export type PlanningRequestDecisionIntake = {
  entryId: string;
  decision: "approve" | "reject" | "cancel" | "withdraw" | "approve_series" | "reject_series" | "cancel_series" | "withdraw_series" | null;
  reason: string;
};

function clean(value: string) {
  return value.trim().replace(/[.,;:!?]+$/, "");
}

export function looksLikePlanningRequestDecision(question: string) {
  return (
    /terminwunsch(?:serie)?/i.test(question) && /(freigeb|gib[\s\S]{0,80}\bfrei\b|genehmig|bestätig|bestaetig|ablehn|zurückweis|zurueckweis|zurückzieh|zurueckzieh)/i.test(question)
  ) || (
    /\btermin(?:serie)?\b/i.test(question) && /(absag|streich|löschen|loeschen)/i.test(question)
  );
}

export function extractPlanningRequestDecision(question: string): PlanningRequestDecisionIntake {
  const wholeSeries = /\b(?:gesamte[nrsm]?|ganze[nrsm]?|komplette[nrsm]?|vollständige[nrsm]?|alle)\b/i.test(question) || /termin(?:wunsch)?-?serie/i.test(question);
  const decision = wholeSeries && /terminwunsch/i.test(question) && /(zurückzieh|zurueckzieh)/i.test(question)
    ? "withdraw_series"
    : wholeSeries && /terminwunsch/i.test(question) && /(ablehn|zurückweis|zurueckweis)/i.test(question)
      ? "reject_series"
    : wholeSeries && /terminwunsch/i.test(question) && /(freigeb|gib[\s\S]{0,80}\bfrei\b|genehmig|bestätig|bestaetig)/i.test(question)
      ? "approve_series"
    : wholeSeries && /\btermin(?:serie)?\b/i.test(question) && /(absag|streich|löschen|loeschen)/i.test(question)
      ? "cancel_series"
    : /terminwunsch/i.test(question) && /(zurückzieh|zurueckzieh)/i.test(question)
    ? "withdraw"
    : /\btermin\b/i.test(question) && /(absag|streich|löschen|loeschen)/i.test(question)
    ? "cancel"
    : /(ablehn|zurückweis|zurueckweis)/i.test(question)
      ? "reject"
      : /(freigeb|gib[\s\S]{0,80}\bfrei\b|genehmig|bestätig|bestaetig)/i.test(question)
        ? "approve"
        : null;
  const explicitCandidate = question.match(/(?:terminwunsch-id|termin-id|eintrags-id|eintrag-id|id)\s*[:#]?\s*([a-z0-9][a-z0-9-]{7,119})/i)?.[1]
    ?? question.match(/(?:terminwunsch(?:serie)?|terminserie|termin|eintrag)\s*[:#]?\s*([a-z0-9][a-z0-9-]{7,119})/i)?.[1]
    ?? "";
  const explicitId = /^(?:freigeben|genehmigen|bestätigen|bestaetigen|ablehnen|zurückweisen|zurueckweisen|zurückziehen|zurueckziehen|absagen|streichen|löschen|loeschen)$/i.test(explicitCandidate)
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
