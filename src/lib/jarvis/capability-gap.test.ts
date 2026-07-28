import { describe, expect, it } from "vitest";
import { resolveJarvisCapabilityGap } from "@/lib/jarvis/capability-gap";

describe("resolveJarvisCapabilityGap", () => {
  it.each([
    "Wie viele offene Posten haben wir?",
    "Welche Kunden haben offene Angebote, aber seit 30 Tagen keine Aktivität?",
    "Welche Projekte haben Zeiten, aber noch keine Rechnung?",
  ])("meldet bei fehlendem Organisationsadapter sicher die Grenze: %s", (question) => {
    const result = resolveJarvisCapabilityGap(question);
    expect(result?.topicId).toBe("capability.analysis-adapter-missing");
    expect(result?.message).toContain("noch nicht sicher");
    expect(result?.message).not.toContain("keine passenden");
  });

  it("überlässt explizite Projektfragen dem Projektadapter", () => {
    expect(
      resolveJarvisCapabilityGap(
        "Warum hat HAS-1 trotz Zeiten noch keine Rechnung?"
      )
    ).toBeUndefined();
  });
});
