import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

import { storageChecksumsMatch } from "./checksum";
import { loadStorageConfig } from "./config";
import { createStorageProvider } from "./factory";
import {
  cleanupPreparedStorageUploads,
  persistPreparedStoredFiles,
  prepareStorageAttachments,
  type PreparedStorageAttachments,
} from "./file-pilot";
import type { GetStorageObjectResult } from "./provider";
import type { StorageOwnerType } from "./types";

const STORED_FILE_REFERENCE_PREFIX = "stored-file:";

export type PreparedStorageBackedPayload = {
  prepared: PreparedStorageAttachments;
  storedFileId: string | null;
  reference: string | null;
};

type PrepareStorageBackedPayloadInput = {
  organizationId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  sourceType: string;
  category: string;
  originalName: string;
  contentType: "application/pdf" | "application/xml" | "image/jpeg" | "image/png";
  bytes: Uint8Array;
  createdByUserId?: string | null;
};

function attachmentType(contentType: string) {
  return contentType.startsWith("image/") ? ("Bild" as const) : ("Dokument" as const);
}

function extensionMatches(name: string, contentType: string) {
  if (contentType === "application/pdf") return name.toLowerCase().endsWith(".pdf");
  if (contentType === "application/xml") return name.toLowerCase().endsWith(".xml");
  return true;
}

export function storedFileReference(fileId: string) {
  return `${STORED_FILE_REFERENCE_PREFIX}${fileId}`;
}

export function storedFileIdFromReference(value: string | null | undefined) {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean.startsWith(STORED_FILE_REFERENCE_PREFIX)) return null;
  return clean.slice(STORED_FILE_REFERENCE_PREFIX.length).trim() || null;
}

export function isStoredFileReference(value: string | null | undefined) {
  return Boolean(storedFileIdFromReference(value));
}

export async function prepareStorageBackedPayload(
  input: PrepareStorageBackedPayloadInput
): Promise<PreparedStorageBackedPayload> {
  if (!input.bytes.byteLength) {
    throw new Error("Leere Dateien koennen nicht ausgelagert werden.");
  }
  if (!extensionMatches(input.originalName, input.contentType)) {
    throw new Error("Dateiname und Dateityp stimmen nicht ueberein.");
  }

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const prepared = await prepareStorageAttachments({
    organizationId: input.organizationId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    sourceType: input.sourceType,
    category: input.category,
    documentCategory: input.category,
    createdByUserId: input.createdByUserId,
    attachments: [
      {
        name: input.originalName,
        type: attachmentType(input.contentType),
        mimeType: input.contentType,
        size: input.bytes.byteLength,
        dataUrl: `data:${input.contentType};base64,${Buffer.from(input.bytes).toString("base64")}`,
        // Aenderungen eines Belegs erzeugen eine neue, verifizierbare Version.
        // Dadurch wird ein bereits funktionsfaehiges Objekt nie vor dem DB-Commit ueberschrieben.
        sourceEntityId: `${input.ownerId}:${sha256}`,
      },
    ],
  });
  const storedFileId = prepared.attachments[0]?.storageFileId || null;
  return {
    prepared,
    storedFileId,
    reference: storedFileId ? storedFileReference(storedFileId) : null,
  };
}

export async function persistStorageBackedPayload(
  tx: Prisma.TransactionClient,
  payload: PreparedStorageBackedPayload
) {
  await persistPreparedStoredFiles(tx, payload.prepared);
}

export async function cleanupStorageBackedPayload(payload: PreparedStorageBackedPayload) {
  await cleanupPreparedStorageUploads(payload.prepared);
}

export async function externalizePdfPayload(input: {
  organizationId: string;
  ownerType: "offer" | "invoice";
  ownerId: string;
  sourceType: "offer-pdf" | "invoice-pdf";
  category: string;
  originalName: string;
  pdfBase64: string | null | undefined;
  createdByUserId?: string | null;
  writeReference: (tx: Prisma.TransactionClient, reference: string) => Promise<unknown>;
}) {
  if (!input.pdfBase64 || isStoredFileReference(input.pdfBase64)) return false;
  const bytes = Buffer.from(input.pdfBase64, "base64");
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Das erzeugte PDF hat keine gueltige PDF-Signatur.");
  }
  const prepared = await prepareStorageBackedPayload({
    organizationId: input.organizationId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    sourceType: input.sourceType,
    category: input.category,
    originalName: input.originalName,
    contentType: "application/pdf",
    bytes,
    createdByUserId: input.createdByUserId,
  });
  if (!prepared.reference) return false;
  try {
    await prisma.$transaction(async (tx) => {
      await persistStorageBackedPayload(tx, prepared);
      await input.writeReference(tx, prepared.reference!);
    });
    return true;
  } catch (error) {
    await cleanupStorageBackedPayload(prepared);
    console.error("Verified PDF externalization rolled back", {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

async function collectBody(body: GetStorageObjectResult["body"]) {
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function readStoredFileBytes(input: {
  organizationId: string;
  fileId: string;
  expectedOwnerType?: string;
  expectedOwnerId?: string;
}) {
  const file = await prisma.storedFile.findFirst({
    where: {
      id: input.fileId,
      organizationId: input.organizationId,
      status: "available",
      deletedAt: null,
      ...(input.expectedOwnerType ? { ownerType: input.expectedOwnerType } : {}),
      ...(input.expectedOwnerId ? { ownerId: input.expectedOwnerId } : {}),
    },
  });
  if (!file) return null;

  const config = loadStorageConfig();
  const provider = createStorageProvider(config);
  if (!provider || config.provider !== "s3" || config.bucket !== file.storageBucket) {
    throw new Error("storage_not_active");
  }
  const object = await provider.get(file.objectKey);
  if (!object || object.sizeBytes !== file.sizeBytes) {
    throw new Error("storage_size_mismatch");
  }
  if (
    object.checksum &&
    !storageChecksumsMatch(`sha256:${file.sha256}`, object.checksum)
  ) {
    throw new Error("storage_checksum_mismatch");
  }
  const bytes = await collectBody(object.body);
  if (bytes.byteLength !== file.sizeBytes) throw new Error("storage_stream_size_mismatch");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== file.sha256) throw new Error("storage_stream_checksum_mismatch");
  return { bytes, file };
}

export async function resolveStorageBackedBytes(input: {
  organizationId: string;
  payload: string | null | undefined;
  expectedOwnerType?: string;
  expectedOwnerId?: string;
}) {
  const fileId = storedFileIdFromReference(input.payload);
  if (!fileId) {
    return input.payload ? Buffer.from(input.payload, "base64") : null;
  }
  const stored = await readStoredFileBytes({
    organizationId: input.organizationId,
    fileId,
    expectedOwnerType: input.expectedOwnerType,
    expectedOwnerId: input.expectedOwnerId,
  });
  return stored?.bytes ?? null;
}

export async function resolveStorageBackedBase64(input: {
  organizationId: string;
  payload: string | null | undefined;
  expectedOwnerType?: string;
  expectedOwnerId?: string;
}) {
  const bytes = await resolveStorageBackedBytes(input);
  return bytes ? bytes.toString("base64") : "";
}
