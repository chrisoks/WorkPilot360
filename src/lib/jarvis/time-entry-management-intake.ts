import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

function normalizeDate(value: string | undefined) {
  if (!value) return undefined;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const german = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/);
  if (!german) return undefined;
  const year = Number(german[3]) < 100 ? 2000 + Number(german[3]) : Number(german[3]);
  return `${year}-${german[2].padStart(2, "0")}-${german[1].padStart(2, "0")}`;
}

export function looksLikeTimeEntryManagementRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\b(?:zeiteintrag|zeitbuchung|arbeitszeit)\w*\b/.test(value) &&
    /\b(?:korrigier|ander|aender|losch|loesch|entfern)\w*\b/.test(value) &&
    !/\b(?:wie|warum|welche|zeig|liste|such)\b/.test(value) &&
    !/\b(?:stempelung|einstempel|ausstempel)\w*\b/.test(value)
  );
}

export function extractTimeEntryManagement(question: string) {
  const normalized = normalizeJarvisIntentText(question);
  const action = /\b(?:losch|loesch|entfern)\w*\b/.test(normalized)
    ? ("delete" as const)
    : ("update" as const);
  const entryId = question.match(
    /\b(?:Zeiteintrags?-ID|Zeitbuchungs?-ID|Zeiteintrag)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9_-]{5,119})\b/i
  )?.[1];
  const reason = question
    .match(/\b(?:Grund|weil|wegen)\s*[:\-]?\s*(.+?)(?=\s+\b(?:Datum|Beginn|Start|Ende|Pause|Kommentar)\b\s*[:=]|$)/i)?.[1]
    ?.trim()
    .replace(/[.!?]+$/, "")
    .trim();
  const date = normalizeDate(
    question.match(/\bDatum\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})\b/i)?.[1]
  );
  const startTime = question.match(/\b(?:Beginn|Start)\s*[:=]?\s*([0-2]\d:[0-5]\d)\b/i)?.[1];
  const endTime = question.match(/\bEnde\s*[:=]?\s*([0-2]\d:[0-5]\d)\b/i)?.[1];
  const pauseMinutesValue = question.match(/\bPause\s*[:=]?\s*(\d{1,4})\s*(?:Min(?:uten?)?)?\b/i)?.[1];
  const comment = question.match(/\bKommentar\s*[:=]\s*(.+?)(?=\s+\b(?:Grund|Datum|Beginn|Start|Ende|Pause)\b\s*[:=]|$)/i)?.[1]?.trim();
  const changes = action === "update"
    ? {
        ...(date ? { date } : {}),
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(pauseMinutesValue ? { pauseMs: Number(pauseMinutesValue) * 60_000 } : {}),
        ...(comment !== undefined ? { comment } : {}),
      }
    : undefined;
  return {
    action,
    entryId,
    reason,
    ...(changes && Object.keys(changes).length ? { changes } : {}),
  };
}
