import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/client";
import {
  cleanupStorageBackedPayload,
  persistStorageBackedPayload,
  prepareStorageBackedPayload,
  readStoredFileBytes,
} from "@/lib/storage/document-file";

export type InvoiceArtifactKind = "xrechnung" | "zugferd";

function artifactDefinition(kind: InvoiceArtifactKind) {
  return kind === "xrechnung"
    ? {
        sourceType: "invoice-xrechnung-xml",
        category: "e-invoices",
        contentType: "application/xml" as const,
        suffix: "-xrechnung.xml",
      }
    : {
        sourceType: "invoice-zugferd-pdf",
        category: "e-invoices",
        contentType: "application/pdf" as const,
        suffix: "-zugferd.pdf",
      };
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function archiveInvoiceArtifact(input: {
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  kind: InvoiceArtifactKind;
  bytes: Uint8Array;
  createdByUserId?: string | null;
}) {
  const definition = artifactDefinition(input.kind);
  const checksum = sha256(input.bytes);
  const existing = await prisma.storedFile.findFirst({
    where: {
      organizationId: input.organizationId,
      ownerType: "invoice",
      ownerId: input.invoiceId,
      sourceType: definition.sourceType,
      sha256: checksum,
      status: "available",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const prepared = await prepareStorageBackedPayload({
    organizationId: input.organizationId,
    ownerType: "invoice",
    ownerId: input.invoiceId,
    sourceType: definition.sourceType,
    category: definition.category,
    originalName: `${input.invoiceNumber}${definition.suffix}`,
    contentType: definition.contentType,
    bytes: input.bytes,
    createdByUserId: input.createdByUserId,
  });
  if (!prepared.storedFileId) return null;
  try {
    await prisma.$transaction(async (tx) => {
      await persistStorageBackedPayload(tx, prepared);
    });
  } catch (error) {
    await cleanupStorageBackedPayload(prepared);
    throw error;
  }
  return prisma.storedFile.findFirst({
    where: {
      id: prepared.storedFileId,
      organizationId: input.organizationId,
      status: "available",
      deletedAt: null,
    },
  });
}

export async function archiveAndResolveInvoiceArtifact(input: {
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  kind: InvoiceArtifactKind;
  bytes: Uint8Array;
  createdByUserId?: string | null;
}) {
  const file = await archiveInvoiceArtifact(input);
  if (!file) return Buffer.from(input.bytes);
  const stored = await readStoredFileBytes({
    organizationId: input.organizationId,
    fileId: file.id,
    expectedOwnerType: "invoice",
    expectedOwnerId: input.invoiceId,
  });
  if (!stored) throw new Error("invoice_artifact_storage_verification_failed");
  return stored.bytes;
}
