import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export type JarvisOrganizationOperationsIntent =
  | "invoice_drafts"
  | "utilization"
  | "today_planning"
  | "today_time"
  | "pending_overtime"
  | "recurring_month_gaps"
  | "monthly_quota_available"
  | "customer_risk"
  | "inactive_customers"
  | "unbilled_projects"
  | "missing_offer_projects"
  | "critical_projects"
  | "offer_rates"
  | "customer_revenue"
  | "revenue";

export function resolveJarvisOrganizationOperationsIntent(
  question: string
): JarvisOrganizationOperationsIntent | undefined {
  if (extractJarvisProjectReferences(question).length > 0) return undefined;
  const value = normalizeJarvisIntentText(question).replace(/\s+/g, " ").trim();
  if (/\brechnungsentwurf\w*\b.*\b(?:offen|insgesamt|wie viele|zeig|liste)\b|\bwie viele\b.*\brechnungsentwurf\w*\b/.test(value)) return "invoice_drafts";
  if (/\b(?:auslastung|ausgelastet|uberlastet|zu wenig arbeit)\b/.test(value)) return "utilization";
  if (/\bwelche termin\w*\b.*\b(?:habe ich|fur mich|meine)\b.*\bheute\b|\bwelche termin\w*\b.*\bheute\b/.test(value)) return "today_planning";
  if (/\bwelche zeit\w*\b.*\b(?:habe ich|von mir|meine)\b.*\bheute\b.*\bgestempel\w*\b|\bwelche zeit\w*\b.*\bheute\b.*\bgestempel\w*\b/.test(value)) return "today_time";
  if (/\bwelche uberstund\w*\b.*\b(?:warten|offen|ausstehend)\b.*\bfreigab\w*\b/.test(value)) return "pending_overtime";
  if (/\bwelche dauerlauf\w*\b.*\boffen\w*\s+monat\w*\b/.test(value)) return "recurring_month_gaps";
  if (/\bwelche monatspauschal\w*\b.*\b(?:frei|freies|verfugbar)\w*\b.*\bkontingent\w*\b/.test(value)) return "monthly_quota_available";
  if (/\bwelche kundenbeziehung\w*\b.*\b(?:gefahrdet|kritisch|risiko)\w*\b/.test(value)) return "customer_risk";
  if (/\bwelche kunden\b.*\b(?:keine aktivitat|nichts passiert|lange nichts|nachfass)/.test(value)) return "inactive_customers";
  if (/\bwelche projekte\b.*\b(?:zeiten|stempel)\b.*\bkeine rechnung\b|\bwelche projektzeiten\b.*\b(?:noch nicht abgerechnet|nicht abgerechnet|offen)\b/.test(value)) return "unbilled_projects";
  if (/\bwelche projekte\b.*\b(?:ohne|kein\w*)\b.*\b(?:gultig\w*\s+)?angebot\b/.test(value)) return "missing_offer_projects";
  if (/\bwelche projekte\b.*\b(?:auffallig|unwirtschaftlich|verlust|marge|kritisch|risiko|gefahrdet)\b|\b(?:analysier|pruf|untersuch)\w*\b.*\b(?:alle\s+)?kritisch\w*\s+projekte\b/.test(value)) return "critical_projects";
  if (/\b(?:wie|welche)\b.*\b(?:annahmequote|offnungsquote)\b/.test(value)) return "offer_rates";
  if (/\bwelche kunden\b.*\b(?:meisten|hochsten|großten)\b.*\bumsatz\b|\bumsatzstark\w*\s+kunden\b/.test(value)) return "customer_revenue";
  if (/\b(?:wie viel|wie hoch)\b.*\bumsatz\b/.test(value)) return "revenue";
  return undefined;
}
