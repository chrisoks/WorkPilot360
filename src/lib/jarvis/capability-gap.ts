import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";

const ORGANIZATION_ANALYSIS_PATTERNS = [
  /\boffen\w*\s+posten\b/,
  /\b(?:rechnungsentwurf|rechnungsentwurfe)\b.*\b(?:offen|insgesamt|wie viele)\b/,
  /\bwie viele\b.*\brechnungsentwurf\w*\b/,
  /\b(?:offene|uberfallige)\b.*\b(?:forderung|posten)\b/,
  /\bangebot\w*\b.*\b(?:mehr als|alter als)\b.*\b\d+\s+tag\w*\b.*\boffen\b/,
  /\b(?:auslastung|ausgelastet|uberlastet|zu wenig arbeit)\b/,
  /\bwelche kunden\b.*\b(?:keine aktivitat|nichts passiert|lange nichts|nachfass)/,
  /\bwelche projekte\b.*\b(?:zeiten|stempel)\b.*\bkeine rechnung\b/,
  /\bwelche projekte\b.*\b(?:ohne|kein\w*)\b.*\b(?:gültig\w*\s+)?angebot\b/,
  /\bwelche projekte\b.*\b(?:auffallig|unwirtschaftlich|verlust|marge)\b/,
  /\bwelche (?:artikel|materialien|leistungen)\b.*\b(?:am haufigsten|meisten)\b/,
  /\b(?:wie|welche)\b.*\b(?:annahmequote|offnungsquote)\b/,
  /\b(?:wie viel|wie hoch)\b.*\b(?:uberfallig|umsatz|forderungen)\b/,
];

export function resolveJarvisCapabilityGap(
  question: string
): JarvisReadResponse | undefined {
  if (extractJarvisProjectReferences(question).length > 0) return undefined;
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
