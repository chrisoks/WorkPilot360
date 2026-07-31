import { describe, expect, it } from "vitest";
import {
  extractOfferDraftKind,
  extractOfferExecutionMonth,
  extractOfferNumber,
  looksLikeOfferDraftRequest,
  looksLikeOfferFinalizationRequest,
} from "@/lib/jarvis/offer-intake";

describe("JARVIS offer intake", () => {
  it("recognizes creation but not offer reads or sending", () => {
    expect(looksLikeOfferDraftRequest("Erstelle ein Angebot für Projekt GLR-449")).toBe(true);
    expect(looksLikeOfferDraftRequest("Zeig mir offene Angebote")).toBe(false);
    expect(looksLikeOfferDraftRequest("Versende das Angebot")).toBe(false);
  });

  it("recognizes isolated finalization and excludes combined follow-up actions", () => {
    expect(looksLikeOfferFinalizationRequest("Finalisiere Angebot ANG-10124")).toBe(true);
    expect(looksLikeOfferFinalizationRequest("Finalisiere und versende Angebot ANG-10124")).toBe(false);
    expect(looksLikeOfferFinalizationRequest("Markiere Angebot ANG-10124 als gewonnen")).toBe(false);
    expect(extractOfferNumber("Bitte ANG-10124 finalisieren")).toBe("ANG-10124");
  });

  it("extracts ISO, numeric and German execution months", () => {
    const now = new Date("2026-07-31T08:00:00.000Z");
    expect(extractOfferExecutionMonth("Ausführung 2026-11", now)).toBe("2026-11");
    expect(extractOfferExecutionMonth("Ausführung 3/2027", now)).toBe("2027-03");
    expect(extractOfferExecutionMonth("Ausführung im Dezember 2026", now)).toBe("2026-12");
  });

  it("distinguishes offer, addendum and company", () => {
    expect(extractOfferDraftKind("Erstelle einen Nachtrag für OK immocare")).toEqual({
      offerType: "addendum",
      company: "OK immocare",
    });
  });
});
