import { randomUUID } from "node:crypto";

import type { Prisma, StoredFile } from "@prisma/client";

import { prisma } from "@/lib/db/client";

import { calculateStorageChecksum, storageChecksumsMatch } from "./checksum";
import { loadStorageConfig } from "./config";
import { createStorageProvider } from "./factory";
import { buildStorageObjectKey } from "./object-key";
import type { StorageProvider } from "./provider";
import type { StorageOwnerType } from "./types";

export type StoragePilotAttachment = {
  name: string;
  type: "Bild" | "Dokument";
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  storageFileId?: string;
};

export type PreparedStoredFile = {
  record: Prisma.StoredFileUncheckedCreateInput;
  uploadedInThisAttempt: boolean;
};

export type PreparedStorageAttachments = {
  attachments: StoragePilotAttachment[];
  files: PreparedStoredFile[];
  provider: StorageProvider | null;
  fallbackCount: number;
};

type PrepareStorageAttachmentsInput = {
  organizationId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  sourceType: string;
  category: string;
  documentCategory?: string;
  createdByUserId?: string | null;
  attachments: Array<StoragePilotAttachment & { sourceEntityId?: string }>;
};

const BASE64_DATA_URL = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i;

export class StorageAttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageAttachmentValidationError";
  }
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(BASE64_DATA_URL);
  if (!match) {
    throw new StorageAttachmentValidationError(
      "Der Dateiinhalt ist nicht als gueltige Base64-Datei codiert."
    );
  }
  const declaredContentType = match[1].toLowerCase();
  const body = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!body.length) {
    throw new StorageAttachmentValidationError("Die Datei ist leer.");
  }
  return { body, declaredContentType };
}

function isPdf(body: Uint8Array) {
  return body.length >= 5 && Buffer.from(body.subarray(0, 5)).toString("ascii") === "%PDF-";
}

function isPdfAttachment(attachment: StoragePilotAttachment, declaredContentType: string) {
  return (
    attachment.type === "Dokument" &&
    attachment.name.toLowerCase().endsWith(".pdf") &&
    ["application/pdf", "application/octet-stream"].includes(declaredContentType)
  );
}

