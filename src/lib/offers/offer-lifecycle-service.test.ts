import { describe, expect, it, vi } from "vitest";
import {
  evaluateOfferLifecycle,
  executeOfferLifecycle,
  getOfferLifecycleConfirmationText,
  matchesOfferLifecycleConfirmation,
} from "@/lib/offers/offer-lifecycle-service";

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-1", offerNumber: "ANG-10124", status: "Erstellt", projectId: "project-1",
    projectNumber: "GLR-449", projectTitle: "Glasreinigung", customerName: "Musterkunde",
    netTotal: 100, grossTotal: 119, lostAt: null, wonAt: null, pdfData: "pdf",
    updatedAt: new Date("2026-07-31T20:00:00.000Z"), ...overrides,
  };
}

function dbFor(source = offer(), options: { invoices?: unknown[]; acceptances?: unknown[]; deletion?: unknown } = {}) {
  return {
    offer: { findFirst: vi.fn().mockResolvedValue(source) },
    invoice: { findMany: vi.fn().mockResolvedValue(options.invoices || []) },
    offerAcceptanceRequest: { findMany: vi.fn().mockResolvedValue(options.acceptances || []) },
    offerHistory: { findFirst: vi.fn().mockResolvedValue(options.deletion || null) },
  } as never;
}

describe("offer lifecycle service", () => {
  it("requires exact action-specific confirmation phrases", () => {
    expect(getOfferLifecycleConfirmationText("ANG-10124", "delete")).toBe("ANGEBOT LÖSCHEN ANG-10124");
    expect(getOfferLifecycleConfirmationText("ANG-10124", "restore")).toBe("ANGEBOT WIEDERHERSTELLEN ANG-10124");
    expect(matchesOfferLifecycleConfirmation("ANG-10124", "delete", "ANGEBOT LÖSCHEN ANG-10124")).toBe(true);
    expect(matchesOfferLifecycleConfirmation("ANG-10124", "restore", "Angebot wiederherstellen ANG-10124")).toBe(false);
  });

  it("prepares a reversible soft-delete and warns about revoked acceptance links", async () => {
    const result = await evaluateOfferLifecycle({
      organizationId: "org-1", offerId: "offer-1", action: "delete", reason: "Doppelt angelegt",
      db: dbFor(offer(), { acceptances: [{ id: "a-1", status: "sent", acceptedAt: null, updatedAt: new Date() }] }),
    });
    expect(result.blockingIssues).toEqual([]);
    expect(result.acceptanceLinksToRevoke).toBe(1);
    expect(result.warnings.join(" ")).toContain("nicht physisch entfernt");
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks deleting an offer linked to an active invoice or accepted digitally", async () => {
    const result = await evaluateOfferLifecycle({
      organizationId: "org-1", offerId: "offer-1", action: "delete", reason: "Fehlerhaft",
      db: dbFor(offer(), {
        invoices: [{ id: "i-1", invoiceNumber: "RE-1", status: "Fakturiert", updatedAt: new Date() }],
        acceptances: [{ id: "a-1", status: "accepted", acceptedAt: new Date(), updatedAt: new Date() }],
      }),
    });
    expect(result.blockingIssues.join(" ")).toContain("RE-1");
    expect(result.blockingIssues.join(" ")).toContain("digital angenommen");
  });

  it("restores the status frozen in the latest deletion history", async () => {
    const result = await evaluateOfferLifecycle({
      organizationId: "org-1", offerId: "offer-1", action: "restore", reason: "Irrtümlich gelöscht",
      db: dbFor(offer({ status: "Gelöscht" }), {
        deletion: { id: "h-1", note: "ANG-10124 gelöscht. Vorheriger Status: Verloren.", createdAt: new Date() },
      }),
    });
    expect(result.previousStatus).toBe("Verloren");
    expect(result.blockingIssues).toEqual([]);
  });

  it("executes once and writes history plus project logbook", async () => {
    const source = offer();
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      offer: { findFirst: vi.fn().mockResolvedValue(source), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findFirstOrThrow: vi.fn().mockResolvedValue({ ...source, status: "Gelöscht" }) },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      offerAcceptanceRequest: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      offerHistory: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "h-1" }) },
      projectLogbookEntry: { create: vi.fn().mockResolvedValue({ id: "l-1" }) },
    } as any;
    const preview = await evaluateOfferLifecycle({ organizationId: "org-1", offerId: "offer-1", action: "delete", reason: "Doppelt", db: tx });
    await executeOfferLifecycle({
      tx, organizationId: "org-1", offerId: "offer-1", action: "delete", reason: "Doppelt",
      actorId: "user-1", actorName: "GF Test", expectedFingerprint: preview.fingerprint, source: "jarvis",
    });
    expect(tx.offer.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.offerAcceptanceRequest.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", offerId: "offer-1", revokedAt: null, acceptedAt: null },
      data: { status: "revoked", revokedAt: expect.any(Date) },
    });
    expect(tx.offerHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.projectLogbookEntry.create).toHaveBeenCalledTimes(1);
  });
});
