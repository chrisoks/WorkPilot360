import {
  resolveJarvisIntentDecision,
  type JarvisIntentDomain,
} from "@/lib/jarvis/intent-decision";
import {
  resolveJarvisConversationDomain,
  type JarvisDialogState,
} from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisDomain = JarvisIntentDomain;

const NAMED_MAIN_NAVIGATION_AREAS = [
  "dashboard",
  "auswertungen",
  "kontakte",
  "news feed",
  "meine ziele",
  "projekte ok solutions",
  "projekte ok immocare",
  "artikel und leistungen",
  "kalkulations rechner",
  "zusatzverkaufe",
  "aufgaben",
  "planungsboard",
  "prozess automation",
  "buchhaltung",
  "personliche daten",
  "mitarbeiter",
  "firmeneinstellungen",
];

function isNamedMainNavigationQuestion(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /^(?:wo\s+(?:ist|sind|liegt|liegen|befindet|befinden)\b|wo\s+(?:finde|sehe)\s+ich\b|wie\s+(?:komme|gelange)\s+ich\b|wie\s+offne\s+ich\b)/.test(
      value
    ) &&
    NAMED_MAIN_NAVIGATION_AREAS.some((area) => value.includes(area))
  );
}

export function resolveJarvisDomain(
  question: string,
  previousState?: JarvisDialogState
): JarvisDomain {
  if (isNamedMainNavigationQuestion(question)) return "system";
  if (previousState) {
    return resolveJarvisConversationDomain(question, previousState);
  }
  const decision = resolveJarvisIntentDecision(question);
  return decision.state === "resolved" ? decision.domain : "system";
}
