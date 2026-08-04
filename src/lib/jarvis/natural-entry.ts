import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { createJarvisDialogChoice } from "@/lib/jarvis/dialog";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

const BROAD_ENTRY_PATTERNS = [
  /^wie (?:sieht|schaut) es(?: denn)? aus$/,
  /^wie lauft es(?: denn)?$/,
  /^was gibt es neues$/,
  /^was ist(?: heute)? wichtig$/,
  /^wo klemmt es$/,
  /^gibt es auffalligkeiten$/,
  /^was soll ich zuerst tun$/,
  /^was muss ich wissen$/,
  /^was steht an$/,
];

function hasStableRecordContext(context: JarvisSurfaceContext | undefined) {
  return context?.recordType === "project" || context?.recordType === "customer";
}

export function isJarvisBroadNaturalEntry(question: string) {
  const value = normalizeJarvisIntentText(question)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^bitte\s+/, "")
    .replace(/\s+bitte$/, "");
  return BROAD_ENTRY_PATTERNS.some((pattern) => pattern.test(value));
}

export function resolveJarvisNaturalEntryRequest(input: {
  question: string;
  accessProfile: JarvisAccessProfile;
  context?: JarvisSurfaceContext;
}): JarvisReadResponse | undefined {
  if (!isJarvisBroadNaturalEntry(input.question) || hasStableRecordContext(input.context)) return undefined;
  const choices = [
    createJarvisDialogChoice("natural-entry-my-day", "Mein heutiger Tag", "Zeige mir meine heutigen Termine und offenen Aufgaben"),
  ];
  if (getJarvisActionDecision("project.read", input.accessProfile).executable) {
    choices.push(createJarvisDialogChoice("natural-entry-projects", "Projekte", "Zeige mir die aktuell auffälligen und kritischen Projekte"));
  }
  if (getJarvisActionDecision("offer.read", input.accessProfile).executable) {
    choices.push(createJarvisDialogChoice("natural-entry-sales", "Vertrieb", "Welche Kunden und Angebote sollten wir heute im Vertrieb priorisieren?"));
  }
  if (getJarvisActionDecision("invoice.read", input.accessProfile).executable) {
    choices.push(createJarvisDialogChoice("natural-entry-company", "Unternehmen", "Analysiere unser Unternehmen vollständig"));
  }
  return {
    type: "clarification",
    topicId: "intent.natural-entry.scope-required",
    message: "Gern. Meinst du deinen heutigen Arbeitstag, die laufenden Projekte, den Vertrieb oder die gesamte Unternehmenslage? Ich frage einmal gezielt nach, damit ich nicht am eigentlichen Anliegen vorbeianalysiere.",
    choices,
    deterministic: true,
  };
}
