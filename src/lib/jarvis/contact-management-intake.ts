import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { ContactCreateInput, ContactManagementChanges, ContactManagementField } from "@/lib/contacts/contact-management-service";

const FIELD_ALIASES: Array<[ContactManagementField, RegExp]> = [
  ["companyName", /(?:firma|firmenname|unternehmen)\s*[:=]\s*([^;\n]+)/i],
  ["firstName", /(?:vorname)\s*[:=]\s*([^;\n]+)/i],
  ["lastName", /(?:nachname)\s*[:=]\s*([^;\n]+)/i],
  ["position", /(?:position|funktion)\s*[:=]\s*([^;\n]+)/i],
  ["invoiceEmail", /(?:rechnungs-?e-?mail)\s*[:=]\s*([^;\s\n]+)/i],
  ["activityReportEmail", /(?:tätigkeitsbericht-?e-?mail|bericht-?e-?mail)\s*[:=]\s*([^;\s\n]+)/i],
  ["email", /(?:e-?mail)\s*[:=]\s*([^;\s\n]+)/i],
  ["phone", /(?:telefon|festnetz)\s*[:=]\s*([^;\n]+)/i],
  ["mobile", /(?:mobil|handy)\s*[:=]\s*([^;\n]+)/i],
  ["website", /(?:website|webseite)\s*[:=]\s*([^;\n]+)/i],
  ["source", /(?:quelle)\s*[:=]\s*([^;\n]+)/i],
  ["reachability", /(?:erreichbarkeit)\s*[:=]\s*([^;\n]+)/i],
  ["street", /(?:straße|strasse)\s*[:=]\s*([^;\n]+)/i],
  ["addressLine1", /(?:adresszeile\s*1)\s*[:=]\s*([^;\n]+)/i],
  ["addressLine2", /(?:adresszeile\s*2)\s*[:=]\s*([^;\n]+)/i],
  ["postalCode", /(?:plz|postleitzahl)\s*[:=]\s*([^;\n]+)/i],
  ["city", /(?:ort|stadt)\s*[:=]\s*([^;\n]+)/i],
  ["country", /(?:land)\s*[:=]\s*([^;\n]+)/i],
];

function extractFields(question: string) {
  const values: ContactManagementChanges = {};
  for (const [field, pattern] of FIELD_ALIASES) {
    const value = question.match(pattern)?.[1]?.trim().replace(/[.!?]+$/, "").trim();
    if (value !== undefined) values[field] = value;
  }
  return values;
}

export function looksLikeContactManagementRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:kontakt|kunde|ansprechpartner|firma|privatkunde)\w*\b/.test(value) &&
    /\b(?:anleg|erstell|neu|ander|aktualisier|bearbeit|setz|trag)\w*\b/.test(value) &&
    FIELD_ALIASES.some(([, pattern]) => pattern.test(question));
}

export function extractContactManagementRequest(question: string):
  | { mode: "create"; values: ContactCreateInput }
  | { mode: "update"; customerNumber?: string; values: ContactManagementChanges } {
  const normalized = normalizeJarvisIntentText(question);
  const mode = /\b(?:anleg|erstell|leg)\w*\b/.test(normalized) ||
    /\bneu(?:e|en|er|es)?\s+(?:kontakt|kunde|ansprechpartner|firma|privatkunde)\w*\b/.test(normalized)
    ? "create" : "update";
  const fields = extractFields(question);
  const customerNumber = question.match(/(?:kundennummer|kunden-?nr\.?|kontakt)\s*[:#]?\s*(\d{4,18})\b/i)?.[1];
  if (mode === "update") return { mode, customerNumber, values: fields };
  const type: ContactCreateInput["type"] = /\b(?:firma|unternehmen|gesellschaft)\b/.test(normalized)
    ? "company" : /\bprivatkund\w*\b/.test(normalized) ? "private" : "person";
  return { mode, values: { ...fields, type } };
}
