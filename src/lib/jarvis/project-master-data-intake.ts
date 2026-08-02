import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { ProjectMasterDataChanges, ProjectMasterDataField } from "@/lib/projects/project-master-data-service";

const FIELD_ALIASES: Array<[ProjectMasterDataField, RegExp]> = [
  ["title", /(?:projekttitel|titel|projektname)\s*[:=]\s*([^;\n]+)/i],
  ["description", /(?:projektbeschreibung|beschreibung)\s*[:=]\s*([^;\n]+)/i],
  ["projectRuntimeFrom", /(?:laufzeit\s+von|startmonat)\s*[:=]\s*(\d{4}-(?:0[1-9]|1[0-2]))/i],
  ["projectRuntimeUntil", /(?:laufzeit\s+bis|endmonat)\s*[:=]\s*(\d{4}-(?:0[1-9]|1[0-2]))/i],
  ["trade", /(?:gewerk)\s*[:=]\s*([^;\n]+)/i],
  ["address", /(?:projektadresse|adresse)\s*[:=]\s*([^;\n]+)/i],
  ["participants", /(?:beteiligte|teilnehmer)\s*[:=]\s*([^;\n]+)/i],
  ["responsibleName", /(?:projektverantwort(?:licher|liche|ung)?|verantwortlich)\s*[:=]\s*([^;\n]+)/i],
  ["deputyName", /(?:vertretung|stellvertretung)\s*[:=]\s*([^;\n]+)/i],
  ["deputyFrom", /(?:vertretung\s+von)\s*[:=]\s*(\d{4}-(?:0[1-9]|1[0-2]))/i],
  ["deputyUntil", /(?:vertretung\s+bis)\s*[:=]\s*(\d{4}-(?:0[1-9]|1[0-2]))/i],
];

export function looksLikeProjectMasterDataChangeRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:ander|aktualisier|bearbeit|setz|trag)\w*\b/.test(value) &&
    (/\bprojekt\w*\b/.test(value) || /\b[a-z]{2,8}-\d{1,10}\b/.test(value)) &&
    FIELD_ALIASES.some(([, pattern]) => pattern.test(question)) &&
    !/\b(?:status|archivier|wiederherstell)\w*\b/.test(value);
}

export function extractProjectMasterDataChangeRequest(question: string) {
  const projectNumber = question.match(/\b([A-ZÄÖÜ]{2,8}-\d{1,10})\b/i)?.[1]?.toUpperCase();
  const changes: ProjectMasterDataChanges = {};
  for (const [field, pattern] of FIELD_ALIASES) {
    const value = question.match(pattern)?.[1]?.trim().replace(/[.!?]+$/, "").trim();
    if (value !== undefined) changes[field] = value;
  }
  return { projectNumber, changes };
}
