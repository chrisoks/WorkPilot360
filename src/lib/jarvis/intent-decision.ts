import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisIntentDomain = "system" | "sales" | "management";
export type JarvisIntentConfidence = "low" | "medium" | "high";
export type JarvisIntentState = "resolved" | "clarification" | "unrecognized";
export type JarvisIntentClarificationReason =
  | "multiple_domains"
  | "multiple_record_targets"
  | "multiple_time_scopes";
export type JarvisIntentGoal =
  | "how_to"
  | "read"
  | "explain"
  | "diagnose"
  | "analyze"
  | "change";
export type JarvisIntentEntity =
  | "project"
  | "customer"
  | "task"
  | "offer"
  | "invoice"
  | "employee"
  | "catalog";
export type JarvisIntentTimeScope =
  | "today"
  | "current_month"
  | "previous_month"
  | "current_year"
  | "previous_year";
export type JarvisIntentRecordFilter = "all" | "open" | "today" | "overdue";

export type JarvisIntentCandidate = {
  domain: JarvisIntentDomain;
  score: number;
  confidence: JarvisIntentConfidence;
  reasons: string[];
  segment: string;
};

export type JarvisIntentDecision = {
  question: string;
  state: JarvisIntentState;
  domain: JarvisIntentDomain;
  confidence: JarvisIntentConfidence;
  candidates: JarvisIntentCandidate[];
  clarificationReasons: JarvisIntentClarificationReason[];
  goals: JarvisIntentGoal[];
  entities: JarvisIntentEntity[];
  timeScopes: JarvisIntentTimeScope[];
  recordFilter: JarvisIntentRecordFilter;
  segments: string[];
};

type DomainScore = {
  domain: JarvisIntentDomain;
  score: number;
  reasons: string[];
};

const DOMAIN_ORDER: JarvisIntentDomain[] = ["system", "sales", "management"];

