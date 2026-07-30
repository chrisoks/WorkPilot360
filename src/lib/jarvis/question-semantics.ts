import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisQuestionProjectScope =
  | "full"
  | "planning"
  | "stamps"
  | "tasks"
  | "commercial"
  | "automation"
  | "improvements";

export type JarvisQuestionRelation =
  | "time_to_invoice"
  | "planning_gap"
  | "invoice_month"
  | "project_materials"
  | "project_service_rates"
  | "none";

export type JarvisQuestionAnswerDepth =
  | "focused"
  | "diagnostic"
  | "explanatory"
  | "unspecified";

export type JarvisExplicitMonth = {
  key: string;
  label: string;
};

export type JarvisQuestionSemantics = {
  normalized: string;
  projectReferences: string[];
  explicitMonths: JarvisExplicitMonth[];
  projectScopes: JarvisQuestionProjectScope[];
  relation: JarvisQuestionRelation;
  answerDepth: JarvisQuestionAnswerDepth;
  responsePolicy: {
    includeScore: boolean;
    includeAreaAssessments: boolean;
    maxPrimaryFindings: number;
  };
};

type AnalyzeJarvisQuestionOptions = {
  now?: Date;
};

const GERMAN_MONTHS: Array<{
  number: string;
  label: string;
  names: string[];
}> = [
  { number: "01", label: "Januar", names: ["januar", "jan"] },
  { number: "02", label: "Februar", names: ["februar", "feb"] },
  { number: "03", label: "März", names: ["marz", "maerz", "mrz"] },
  { number: "04", label: "April", names: ["april", "apr"] },
  { number: "05", label: "Mai", names: ["mai"] },
  { number: "06", label: "Juni", names: ["juni", "jun"] },
  { number: "07", label: "Juli", names: ["juli", "jul"] },
  { number: "08", label: "August", names: ["august", "aug"] },
  {
    number: "09",
    label: "September",
    names: ["september", "sept", "sep"],
  },
  { number: "10", label: "Oktober", names: ["oktober", "okt"] },
  { number: "11", label: "November", names: ["november", "nov"] },
  { number: "12", label: "Dezember", names: ["dezember", "dez"] },
];

const CALENDAR_REFERENCE_PREFIXES = new Set(
  GERMAN_MONTHS.flatMap((month) => month.names.map((name) => name.toUpperCase()))
);

function normalize(value: string) {
  return normalizeJarvisIntentText(value)
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s./_@-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeProjectReference(value: string) {
  const reference = value.trim().toUpperCase();
  return /^[\p{L}]{2,}[- ]?\d{1,8}$/u.test(reference)
    ? reference.replace(/\s+/g, "-")
    : "";
}

function isCalendarReference(reference: string) {
  const match = reference.match(/^([\p{L}]+)-(\d{4})$/u);
  if (!match) return false;
  const year = Number(match[2]);
  const normalizedPrefix = normalizeJarvisIntentText(match[1]).toUpperCase();
  return (
    year >= 1900 &&
    year <= 2200 &&
    CALENDAR_REFERENCE_PREFIXES.has(normalizedPrefix)
  );
}

function extractProjectReferences(question: string) {
  const matches =
    question.match(
      /\b(?:[\p{L}]{2,}-\d{1,8}|[A-ZÄÖÜ]{2,}\s+\d{1,8})\b/gu
    ) ?? [];
  return [
    ...new Set(
      matches
        .map(sanitizeProjectReference)
        .filter((reference) => reference && !isCalendarReference(reference))
    ),
  ].slice(0, 5);
}

function currentBerlinYear(now: Date) {
  const year = Number(
    new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      timeZone: "Europe/Berlin",
    }).format(now)
  );
  return Number.isFinite(year) ? year : now.getUTCFullYear();
}

