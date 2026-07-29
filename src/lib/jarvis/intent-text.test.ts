import { describe, expect, it } from "vitest";
import {
  correctJarvisIntentToken,
  normalizeJarvisIntentText,
} from "@/lib/jarvis/intent-text";

describe("JARVIS intent text tolerance", () => {
  it.each([
    ["proejkt", "projekt"],
    ["abrechnugn", "abrechnung"],
    ["stempellungen", "stempelungen"],
    ["monatsauschale", "monatspauschale"],
    ["stundenabrechnng", "stundenabrechnung"],
    ["sollprozes", "sollprozess"],
    ["termn", "termin"],
  ])("corrects the known intent typo %s", (input, expected) => {
    expect(correctJarvisIntentToken(input)).toBe(expected);
  });

  it.each([
    "has-1",
    "mkg-209",
    "8240501",
    "klaus",
    "testmann",
    "christian.eid@ok-solutions.com",
  ])("does not rewrite identifiers or ordinary record values: %s", (value) => {
    expect(correctJarvisIntentToken(value)).toBe(value);
  });

  it("does not force an uncertain short-word correction", () => {
    expect(correctJarvisIntentToken("lokgi")).toBe("lokgi");
  });

  it("normalizes a typo without changing the project number", () => {
    expect(normalizeJarvisIntentText("Was ist HAS-1 für ein Proejkt?")).toBe(
      "was ist has-1 fur ein projekt"
    );
  });
});
