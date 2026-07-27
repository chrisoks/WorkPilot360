import { describe, expect, it } from "vitest";
import { resolveJarvisProjectDialogIntent } from "@/lib/jarvis/project-dialog-intent";

describe("JARVIS project dialog intent", () => {
  it.each([
    ["Was ist HAS-1 für ein Projekt?", "explainProjectType"],
    ["Welche Projektart hat HAS-1?", "explainProjectType"],
    [
      "Erkläre Projektart, Abrechnung und Sollprozess für HAS-1.",
      "explainProjectType",
    ],
    ["Wie wird HAS-1 abgerechnet?", "explainBilling"],
    ["Welches Abrechnungsmodell hat HAS-1?", "explainBilling"],
    ["Welche Logik gilt bei HAS-1?", "explainProcess"],
    ["Wie läuft HAS-1 von der Planung bis zur Rechnung?", "explainProcess"],
    ["Was unterscheidet HAS-1 von einem Einmalprojekt?", "explainProcess"],
    ["Was ist mit HAS-1?", "ambiguousProjectQuestion"],
  ])("resolves %s as %s", (question, expected) => {
    expect(
      resolveJarvisProjectDialogIntent({
        question,
        hasProjectContext: true,
      })
    ).toBe(expected);
  });

  it.each([
    "Prüfe HAS-1 vollständig.",
    "Prüfe Planung und Termine für HAS-1.",
    "Analysiere die Stempelungen von HAS-1.",
  ])("leaves diagnostic commands to the health router: %s", (question) => {
    expect(
      resolveJarvisProjectDialogIntent({
        question,
        hasProjectContext: true,
      })
    ).toBeUndefined();
  });

  it("does not claim a generic question without a project context", () => {
    expect(
      resolveJarvisProjectDialogIntent({
        question: "Wie wird ein Projekt abgerechnet?",
        hasProjectContext: false,
      })
    ).toBeUndefined();
  });
});
