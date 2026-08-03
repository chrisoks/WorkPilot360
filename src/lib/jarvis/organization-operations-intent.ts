import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisOrganizationOperationsIntent =
  | "invoice_drafts"
  | "utilization"
  | "inactive_customers"
  | "unbilled_projects"
  | "missing_offer_projects"
  | "critical_projects"
  | "offer_rates"
  | "revenue";

export function resolveJarvisOrganizationOperationsIntent(
  question: string
): JarvisOrganizationOperationsIntent | undefined {
  if (extractJarvisProjectReferences(question).length > 0) return undefined;
  const value = normalizeJarvisIntentText(question).replace(/\s+/g, " ").trim();
  if (/\brechnungsentwurf\w*\b.*\b(?:offen|insgesamt|wie viele|zeig|liste)\b|\bwie viele\b.*\brechnungsentwurf\w*\b/.test(value)) return "invoice_drafts";
  if (/\b(?:auslastung|ausgelastet|uberlastet|zu wenig arbeit)\b/.test(value)) return "utilization";
  if (/\bwelche kunden\b.*\b(?:keine aktivitat|nichts passiert|lange nichts|nachfass)/.test(value)) return "inactive_customers";
  if (/\bwelche projekte\b.*\b(?:zeiten|stempel)\b.*\bkeine rechnung\b/.test(value)) return "unbilled_projects";
  if (/\bwelche projekte\b.*\b(?:ohne|kein\w*)\b.*\b(?:gultig\w*\s+)?angebot\b/.test(value)) return "missing_offer_projects";
  if (/\bwelche projekte\b.*\b(?:auffallig|unwirtschaftlich|verlust|marge|kritisch|risiko|gefahrdet)\b|\b(?:analysier|pruf|untersuch)\w*\b.*\b(?:alle\s+)?kritisch\w*\s+projekte\b/.test(value)) return "critical_projects";
  if (/\b(?:wie|welche)\b.*\b(?:annahmequote|offnungsquote)\b/.test(value)) return "offer_rates";
  if (/\b(?:wie viel|wie hoch)\b.*\bumsatz\b/.test(value)) return "revenue";
  return undefined;
}
