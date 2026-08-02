function clean(value: unknown, maxLength = 1000) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function looksLikeContactDeletionRequest(question: string) {
  const normalized = clean(question).toLowerCase();
  return /\b(kontakt|kunde|kundin)\b/.test(normalized) && /\b(lösch\w*|loesch\w*|entfern\w*)\b/.test(normalized);
}

export function extractContactDeletionRequest(question: string) {
  const text = clean(question, 4000);
  const customerNumber = text.match(/\b(?:kundennummer|kunden-?nr\.?|kontakt)\s*[:#-]?\s*([0-9]{5,18})\b/i)?.[1]
    ?? text.match(/\b([0-9]{5,18})\b/)?.[1]
    ?? "";
  const reason = clean(text.match(/\bgrund\s*:\s*(.+)$/i)?.[1], 1000);
  return { customerNumber, reason };
}
