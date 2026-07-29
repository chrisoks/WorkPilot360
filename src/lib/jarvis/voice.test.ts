import { describe, expect, it } from "vitest";
import {
  mergeJarvisSpeechTranscript,
  sanitizeJarvisSpeechOutput,
  sanitizeJarvisSpeechTranscript,
} from "./voice";

describe("JARVIS browser voice helpers", () => {
  it("keeps a spoken command editable without changing its meaning", () => {
    expect(
      mergeJarvisSpeechTranscript(
        "",
        "Plane hier nächsten Montag um 8 Uhr einen Termin ein."
      )
    ).toBe("Plane hier nächsten Montag um 8 Uhr einen Termin ein.");
  });

  it("appends a correction to an existing draft instead of replacing it", () => {
    expect(
      mergeJarvisSpeechTranscript(
        "Prüfe HAS-1.",
        "Aber bitte nur die Planung."
      )
    ).toBe("Prüfe HAS-1. Aber bitte nur die Planung.");
  });

  it("removes control characters and bounds browser transcripts", () => {
    const result = sanitizeJarvisSpeechTranscript(`Hallo\u0000   JARVIS ${"x".repeat(5_000)}`);

    expect(result).not.toContain("\u0000");
    expect(result).toMatch(/^Hallo JARVIS x+/);
    expect(result.length).toBeLessThanOrEqual(4_000);
  });

  it("bounds text before handing it to browser speech synthesis", () => {
    expect(sanitizeJarvisSpeechOutput(`Antwort ${"x".repeat(6_000)}`).length).toBe(5_000);
  });
});
