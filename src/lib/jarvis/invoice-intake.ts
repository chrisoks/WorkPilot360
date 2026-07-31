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

export function looksLikeInvoiceDeliveryRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\brechnung\w*\b/.test(value) &&
    /\b(?:send|sende|versend|schick)\w*\b/.test(value) &&
    !/\b(?:fakturier|mahn|bezahlt|storn|losch|loesch|archivier)\w*\b/.test(
      value
    ) &&
    !/\bprojekt\w*\b.*\b(?:losch|loesch|entfern)\w*\b/.test(value)
  );
}

export function looksLikeInvoicePaymentRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    (/(?:^|\s)re-\d+\b/.test(value) ||
      /\b(?:rechnung|zahlungseingang)\w*\b/.test(value)) &&
    /\b(?:markier|kennzeichne|buche|setz)\w*\b/.test(value) &&
    /\b(?:bezahlt|zahlungseingang)\w*\b/.test(value) &&
    !/\b(?:mahn|storn|versend|send|schick|losch|loesch|archivier|fakturier)\w*\b/.test(
      value
    ) &&
    !/^\s*(?:ist|war|wurde|zeig|pruf|pruef|welch|wann|warum|wieso)\w*\b/.test(
      value
    )
  );
}

export function looksLikeInvoiceReminderRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    (/(?:^|\s)re-\d+\b/.test(value) || /\brechnung\w*\b/.test(value)) &&
    /\b(?:mahn\w*|zahlungserinnerung\w*)\b/.test(value) &&
    /\b(?:erstell|erstelle|erzeuge|leg|lege|mahn)\w*\b/.test(value) &&
    !/\b(?:versend|send|schick|bezahlt|zahlungseingang|storn|losch|loesch|archivier|fakturier)\w*\b/.test(
      value
    ) &&
    !/^\s*(?:ist|war|wurde|zeig|pruf|pruef|welch|wann|warum|wieso)\w*\b/.test(
      value
    )
  );
}

export function looksLikeInvoiceCancellationRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    (/(?:^|\s)re-\d+\b/.test(value) || /\brechnung\w*\b/.test(value)) &&
    /\b(?:stornier|storno)\w*\b/.test(value) &&
    !/\b(?:teil|teilweise|gutschrift|rechnungskorrektur)\w*\b/.test(value) &&
    !/^\s*(?:ist|war|wurde|zeig|pruf|pruef|welch|wann|warum|wieso|wie)\w*\b/.test(value)
  );
}

export function looksLikeInvoiceCreditRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    (/(?:^|\s)re-\d+\b/.test(value) || /\brechnung\w*\b/.test(value)) &&
    /\b(?:gutschrift|teilgutschrift|rechnungskorrektur|teilstorno|teilweise\s+storn|storn\w*\s+.*teilweise)\w*\b/.test(value)
  );
}

export function looksLikeInvoiceLifecycleRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  const command = value.split(/\b(?:grund|weil|wegen)\b/, 1)[0] || value;
  return (
    (/(?:^|\s)re-\d+\b/.test(command) || /\b(?:rechnung|rechnungsentwurf)\w*\b/.test(command)) &&
    /\b(?:losch|loesch|entfern|wiederherstell|zuruckhol|reaktivier)\w*\b|\bwieder\s+her\b/.test(command) &&
    !/\b(?:angebot|aufgabe|projekt|termin)\w*\b/.test(command) &&
    !/\b(?:zeig|liste|such|welche|warum|status)\w*\b/.test(command)
  );
}

export function extractInvoiceLifecycle(question: string) {
  const value = normalizeJarvisIntentText(question);
  const action = /\b(?:wiederherstell|zuruckhol|reaktivier)\w*\b|\bwieder\s+her\b/.test(value)
    ? ("restore" as const)
    : /\b(?:losch|loesch|entfern)\w*\b/.test(value)
      ? ("delete" as const)
      : undefined;
  const reason = question
    .match(/\b(?:Grund|weil|wegen)\s*[:\-]?\s*(.+)$/i)?.[1]
    ?.trim()
    .replace(/[.!?]+$/, "")
    .trim();
  return { action, reason: reason || undefined };
}

export function extractInvoiceCancellationReason(question: string) {
  const match = question.match(/(?:grund|weil|wegen)\s*[:=-]?\s*(.{3,500})$/i);
  return match?.[1]?.trim();
}

export const extractInvoiceCreditReason = extractInvoiceCancellationReason;

export function extractInvoiceCreditNetAmount(question: string) {
  const normalized = question.replace(/\./g, "").replace(/,(?=\d{1,2}\b)/g, ".");
  const afterAmount = normalized.match(/\b(\d+(?:\.\d{1,2})?)\s*(?:eur|euro|€)\s*netto\b/i);
  const beforeAmount = normalized.match(/\bnetto\s*(?:über|in höhe von|von)?\s*(\d+(?:\.\d{1,2})?)\s*(?:eur|euro|€)?\b/i);
  const value = Number(afterAmount?.[1] ?? beforeAmount?.[1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
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

export const extractInvoicePaymentDate = extractInvoiceServiceDate;

export function extractInvoiceReminderDeadline(question: string) {
  const match = question.match(
    /(?:bis|zahlungsfrist(?:\s+bis)?)\s+((?:20\d{2}-(?:0[1-9]|1[0-2])-(?:[012]\d|3[01]))|(?:(?:[012]?\d|3[01])\.(?:0?\d|1[0-2])\.20\d{2}))/i
  );
  return match ? extractInvoiceServiceDate(match[1]) : undefined;
}

export function extractInvoiceCompany(question: string) {
  const value = normalizeJarvisIntentText(question);
  return /\b(?:ok\s*immocare|immocare|oki)\b/.test(value)
    ? ("OK immocare" as const)
    : /\b(?:ok\s*solutions|solutions)\b/.test(value)
      ? ("OK solutions" as const)
      : undefined;
}
