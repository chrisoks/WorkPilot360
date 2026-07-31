import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateOfferPdf, evaluateOfferDraft } = vi.hoisted(() => ({
  generateOfferPdf: vi.fn(),
  evaluateOfferDraft: vi.fn(),
}));

vi.mock("@/app/api/offers/route", () => ({ generateOfferPdf }));
vi.mock("@/lib/offers/offer-draft-service", () => ({
  evaluateOfferDraft,
  OfferDraftServiceError: class OfferDraftServiceError extends Error {},
}));

import {
  evaluateOfferFinalization,
  finalizeOfferDraft,
  getOfferFinalizationConfirmationText,
  matchesOfferFinalizationConfirmation,
  OfferFinalizationServiceError,
} from "@/lib/offers/offer-finalization-service";

function offer(status = "Entwurf") {
  return {
    id: "offer-1",
    organizationId: "org-1",
    projectId: "project-1",
    projectNumber: "GLR-449",
    projectTitle: "Glasreinigung",
    company: "OK solutions",
    offerType: "base",
    addendumMode: "addition",
    plannedExecutionEndMonth: "",
    parentOfferId: "",
    offerNumber: "ANG-10124",
    status,
    customerName: "Musterkunde",
    customerStreet: "Testweg 1",
    customerCity: "12345 Teststadt",
    contactName: "Frau Test",
    internalContactName: "GF Test",
    internalPhone: "",
    internalEmail: "",
    plannedExecutionMonth: "2026-11",
    introText: "Einleitung",
    closingText: "Abschluss",
    netTotal: 100,
    vatRate: 19,
    grossTotal: 119,
    discountPercent: 0,
    lostReason: "",
    lostNote: "",
    lostAt: null,
    wonAt: null,
    wonByName: "",
    wonReason: "",
    pdfData: null,
    createdAt: new Date("2026-07-31T10:00:00.000Z"),
    updatedAt: new Date("2026-07-31T10:00:00.000Z"),
    lines: [{
      id: "line-1", organizationId: "org-1", offerId: "offer-1",
      catalogItemId: "catalog-1", catalogType: "service", position: 1,
      quantity: 2, unit: "Std", title: "Glasreinigung", description: "",
      unitPrice: 50, discountPercent: 0, isLaborPosition: true,
      laborCostRateKey: "", laborCostRate: 0, vatRate: 19, totalNet: 100,
      createdAt: new Date("2026-07-31T10:00:00.000Z"),
      updatedAt: new Date("2026-07-31T10:00:00.000Z"),
    }],
  };
}

function evaluatedDraft() {
  return {
    input: {
      projectId: "project-1", company: "OK solutions", offerType: "base",
      addendumMode: "addition", parentOfferId: "", plannedExecutionMonth: "2026-11",
      plannedExecutionEndMonth: "", introText: "Einleitung", closingText: "Abschluss",
      vatRate: 19, discountPercent: 0, lines: [],
    },
    project: { id: "project-1", updatedAt: "2026-07-31T10:00:00.000Z" },
    parentOffer: null,
    catalogVersions: [{ id: "catalog-1", updatedAt: "2026-07-31T10:00:00.000Z" }],
    totals: { lineNetBeforeOfferDiscount: 100, offerDiscountAmount: 0, netTotal: 100, vatRate: 19, vatAmount: 19, grossTotal: 119 },
    missingFields: [], errors: [], warnings: [],
  };
}

describe("offer finalization service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateOfferDraft.mockResolvedValue(evaluatedDraft());
    generateOfferPdf.mockResolvedValue({ pdfData: "cGRm", netTotal: 100, vatRate: 19, grossTotal: 119, pageCount: 1 });
  });

  it("requires the exact offer-specific critical phrase", () => {
    expect(getOfferFinalizationConfirmationText("ANG-10124")).toBe("ANGEBOT FINALISIEREN ANG-10124");
    expect(matchesOfferFinalizationConfirmation("ANG-10124", "ANGEBOT FINALISIEREN ANG-10124")).toBe(true);
    expect(matchesOfferFinalizationConfirmation("ANG-10124", "Angebot finalisieren ANG-10124")).toBe(false);
  });

  it("evaluates a consistent draft and fingerprints its frozen context", async () => {
    const db = { offer: { findFirst: vi.fn().mockResolvedValue(offer()) } } as never;
    const result = await evaluateOfferFinalization({ organizationId: "org-1", offerId: "offer-1", db });
    expect(result.blockingIssues).toEqual([]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.offer).toMatchObject({ offerNumber: "ANG-10124", lineCount: 1, grossTotal: 119 });
  });

  it("blocks non-drafts without changing them", async () => {
    const db = { offer: { findFirst: vi.fn().mockResolvedValue(offer("Erstellt")) } } as never;
    await expect(evaluateOfferFinalization({ organizationId: "org-1", offerId: "offer-1", db })).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("finalizes once, creates the PDF and records only the finalization history", async () => {
    const source = offer();
    const finalized = { ...source, status: "Erstellt", pdfData: "cGRm" };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      offer: {
        findFirst: vi.fn().mockResolvedValue(source),
        findFirstOrThrow: vi.fn().mockResolvedValue(source),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(finalized),
      },
      offerHistory: { create: vi.fn().mockResolvedValue({ id: "history-1" }) },
    } as any;
    const preview = await evaluateOfferFinalization({ organizationId: "org-1", offerId: "offer-1", db: tx });
    const result = await finalizeOfferDraft({
      tx,
      organizationId: "org-1",
      offerId: "offer-1",
      actorName: "GF Test",
      expectedFingerprint: preview.fingerprint,
      source: "jarvis",
    });
    expect(result.status).toBe("Erstellt");
    expect(generateOfferPdf).toHaveBeenCalledTimes(1);
    expect(tx.offer.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "Entwurf" }),
      data: expect.objectContaining({ status: "Erstellt", pdfData: "cGRm" }),
    }));
    expect(tx.offerHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "finalized" }),
    }));
  });

  it("rejects a changed draft fingerprint", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      offer: { findFirst: vi.fn().mockResolvedValue(offer()) },
    } as any;
    await expect(finalizeOfferDraft({
      tx, organizationId: "org-1", offerId: "offer-1", actorName: "GF Test",
      expectedFingerprint: "changed", source: "jarvis",
    })).rejects.toBeInstanceOf(OfferFinalizationServiceError);
    expect(generateOfferPdf).not.toHaveBeenCalled();
  });
});
