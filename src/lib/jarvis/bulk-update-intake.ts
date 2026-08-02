import { CONTACT_BULK_CATEGORIES, type ContactBulkCategory, type ContactBulkCategoryRequest } from "@/lib/contacts/contact-bulk-category-service";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

const CATEGORY_ALIASES: Array<[ContactBulkCategory, RegExp]> = [
  ["Privatkunde", /\bprivatkund(?:e|en)?\b/i], ["Lieferant", /\blieferant(?:e|en)?\b/i],
  ["Partner", /\bpartner\b/i], ["Ansprechpartner", /\bansprechpartner\b/i],
  ["Archiv", /\barchivier\w*\b|\barchiv\b/i], ["Kunde", /\bkunden?\b/i],
];

export function looksLikeContactBulkCategoryRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:kontakte?|kunden?)\b/.test(value) && /\b(?:massenander|gruppenaktion|archivier|kategorie|setz|ander)\w*\b/.test(value) && extractCustomerNumbers(question).length >= 2;
}

export function looksLikeContactBulkRollbackRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:massenanderung|gruppenaktion)\b/.test(value) && /\b(?:zuruckroll|ruckgangig|wiederherstell)\w*\b/.test(value);
}

function extractCustomerNumbers(question: string) {
  return [...new Set((question.match(/\b\d{4,18}\b/g) ?? []).map((value) => value.trim()))];
}

export function extractContactBulkCategoryRequest(question: string): ContactBulkCategoryRequest {
  if (looksLikeContactBulkRollbackRequest(question)) {
    const sourceRequestId = question.match(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i)?.[0] ?? question.match(/(?:id|änderung)\s*[:#]?\s*([a-z0-9_-]{8,120})/i)?.[1] ?? "";
    return { mode: "rollback", sourceRequestId };
  }
  const targetCategory = CATEGORY_ALIASES.find(([, pattern]) => pattern.test(question))?.[0];
  if (!targetCategory || !CONTACT_BULK_CATEGORIES.includes(targetCategory)) throw new Error("Bitte nenne eine freigegebene Zielkategorie.");
  return { mode: "apply", customerNumbers: extractCustomerNumbers(question), targetCategory };
}
