import { describe, expect, it } from "vitest";
import { resolveJarvisDomain } from "@/lib/jarvis/domain-router";

describe("JARVIS domain router", () => {
  it("keeps system how-to questions in system help", () => {
    expect(resolveJarvisDomain("Wie lege ich ein Angebot an?")).toBe("system");
    expect(resolveJarvisDomain("Wie plane ich Mitarbeiter in einem Projekt ein?")).toBe("system");
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
});
