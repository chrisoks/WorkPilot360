export type PlanningRequestDecisionIntake = {
  entryId: string;
  decision: "approve" | "reject" | "cancel" | null;
  reason: string;
};

function clean(value: string) {
  return value.trim().replace(/[.,;:!?]+$/, "");
}

export function looksLikePlanningRequestDecision(question: string) {
  return (
    /terminwunsch/i.test(question) && /(freigeb|gib[\s\S]{0,80}\bfrei\b|genehmig|bestätig|bestaetig|ablehn|zurückweis|zurueckweis)/i.test(question)
  ) || (
    /\btermin\b/i.test(question) && /(absag|streich|löschen|loeschen)/i.test(question)
  );
}

export function extractPlanningRequestDecision(question: string): PlanningRequestDecisionIntake {
  const decision = /\btermin\b/i.test(question) && /(absag|streich|löschen|loeschen)/i.test(question)
    ? "cancel"
    : /(ablehn|zurückweis|zurueckweis)/i.test(question)
      ? "reject"
      : /(freigeb|gib[\s\S]{0,80}\bfrei\b|genehmig|bestätig|bestaetig)/i.test(question)
        ? "approve"
        : null;
  const explicitCandidate = question.match(/(?:terminwunsch(?:-id)?|eintrag(?:s-id)?|id)\s*[:#]?\s*([a-z0-9][a-z0-9-]{7,119})/i)?.[1] ?? "";
  const explicitId = /^(?:freigeben|genehmigen|bestätigen|bestaetigen|ablehnen|zurückweisen|zurueckweisen|absagen|streichen|löschen|loeschen)$/i.test(explicitCandidate)
    ? ""
    : explicitCandidate;
  const uuid = question.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0];
  const reason = question.match(/(?:grund|begründung|begruendung)\s*:\s*([^\n]{3,500})/i)?.[1] ?? "";
  return {
    entryId: clean(explicitId ?? uuid ?? ""),
    decision,
    reason: clean(reason),
  };
}
