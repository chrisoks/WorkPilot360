import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { CatalogManagementField, CatalogManagementValues, ManagedCatalogType } from "@/lib/catalog/catalog-management-service";

const textFields: Array<[CatalogManagementField, RegExp]> = [
  ["name", /(?:bezeichnung|name)\s*[:=]\s*([^;\n]+)/i], ["category", /(?:kategorie)\s*[:=]\s*([^;\n]+)/i],
  ["trade", /(?:gewerk)\s*[:=]\s*([^;\n]+)/i], ["unit", /(?:einheit)\s*[:=]\s*([^;\n]+)/i],
  ["description", /(?:beschreibung)\s*[:=]\s*([^;\n]+)/i], ["laborCostRateKey", /(?:lohnkostensatz|kostensatz)\s*[:=]\s*([^;\n]+)/i],
  ["defaultPlanningBoard", /(?:standard-?planungsboard|planungsboard)\s*[:=]\s*([^;\n]+)/i],
  ["defaultPlanningGroup", /(?:standard-?planungsgruppe|planungsgruppe)\s*[:=]\s*([^;\n]+)/i],
];
const numberFields: Array<[CatalogManagementField, RegExp]> = [
  ["purchasePrice", /(?:einkaufspreis|selbstkosten|ek)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i],
  ["salesPrice", /(?:verkaufspreis|vk)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i],
  ["vatRate", /(?:umsatzsteuer|mwst|ust)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*%?/i],
  ["planningMinutesPerUnit", /(?:planminuten(?:\s+je\s+einheit)?|minuten\s+je\s+einheit)\s*[:=]\s*(\d+)/i],
];
const booleanFields: Array<[CatalogManagementField, RegExp]> = [
  ["isLaborPosition", /(?:lohnposition)\s*[:=]\s*(ja|nein|true|false)/i],
  ["isPlanningRelevant", /(?:planungsrelevant)\s*[:=]\s*(ja|nein|true|false)/i],
];
const allPatterns = [...textFields, ...numberFields, ...booleanFields].map(([, pattern]) => pattern);

function cleanMatch(value: string | undefined) { return value?.trim().replace(/[.!?]+$/, "").trim(); }
function extractValues(question: string) {
  const values: CatalogManagementValues = {};
  for (const [field, pattern] of textFields) { const value = cleanMatch(question.match(pattern)?.[1]); if (value !== undefined) values[field] = value; }
  for (const [field, pattern] of numberFields) { const value = question.match(pattern)?.[1]; if (value !== undefined) values[field] = Number(value.replace(",", ".")); }
  for (const [field, pattern] of booleanFields) { const value = question.match(pattern)?.[1]?.toLowerCase(); if (value !== undefined) values[field] = value === "ja" || value === "true"; }
  return values;
}

export function looksLikeCatalogManagementRequest(question: string) {
  const normalized = normalizeJarvisIntentText(question);
  return /\b(?:katalogposition|artikel|leistung)\w*\b/.test(normalized) &&
    /\b(?:anleg|erstell|neu|ander|aktualisier|bearbeit|setz|trag)\w*\b/.test(normalized) &&
    allPatterns.some((pattern) => pattern.test(question)) && !/\b(?:paket|kalkulier|rechne)\w*\b/.test(normalized);
}

export function extractCatalogManagementRequest(question: string): { mode: "create" | "update"; catalogNumber?: string; values: CatalogManagementValues } {
  const normalized = normalizeJarvisIntentText(question);
  const mode = /\b(?:anleg|erstell)\w*\b/.test(normalized) || /\bneu\w*\s+(?:artikel|leistung)\w*\b/.test(normalized) ? "create" : "update";
  const catalogNumber = question.match(/\b([AL]\d{3,12})\b/i)?.[1]?.toUpperCase();
  const type: ManagedCatalogType | undefined = /\bleistung\w*\b/.test(normalized) ? "service" : /\bartikel\w*\b/.test(normalized) ? "article" : undefined;
  const values = extractValues(question);
  if (mode === "create" && type) values.type = type;
  if (mode === "create" && catalogNumber) values.number = catalogNumber;
  return { mode, catalogNumber, values };
}
