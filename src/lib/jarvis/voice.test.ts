import { describe, expect, it } from "vitest";
import {
  getJarvisSpeechRecognitionEndMessage,
  getJarvisSpeechRecognitionErrorMessage,
  JARVIS_SPEECH_LISTENING_MESSAGE,
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

  it.each([
    ["not-allowed", "Mikrofonzugriff wurde nicht erlaubt."],
    ["service-not-allowed", "Mikrofonzugriff wurde nicht erlaubt."],
    ["audio-capture", "Es wurde kein verfügbares Mikrofon gefunden."],
    ["no-speech", "Ich habe keine Sprache erkannt. Bitte versuche es erneut."],
    ["aborted", "Die Spracheingabe wurde abgebrochen."],
    ["network", "Die Spracheingabe ist wegen eines Netzwerkfehlers nicht verfügbar."],
    [
      "language-not-supported",
      "Die deutsche Spracheingabe wird von diesem Browser nicht unterstützt.",
    ],
    ["unexpected", "Die Spracheingabe ist gerade nicht verfügbar."],
  ])("maps the recognition error %s to an actionable status", (error, expected) => {
    expect(getJarvisSpeechRecognitionErrorMessage(error)).toBe(expected);
  });

  it("only asks to review a transcript when speech was actually recognized", () => {
    expect(getJarvisSpeechRecognitionEndMessage(true)).toBe(
      "Transkript prüfen und anschließend bewusst senden."
    );
    expect(getJarvisSpeechRecognitionEndMessage(false)).toBe(
      "Ich habe keine Sprache erkannt. Bitte versuche es erneut."
    );
    expect(JARVIS_SPEECH_LISTENING_MESSAGE).toContain("Loslassen");
  });
});