function detectImageContentType(body: Uint8Array): string | null {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    body.length >= 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47 &&
    body[4] === 0x0d &&
    body[5] === 0x0a &&
    body[6] === 0x1a &&
    body[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    body.length >= 12 &&
    Buffer.from(body.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(body.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const signature = Buffer.from(body.subarray(0, 6)).toString("ascii");
  if (signature === "GIF87a" || signature === "GIF89a") {
    return "image/gif";
  }
  return null;
}

function extensionForContentType(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/pdf":
      return "pdf";
    default:
      return undefined;
  }
}

function publicFilePath(fileId: string) {
  return `/api/files/${encodeURIComponent(fileId)}`;
}

function genericStorageError(error: unknown) {
  if (error instanceof Error && error.name === "StorageAttachmentValidationError") {
    throw error;
  }
  return "Externer Dateispeicher voruebergehend nicht erreichbar; Datenbank-Fallback aktiv.";
}

async function existingFile(
  organizationId: string,
  sourceType: string,
  sourceEntityId: string
) {
  return prisma.storedFile.findUnique({
    where: {
      organizationId_sourceType_sourceEntityId: {
        organizationId,
        sourceType,
        sourceEntityId,
      },
    },
  });
}

export async function prepareStorageAttachments(
  input: PrepareStorageAttachmentsInput
): Promise<PreparedStorageAttachments> {
  let provider: StorageProvider | null = null;
  let bucket = "";
  try {
    const config = loadStorageConfig();
    if (config.provider === "disabled") {
      return {
        attachments: input.attachments,
        files: [],
        provider: null,
        fallbackCount: 0,
      };
    }
    provider = createStorageProvider(config);
    bucket = config.bucket;
  } catch (error) {
    console.error("Storage pilot configuration unavailable", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return {
      attachments: input.attachments,
      files: [],
      provider: null,
      fallbackCount: input.attachments.filter((attachment) => {
        if (!attachment.dataUrl?.startsWith("data:")) return false;
        return attachment.type === "Bild" || attachment.name.toLowerCase().endsWith(".pdf");
      }).length,
    };
  }

  if (!provider) {
    return {
      attachments: input.attachments,
      files: [],
      provider: null,
      fallbackCount: 0,
    };
  }

  const attachments: StoragePilotAttachment[] = [];
  const files: PreparedStoredFile[] = [];
  let fallbackCount = 0;

  for (const [index, attachment] of input.attachments.entries()) {
    if (!attachment.dataUrl?.startsWith("data:")) {
      attachments.push(attachment);
      continue;
    }

    const { body, declaredContentType } = decodeDataUrl(attachment.dataUrl);
    const detectedImageContentType = attachment.type === "Bild" ? detectImageContentType(body) : null;
    const pdfAttachment = isPdfAttachment(attachment, declaredContentType);
    const detectedContentType = detectedImageContentType || (pdfAttachment && isPdf(body) ? "application/pdf" : null);

    if (attachment.type === "Dokument" && !pdfAttachment) {
      attachments.push(attachment);
      continue;
    }

    if (
      !detectedContentType ||
      (detectedImageContentType && detectedImageContentType !== declaredContentType)
    ) {
      throw new StorageAttachmentValidationError(
        `Datei "${attachment.name}" stimmt nicht mit ihrem angegebenen Dateityp ueberein.`
      );
    }

    const storageCategory =
      detectedContentType === "application/pdf"
        ? input.documentCategory || input.category
        : input.category;

    const checksum = calculateStorageChecksum(body);
    const checksumHex = checksum.slice("sha256:".length);
    const sourceEntityId =
      attachment.sourceEntityId?.trim() || `${input.ownerId}:${index}:${checksumHex}`;
    const prior = await existingFile(input.organizationId, input.sourceType, sourceEntityId);
    const fileId = prior?.id ?? randomUUID();
    const objectKey =
      prior?.objectKey ??
      buildStorageObjectKey({
        organizationId: input.organizationId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        category: storageCategory,
        extension: extensionForContentType(detectedContentType),
        objectId: fileId,
      });

    if (
      prior?.status === "available" &&
      prior.sha256 === checksumHex &&
      prior.sizeBytes === body.byteLength
    ) {
      attachments.push({
        name: attachment.name,
        type: attachment.type,
        mimeType: detectedContentType,
        size: body.byteLength,
        storageFileId: prior.id,
        dataUrl: publicFilePath(prior.id),
      });
      files.push({ record: prior, uploadedInThisAttempt: false });
      continue;
    }

    const baseRecord: Prisma.StoredFileUncheckedCreateInput = {
      id: fileId,
      organizationId: input.organizationId,
      storageProvider: "s3",
      storageBucket: bucket,
      objectKey,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      sourceType: input.sourceType,
      sourceEntityId,
      category: storageCategory,
      originalName: attachment.name,
      contentType: detectedContentType,
      sizeBytes: body.byteLength,
      sha256: checksumHex,
      status: "pending",
      createdByUserId: input.createdByUserId || null,
    };

    try {
      const stored = await provider.put({
        key: objectKey,
        body,
        contentType: detectedContentType,
        checksum,
        metadata: {
          organizationId: input.organizationId,
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          category: storageCategory,
          originalName: attachment.name,
          contentType: detectedContentType,
          sizeBytes: body.byteLength,
          checksum,
        },
      });
      const verified = await provider.stat(objectKey);
      if (
        !verified ||
        verified.sizeBytes !== body.byteLength ||
        !verified.checksum ||
        !storageChecksumsMatch(checksum, verified.checksum)
      ) {
        throw new Error("storage_verification_failed");
      }
      files.push({
        record: {
          ...baseRecord,
          status: "available",
          etag: stored.etag || verified.etag || null,
          availableAt: new Date(),
          lastError: null,
        },
        uploadedInThisAttempt: true,
      });
      attachments.push({
        name: attachment.name,
        type: attachment.type,
        mimeType: detectedContentType,
        size: body.byteLength,
        storageFileId: fileId,
        dataUrl: publicFilePath(fileId),
      });
    } catch (error) {
      const lastError = genericStorageError(error);
      console.error("Storage pilot upload failed; database fallback retained", {
        ownerType: input.ownerType,
        sourceType: input.sourceType,
        error: error instanceof Error ? error.name : "unknown",
      });
      files.push({
        record: {
          ...baseRecord,
          status: "failed",
          lastError,
        },
        uploadedInThisAttempt: false,
      });
      attachments.push(attachment);
      fallbackCount += 1;
    }
  }

  return { attachments, files, provider, fallbackCount };
}

export async function persistPreparedStoredFiles(
  tx: Prisma.TransactionClient,
  prepared: PreparedStorageAttachments
) {
  for (const file of prepared.files) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...update } =
      file.record as Prisma.StoredFileUncheckedCreateInput & Partial<StoredFile>;
    await tx.storedFile.upsert({
      where: {
        organizationId_sourceType_sourceEntityId: {
          organizationId: file.record.organizationId,
          sourceType: file.record.sourceType,
          sourceEntityId: file.record.sourceEntityId,
        },
      },
      create: file.record,
      update,
    });
  }
}

export async function cleanupPreparedStorageUploads(
  prepared: PreparedStorageAttachments
) {
  if (!prepared.provider) return;
  await Promise.allSettled(
    prepared.files
      .filter((file) => file.uploadedInThisAttempt)
      .map((file) => prepared.provider!.delete(file.record.objectKey))
  );
}
