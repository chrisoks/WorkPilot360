import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

const MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  marz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

export function looksLikeOfferDraftRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /^\s*(?:erstell|erstelle|leg|lege|bereit|kalkulier|rechne|mach)\w*\b/.test(
      value
    ) &&
    /\b(?:angebot|nachtrag|nachtragsangebot)\w*\b/.test(value) &&
    !/\baufgabe\w*\b/.test(value) &&
    !/\b(?:such|zeig|liste|offen|alt|status|versend|send|schick|losch|archivier)\w*\b/.test(
      value
    )
  );
}

export function looksLikeOfferFinalizationRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\b(?:angebot|angebotsentwurf|nachtragsangebot)\w*\b/.test(value) &&
    /\b(?:finalisier|abschliess|abschließ|fertigstell)\w*\b/.test(value) &&
    !/\b(?:versend|send|schick|gewonnen|verloren|losch|loesch|archivier)\w*\b/.test(value)
  );
}

export function looksLikeOfferDeliveryRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\b(?:angebot|angebots-pdf|angebotsdokument|nachtragsangebot)\w*\b/.test(value) &&
    /\b(?:send|sende|versend|schick)\w*\b/.test(value) &&
    !/\b(?:finalisier|gewonnen|verloren|losch|loesch|archivier)\w*\b/.test(value)
  );
}

export function looksLikeOfferDecisionRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\bangebot\w*\b/.test(value) &&
    /\b(?:gewonnen|verloren|gewinnen|verlieren)\b/.test(value) &&
    /\b(?:markier|setz|entscheide|ist)\w*\b/.test(value)
  );
}

export function looksLikeOfferLifecycleRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\bangebot\w*\b/.test(value) &&
    /\b(?:losch|loesch|entfern|wiederherstell|zuruckhol|reaktivier)\w*\b|\bwieder\s+her\b/.test(value) &&
    !/\b(?:aufgabe|rechnung|termin)\w*\b/.test(value) &&
    !/\b(?:zeig|liste|such|welche|warum|status)\w*\b/.test(value)
  );
}

export function extractOfferLifecycle(question: string) {
  const value = normalizeJarvisIntentText(question);
  const action = /\b(?:wiederherstell|zuruckhol|reaktivier)\w*\b|\bwieder\s+her\b/.test(value)
    ? ("restore" as const)
    : /\b(?:losch|loesch|entfern)\w*\b/.test(value)
      ? ("delete" as const)
      : undefined;
  const reason = question
    .match(/\b(?:Grund|weil|wegen)\s*[:\-]?\s*(.+)$/i)?.[1]
    ?.trim()
    .replace(/[.!?]+$/, "")
    .trim();
  return { action, reason: reason || undefined };
}

export function extractOfferDecision(question: string) {
  const value = normalizeJarvisIntentText(question);
  const decision = /\b(?:verloren|verlieren)\b/.test(value)
    ? ("lost" as const)
    : /\b(?:gewonnen|gewinnen)\b/.test(value)
      ? ("won" as const)
      : undefined;
  const cleanSentenceValue = (input: string | undefined) =>
    input?.trim().replace(/[.!?]+$/, "").trim() || undefined;
  const reason = cleanSentenceValue(
    question.match(/\b(?:Grund|weil|wegen)\s*[:\-]?\s*([^\n.]+(?:\.(?!\s*Kommentar\b)[^\n.]*)?)/i)?.[1]
  );
  const note = cleanSentenceValue(
    question.match(/\bKommentar\s*[:\-]\s*(.+)$/i)?.[1]
  );
  return { decision, reason, note };
}

export function extractOfferNumber(question: string) {
  return question.match(/\bANG-\d+\b/i)?.[0]?.toUpperCase();
}

export function extractOfferExecutionMonth(
  question: string,
  now = new Date()
) {
  const isoMonth = question.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/)?.[0];
  if (isoMonth) return isoMonth;
  const numeric = question.match(
    /\b(?:monat\s+)?(0?[1-9]|1[0-2])[./-](20\d{2})\b/
  );
  if (numeric) {
    return `${numeric[2]}-${numeric[1].padStart(2, "0")}`;
  }
  const value = normalizeJarvisIntentText(question);
  for (const [name, month] of Object.entries(MONTHS)) {
    if (!new RegExp(`\\b${name}\\b`).test(value)) continue;
    const yearMatch = value.match(
      new RegExp(`\\b${name}\\s+(20\\d{2})\\b`)
    );
    const year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  return undefined;
}

export function extractOfferDraftKind(question: string) {
  const value = normalizeJarvisIntentText(question);
  return {
    offerType:
      /\b(?:nachtrag|nachtragsangebot)\w*\b/.test(value)
        ? ("addendum" as const)
        : ("base" as const),
    company:
      /\b(?:ok\s*immocare|immocare|oki)\b/.test(value)
        ? ("OK immocare" as const)
        : /\b(?:ok\s*solutions|solutions)\b/.test(value)
          ? ("OK solutions" as const)
          : undefined,
  };
}
