import { describe, expect, it } from "vitest";
import {
  extractOfferDraftKind,
  extractOfferExecutionMonth,
  extractOfferNumber,
  looksLikeOfferDraftRequest,
  looksLikeOfferDeliveryRequest,
  looksLikeOfferDecisionRequest,
  extractOfferDecision,
  looksLikeOfferFinalizationRequest,
  looksLikeOfferLifecycleRequest,
  extractOfferLifecycle,
} from "@/lib/jarvis/offer-intake";

describe("JARVIS offer intake", () => {
  it("recognizes creation but not offer reads or sending", () => {
    expect(looksLikeOfferDraftRequest("Erstelle ein Angebot für Projekt GLR-449")).toBe(true);
    expect(looksLikeOfferDraftRequest("Kannst du das Angebot für mich schreiben?")).toBe(true);
    expect(looksLikeOfferDraftRequest("JARVIS, schreib mir ein Angebot.")).toBe(true);
    expect(looksLikeOfferDraftRequest("Hey Jarvis, bitte erstelle einen Nachtrag.")).toBe(true);
    expect(looksLikeOfferDraftRequest("Ich möchte ein Angebot für den Kunden anlegen.")).toBe(true);
    expect(looksLikeOfferDraftRequest("Wie schreibe ich ein Angebot?")).toBe(false);
    expect(looksLikeOfferDraftRequest("Zeig mir offene Angebote")).toBe(false);
    expect(looksLikeOfferDraftRequest("Versende das Angebot")).toBe(false);
  });

  it("recognizes and extracts controlled offer decisions", () => {
    const question = "Markiere Angebot ANG-10124 als verloren. Grund: Preis. Kommentar: Kunde hat abgesagt.";
    expect(looksLikeOfferDecisionRequest(question)).toBe(true);
    expect(extractOfferDecision(question)).toEqual({
      decision: "lost",
      reason: "Preis",
      note: "Kunde hat abgesagt",
    });
    expect(extractOfferDecision("Markiere Angebot ANG-10124 als gewonnen. Grund: Schriftliche Kundenzusage.")).toEqual({
      decision: "won",
      reason: "Schriftliche Kundenzusage",
      note: undefined,
    });
    expect(looksLikeOfferDecisionRequest("Zeig mir verlorene Angebote")).toBe(false);
  });

  it("recognizes isolated controlled offer delivery", () => {
    expect(looksLikeOfferDeliveryRequest("Sende Angebot ANG-10124")).toBe(true);
    expect(looksLikeOfferDeliveryRequest("Versende das Angebots-PDF ANG-10124")).toBe(true);
    expect(looksLikeOfferDeliveryRequest("Finalisiere und versende Angebot ANG-10124")).toBe(false);
    expect(looksLikeOfferDeliveryRequest("Markiere Angebot ANG-10124 als gewonnen")).toBe(false);
  });

  it("recognizes controlled deletion and restoration with a reason", () => {
    expect(looksLikeOfferLifecycleRequest("Lösche Angebot ANG-10124. Grund: Doppelt angelegt.")).toBe(true);
    expect(extractOfferLifecycle("Lösche Angebot ANG-10124. Grund: Doppelt angelegt.")).toEqual({
      action: "delete",
      reason: "Doppelt angelegt",
    });
    expect(extractOfferLifecycle("Stelle Angebot ANG-10124 wieder her. Grund: Irrtümlich gelöscht.")).toEqual({
      action: "restore",
      reason: "Irrtümlich gelöscht",
    });
    expect(looksLikeOfferLifecycleRequest("Zeig mir gelöschte Angebote")).toBe(false);
    expect(looksLikeOfferLifecycleRequest("Lösche die Aufgabe Kunden wegen Angebot anrufen.")).toBe(false);
    expect(looksLikeOfferLifecycleRequest("Lösche Angebot ANG-10124. Grund: Sichtbarer Listen-Test.")).toBe(true);
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