function extractExplicitMonths(normalized: string, now: Date) {
  const matches: JarvisExplicitMonth[] = [];
  for (const month of GERMAN_MONTHS) {
    for (const name of month.names) {
      const pattern = new RegExp(`\\b${name}(?:\\s+|-)(\\d{4})\\b`, "g");
      for (const match of normalized.matchAll(pattern)) {
        const year = Number(match[1]);
        if (year < 1900 || year > 2200) continue;
        const key = `${year}-${month.number}`;
        if (!matches.some((candidate) => candidate.key === key)) {
          matches.push({ key, label: `${month.label} ${year}` });
        }
      }
    }
  }
  if (matches.length === 0) {
    const inferredYear = currentBerlinYear(now);
    for (const month of GERMAN_MONTHS) {
      if (
        !month.names.some((name) =>
          new RegExp(`\\b${name}\\b`).test(normalized)
        )
      ) {
        continue;
      }
      matches.push({
        key: `${inferredYear}-${month.number}`,
        label: `${month.label} ${inferredYear}`,
      });
    }
  }
  return matches.sort((left, right) => left.key.localeCompare(right.key));
}

function resolveRelation(
  normalized: string,
  explicitMonths: JarvisExplicitMonth[]
): JarvisQuestionRelation {
  const hasTime =
    /\b(stempel|arbeitszeit|zeiteintrag|stunden)\w*\b/.test(normalized);
  const hasInvoice =
    /\b(rechnung|rechnungsentwurf|abrechnung|faktura)\w*\b/.test(normalized) ||
    (
      /\b(entwurf|draft)\w*\b/.test(normalized) &&
      (hasTime || explicitMonths.length > 0) &&
      !/\bangebot\w*\b/.test(normalized)
    );
  const hasPlanning =
    /\b(planung|termin|geplant|verplant|planen)\w*\b/.test(normalized);
  const hasMaterial =
    /\b(material|artikel|paketbestandteil|streugut|streusalz|salz)\w*\b/.test(
      normalized
    );
  const asksForMaterialAnalysis =
    /\b(welche|wieviel|wie viel|menge|verbrauch|verwendet|abgerechnet|verkauft|lager|analysier|pruf|auswert|auffallig|wirtschaftlich|rentabel)\w*\b/.test(
      normalized
    ) ||
    /\bwert\w*\b.*\baus\b/.test(normalized);
  const hasServiceRate =
    /\b(stundenverrechnungssatz|stundensatz|svs|abrechnungsleistung|leistungspreis)\w*\b/.test(
      normalized
    ) ||
    (
      /\b(leistung)\w*\b/.test(normalized) &&
      /\b(preis|wirtschaftlich|rentabel|marge|erlos|umsatz|kosten|analysier|auswert)\w*\b/.test(
        normalized
      )
    );
  const asksForServiceRateAnalysis =
    /\b(wie hoch|tatsachlich|erzielt|berechnet|analysier|auswert|pruf|wirtschaftlich|rentabel|erhoh|anpass|empfehl)\w*\b/.test(
      normalized
    ) ||
    /\bwert\w*\b.*\baus\b/.test(normalized);
  const asksForCauseOrGap =
    /\b(warum|wieso|weshalb|wodurch|verhinder|keine|keinen|nicht|fehlt|fehlend|erstellt|erzeugt|unvollstandig)\w*\b/.test(
      normalized
    );

  if (hasInvoice && hasTime && asksForCauseOrGap) return "time_to_invoice";
  if (hasPlanning && asksForCauseOrGap) return "planning_gap";
  if (hasMaterial && asksForMaterialAnalysis) return "project_materials";
  if (hasServiceRate && asksForServiceRateAnalysis) {
    return "project_service_rates";
  }
  if (hasInvoice && explicitMonths.length > 0 && asksForCauseOrGap) {
    return "invoice_month";
  }
  return "none";
}

