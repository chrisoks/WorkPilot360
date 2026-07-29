import { describe, expect, it } from "vitest";
import { resolveJarvisCapabilityGap } from "@/lib/jarvis/capability-gap";

describe("resolveJarvisCapabilityGap", () => {
  it.each([
    "Wie viele Rechnungsentwürfe gibt es aktuell?",
    "Welche Angebote sind seit mehr als 30 Tagen offen?",
    "Wie stark sind unsere Mitarbeiter aktuell ausgelastet?",
    "Welche Planungsgruppe ist nächste Woche überlastet?",
    "Welche Mitarbeiter haben im August zu wenig Arbeit?",
    "Welche Kunden haben offene Angebote, aber seit 30 Tagen keine Aktivität?",
    "Welche Projekte haben Zeiten, aber noch keine Rechnung?",
    "Welche Projekte laufen ohne gültiges Angebot?",
  ])("meldet bei fehlendem Organisationsadapter sicher die Grenze: %s", (question) => {
    const result = resolveJarvisCapabilityGap(question);
    expect(result?.topicId).toBe("capability.analysis-adapter-missing");
    expect(result?.message).toContain("noch nicht sicher");
    expect(result?.message).not.toContain("keine passenden");
  });

  it.each([
    "Wie viele offene Posten haben wir?",
    "Wie hoch sind unsere offenen Posten?",
    "Wie hoch sint unser offnen Posten?",
  ])("meldet für den angebundenen Offene-Posten-Adapter keine Lücke: %s", (question) => {
    expect(resolveJarvisCapabilityGap(question)).toBeUndefined();
  });

  it("überlässt explizite Projektfragen dem Projektadapter", () => {
    expect(
      resolveJarvisCapabilityGap(
        "Warum hat HAS-1 trotz Zeiten noch keine Rechnung?"
      )
    ).toBeUndefined();
  });
});
