import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

const REFERENCE_PATTERN = /\bOKI-\d{8}-[A-F0-9]{6}\b/i;

export function looksLikeOnlineRequestConversionRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    REFERENCE_PATTERN.test(question) &&
    /\b(?:wandle|umwandeln|umwandeln lassen|konvertiere|konvertieren|ubernimm|ubernehmen)\b/.test(
      value
    ) &&
    !/\b(?:bereit|voraussetzung|blockiert|fehlt|pruf|zeige|erklare)\b/.test(
      value
    )
  );
}

export function extractOnlineRequestConversionReference(question: string) {
  return question.match(REFERENCE_PATTERN)?.[0]?.toUpperCase() ?? null;
}
