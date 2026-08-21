import type { JarvisLiveQuestion } from "@/lib/jarvis/live-question-corpus";

export type JarvisEvaluationProfile = "smoke" | "targeted" | "release";

export const JARVIS_EVALUATION_CATEGORIES = [
  "navigation",
  "projects",
  "customers",
  "tasks",
  "planning",
  "time",
  "calculators",
  "offers",
  "invoices",
  "onlineRequests",
  "security",
] as const;

export type JarvisEvaluationCategory = (typeof JARVIS_EVALUATION_CATEGORIES)[number];

/**
 * Kleiner, absichtlich stabiler Querschnitt. Er deckt Verstehen, Navigation,
 * Rückfragen, Vorschauen, Rollen-/Mandantenschutz und Stale-State-Schutz ab.
 * Die IDs sind fachlich gewählt; die Anzahl ist kein Qualitätsziel.
 */
export const JARVIS_SMOKE_EVALUATION_IDS = [
  "navigation-01",
  "projects-03",
  "projects-06",
  "customers-07",
  "customers-09",
  "tasks-10",
  "planning-03",
  "planning-09",
  "time-01",
  "time-07",
  "calculators-02",
  "offers-01",
  "offers-10",
  "invoices-01",
  "invoices-05",
  "onlineRequests-06",
  "onlineRequests-10",
  "security-07",
  "security-08",
  "security-09",
  "security-10",
] as const;

const CROSS_CUTTING_PATHS = [
  /^src\/app\/api\/jarvis\/chat\/route\.ts$/,
  /^src\/app\/api\/jarvis\/action-drafts\//,
  /^src\/lib\/jarvis\/(?:actions|action-center|action-draft-store|dialog|intent|intent-text|knowledge|security|system-map)/,
  /^src\/lib\/jarvis\/(?:live-question-corpus|evaluation-profile)\./,
  /^scripts\/qa-jarvis-live-corpus\.mjs$/,
];

const CATEGORY_PATHS: Array<[JarvisEvaluationCategory, RegExp[]]> = [
  ["planning", [/planning/i, /appointment/i, /absence/i, /team-availability/i]],
  ["time", [/time-entry/i, /stamp-session/i, /work-duration/i, /labor-hour/i]],
  ["invoices", [/invoice/i, /document-mail/i, /receivable/i, /activity-report/i]],
  ["offers", [/offer/i, /catalog/i, /package/i]],
  ["customers", [/contact/i, /customer/i, /sales-journal/i, /sales-opportunit/i]],
  ["projects", [/project/i, /forecast/i, /potential/i]],
  ["tasks", [/(?:^|\/)tasks?(?:\/|\.|-)/i, /escalation/i, /deadline/i]],
  ["calculators", [/calculation/i, /calculator/i, /winter-service/i, /vehicle/i, /fuel-price/i]],
  ["onlineRequests", [/online-request/i, /public\/online-requests/i]],
  ["navigation", [/navigation/i, /sidebar/i, /dashboard-page/i]],
  ["security", [/permission/i, /auth/i, /session/i, /security/i, /middleware/i]],
];

function normalizePath(value: string) {
  return value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

export function planJarvisEvaluation(changedPaths: string[]): {
  profile: JarvisEvaluationProfile;
  categories: JarvisEvaluationCategory[];
  reasons: string[];
} {
  const paths = changedPaths.map(normalizePath).filter(Boolean);
  if (paths.some((path) => CROSS_CUTTING_PATHS.some((pattern) => pattern.test(path)))) {
    return {
      profile: "release",
      categories: [...JARVIS_EVALUATION_CATEGORIES],
      reasons: ["JARVIS-Kern-, Sicherheits- oder Korpuslogik wurde verändert."],
    };
  }

  const categories = CATEGORY_PATHS
    .filter(([, patterns]) => paths.some((path) => patterns.some((pattern) => pattern.test(path))))
    .map(([category]) => category);

  if (categories.length > 0) {
    return {
      profile: "targeted",
      categories,
      reasons: [`Betroffene Fachbereiche: ${categories.join(", ")}.`],
    };
  }

  return {
    profile: "smoke",
    categories: [],
    reasons: [paths.length ? "Keine JARVIS-relevante Fachänderung erkannt." : "Keine geänderten Pfade übergeben."],
  };
}

export function selectJarvisEvaluationCases(input: {
  corpus: JarvisLiveQuestion[];
  profile: JarvisEvaluationProfile;
  categories?: string[];
}) {
  if (input.profile === "release") return [...input.corpus];
  const smokeIds = new Set<string>(JARVIS_SMOKE_EVALUATION_IDS);
  if (input.profile === "smoke") {
    return input.corpus.filter((item) => smokeIds.has(item.id));
  }
  const categories = new Set(input.categories ?? []);
  return input.corpus.filter((item) => smokeIds.has(item.id) || categories.has(item.category));
}
