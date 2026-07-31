import { describe, expect, it } from "vitest";
import { resolveJarvisDomain } from "@/lib/jarvis/domain-router";

describe("JARVIS domain router", () => {
  it("keeps system how-to questions in system help", () => {
    expect(resolveJarvisDomain("Wie lege ich ein Angebot an?")).toBe("system");
    expect(resolveJarvisDomain("Wie plane ich Mitarbeiter in einem Projekt ein?")).toBe("system");
    expect(resolveJarvisDomain("Wo finde ich Zusatzverkäufe?")).toBe("system");
    expect(resolveJarvisDomain("Wo ist das Planungsboard?")).toBe("system");
    expect(resolveJarvisDomain("Wo liegen die Firmeneinstellungen?")).toBe("system");
    expect(resolveJarvisDomain("Was ist der Unterschied zwischen Termin und Terminwunsch?")).toBe("system");
    expect(resolveJarvisDomain("Wie prüfe ich, ob Zeiten fakturierbar sind?")).toBe("system");
    expect(resolveJarvisDomain("Wie erstelle ich einen Logbucheintrag im Projekt?")).toBe("system");
  });

  it("routes sales and management analysis without visible modes", () => {
    expect(resolveJarvisDomain("Welche Kunden soll ich heute aktiv angehen?")).toBe("sales");
    expect(resolveJarvisDomain("Wo liegen unsere größten Nachfassbremsen?")).toBe("sales");
    expect(resolveJarvisDomain("Wo bremsen Wachstum und Liquidität?")).toBe("management");
    expect(resolveJarvisDomain("Wie ist unsere aktuelle Kapazität?")).toBe("management");
    expect(resolveJarvisDomain("Wie entwickelt sich unser Umsatz?")).toBe("management");
  });

  it("keeps person and customer questions in the deterministic system path", () => {
    expect(resolveJarvisDomain("Sag mir alles über Klaus Testmann")).toBe("system");
    expect(resolveJarvisDomain("Welche Projekte hat Klaus Testmann?")).toBe("system");
  });

  it.each([
    "Starte eine Kalkulation.",
    "Kalkuliere Winterdienst: 1250 qm, 5 Saisonmonate, 18 Einsätze, Stundensatz 68 Euro pro Stunde.",
    "Was kostet die Fahrt mit dem Crafter über 180 Kilometer?",
    "Berechne mir einen Mietpreis für die Fahrzeugvermietung.",
  ])("keeps calculator requests on the secure system route: %s", (question) => {
    expect(resolveJarvisDomain(question)).toBe("system");
  });

  it.each([
    "Welche Prinzipien leiten dich?",
    "Wie helfen dir deine Prinzipien bei Entscheidungen im Alltag?",
    "Welchen Auftrag hast du gegenüber den Menschen im Unternehmen?",
    "Wie verbindest du Automatisierung mit menschlicher Verantwortung?",
    "Wie förderst du Stärken von Mitarbeitenden?",
    "Wie gehst du mit Schwächen von Mitarbeitenden um?",
    "Wie berichtest du Entwicklungsfelder an die Geschäftsleitung?",
    "Wie vermeidest du Überwachung bei Mitarbeiterentwicklung?",
    "Welche Rolle spielt Kontinuität für dich?",
  ])("keeps JARVIS governance and people-development questions in system help: %s", (question) => {
    expect(resolveJarvisDomain(question)).toBe("system");
  });
});
