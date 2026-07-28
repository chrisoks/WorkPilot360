import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import { analyzeJarvisQuestion } from "@/lib/jarvis/question-semantics";

type UnknownRecord = Record<string, unknown>;

const DIAGNOSTIC_FACT_LABELS = new Set([
  "prufwert",
  "teilprufwert",
  "prufumfang",
  "auswahl",
]);

const DIAGNOSTIC_SECTION_TITLES = new Set([
  "bewertung nach bereichen",
  "geprufter umfang",
  "erkannte automatik",
  "abgrenzung",
]);

function normalizedLabel(value: unknown) {
  return typeof value === "string"
    ? normalizeJarvisIntentText(value).replace(/ß/g, "ss")
    : "";
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function limitFocusedSections(
  sections: unknown[],
  maxPrimaryFindings: number,
  prioritizeNextMonthPlanning: boolean
) {
  let remainingPrimaryFindings = maxPrimaryFindings;
  return sections.flatMap((value) => {
    if (!isUnknownRecord(value)) return [];
    const title = normalizedLabel(value.title);
    if (DIAGNOSTIC_SECTION_TITLES.has(title)) return [];
    const items = Array.isArray(value.items)
      ? value.items.filter((item): item is string => typeof item === "string")
      : [];
    const orderedItems = prioritizeNextMonthPlanning
      ? [...items].sort((left, right) => {
          const isNextMonth = (item: string) =>
            /\b(nachsten projektmonat|nachsten monat|folgemonat)\b/.test(
              normalizedLabel(item)
            );
          return Number(isNextMonth(right)) - Number(isNextMonth(left));
        })
      : items;
    const isSupportingSection =
      title === "nachster schritt" ||
      title === "rollenbedingter prufumfang";
    const limitedItems = isSupportingSection
      ? orderedItems.slice(0, 2)
      : orderedItems.slice(0, Math.max(0, remainingPrimaryFindings));
    if (!isSupportingSection) {
      remainingPrimaryFindings -= limitedItems.length;
    }
    return limitedItems.length > 0
      ? [{ ...value, items: limitedItems }]
      : [];
  });
}

export function applyJarvisAnswerPolicy(
  question: string,
  payload: UnknownRecord
): UnknownRecord {
  const semantics = analyzeJarvisQuestion(question);
  if (
    payload.type !== "answer" ||
    semantics.answerDepth !== "focused" ||
    !isUnknownRecord(payload.structured)
  ) {
    return payload;
  }

  const structured = payload.structured;
  const prioritizeNextMonthPlanning =
    semantics.relation === "planning_gap" &&
    /\b(folgemonat|nachste\w* monat|kommende\w* monat)\b/.test(
      semantics.normalized
    );
  const facts = Array.isArray(structured.facts)
    ? structured.facts.filter(
        (fact) =>
          isUnknownRecord(fact) &&
          !DIAGNOSTIC_FACT_LABELS.has(normalizedLabel(fact.label))
      )
    : undefined;
  const sections = Array.isArray(structured.sections)
    ? limitFocusedSections(
        structured.sections,
        prioritizeNextMonthPlanning
          ? 1
          : semantics.responsePolicy.maxPrimaryFindings,
        prioritizeNextMonthPlanning
      )
    : undefined;
  const firstFinding = sections
    ?.flatMap((section) =>
      Array.isArray(section.items) ? section.items : []
    )
    .find((item): item is string => typeof item === "string");
  const genericDiagnosticSummary =
    typeof structured.summary === "string" &&
    /\b(kritisch|prufungen|prufbereiche|prufpunkt)\w*\b/.test(
      normalizedLabel(structured.summary)
    );
  const summary =
    genericDiagnosticSummary && firstFinding
      ? firstFinding.split(" Nächster Schritt:")[0].trim()
      : structured.summary;
  const message =
    typeof payload.message === "string" &&
    /\b(punkte|prufumfang|prufpunkt)\w*\b/.test(
      normalizedLabel(payload.message)
    ) &&
    typeof summary === "string"
      ? summary
      : payload.message;

  return {
    ...payload,
    message,
    structured: {
      ...structured,
      summary,
      ...(facts ? { facts: facts.slice(0, 3) } : {}),
      ...(sections ? { sections } : {}),
    },
  };
}
