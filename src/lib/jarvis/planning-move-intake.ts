import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

function normalizeDate(value: string | undefined) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function looksLikePlanningMoveRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:termin|terminwunsch|planung)\w*\b/.test(value) &&
    /\b(?:verschieb|verleg|umbuch)\w*\b/.test(value) &&
    !/\b(?:wie|warum|zeig|liste|welche)\b/.test(value);
}

export function extractPlanningMoveRequest(question: string) {
  const entryId = question.match(/\b(?:Termin(?:wunsch)?-?ID|Planungs-?ID|Termin(?:wunsch)?)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9_-]{5,119})\b/i)?.[1];
  const date = normalizeDate(question.match(/\b(?:auf|am|Datum)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})\b/i)?.[1]);
  const window = question.match(/\b(?:von|Beginn|Start)\s*[:=]?\s*([0-2]\d:[0-5]\d)\s*(?:bis|[-\u2013])\s*([0-2]\d:[0-5]\d)\b/i);
  const startTime = window?.[1] ?? question.match(/\b(?:Beginn|Start)\s*[:=]\s*([0-2]\d:[0-5]\d)\b/i)?.[1];
  const endTime = window?.[2] ?? question.match(/\bEnde\s*[:=]\s*([0-2]\d:[0-5]\d)\b/i)?.[1];
  const overbookingLabel = "(?:\\u00dcberplanung|Ueberplanung|Uberplanung)";
  const overbookingReason = question.match(new RegExp(`${overbookingLabel}\\s*[:=]\\s*(.+?)(?=\\s+Grund\\s*[:=]|$)`, "i"))?.[1]?.trim().replace(/[.!?]+$/, "");
  const reason = question.match(new RegExp(`\\b(?:Grund|weil|wegen)\\s*[:=]?\\s*(.+?)(?=\\s+(?:${overbookingLabel}|Datum|Beginn|Start|Ende)\\s*[:=]|$)`, "i"))?.[1]?.trim().replace(/[.!?]+$/, "");
  return {
    entryId, date, startTime, endTime, reason, overbookingReason,
    seriesRequested: /\b(?:ganze|komplette|alle)\w*\s+(?:serie|terminserie)\b/i.test(question),
  };
}
