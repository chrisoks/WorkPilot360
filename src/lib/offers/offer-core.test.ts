import { describe, expect, it } from "vitest";
import {
  calculateOfferDraftTotals,
  calculateOfferLineNet,
  normalizeOfferMonth,
  normalizeOfferUnit,
  validateOfferDraft,
} from "@/lib/offers/offer-core";

describe("offer core", () => {
  it("calculates line, offer discount, VAT and gross total deterministically", () => {
    const first = calculateOfferLineNet({
      quantity: 2,
      unitPrice: 100,
      discountPercent: 10,
    });
    const totals = calculateOfferDraftTotals(
      [{ totalNet: first }, { totalNet: 50 }],
      5,
      19
    );
    expect(first).toBe(180);
    expect(totals).toEqual({
      lineNetBeforeOfferDiscount: 230,
      offerDiscountAmount: 11.5,
      netTotal: 218.5,
      vatRate: 19,
      vatAmount: 41.52,
      grossTotal: 260.02,
    });
  });

  it("normalizes only real calendar months and known unit aliases", () => {
    expect(normalizeOfferMonth("2026-08")).toBe("2026-08");
    expect(normalizeOfferMonth("2026-13")).toBe("");
    expect(normalizeOfferUnit("Stunden")).toBe("Std");
    expect(normalizeOfferUnit("m²")).toBe("m²");
  });

  it("requires the parent offer for addenda and the end month for recurring work", () => {
    expect(
      validateOfferDraft({
        projectId: "project-1",
        offerType: "addendum",
        parentOfferId: "",
        plannedExecutionMonth: "2026-08",
        plannedExecutionEndMonth: "",
        requiresExecutionEndMonth: true,
        lines: [],
      }).missingFields
    ).toEqual([
      "Endmonat des Ausführungszeitraums",
      "Bezugsangebot für den Nachtrag",
      "Mindestens eine Position",
    ]);
  });
});
