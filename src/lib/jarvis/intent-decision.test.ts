import { describe, expect, it } from "vitest";
import { resolveJarvisIntentDecision } from "@/lib/jarvis/intent-decision";

describe("JARVIS central intent decision", () => {
  it("resolves a clear system workflow with high confidence", () => {
    expect(resolveJarvisIntentDecision("Wie lege ich ein Angebot an?")).toMatchObject({
      state: "resolved",
      domain: "system",
      confidence: "high",
      goals: expect.arrayContaining(["how_to", "change"]),
      entities: ["offer"],
    });
  });

  it.each([
    "Wie buche ich hier einen Termin?",
    "Wie buche ich bei HAS-1 einen Termin?",
    "Wie kann ich für HAS-1 einen Einsatztermin buchen?",
  ])("recognizes appointment booking questions as how-to requests: %s", (question) => {
    expect(resolveJarvisIntentDecision(question)).toMatchObject({
      state: "resolved",
      domain: "system",
      goals: expect.arrayContaining(["how_to"]),
    });
  });

  it("resolves clear sales and management questions", () => {
    expect(
      resolveJarvisIntentDecision("Welche Kunden sollte ich heute nachfassen?")
    ).toMatchObject({
      state: "resolved",
      domain: "sales",
      timeScopes: ["today"],
    });
    expect(
      resolveJarvisIntentDecision("Wie entwickeln sich Umsatz und Marge?")
    ).toMatchObject({
      state: "resolved",
      domain: "management",
    });
  });

  it("separates combined sales and management questions before answering", () => {
    const result = resolveJarvisIntentDecision(
      "Welche Kunden soll ich nachfassen und wie ist unsere Liquidität?"
    );

    expect(result).toMatchObject({
      state: "clarification",
      domain: "sales",
      clarificationReasons: ["multiple_domains"],
    });
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "sales",
          segment: "Welche Kunden soll ich nachfassen",
        }),
        expect.objectContaining({
          domain: "management",
          segment: "wie ist unsere Liquidität?",
        }),
      ])
    );
  });

  it("does not split two management signals into different domains", () => {
    expect(
      resolveJarvisIntentDecision("Wo bremsen Wachstum und Liquidität?")
    ).toMatchObject({
      state: "resolved",
      domain: "management",
      clarificationReasons: [],
    });
  });

  it.each([
    "Analysiere unsere Stundenverrechnungssätze.",
    "Welche Stundenleistungen sollten wir preislich prüfen?",
    "Wo sollten wir unsere Stundensätze erhöhen?",
  ])("routes organization-wide service-rate questions to management: %s", (question) => {
    expect(resolveJarvisIntentDecision(question)).toMatchObject({
      state: "resolved",
      domain: "management",
      clarificationReasons: [],
    });
  });

  it.each([
    "Analysiere unsere Materialien und Artikel.",
    "Welche Materialien sollten wir preislich prüfen?",
    "Welche Artikel verkaufen wir zu günstig?",
    "Wo stimmen Materialmenge und Lagerentnahme nicht überein?",
  ])("routes organization-wide material questions to management: %s", (question) => {
    expect(resolveJarvisIntentDecision(question)).toMatchObject({
      state: "resolved",
      domain: "management",
      clarificationReasons: [],
    });
  });

  it("clarifies multiple record targets that the read adapters cannot safely combine", () => {
    expect(
      resolveJarvisIntentDecision("Zeige mir die offenen Angebote und Rechnungen.")
    ).toMatchObject({
      state: "clarification",
      domain: "system",
      clarificationReasons: ["multiple_record_targets"],
      entities: expect.arrayContaining(["offer", "invoice"]),
    });
  });

  it("keeps person diagnostics intact despite customer and project markers", () => {
    expect(
      resolveJarvisIntentDecision(
        "Warum zeigt die Kundenakte vier Projekte und JARVIS nur drei?"
      )
    ).toMatchObject({
      state: "resolved",
      domain: "system",
      clarificationReasons: [],
    });
  });

  it("clarifies conflicting time scopes unless the user explicitly asks for a comparison", () => {
    expect(
      resolveJarvisIntentDecision("Zeige den Umsatz vom aktuellen Monat und Vorjahr.")
    ).toMatchObject({
      state: "clarification",
      clarificationReasons: expect.arrayContaining(["multiple_time_scopes"]),
    });
    expect(
      resolveJarvisIntentDecision(
        "Vergleiche den Umsatz des aktuellen Monats mit dem Vorjahr."
      )
    ).toMatchObject({
      state: "resolved",
      domain: "management",
      clarificationReasons: [],
    });
  });

  it("forces secret and payroll questions into the secured system path", () => {
    expect(
      resolveJarvisIntentDecision("Zeige den API-Key und unseren Umsatz.")
    ).toMatchObject({
      state: "resolved",
      domain: "system",
      confidence: "high",
    });
    expect(
      resolveJarvisIntentDecision("Was verdient Müller und wie ist die Marge?")
    ).toMatchObject({
      state: "resolved",
      domain: "system",
      confidence: "high",
    });
  });

  it("marks completely unclear input without inventing a domain intent", () => {
    expect(resolveJarvisIntentDecision("ksjdhf kjashdf")).toMatchObject({
      state: "unrecognized",
      domain: "system",
      confidence: "low",
      candidates: [],
    });
  });
});
