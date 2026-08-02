import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export function looksLikeProjectLifecycleRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:archivier|wiederherstell|reaktivier)\w*\b|\bwieder\s+her\b/.test(value) &&
    (/\bprojekt\w*\b/.test(value) || /\b[a-z]{2,8}-\d{1,10}\b/.test(value)) &&
    !/\b(?:warum|welche|zeig|liste|erklar)\w*\b/.test(value);
}

export function extractProjectLifecycleRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  const projectNumber = question.match(/\b([A-ZÄÖÜ]{2,8}-\d{1,10})\b/i)?.[1]?.toUpperCase();
  const reason = question.match(/\b(?:Grund|weil|wegen)\s*[:\-]?\s*(.+)$/i)?.[1]?.trim().replace(/[.!?]+$/, "").trim();
  const lifecycleAction = /\b(?:wiederherstell|reaktivier)\w*\b|\bwieder\s+her\b/.test(value) ? "restore" as const : /\barchivier\w*\b/.test(value) ? "archive" as const : undefined;
  return { projectNumber, lifecycleAction, reason: reason || undefined };
}