function resolveProjectScopes(
  normalized: string,
  relation: JarvisQuestionRelation
): JarvisQuestionProjectScope[] {
  if (relation === "time_to_invoice") return ["commercial"];
  if (relation === "project_materials") return ["commercial"];
  if (relation === "project_service_rates") return ["commercial"];
  if (
    /\b(?:was fehlt|fehl\w*)\b.*\b(?:abrechnung|faktura)\w*\b/.test(
      normalized
    )
  ) {
    return ["commercial"];
  }
  if (
    /\bangebot\w*\b/.test(normalized) &&
    /\bfehl\w*\b/.test(normalized)
  ) {
    return ["commercial"];
  }

  const scopes: JarvisQuestionProjectScope[] = [];
  const add = (scope: JarvisQuestionProjectScope, condition: boolean) => {
    if (condition && !scopes.includes(scope)) scopes.push(scope);
  };
  add("stamps", /\b(stempel|arbeitszeit|zeiteintrag|stunden)\w*\b/.test(normalized));
  add(
    "planning",
    /\b(planung|termin|geplant|verplant|planen)\w*\b/.test(normalized)
  );
  add(
    "tasks",
    /\b(aufgabe|offene punkte|todo|unterbrech)\w*\b/.test(normalized)
  );
  add(
    "commercial",
    /\b(angebot|rechnung|rechnungsentwurf|abrechnung|faktura)\w*\b/.test(
      normalized
    )
  );
  add(
    "automation",
    /\b(automatik|zusammenhang|workflow|prozess)\w*\b/.test(normalized)
  );
  add(
    "improvements",
    /\b(auffallig|verbesser|optimier|was fehlt|wirtschaftlich|rentabel|projektgewinn)\w*\b/.test(
      normalized
    ) ||
      (
        /\b\w*nachweis\w*\b/.test(normalized) &&
        /\bfehl\w*\b/.test(normalized)
      ) ||
      /\b(?:wichtigste[rn]?|nachste[rn]?)\s+(?:sinnvolle[nr]?\s+)?schritt\b/.test(
        normalized
      )
  );

  const explicitlyRequestsFullCheck =
    /\b(gesundheitscheck|vollstandig\w* projektcheck|komplett\w* projektcheck)\b/.test(
      normalized
    ) ||
    (
      /\b(vollstandig|komplett|alles)\b/.test(normalized) &&
      /\b(pruf|check|analysier|untersuch|kontrollier)\w*\b/.test(normalized)
    );
  const requestsBroadProjectAssessment =
    /\b(gesund|schief|hakt|projektuberblick|kurzer uberblick|kurzen uberblick|korrekt abzuschliess)\w*\b/.test(
      normalized
    ) ||
    /\bpruf\w*\b.*\bprojekt\b/.test(normalized);
  if (requestsBroadProjectAssessment && scopes.length === 0) return ["full"];
  if (explicitlyRequestsFullCheck && scopes.length === 0) return ["full"];
  return scopes;
}

function resolveAnswerDepth(
  normalized: string,
  relation: JarvisQuestionRelation
): JarvisQuestionAnswerDepth {
  const explicitDiagnostic =
    /\b(gesundheitscheck|projektcheck)\b/.test(normalized) ||
    /\b(pruf|check|analysier|untersuch|kontrollier)\w*\b/.test(normalized);
  if (explicitDiagnostic) return "diagnostic";
  if (relation !== "none") return "focused";
  if (
    /\b(erklar|was ist|wie funktioniert|wie lauft|welche logik)\b/.test(
      normalized
    )
  ) {
    return "explanatory";
  }
  return "unspecified";
}

export function analyzeJarvisQuestion(
  question: string,
  options: AnalyzeJarvisQuestionOptions = {}
): JarvisQuestionSemantics {
  const normalized = normalize(question.trim().slice(0, 1800));
  const explicitMonths = extractExplicitMonths(
    normalized,
    options.now ?? new Date()
  );
  const relation = resolveRelation(normalized, explicitMonths);
  const answerDepth = resolveAnswerDepth(normalized, relation);
  return {
    normalized,
    projectReferences: extractProjectReferences(question),
    explicitMonths,
    projectScopes: resolveProjectScopes(normalized, relation),
    relation,
    answerDepth,
    responsePolicy:
      answerDepth === "diagnostic"
        ? {
            includeScore: true,
            includeAreaAssessments: true,
            maxPrimaryFindings: 20,
          }
        : {
            includeScore: false,
            includeAreaAssessments: false,
            maxPrimaryFindings: 2,
          },
  };
}

export function isJarvisTimeToInvoiceQuestion(question: string) {
  return analyzeJarvisQuestion(question).relation === "time_to_invoice";
}
