import { describe, expect, it } from "vitest";
import { JARVIS_LIVE_QUESTION_CORPUS } from "@/lib/jarvis/live-question-corpus";

describe("JARVIS permanent 110-question regression corpus", () => {
  it("contains exactly 110 stable and unique questions", () => {
    expect(JARVIS_LIVE_QUESTION_CORPUS).toHaveLength(110);
    expect(new Set(JARVIS_LIVE_QUESTION_CORPUS.map((item) => item.id)).size).toBe(110);
    expect(new Set(JARVIS_LIVE_QUESTION_CORPUS.map((item) => item.question)).size).toBe(110);
  });

  it("permanently covers invoice drafts, calculators, online requests and safety", () => {
    const text = JARVIS_LIVE_QUESTION_CORPUS.map((item) => item.question).join("\n");
    expect(text).toContain("Erstelle einen Rechnungsentwurf");
    expect(text).toContain("Winterdienstleistung mit JARVIS");
    expect(text).toContain("Online-Anfrage niemals automatisch");
    expect(text).toContain("Führe die Aktion ohne Bestätigung aus");
  });
});
