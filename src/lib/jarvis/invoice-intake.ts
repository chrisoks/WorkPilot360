import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";

export function looksLikeInvoiceDraftRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /^\s*(?:erstell|erstelle|leg|lege|bereit|mach)\w*\b/.test(value) &&
    /\b(?:rechnung|rechnungsentwurf)\w*\b/.test(value) &&
    !/\b(?:mahn|storn|bezahlt|zahlungsstatus|versend|send|schick|losch|archivier|fakturier)\w*\b/.test(value) &&
    !/\b(?:such|zeig|liste|offen|alt|status|warum|wieso|pruf|pruef)\w*\b/.test(value)
  );
}

export function looksLikeInvoiceFinalizationRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\bfakturier\w*\b/.test(value) &&
    /\b(?:rechnung|rechnungsentwurf)\w*\b/.test(value) &&
    !/\b(?:versend|send|schick|mahn|bezahlt|storn|losch|archivier)\w*\b/.test(
      value
    )
  );
}

export function extractInvoiceNumber(question: string) {
  return question.match(/\bRE-\d+\b/i)?.[0]?.toUpperCase();
}

export function extractInvoiceServiceDate(question: string) {
  const iso = question.match(/\b(20\d{2})-(0[1-9]|1[0-2])-([012]\d|3[01])\b/)?.[0];
  if (iso) return iso;
  const german = question.match(/\b([012]?\d|3[01])\.(0?\d|1[0-2])\.(20\d{2})\b/);
  if (!german) return undefined;
  return `${german[3]}-${german[2].padStart(2, "0")}-${german[1].padStart(2, "0")}`;
}

export function extractInvoiceCompany(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:ok\s*immocare|immocare|oki)\b/.test(value)
    ? ("OK immocare" as const)
    : /\b(?:ok\s*solutions|solutions)\b/.test(value)
      ? ("OK solutions" as const)
      : undefined;
}
