export const DOCUMENT_BCC_KINDS = [
  "offer",
  "invoice",
  "cancellation",
  "reminder",
  "activityReport",
  "document",
] as const;

export type DocumentBccKind = (typeof DOCUMENT_BCC_KINDS)[number];

const DOCUMENT_BCC_KIND_SET = new Set<string>(DOCUMENT_BCC_KINDS);

export function normalizeDocumentBccKinds(value: unknown): DocumentBccKind[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is DocumentBccKind =>
      typeof entry === "string" && DOCUMENT_BCC_KIND_SET.has(entry)
    )
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
}

export function getConfiguredDocumentBccRecipients(
  account: { bcc?: unknown; bccDocumentKinds?: unknown },
  kind: string
): string[] {
  if (!normalizeDocumentBccKinds(account.bccDocumentKinds).includes(kind as DocumentBccKind)) {
    return [];
  }

  const rawBcc = typeof account.bcc === "string" ? account.bcc : "";
  return rawBcc
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, entries) =>
      entries.findIndex((candidate) => candidate.toLocaleLowerCase() === entry.toLocaleLowerCase()) === index
    );
}