function normalize(value: string) {
  return normalizeJarvisIntentText(value)
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s./_@-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceForScore(score: number): JarvisIntentConfidence {
  if (score >= 10) return "high";
  if (score >= 6) return "medium";
  return "low";
}

function splitIntentSegments(question: string) {
  const segments = question
    .split(/\s+(?:und|sowie|außerdem|ausserdem)\s+|[;]+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : [question.trim()].filter(Boolean);
}

function addSignal(
  scores: Map<JarvisIntentDomain, DomainScore>,
  domain: JarvisIntentDomain,
  score: number,
  reason: string
) {
  const current = scores.get(domain) ?? { domain, score: 0, reasons: [] };
  current.score += score;
  if (!current.reasons.includes(reason)) current.reasons.push(reason);
  scores.set(domain, current);
}

function scoreSegment(segment: string) {
  const value = normalize(segment);
  const scores = new Map<JarvisIntentDomain, DomainScore>();

  if (
    /(passwort|kennwort|api[- ]?key|secret|token|private key|system prompt|developer message|gehalt|lohn|verdien|personalakte)/.test(
      value
    )
  ) {
    addSignal(scores, "system", 100, "Sicherheits- oder Personaldatenfrage");
    return scores;
  }

  if (
    /\bwie\b/.test(value) &&
    /\b(anleg|leg|erstell|erfass|eintrag|offn|find|bearbeit|ander|losch|stornier|bedien|plan|buch|speicher)\w*\b/.test(
      value
    )
  ) {
    addSignal(scores, "system", 14, "Bedien- oder Prozessfrage");
  }
  if (
    /\b(finde|suche|offne|zeige|fasse|zusammenfassung|status von)\b/.test(value) &&
    /\b(projekt|kunde|kontakt|aufgabe|angebot|rechnung|mitarbeiter|artikel|leistung)\w*\b/.test(
      value
    )
  ) {
    addSignal(scores, "system", 10, "Datensatz lesen oder öffnen");
  }
  if (
    /(was weisst du uber|sag mir alles uber|welche projekte hat|warum zeigt .* projekte)/.test(
      value
    )
  ) {
    addSignal(scores, "system", 12, "Personen- oder Kundenauskunft");
  }
  if (
    /\b(projekt|kunde|kontakt|aufgabe|angebot|rechnung|mitarbeiter|artikel|leistung|workpilot|jarvis|reiter|logbuch|stempel|termin|planung)\w*\b/.test(
      value
    )
  ) {
    addSignal(scores, "system", 2, "WorkPilot-Fachobjekt");
  }

  const salesSignals: Array<[RegExp, string]> = [
    [/\bvertrieb\w*\b/, "Vertrieb"],
    [/\bnachfass\w*\b/, "Nachfassen"],
    [/\bverkaufschance\w*\b/, "Verkaufschance"],
    [/\bzusatzverkauf\w*\b/, "Zusatzverkauf"],
    [/\bneukunde\w*\b/, "Neukundengewinnung"],
    [/\bkundenpotenzial\w*\b/, "Kundenpotenzial"],
    [/\babschlussquote\w*\b/, "Abschlussquote"],
    [/\b(?:wiederholungs|folge)auftrag\w*\b/, "Folgeauftrag"],
    [/\bcross selling\b/, "Cross-Selling"],
    [/\bvorjahresleistung\w*\b/, "Vorjahresleistung"],
    [/\bwelche kunden\b.*\b(?:angehen|kontaktier|anrufen)\w*\b/, "Kunden aktiv angehen"],
  ];
  salesSignals.forEach(([pattern, reason]) => {
    if (pattern.test(value)) addSignal(scores, "sales", 7, reason);
  });

  const managementSignals: Array<[RegExp, string]> = [
    [/\bbwl\b/, "BWL"],
    [/\bliquiditat\w*\b/, "Liquidität"],
    [/\bdeckungsbeitrag\w*\b/, "Deckungsbeitrag"],
    [/\brentabilitat\w*\b/, "Rentabilität"],
    [/\bwirtschaftlichkeit\w*\b/, "Wirtschaftlichkeit"],
    [/\bunternehmenslage\w*\b/, "Unternehmenslage"],
    [/\bkapazitat\w*\b/, "Kapazität"],
    [/\bproduktivitat\w*\b/, "Produktivität"],
    [/\boffene posten\b/, "Offene Posten"],
    [/\bforecast\w*\b/, "Forecast"],
    [/\bsvs\b/, "Stundenverrechnungssatz"],
    [
      /\b(stundenverrechnungssatz|stundensatz|stundenleistung|leistungspreis)\w*\b/,
      "Leistungs- und Stundenpreis",
    ],
    [
      /\b(materialverbrauch|materialkosten|artikelpreis|materialpreis|einkaufspreis|verkaufspreis|lagerabweichung|lagerentnahme|lagerbewegung)\w*\b/,
      "Material- und Artikelwirtschaft",
    ],
    [
      /\b(analysier|vergleich|auswert|bewert|pruf)\w*\b.*\b(material|artikel|lager)\w*\b/,
      "Materialanalyse",
    ],
    [
      /\b(material|artikel)\w*\b.*\b(preis|marge|kosten|zu gunstig)\w*\b/,
      "Materialpreis",
    ],
    [/\bwachstum\w*\b/, "Wachstum"],
    [/\bumsatz\w*\b/, "Umsatz"],
    [/\bkosten\w*\b/, "Kosten"],
    [/\bertrag\w*\b/, "Ertrag"],
    [/\bgewinn\w*\b/, "Gewinn"],
    [/\bmarge\w*\b/, "Marge"],
    [/\bauslastung\w*\b/, "Auslastung"],
  ];
  managementSignals.forEach(([pattern, reason]) => {
    if (pattern.test(value)) addSignal(scores, "management", 7, reason);
  });

  return scores;
}

function collectGoals(value: string): JarvisIntentGoal[] {
  const goals: JarvisIntentGoal[] = [];
  const add = (goal: JarvisIntentGoal, condition: boolean) => {
    if (condition && !goals.includes(goal)) goals.push(goal);
  };
  add(
    "how_to",
    /\bwie\b.*\b(anleg|leg|erstell|erfass|eintrag|offn|find|bearbeit|ander|losch|bedien|plan|buch|speicher)\w*\b/.test(
      value
    )
  );
  add(
    "read",
    /\b(finde|suche|offne|zeige|fasse|zusammenfassung|status|uberblick)\w*\b/.test(
      value
    )
  );
  add(
    "diagnose",
    /\b(pruf|check|fehl|falsch|warum|ursache|auffallig|stimm|gesund|hakt|schief|abschliess|abzuschliess)\w*\b/.test(
      value
    )
  );
  add("analyze", /\b(analysier|vergleich|trend|entwickl|potenzial|wirtschaftlichkeit)\w*\b/.test(value));
  add("change", /\b(anleg|leg|erstell|ander|bearbeit|losch|stornier|sende|buch|speicher)\w*\b/.test(value));
  add("explain", /\b(was ist|welche logik|erklar|wie funktioniert|wie lauft)\b/.test(value));
  return goals;
}

function collectEntities(value: string): JarvisIntentEntity[] {
  const entities: JarvisIntentEntity[] = [];
  const markers: Array<[JarvisIntentEntity, RegExp]> = [
    ["invoice", /\brechnung\w*\b/],
    ["offer", /\bangebot\w*\b/],
    ["task", /\b(aufgabe\w*|todo)\b/],
    ["customer", /\b(kunde\w*|kontakt\w*|firma|ansprechpartner)\b/],
    ["project", /\bprojekt\w*\b/],
    ["employee", /\b(mitarbeiter\w*|personal)\b/],
    ["catalog", /\b(artikel\w*|leistung\w*|paket\w*)\b/],
  ];
  markers.forEach(([entity, pattern]) => {
    if (pattern.test(value)) entities.push(entity);
  });
  return entities;
}

function collectTimeScopes(value: string): JarvisIntentTimeScope[] {
  const scopes: JarvisIntentTimeScope[] = [];
  const add = (scope: JarvisIntentTimeScope, condition: boolean) => {
    if (condition && !scopes.includes(scope)) scopes.push(scope);
  };
  add("today", /\b(heute|taglich|tagesaktuell)\b/.test(value));
  add("current_month", /\b(aktuell\w*|diese\w*|laufend\w*) monat\b/.test(value));
  add("previous_month", /\b(vormonat|letzter monat)\b/.test(value));
  add("current_year", /\b(aktuell\w*|diese\w*|laufend\w*) jahr\b/.test(value));
  add("previous_year", /\b(vorjahr|letztes jahr)\b/.test(value));
  return scopes;
}

function collectRecordFilter(value: string): JarvisIntentRecordFilter {
  if (/\buberfallig\w*\b/.test(value)) return "overdue";
  if (/\bheute\b/.test(value)) return "today";
  if (/\boffen\w*\b/.test(value)) return "open";
  return "all";
}

function isComparison(value: string) {
  return /\b(vergleich|gegenuber|unterschied|entwicklung|trend|versus|vs)\w*\b/.test(
    value
  );
}

function isPersonOrCauseQuestion(value: string) {
  return (
    /(was weisst du uber|sag mir alles uber|welche projekte hat)/.test(value) ||
    /\b(warum|ursache|abweichung|unterschied)\b/.test(value)
  );
}

export function resolveJarvisIntentDecision(question: string): JarvisIntentDecision {
  const cleaned = question.trim().slice(0, 1800);
  const normalized = normalize(cleaned);
  const segments = splitIntentSegments(cleaned);
  const aggregate = new Map<JarvisIntentDomain, DomainScore>();
  const candidates: JarvisIntentCandidate[] = [];
  const segmentDomains = new Set<JarvisIntentDomain>();

  segments.forEach((segment) => {
    const scores = [...scoreSegment(segment).values()].sort(
      (left, right) =>
        right.score - left.score ||
        DOMAIN_ORDER.indexOf(left.domain) - DOMAIN_ORDER.indexOf(right.domain)
    );
    scores.forEach((score) => {
      const current = aggregate.get(score.domain) ?? {
        domain: score.domain,
        score: 0,
        reasons: [],
      };
      current.score += score.score;
      score.reasons.forEach((reason) => {
        if (!current.reasons.includes(reason)) current.reasons.push(reason);
      });
      aggregate.set(score.domain, current);
    });
    const relevant = scores.filter((score) => score.score >= 6);
    relevant.forEach((score) => segmentDomains.add(score.domain));
    relevant.forEach((score) => {
      candidates.push({
        domain: score.domain,
        score: score.score,
        confidence: confidenceForScore(score.score),
        reasons: score.reasons,
        segment,
      });
    });
  });

  const ranked = [...aggregate.values()].sort(
    (left, right) =>
      right.score - left.score ||
      DOMAIN_ORDER.indexOf(left.domain) - DOMAIN_ORDER.indexOf(right.domain)
  );
  const selected = ranked[0];
  const securityForced = (aggregate.get("system")?.score ?? 0) >= 100;
  const goals = collectGoals(normalized);
  const entities = collectEntities(normalized);
  const timeScopes = collectTimeScopes(normalized);
  const recordFilter = collectRecordFilter(normalized);
  const clarificationReasons: JarvisIntentClarificationReason[] = [];

  if (!securityForced && segmentDomains.size > 1) {
    clarificationReasons.push("multiple_domains");
  }
  const recordEntities = entities.filter((entity) =>
    ["project", "customer", "task", "offer", "invoice"].includes(entity)
  );
  if (
    !securityForced &&
    recordEntities.length > 1 &&
    goals.includes("read") &&
    !goals.includes("how_to") &&
    !isPersonOrCauseQuestion(normalized)
  ) {
    clarificationReasons.push("multiple_record_targets");
  }
  if (!securityForced && timeScopes.length > 1 && !isComparison(normalized)) {
    clarificationReasons.push("multiple_time_scopes");
  }

  const uniqueCandidates = candidates
    .filter((candidate) => !securityForced || candidate.domain === "system")
    .sort((left, right) => right.score - left.score)
    .filter(
      (candidate, index, list) =>
        list.findIndex(
          (other) =>
            other.domain === candidate.domain && other.segment === candidate.segment
        ) === index
    );
  const fallbackDomain = selected?.domain ?? "system";
  const fallbackScore = selected?.score ?? 0;

  return {
    question: cleaned,
    state:
      clarificationReasons.length > 0
        ? "clarification"
        : selected
          ? "resolved"
          : "unrecognized",
    domain: fallbackDomain,
    confidence: selected ? confidenceForScore(fallbackScore) : "low",
    candidates: uniqueCandidates,
    clarificationReasons,
    goals,
    entities,
    timeScopes,
    recordFilter,
    segments,
  };
}
