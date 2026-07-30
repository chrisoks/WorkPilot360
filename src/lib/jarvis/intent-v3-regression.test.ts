import { describe, expect, it } from "vitest";
import { resolveJarvisCapabilityGap } from "@/lib/jarvis/capability-gap";
import { resolveJarvisProjectReviewInventoryIntent } from "@/lib/jarvis/organization-project-review-analysis";
import { resolveJarvisProjectDialogIntent } from "@/lib/jarvis/project-dialog-intent";
import { resolveJarvisReadIntent } from "@/lib/jarvis/read-intent";

describe("JARVIS intent orchestrator V3 regressions", () => {
  it.each([
    "Wie suche ich einen Kunden?",
    "Wie finde ich ein Projekt?",
    "Wie kann ich eine Rechnung öffnen?",
    "Wie suche ich einen Ansprechpartner?",
  ])("keeps search how-to questions out of live record search: %s", (question) => {
    expect(resolveJarvisReadIntent(question)).toBeUndefined();
  });

  it.each([
    "Wo kann ich die Rechnung von diesem Projekt kontrollieren?",
    "Wie kontrolliere ich das Angebot im Projekt?",
    "Was muss ich bei der Rechnung in diesem Projekt prüfen?",
    "Ist dieses Projekt fachlich freigegeben?",
  ])("does not steal a single-project workflow as inventory: %s", (question) => {
    expect(resolveJarvisProjectReviewInventoryIntent(question)).toBeUndefined();
  });

  it.each([
    ["Was isn HAS-1 fürn Projekt?", "explainProjectType"],
    ["Welchen Status hat HAS-1?", "explainStatus"],
    ["Wer ist bei HAS-1 verantwortlich?", "explainResponsibility"],
    ["Ist HAS-1 fachlich freigegeben?", "explainReviewStatus"],
    ["Was wurde bei HAS-1 zuletzt geändert?", "explainLastChange"],
    ["Und jetzt HAS-1: Was weißt du darüber?", "ambiguousProjectQuestion"],
  ])("keeps explicit project context in %s", (question, intent) => {
    expect(
      resolveJarvisProjectDialogIntent({
        question,
        hasProjectContext: true,
      })
    ).toBe(intent);
  });

  it.each([
    "Wie viele Rechnungsentwürfe sind insgesamt offen?",
    "Welche Kunden haben seit 30 Tagen keine Aktivität?",
    "Welche Projekte haben Zeiten, aber noch keine Rechnung?",
    "Welche Projekte sind aktuell kritisch?",
  ])("never turns an unsupported analysis into a false zero result: %s", (question) => {
    const result = resolveJarvisCapabilityGap(question);
    expect(result?.type).toBe("unknown");
    expect(result?.message).toContain("keine Treffer");
  });
});
