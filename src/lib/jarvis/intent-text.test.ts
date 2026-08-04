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
    ["kome", "komme"],
    ["projecktnummer", "projektnummer"],
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

  it.each(["projekten", "projektes", "termine", "terminen"])(
    "keeps regular German inflections intact: %s",
    (value) => {
      expect(correctJarvisIntentToken(value)).toBe(value);
    }
  );

  it("normalizes a typo without changing the project number", () => {
    expect(normalizeJarvisIntentText("Was ist HAS-1 für ein Proejkt?")).toBe(
      "was ist has-1 fur ein projekt"
    );
  });

  it("does not rewrite the known term Projektdaten as Projektarten", () => {
    expect(normalizeJarvisIntentText("Projektdaten ändern")).toBe(
      "projektdaten andern"
    );
  });

  it.each([
    ["Wie siehts bei den Angeboten aus?", "wie sieht es bei den angeboten aus"],
    ["Wie sieht's bei den Rechnungen aus?", "wie sieht es bei den rechnungen aus"],
    ["Wie läufts im Unternehmen?", "wie lauft es im unternehmen"],
    ["Was gibts heute zu tun?", "was gibt es heute zu tun"],
    ["Wo klemmts bei den Projekten?", "wo klemmt es bei den projekten"],
    ["Wie schauts ggü. Vorjahr aus?", "wie schaut es gegenuber vorjahr aus"],
    ["Zeig ma die offenen Angebote", "zeige mal die offenen angebote"],
    ["Welche Kunden solln wir angehen?", "welche kunden sollen wir angehen"],
    ["Ham wir noch offene Rechnungen?", "haben wir noch offene rechnungen"],
    ["Hey JARVIS, wie siehts aus?", "wie sieht es aus"],
    ["Sag mal Jarvis, was gibts Neues?", "was gibt es neues"],
    ["Wie isses bei den Projekten?", "wie ist es bei den projekten"],
  ])("normalizes colloquial wording without changing its meaning: %s", (input, expected) => {
    expect(normalizeJarvisIntentText(input)).toBe(expected);
  });
});
