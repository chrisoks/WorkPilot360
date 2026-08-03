import { readStoredFileBytes } from "@/lib/storage/document-file";

export const MAX_DOCUMENT_MAIL_ADDITIONAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export type GraphFileAttachment = {
  "@odata.type": "#microsoft.graph.fileAttachment";
  name: string;
  contentType: string;
  contentBytes: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeAttachmentName(value: unknown) {
  return cleanText(value).replace(/[\r\n]/g, "").slice(0, 180) || "Dokument";
}

export function findReminderAttachment(entries: Array<{ attachments: unknown }>, documentNumber: string) {
  const expectedName = `${documentNumber.replace(/\.pdf$/i, "")}.pdf`.toLowerCase();
  return entries
    .flatMap((entry) => Array.isArray(entry.attachments) ? entry.attachments : [])
    .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : null)
    .find((item) => cleanText(item?.name).toLowerCase() === expectedName && cleanText(item?.mimeType) === "application/pdf");
}

function storedFileIdFromUrl(value: string) {
  const match = value.match(/^\/api\/files\/([^/?#]+)(?:[?#].*)?$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function dataUrlAttachment(name: string, dataUrl: string): GraphFileAttachment | null {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([a-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.byteLength) return null;
  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: safeAttachmentName(name),
    contentType: cleanText(match[1]) || "application/octet-stream",
    contentBytes: bytes.toString("base64"),
  };
}

export async function resolveDocumentMailAttachment(input: {
  organizationId: string;
  projectId: string;
  attachment: Record<string, unknown>;
}): Promise<GraphFileAttachment | null> {
  const name = safeAttachmentName(input.attachment.name);
  const dataUrl = cleanText(input.attachment.dataUrl);
  const inline = dataUrlAttachment(name, dataUrl);
  if (inline) return inline;

  const fileId = cleanText(input.attachment.storageFileId) || storedFileIdFromUrl(dataUrl);
  if (!fileId || !input.projectId) return null;
  const stored = await readStoredFileBytes({
    organizationId: input.organizationId,
    fileId,
    expectedOwnerType: "project",
    expectedOwnerId: input.projectId,
  });
  if (!stored) return null;
  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: cleanText(input.attachment.name) ? safeAttachmentName(input.attachment.name) : safeAttachmentName(stored.file.originalName),
    contentType: stored.file.contentType || "application/octet-stream",
    contentBytes: stored.bytes.toString("base64"),
  };
}

export async function resolveDocumentMailAttachments(input: {
  organizationId: string;
  projectId: string;
  value: unknown;
  target?: "invoice" | "activityReport";
}) {
  if (!Array.isArray(input.value)) return [];
  const candidates = input.value
    .map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => {
      if (!input.target) return true;
      const target = cleanText(item.target) || "both";
      return target === "both" || target === input.target;
    });
  const resolved = await Promise.all(candidates.map((attachment) => resolveDocumentMailAttachment({
    organizationId: input.organizationId,
    projectId: input.projectId,
    attachment,
  })));
  if (resolved.some((attachment) => !attachment)) {
    throw new Error("Mindestens ein Zusatzanhang wurde nicht gefunden oder gehört nicht zu diesem Projekt.");
  }
  return resolved.filter((attachment): attachment is GraphFileAttachment => Boolean(attachment));
}

export function assertAdditionalAttachmentSize(attachments: GraphFileAttachment[]) {
  const bytes = attachments.reduce((sum, attachment) => sum + Buffer.from(attachment.contentBytes, "base64").byteLength, 0);
  if (bytes > MAX_DOCUMENT_MAIL_ADDITIONAL_ATTACHMENT_BYTES) {
    throw new Error("Die ausgewählten Zusatzanhänge sind größer als 15 MB.");
  }
}
