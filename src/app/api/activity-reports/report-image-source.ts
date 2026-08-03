import { readStoredFileBytes } from "@/lib/storage/document-file";

export type ActivityReportImageSource = {
  name: string;
  mimeType?: string;
  dataUrl?: string;
  storageFileId?: string;
};

export type ResolvedActivityReportImage = {
  bytes: Buffer;
  mimeType: string;
};

export class ActivityReportImageSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityReportImageSourceError";
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function fileIdFromProtectedImagePath(value: string | null | undefined) {
  const source = cleanString(value);
  const match = source.match(/^\/api\/files\/([^/?#]+)(?:[?#].*)?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function decodeImageDataUrl(value: string, imageName: string): ResolvedActivityReportImage {
  const match = value.match(/^data:(image\/(?:jpeg|png));base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) {
    throw new ActivityReportImageSourceError(
      `${imageName} hat kein unterstütztes Bildformat. Bitte das Bild erneut als JPG oder PNG hochladen.`
    );
  }

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength === 0) {
    throw new ActivityReportImageSourceError(`${imageName} enthält keine lesbaren Bilddaten.`);
  }
  return { bytes, mimeType: match[1].toLowerCase() };
}

export async function resolveActivityReportImage(input: {
  organizationId: string;
  projectId: string;
  image: ActivityReportImageSource;
}): Promise<ResolvedActivityReportImage> {
  const imageName = cleanString(input.image.name) || "Bild";
  const explicitFileId = cleanString(input.image.storageFileId);
  const pathFileId = fileIdFromProtectedImagePath(input.image.dataUrl);

  if (explicitFileId && pathFileId && explicitFileId !== pathFileId) {
    throw new ActivityReportImageSourceError(
      `${imageName} verweist auf widersprüchliche geschützte Dateien.`
    );
  }

  const fileId = explicitFileId || pathFileId;
  if (fileId) {
    let stored: Awaited<ReturnType<typeof readStoredFileBytes>>;
    try {
      stored = await readStoredFileBytes({
        organizationId: input.organizationId,
        fileId,
        expectedOwnerType: "project",
        expectedOwnerId: input.projectId,
      });
    } catch {
      throw new ActivityReportImageSourceError(
        `${imageName} konnte nicht aus dem geschützten Dateispeicher geladen werden. Bitte später erneut versuchen.`
      );
    }
    if (!stored) {
      throw new ActivityReportImageSourceError(
        `${imageName} ist für dieses Projekt nicht verfügbar oder der Zugriff ist nicht erlaubt.`
      );
    }
    if (stored.file.contentType !== "image/jpeg" && stored.file.contentType !== "image/png") {
      throw new ActivityReportImageSourceError(
        `${imageName} ist keine unterstützte JPG- oder PNG-Bilddatei.`
      );
    }
    return { bytes: stored.bytes, mimeType: stored.file.contentType };
  }

  const dataUrl = cleanString(input.image.dataUrl);
  if (dataUrl.startsWith("data:")) return decodeImageDataUrl(dataUrl, imageName);

  throw new ActivityReportImageSourceError(
    `${imageName} konnte nicht sicher geladen werden. Bitte das Bild erneut hochladen.`
  );
}
