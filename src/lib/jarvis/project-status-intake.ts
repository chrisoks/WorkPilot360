import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import { normalizeProjectOperationalStatus } from "@/lib/projects/project-status-service";

export function looksLikeProjectStatusChangeRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    (/\bprojekt(?:status)?\b|\bstatus\b/.test(value) || /\b[a-z]{2,8}-\d{1,10}\b/.test(value)) &&
    /\b(?:setz|stell|ander|wechsel|verschieb)\w*\b/.test(value) &&
    !/\b(?:warum|welche|zeig|liste|erklar|aktueller?)\w*\b/.test(value)
  );
}

export function extractProjectStatusChange(question: string) {
  const projectNumber = question.match(/\b([A-ZÄÖÜ]{2,8}-\d{1,10})\b/i)?.[1]?.toUpperCase();
  const reason = question.match(/\b(?:Grund|weil|wegen)\s*[:\-]?\s*(.+)$/i)?.[1]?.trim().replace(/[.!?]+$/, "").trim();
  const command = question.split(/\b(?:Grund|weil|wegen)\b/i, 1)[0] || question;
  const targetMatch = command.match(/\b(?:auf|in|zu)\s+[„“"]?([^„“".,!?;:]{2,80})/i)?.[1];
  const cleanedTarget = targetMatch
    ?.replace(/\b(?:beim|für|vom|des)\s+projekt\b.*$/i, "")
    .replace(/\b(?:bitte|jetzt)\b/gi, "")
    .trim();
  const targetStatus = normalizeProjectOperationalStatus(cleanedTarget);
  return { projectNumber, targetStatus: targetStatus || undefined, reason: reason || undefined };
}
