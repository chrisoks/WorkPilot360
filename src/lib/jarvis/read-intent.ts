import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";

export type JarvisRecordKind = "project" | "customer" | "task" | "offer" | "invoice";
export type JarvisRecordFilter = "all" | "open" | "today" | "overdue";

export type JarvisReadIntent = {
  kind: JarvisRecordKind;
  query: string;
  filter: JarvisRecordFilter;
  contextRecordId?: string;
  summarize: boolean;
};

export type JarvisReadIntentHint = {
  kind: JarvisRecordKind;
  filter?: JarvisRecordFilter;
};

const READ_INTENT_MARKERS = [
  "finde",
  "finden",
  "suche",
  "such",
  "offne",
  "öffne",
  "oeffne",
  "zeige",
  "zeig",
  "welche",
  "welcher",
  "welches",
  "fasse",
  "zusammenfassung",
  "status von",
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s./_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKind(normalized: string): JarvisRecordKind | undefined {
  if (/\b(rechnung|rechnungen|rechnung nr|rechnungsnummer)\b/.test(normalized)) return "invoice";
  if (/\b(angebot|angebote|angebotsnummer|nachtragsangebot)\b/.test(normalized)) return "offer";
  if (/\b(aufgabe|aufgaben|todo|to do)\b/.test(normalized)) return "task";
  if (/\b(kunde|kunden|kontakt|kontakte|firma|ansprechpartner)\b/.test(normalized)) return "customer";
  if (/\b(projekt|projekte|projektnummer)\b/.test(normalized)) return "project";
  return undefined;
}

function getFilter(kind: JarvisRecordKind, normalized: string): JarvisRecordFilter {
  if (
    (kind === "invoice" || kind === "task") &&
    /\buberfallig\w*\b/.test(normalized)
  ) {
    return "overdue";
  }
  if (kind === "task" && /\bheute\b/.test(normalized)) return "today";
  if (/\b(offen|offene|offenen|noch offen)\b/.test(normalized)) return "open";
  return "all";
}

function cleanQuery(kind: JarvisRecordKind, question: string) {
  const normalized = normalize(question);
  const entityWords: Record<JarvisRecordKind, string[]> = {
    project: ["projekt", "projekte", "projektnummer"],
    customer: ["kunde", "kunden", "kontakt", "kontakte", "firma", "ansprechpartner"],
    task: ["aufgabe", "aufgaben", "todo", "to do"],
    offer: ["angebot", "angebote", "angebotsnummer", "nachtragsangebot"],
    invoice: ["rechnung", "rechnungen", "rechnungsnummer", "rechnung nr"],
  };
  const removable = [
    ...READ_INTENT_MARKERS,
    ...entityWords[kind],
    "bitte",
    "mir",
    "die",
    "den",
    "das",
    "der",
    "dieses",
    "diesen",
    "dieser",
    "kurz",
    "ist",
    "sind",
    "alle",
    "noch",
    "offen",
    "offene",
    "offenen",
    "uberfallig",
    "uberfallige",
    "uberfalligen",
    "heute",
    "zusammen",
    "status",
    "von",
    "wie",
    "viel",
    "viele",
    "hoch",
    "haben",
    "hat",
    "wir",
    "unsere",
    "unseren",
    "unserer",
    "im",
    "unternehmen",
    "organisation",
    "gibt",
    "es",
  ].sort((first, second) => second.length - first.length);

  let query = ` ${normalized} `;
  removable.forEach((word) => {
    query = query.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
  });
  return query.replace(/\s+/g, " ").replace(/^[\s:.-]+|[\s:?.-]+$/g, "").trim().slice(0, 120);
}

export function resolveJarvisReadIntent(
  question: string,
  context: JarvisSurfaceContext = {},
  hint?: JarvisReadIntentHint
): JarvisReadIntent | undefined {
  const normalized = normalize(question);
  const asksHowToSearchOrOpen =
    /\bwie\s+(?:kann\s+ich\s+)?(?:suche|such|finde|offne|oeffne)\s+ich\b/.test(
      normalized
    ) ||
    /\bwie\s+kann\s+ich\b.*\b(?:suchen|finden|offnen|oeffnen)\b/.test(
      normalized
    );
  if (asksHowToSearchOrOpen) return undefined;
  const kind = getKind(normalized) ?? hint?.kind;
  if (
    !kind ||
    (!hint &&
      !READ_INTENT_MARKERS.some((marker) =>
        normalized.includes(normalize(marker))
      ))
  ) {
    return undefined;
  }
  const explicitSearchOrOpen = /\b(finde|finden|suche|such|offne|oeffne)\b/.test(normalized);
  if (!hint && /\bwie\b/.test(normalized) && !explicitSearchOrOpen) {
    return undefined;
  }

  const summarize = /\b(fasse|zusammenfassung|status von)\b/.test(normalized);
  const filter = hint?.filter ?? getFilter(kind, normalized);
  const explicitlyAsksForCollection =
    (kind === "project" && /\bprojekte\b/.test(normalized)) ||
    (kind === "customer" && /\b(kunden|kontakte)\b/.test(normalized)) ||
    filter !== "all";
  const contextMatches =
    !explicitlyAsksForCollection &&
    ((kind === "project" && context.recordType === "project") ||
      (kind === "customer" && context.recordType === "customer"));
  const contextRecordId = contextMatches && context.recordId ? context.recordId : undefined;

  return {
    kind,
    query: contextRecordId ? "" : cleanQuery(kind, question),
    filter,
    contextRecordId,
    summarize,
  };
}
