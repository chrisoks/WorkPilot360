import { describe, expect, it } from "vitest";
import {
  extractOnlineRequestConversionReference,
  looksLikeOnlineRequestConversionRequest,
} from "@/lib/jarvis/online-request-conversion-intake";

describe("JARVIS online request conversion intake", () => {
  it.each([
    "Wandle OKI-20260802-A1B2C3 in ein Projekt um.",
    "Übernimm OKI-20260802-A1B2C3 kontrolliert als Projekt.",
    "Konvertiere OKI-20260802-A1B2C3.",
  ])("recognizes an explicit conversion command: %s", (question) => {
    expect(looksLikeOnlineRequestConversionRequest(question)).toBe(true);
  });

  it.each([
    "Ist OKI-20260802-A1B2C3 zur Übernahme bereit?",
    "Welche Voraussetzungen fehlen bei OKI-20260802-A1B2C3?",
    "Zeige OKI-20260802-A1B2C3.",
  ])("keeps read-only questions out of the action path: %s", (question) => {
    expect(looksLikeOnlineRequestConversionRequest(question)).toBe(false);
  });

  it("extracts and normalizes the exact reference", () => {
    expect(
      extractOnlineRequestConversionReference(
        "wandle oki-20260802-a1b2c3 bitte um"
      )
    ).toBe("OKI-20260802-A1B2C3");
  });
});
