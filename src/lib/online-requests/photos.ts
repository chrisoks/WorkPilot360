import { createHash } from "crypto";
import sharp, { type Metadata, type OutputInfo } from "sharp";

const MAX_PUBLIC_PHOTO_COUNT = 6;
const MAX_PUBLIC_PHOTO_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_PUBLIC_PHOTO_OUTPUT_BYTES = 3 * 1024 * 1024;
const MAX_PUBLIC_PHOTO_PIXELS = 40_000_000;
const ALLOWED_PUBLIC_PHOTO_FORMATS = new Set(["jpeg", "png", "webp"]);

type PublicPhotoFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ProcessedPublicPhoto = {
  fileName: string;
  mimeType: "image/jpeg";
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
  sortOrder: number;
  data: Buffer;
};

export class PublicPhotoError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 413
  ) {
    super(message);
  }
}

export async function processPublicRequestPhotos(
  files: readonly PublicPhotoFile[]
): Promise<ProcessedPublicPhoto[]> {
  if (files.length > MAX_PUBLIC_PHOTO_COUNT) {
    throw new PublicPhotoError("Es können maximal 6 Fotos übertragen werden.", 413);
  }

  const processed: ProcessedPublicPhoto[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size <= 0 || file.size > MAX_PUBLIC_PHOTO_INPUT_BYTES) {
      throw new PublicPhotoError(
        `Foto ${index + 1} ist leer oder größer als 8 MB.`,
        413
      );
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
      throw new PublicPhotoError(
        `Foto ${index + 1} hat einen nicht erlaubten Dateityp.`,
        400
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    if (input.byteLength !== file.size || input.byteLength > MAX_PUBLIC_PHOTO_INPUT_BYTES) {
      throw new PublicPhotoError(`Foto ${index + 1} hat eine ungültige Größe.`, 413);
    }

    let image = sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_PUBLIC_PHOTO_PIXELS,
      sequentialRead: true,
    });
    let metadata: Metadata;
    try {
      metadata = await image.metadata();
    } catch {
      throw new PublicPhotoError(`Foto ${index + 1} konnte nicht geprüft werden.`, 400);
    }
    if (
      !metadata.format ||
      !ALLOWED_PUBLIC_PHOTO_FORMATS.has(metadata.format) ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new PublicPhotoError(`Foto ${index + 1} ist kein gültiges Einzelbild.`, 400);
    }

    image = image
      .rotate()
      .resize({
        width: 1_800,
        height: 1_800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true });

    let data: Buffer;
    let outputInfo: OutputInfo;
    try {
      const output = await image.toBuffer({ resolveWithObject: true });
      data = output.data;
      outputInfo = output.info;
    } catch {
      throw new PublicPhotoError(`Foto ${index + 1} konnte nicht sicher verarbeitet werden.`, 400);
    }
    if (
      data.byteLength <= 0 ||
      data.byteLength > MAX_PUBLIC_PHOTO_OUTPUT_BYTES ||
      !outputInfo.width ||
      !outputInfo.height
    ) {
      throw new PublicPhotoError(
        `Foto ${index + 1} ist nach der Verarbeitung zu groß.`,
        413
      );
    }

    processed.push({
      fileName: `anfragebild-${String(index + 1).padStart(2, "0")}.jpg`,
      mimeType: "image/jpeg",
      byteSize: data.byteLength,
      sha256: createHash("sha256").update(data).digest("hex"),
      width: outputInfo.width,
      height: outputInfo.height,
      sortOrder: index,
      data,
    });
  }
  return processed;
}
