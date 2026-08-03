import { describe, expect, it, vi } from "vitest";
import {
  evaluateOfferDecision,
  executeOfferDecision,
  getOfferDecisionConfirmationText,
  matchesOfferDecisionConfirmation,
} from "@/lib/offers/offer-decision-service";

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-1",
    offerNumber: "ANG-10124",
    status: "Erstellt",
    projectId: "project-1",
    projectNumber: "GLR-449",
    projectTitle: "Glasreinigung",
    customerName: "Musterkunde",
    netTotal: 100,
    grossTotal: 119,
    lostAt: null,
    wonAt: null,
    updatedAt: new Date("2026-07-31T20:00:00.000Z"),
    ...overrides,
  };
}

function dbFor(source = offer(), linkedInvoices: unknown[] = []) {
  return {
    offer: { findFirst: vi.fn().mockResolvedValue(source) },
    invoice: { findMany: vi.fn().mockResolvedValue(linkedInvoices) },
  } as never;
}

describe("offer decision service", () => {
  it("requires an exact offer- and decision-specific phrase", () => {
    expect(getOfferDecisionConfirmationText("ANG-10124", "won")).toBe("ANGEBOT GEWINNEN ANG-10124");
    expect(getOfferDecisionConfirmationText("ANG-10124", "lost")).toBe("ANGEBOT VERLIEREN ANG-10124");
    expect(matchesOfferDecisionConfirmation("ANG-10124", "won", "ANGEBOT GEWINNEN ANG-10124")).toBe(true);
    expect(matchesOfferDecisionConfirmation("ANG-10124", "lost", "Angebot verlieren ANG-10124")).toBe(false);
  });

  it("prepares a won decision with a frozen context and explicit side effects", async () => {
    const result = await evaluateOfferDecision({
      organizationId: "org-1",
      offerId: "offer-1",
      decision: "won",
      reason: "Schriftliche Zusage des Kunden",
      db: dbFor(),
    });
    expect(result.blockingIssues).toEqual([]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checks.find((check) => check.key === "side-effects")?.detail).toContain("Projektstatus");
  });

  it("requires reason and comment for a lost decision", async () => {
    const result = await evaluateOfferDecision({
      organizationId: "org-1",
      offerId: "offer-1",
      decision: "lost",
      db: dbFor(),
    });
    expect(result.blockingIssues).toEqual(expect.arrayContaining([
      expect.stringContaining("Grund"),
      expect.stringContaining("Kommentar"),
    ]));
  });

  it("blocks losing an offer that already has an active invoice", async () => {
    const result = await evaluateOfferDecision({
      organizationId: "org-1",
      offerId: "offer-1",
      decision: "lost",
      reason: "Preis",
      note: "Kunde hat abgesagt",
      db: dbFor(offer(), [{ id: "invoice-1", invoiceNumber: "RE-1", status: "Erstellt", updatedAt: new Date() }]),
    });
    expect(result.blockingIssues.join(" ")).toContain("RE-1");
  });

  it("executes once and writes offer history plus project logbook", async () => {
    const source = offer();
    const decided = { ...source, wonAt: new Date() };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      offer: {
        findFirst: vi.fn().mockResolvedValue(source),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(decided),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      offerHistory: { create: vi.fn().mockResolvedValue({ id: "history-1" }) },
      projectLogbookEntry: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    } as any;
    const preview = await evaluateOfferDecision({
      organizationId: "org-1", offerId: "offer-1", decision: "won",
      reason: "Kundenzusage", db: tx,
    });
    const result = await executeOfferDecision({
      tx, organizationId: "org-1", offerId: "offer-1", decision: "won",
      reason: "Kundenzusage", actorId: "user-1", actorName: "GF Test",
      expectedFingerprint: preview.fingerprint, source: "jarvis",
    });
    expect(result.id).toBe("offer-1");
    expect(tx.offer.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.offerHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.projectLogbookEntry.create).toHaveBeenCalledTimes(1);
  });

  it("revokes every still-active acceptance link when an offer is lost", async () => {
    const source = offer();
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      offer: {
        findFirst: vi.fn().mockResolvedValue(source),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue({ ...source, status: "Verloren", lostAt: new Date() }),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      offerAcceptanceRequest: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      offerHistory: { create: vi.fn().mockResolvedValue({ id: "history-1" }) },
      projectLogbookEntry: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    } as any;
    await executeOfferDecision({
      tx, organizationId: "org-1", offerId: "offer-1", decision: "lost",
      reason: "Preis", note: "Kunde hat abgesagt", actorId: "user-1", actorName: "GF Test", source: "jarvis",
    });
    expect(tx.offerAcceptanceRequest.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", offerId: "offer-1", acceptedAt: null, revokedAt: null },
      data: { status: "revoked", revokedAt: expect.any(Date) },
    });
  });
});
