export type ActivityReportImageAttachment = {
  name: string;
  type: "Bild" | "Dokument";
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  storageFileId?: string;
};

export type ActivityReportImageEntry = {
  [key: string]: unknown;
  id: string;
  projectId?: string;
  title: string | null;
  attachments: unknown;
  projectMonth: string | null;
  createdAt: Date;
};

export type SelectedActivityReportImage = ActivityReportImageAttachment & {
  entryDate: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanAttachments(value: unknown): ActivityReportImageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const name = cleanString(candidate.name);
    const type = candidate.type === "Bild" ? "Bild" : candidate.type === "Dokument" ? "Dokument" : null;
    if (!name || !type) return [];
    return [{
      name,
      type,
      mimeType: cleanString(candidate.mimeType) || undefined,
      size: typeof candidate.size === "number" ? candidate.size : undefined,
      dataUrl: cleanString(candidate.dataUrl) || undefined,
      storageFileId: cleanString(candidate.storageFileId) || undefined,
    }];
  });
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getReportImageIdentity(image: ActivityReportImageAttachment) {
  const normalizedFileStem = cleanString(image.name)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ");
  return normalizedFileStem || cleanString(image.dataUrl).slice(0, 240);
}

export function getReportImages(
  entries: ActivityReportImageEntry[],
  category: "Vorherbilder" | "Nachherbilder",
  month: string,
  useMonth: boolean,
  selectedKeys: string[] = []
) {
  const uniqueImages = new Map<string, SelectedActivityReportImage>();
  const selectedKeySet = new Set(selectedKeys);

  entries
    .filter((entry) => entry.title === `Bilder: ${category}`)
    .filter(
      (entry) =>
        !useMonth ||
        entry.projectMonth === month ||
        (!entry.projectMonth && getMonthKey(entry.createdAt) === month)
    )
    .forEach((entry) => {
      cleanAttachments(entry.attachments).forEach((attachment, attachmentIndex) => {
        const sourceKey = `${entry.id}:${attachmentIndex}:${attachment.name}`;
        if (attachment.type !== "Bild" || (!attachment.dataUrl && !attachment.storageFileId)) return;
        if (selectedKeySet.size > 0 && !selectedKeySet.has(sourceKey)) return;

        const key = getReportImageIdentity(attachment);
        if (!uniqueImages.has(key)) {
          uniqueImages.set(key, { ...attachment, entryDate: entry.createdAt });
        }
      });
    });

  return Array.from(uniqueImages.values());
}
