import { describe, expect, it } from "vitest";
import { resolveJarvisDomainClarification } from "@/lib/jarvis/domain-clarification";

describe("JARVIS domain-specific clarification", () => {
  it.each([
    ["Warum bewertest du dieses Projekt als kritisch?", "project.health.reference-required"],
    ["Warum ist diese Aufgabe eskaliert?", "task.escalation.reference-required"],
    ["Warum ist diese Planung überbucht?", "planning.overbooking.reference-required"],
    ["Warum ist dieses Angebot wirtschaftlich auffällig?", "offer.health.reference-required"],
    ["Vergleiche Räumen und Streuen mit nur Streuen.", "calculator.winter.variant-comparison"],
    ["Nutze den aktuellen Kraftstoffpreis für die Fahrt.", "calculator.vehicle-trip.fuel-context"],
    ["Erkläre mir die Rechenschritte der Kalkulation.", "calculator.explanation.choice"],
    ["Welche Anliegenart wurde ausgewählt?", "online-requests.request-type.reference-required"],
    ["Welches Gewerk passt zur Anfrage?", "online-requests.trade.reference-required"],
  ])("asks a precise domain question for %s", (question, topicId) => {
    const result = resolveJarvisDomainClarification(question);
    expect(result).toMatchObject({ type: "clarification", topicId });
    expect(result?.choices?.length).toBeGreaterThan(0);
    expect(result?.message).not.toContain("nicht sicher verstehen");
  });
});
