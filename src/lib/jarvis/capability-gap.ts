import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import { resolveJarvisOrganizationOperationsIntent } from "@/lib/jarvis/organization-operations-intent";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";

const ORGANIZATION_ANALYSIS_PATTERNS = [
  /\b(?:rechnungsentwurf|rechnungsentwurfe)\b.*\b(?:offen|insgesamt|wie viele)\b/,
  /\bwie viele\b.*\brechnungsentwurf\w*\b/,
  /\b(?:auslastung|ausgelastet|uberlastet|zu wenig arbeit)\b/,
  /\bwelche kunden\b.*\b(?:keine aktivitat|nichts passiert|lange nichts|nachfass)/,
  /\bwelche projekte\b.*\b(?:zeiten|stempel)\b.*\bkeine rechnung\b/,
  /\bwelche projekte\b.*\b(?:ohne|kein\w*)\b.*\b(?:gültig\w*\s+)?angebot\b/,
  /\bwelche projekte\b.*\b(?:auffallig|unwirtschaftlich|verlust|marge)\b/,
  /\bwelche projekte\b.*\b(?:kritisch|risiko|gefahrdet)\b/,
  /\b(?:analysier|pruf|untersuch)\w*\b.*\b(?:alle\s+)?kritisch\w*\s+projekte\b/,
  /\bwelche (?:artikel|materialien|leistungen)\b.*\b(?:am haufigsten|meisten)\b/,
  /\b(?:wie|welche)\b.*\b(?:annahmequote|offnungsquote)\b/,
  /\b(?:wie viel|wie hoch)\b.*\b(?:umsatz)\b/,
];

export function resolveJarvisCapabilityGap(
  question: string
): JarvisReadResponse | undefined {
  if (extractJarvisProjectReferences(question).length > 0) return undefined;
  if (resolveJarvisOrganizationOperationsIntent(question)) return undefined;
  const value = normalizeJarvisIntentText(question);
  if (!ORGANIZATION_ANALYSIS_PATTERNS.some((pattern) => pattern.test(value))) {
    return undefined;
  }
  return {
    type: "unknown",
    topicId: "capability.analysis-adapter-missing",
    message:
      "Diese unternehmensweite Auswertung ist noch nicht sicher an JARVIS angebunden. Deshalb behaupte ich weder, dass es keine Treffer gibt, noch nenne ich eine geratene Zahl. Die Daten können derzeit direkt in der passenden WorkPilot360-Auswertung geprüft werden; der dafür notwendige JARVIS-Datenadapter wird im vorgesehenen Entwicklungsschritt ergänzt.",
    deterministic: true,
  };
}
