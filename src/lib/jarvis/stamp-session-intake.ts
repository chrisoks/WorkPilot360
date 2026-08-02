import type { StampSessionTransition } from "@/lib/time/stamp-session-service";

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractStampSessionTransition(
  question: string
): StampSessionTransition | null {
  const value = normalize(question);
  if (!value || !/\b(stempel\w*|timer|arbeitszeit)\b/.test(value)) {
    return null;
  }
  if (
    /\b(zeige|status|laeuft|laufe|ist|warum|wie|wann|welche|pruefe|kontrolliere)\b/.test(
      value
    ) &&
    !/\b(pausier\w*|fortsetz\w*|setze\b.*\bfort|starte wieder|weiterlaufen)\b/.test(
      value
    )
  ) {
    return null;
  }
  if (/\b(pausier\w*|pause einlegen)\b/.test(value)) {
    return "pause";
  }
  if (
    /\b(fortsetz\w*|starte wieder|weiterlaufen|weiter stempeln|pause beenden)\b/.test(value) ||
    /\bsetze\b.*\bfort\b/.test(value) ||
    /\bbeende\b.*\bstempelpause\b/.test(value)
  ) {
    return "resume";
  }
  return null;
}

export function looksLikeStampSessionTransitionRequest(question: string) {
  return extractStampSessionTransition(question) !== null;
}
