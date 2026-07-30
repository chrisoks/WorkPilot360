import { describe, expect, it } from "vitest";
import { resolveJarvisProjectDialogIntent } from "@/lib/jarvis/project-dialog-intent";

describe("JARVIS project dialog intent", () => {
  it.each([
    ["Was ist HAS-1 für ein Projekt?", "explainProjectType"],
    ["Wie lautet die Projektnummer hier?", "explainIdentity"],
    ["Welcher Kunde gehört zu diesem Projekt?", "explainCustomer"],
    ["Wer ist der Kunde dieses Projekts?", "explainCustomer"],
    ["Wie heißt der Kunde dieses Projekts?", "explainCustomer"],
    ["Welche Objektadresse ist mit dem Projekt verknüpft?", "explainAddress"],
    ["Welches Gewerk hat dieses Projekt?", "explainTrade"],
    ["Welche Niederlassung ist zugeordnet?", "explainBranch"],
    ["Welche Niederlassung hat dieses Projekt?", "explainBranch"],
    ["Welches Projektvolumen ist hinterlegt?", "explainVolume"],
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
    ["Was isn HAS-1 eigentlich fürn Projekt?", "explainProjectType"],
    ["Welchen Status hat HAS-1?", "explainStatus"],
    ["Wie ist der Planungsstand dieses Projekts?", "explainPlanning"],
    ["Was ist aktuell das größte Risiko bei diesem Projekt?", "explainRisk"],
    ["Wer ist bei HAS-1 verantwortlich?", "explainResponsibility"],
    ["Wer kümmert sich um das Projekt?", "explainResponsibility"],
    ["Ist HAS-1 fachlich freigegeben?", "explainReviewStatus"],
    ["Was wurde bei HAS-1 zuletzt geändert?", "explainLastChange"],
    ["Wann wurde MKG-209 zuletzt gespeichert?", "explainLastChange"],
    ["Welche letzte Aktualisierung gab es bei HAS-1?", "explainLastChange"],
    ["Was ist mit HAS-1?", "ambiguousProjectQuestion"],
    ["Und jetzt HAS-1: Was weißt du darüber?", "ambiguousProjectQuestion"],
  ])("resolves %s as %s", (question, expected) => {
    expect(
      resolveJarvisProjectDialogIntent({
        question,
        hasProjectContext: true,
      })
    ).toBe(expected);
  });

  it.each([
    ["Was ist HAS-1 für ein Proejkt?", "explainProjectType"],
    ["Und was ist HAS-1 für en Projekt?", "explainProjectType"],
    ["Welches Abrechnungsmodelll hat HAS-1?", "explainBilling"],
    ["Welche Logki gilt bei HAS-1?", "explainProcess"],
  ])("tolerates a clear intent typo in %s", (question, expected) => {
    expect(
      resolveJarvisProjectDialogIntent({
        question,
        hasProjectContext: true,
      })
    ).toBe(expected);
  });

  it.each([
    "Prüfe HAS-1 vollständig.",
    "Pürfe HAS-1 vollständig.",
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

  it("does not turn a plural project-list question into the open project", () => {
    expect(
      resolveJarvisProjectDialogIntent({
        question: "Welche Projekte sind noch offen?",
        hasProjectContext: true,
      })
    ).toBeUndefined();
  });

  it("does not confuse a material question with the project type", () => {
    expect(
      resolveJarvisProjectDialogIntent({
        question:
          "Welche Materialien fallen in diesem Projekt wirtschaftlich auf?",
        hasProjectContext: true,
      })
    ).toBeUndefined();
  });
});
