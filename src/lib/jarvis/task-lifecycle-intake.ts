import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export function looksLikeTaskLifecycleRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  const command = value.split(/\b(?:grund|weil|wegen)\b/, 1)[0] || value;
  return (
    /\baufgabe\w*\b/.test(command) &&
    /\b(?:archivier|losch|loesch|entfern|wiederherstell|zuruckhol|reaktivier)\w*\b|\bwieder\s+her\b/.test(command) &&
    !/\b(?:rechnung|angebot|projekt|termin)\w*\b/.test(command) &&
    !/\b(?:zeig|liste|such|welche|warum|status)\w*\b/.test(command)
  );
}

export function extractTaskLifecycle(question: string) {
  const normalized = normalizeJarvisIntentText(question);
  const command = normalized.split(/\b(?:grund|weil|wegen)\b/, 1)[0] || normalized;
  const action = /\b(?:wiederherstell|zuruckhol|reaktivier)\w*\b|\bwieder\s+her\b/.test(command)
    ? ("restore" as const)
    : /\b(?:archivier|losch|loesch|entfern)\w*\b/.test(command)
      ? ("archive" as const)
      : undefined;
  const reason = question
    .match(/\b(?:Grund|weil|wegen)\s*[:\-]?\s*(.+)$/i)?.[1]
    ?.trim()
    .replace(/[.!?]+$/, "")
    .trim();
  const taskId = question.match(/\bAufgaben-ID\s*[:#]?\s*([A-Za-z0-9_-]{6,120})\b/i)?.[1];
  const commandOriginal = question.split(/\b(?:Grund|weil|wegen)\b/i, 1)[0]?.trim() || "";
  const quotedTitle = commandOriginal.match(/[„“"]([^„“"]{1,180})[„“"]/u)?.[1]?.trim();
  const title = quotedTitle || commandOriginal
    .replace(/\b(?:archivier(?:e|en|t)?|lösch(?:e|en|t)?|loesch(?:e|en|t)?|entfern(?:e|en|t)?|wiederherstell(?:e|en|t)?|zurückhol(?:e|en|t)?|zurueckhol(?:e|en|t)?|reaktivier(?:e|en|t)?|stell(?:e|en|t))\b/giu, " ")
    .replace(/\bwieder\s+her\b/giu, " ")
    .replace(/\b(?:bitte|die|eine?|meine?|diese?|folgende?|endgültig|physisch)\b/giu, " ")
    .replace(/\baufgabe(?:n)?\b/giu, " ")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return { action, reason: reason || undefined, title: title || undefined, taskId: taskId || undefined };
}
