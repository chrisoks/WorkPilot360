import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { EmployeeCostField, EmployeeCostValues } from "@/lib/employee-costs/employee-cost-management-service";

const fields: Array<[EmployeeCostField, RegExp]> = [
  ["monthlySalary", /(?:monatsgehalt(?:\s+brutto)?|bruttogehalt)\s*[:=]\s*([\d.,]+)/i],
  ["fullCostFactor", /(?:vollkostenfaktor)\s*[:=]\s*([\d.,]+)/i],
  ["annualHours", /(?:jahresstunden(?:\s+gesamt)?)\s*[:=]\s*([\d.,]+)/i],
  ["vacationDays", /(?:urlaubstage)\s*[:=]\s*([\d.,]+)/i],
  ["trainingDays", /(?:schulungstage|fortbildungstage)\s*[:=]\s*([\d.,]+)/i],
  ["sickDays", /(?:krankheitstage)\s*[:=]\s*([\d.,]+)/i],
  ["hoursPerDay", /(?:stunden\s+pro\s+arbeitstag|arbeitsstunden\s+pro\s+tag)\s*[:=]\s*([\d.,]+)/i],
];

function parseGermanNumber(value: string) {
  const cleanValue = value.replace(/[.,]$/, "");
  const normalized = cleanValue.includes(",")
    ? cleanValue.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(cleanValue)
      ? cleanValue.replace(/\./g, "")
      : cleanValue;
  return Number(normalized);
}

export function looksLikeEmployeeCostManagementRequest(question: string) {
  const normalized = normalizeJarvisIntentText(question);
  return /\b(?:lohnkosten|mitarbeiterkosten|personalkosten|gehalt)\w*\b/.test(normalized) &&
    /\b(?:ander|aktualisier|bearbeit|setz|trag)\w*\b/.test(normalized) &&
    fields.some(([, pattern]) => pattern.test(question));
}

export function extractEmployeeCostManagementRequest(question: string): { employeeEmail?: string; changes: EmployeeCostValues } {
  const employeeEmail = question.match(/(?:mitarbeiter|benutzer|für|von)\s+([^;:\s]+@[^;:\s]+)/i)?.[1]?.trim().replace(/[.!?]+$/, "").toLowerCase();
  const changes: EmployeeCostValues = {};
  for (const [field, pattern] of fields) {
    const raw = question.match(pattern)?.[1];
    if (raw !== undefined) changes[field] = parseGermanNumber(raw);
  }
  return { employeeEmail, changes };
}
