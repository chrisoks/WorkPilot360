import { Role } from "@prisma/client";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { PersonnelManagementField, PersonnelManagementValues } from "@/lib/users/personnel-management-service";

const textFields: Array<[PersonnelManagementField, RegExp]> = [
  ["firstName", /(?:vorname)\s*[:=]\s*([^;\n]+)/i], ["lastName", /(?:nachname)\s*[:=]\s*([^;\n]+)/i],
  ["email", /(?:dienstliche\s+)?e-?mail\s*[:=]\s*([^;\s\n]+)/i], ["personalNumber", /(?:personalnummer)\s*[:=]\s*([^;\n]+)/i],
  ["phone", /(?:telefon)\s*[:=]\s*([^;\n]+)/i], ["mobile", /(?:mobil(?:telefon)?)\s*[:=]\s*([^;\n]+)/i],
  ["street", /(?:straße|strasse)\s*[:=]\s*([^;\n]+)/i], ["postalCode", /(?:postleitzahl|plz)\s*[:=]\s*([^;\n]+)/i], ["city", /(?:ort|stadt)\s*[:=]\s*([^;\n]+)/i],
  ["planningBoard", /(?:planungsboard)\s*[:=]\s*([^;\n]+)/i], ["planningGroup", /(?:planungsgruppe)\s*[:=]\s*([^;\n]+)/i],
];
const rolePattern = /(?:rolle)\s*[:=]\s*([^;\n]+)/i;
const roleMap: Array<[RegExp, Role]> = [[/^(?:admin)$/i, Role.ADMIN], [/^(?:geschäftsführung|geschaeftsfuehrung|gf)$/i, Role.GESCHAEFTSFUEHRER], [/^(?:führungskraft|fuehrungskraft)$/i, Role.FUEHRUNGSKRAFT], [/^vertrieb$/i, Role.VERTRIEB], [/^buchhaltung$/i, Role.BUCHHALTUNG], [/^mitarbeiter$/i, Role.MITARBEITER], [/^gast$/i, Role.GAST]];
const clean = (value: string | undefined) => value?.trim().replace(/[.!?]+$/, "").trim();

export function looksLikePersonnelManagementRequest(question: string) {
  const normalized = normalizeJarvisIntentText(question);
  return /\b(?:mitarbeiter|personalstammdaten|benutzer)\w*\b/.test(normalized) && /\b(?:ander|aktualisier|bearbeit|setz|trag)\w*\b/.test(normalized) && (textFields.some(([, pattern]) => pattern.test(question)) || rolePattern.test(question)) && !/\b(?:passwort|lohn|gehalt|kosten|losch|deaktivier|aktivier|anleg|erstell)\w*\b/.test(normalized);
}

export function looksLikeRestrictedPersonnelManagementRequest(question: string) {
  const normalized = normalizeJarvisIntentText(question);
  return /\b(?:mitarbeiter|personalstammdaten|benutzer)\w*\b/.test(normalized) && /\b(?:ander|aktualisier|bearbeit|setz|trag|losch|deaktivier|aktivier|anleg|erstell)\w*\b/.test(normalized) && /\b(?:passwort|lohn|gehalt|kosten|losch|deaktivier|aktivier|anleg|erstell)\w*\b/.test(normalized);
}

export function extractPersonnelManagementRequest(question: string): { employeeEmail?: string; changes: PersonnelManagementValues } {
  const employeeEmail = clean(question.match(/(?:mitarbeiter|benutzer)\s+([^;:\s]+@[^;:\s]+)/i)?.[1])?.toLowerCase();
  const changes: PersonnelManagementValues = {};
  for (const [field, pattern] of textFields) { const value = clean(question.match(pattern)?.[1]); if (value !== undefined) changes[field] = value; }
  const roleValue = clean(question.match(rolePattern)?.[1]);
  if (roleValue) changes.role = roleMap.find(([pattern]) => pattern.test(roleValue))?.[1] ?? roleValue.toUpperCase();
  return { employeeEmail, changes };
}
