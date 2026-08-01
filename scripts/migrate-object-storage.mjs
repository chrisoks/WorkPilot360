import { createHash, randomUUID } from "node:crypto";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const modeArg = process.argv.find((value) => value.startsWith("--apply="));
const mode = modeArg?.slice("--apply=".length) || "dry-run";
if (!["dry-run", "mirror", "switch"].includes(mode)) {
  throw new Error("Erlaubt sind --apply=mirror oder --apply=switch; ohne Parameter erfolgt nur ein Dry-Run.");
}
const batchArg = process.argv.find((value) => value.startsWith("--batch="));
const batchSize = Math.min(Math.max(Number(batchArg?.slice(8)) || 25, 1), 100);
const scopeArg = process.argv.find((value) => value.startsWith("--scope="));
const scopes = new Set(
  (scopeArg?.slice(8) || "offers,invoices,logbook,winter-reports,winter-images,employee-documents")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

const storageEnabled = mode !== "dry-run";
const bucket = storageEnabled ? required("WORKPILOT_S3_BUCKET") : process.env.WORKPILOT_S3_BUCKET || "dry-run";
const client = storageEnabled
  ? new S3Client({
      endpoint: required("WORKPILOT_S3_ENDPOINT"),
      region: required("WORKPILOT_S3_REGION"),
      forcePathStyle: process.env.WORKPILOT_S3_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: required("WORKPILOT_S3_ACCESS_KEY_ID"),
        secretAccessKey: required("WORKPILOT_S3_SECRET_ACCESS_KEY"),
      },
      maxAttempts: 3,
    })
  : null;

const totals = { candidates: 0, mirrored: 0, switched: 0, skipped: 0, bytes: 0, failed: 0 };

function safeSegment(value, label) {
  const clean = String(value || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(clean)) {
    throw new Error(`${label} ist kein sicherer technischer Bezeichner.`);
  }
  return clean;
}

function decodeDataUrl(value) {
  const match = String(value || "").match(/^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  return { contentType: match[1].toLowerCase(), bytes: Buffer.from(match[2].replace(/\s/g, ""), "base64") };
}

function extensionFor(contentType, originalName) {
  const known = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[contentType];
  if (known) return known;
  const extension = String(originalName || "").match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase();
  return extension || "bin";
}

function storageReference(id) {
  return `stored-file:${id}`;
}

function publicFilePath(id) {
  return `/api/files/${encodeURIComponent(id)}`;
}

async function ensureStoredFile(input) {
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const existing = await prisma.storedFile.findUnique({
    where: {
      organizationId_sourceType_sourceEntityId: {
        organizationId: input.organizationId,
        sourceType: input.sourceType,
        sourceEntityId: input.sourceEntityId,
      },
    },
  });
  const id = existing?.id || randomUUID();
  const now = new Date();
  const category = input.category.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const objectKey = existing?.objectKey || [
    "organizations",
    safeSegment(input.organizationId, "organizationId"),
    input.ownerType,
    safeSegment(input.ownerId, "ownerId"),
    category,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${id}.${extensionFor(input.contentType, input.originalName)}`,
  ].join("/");

  if (!storageEnabled) {
    return { id, sha256, objectKey, dryRun: true };
  }

  let verified = null;
  if (existing?.status === "available" && existing.sha256 === sha256 && existing.sizeBytes === input.bytes.byteLength) {
    try {
      verified = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    } catch {
      verified = null;
    }
  }
  const metadataChecksum = verified?.Metadata?.sha256;
  if (verified?.ContentLength !== input.bytes.byteLength || metadataChecksum !== sha256) {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: input.bytes,
      ContentType: input.contentType,
      ContentLength: input.bytes.byteLength,
      ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
      Metadata: {
        sha256,
        organization: input.organizationId,
        owner: input.ownerType,
        ownerid: input.ownerId,
        category,
      },
    }));
    verified = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  }
  if (verified.ContentLength !== input.bytes.byteLength || verified.Metadata?.sha256 !== sha256) {
    throw new Error("Objektprüfung nach Upload fehlgeschlagen.");
  }

  await prisma.storedFile.upsert({
    where: { id },
    create: {
      id,
      organizationId: input.organizationId,
      storageProvider: "s3",
      storageBucket: bucket,
      objectKey,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      sourceType: input.sourceType,
      sourceEntityId: input.sourceEntityId,
      category,
      originalName: input.originalName,
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
      sha256,
      status: "available",
      etag: String(verified.ETag || "").replace(/^"|"$/g, "") || null,
      availableAt: new Date(),
    },
    update: {
      storageBucket: bucket,
      objectKey,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      category,
      originalName: input.originalName,
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
      sha256,
      status: "available",
      etag: String(verified.ETag || "").replace(/^"|"$/g, "") || null,
      availableAt: new Date(),
      lastError: null,
      deletedAt: null,
    },
  });
  totals.mirrored += 1;
  totals.bytes += input.bytes.byteLength;
  return { id, sha256, objectKey };
}

async function migrateScalarRows({ label, rows, ownerType, ownerIdField = "id", sourceType, category, numberField, update }) {
  const candidates = rows.filter((row) => row.pdfData && !row.pdfData.startsWith("stored-file:"));
  totals.skipped += rows.length - candidates.length;
  for (const row of candidates.slice(0, batchSize)) {
    const payload = row.pdfData;
    const bytes = Buffer.from(payload, "base64");
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      console.error(`${label} ${row.id}: ungültige PDF-Signatur`);
      totals.failed += 1;
      continue;
    }
    totals.candidates += 1;
    try {
      const ownerId = row[ownerIdField];
      const stored = await ensureStoredFile({
        organizationId: row.organizationId,
        ownerType,
        ownerId,
        sourceType,
        sourceEntityId: `${ownerId}:${createHash("sha256").update(bytes).digest("hex")}`,
        category,
        originalName: `${row[numberField] || row.id}.pdf`,
        contentType: "application/pdf",
        bytes,
      });
      if (mode === "switch") {
        await update(row.id, storageReference(stored.id));
        totals.switched += 1;
      }
    } catch (error) {
      totals.failed += 1;
      console.error(`${label} ${row.id}: ${error instanceof Error ? error.message : "Fehler"}`);
    }
  }
}

async function migrateOffers() {
  const rows = await prisma.offer.findMany({
    where: { pdfData: { not: null } },
    select: { id: true, organizationId: true, offerNumber: true, pdfData: true },
    orderBy: { createdAt: "asc" },
  });
  await migrateScalarRows({
    label: "Angebot", rows, ownerType: "offer", sourceType: "offer-pdf", category: "offers", numberField: "offerNumber",
    update: (id, pdfData) => prisma.offer.update({ where: { id }, data: { pdfData } }),
  });
}

async function migrateInvoices() {
  const rows = await prisma.invoice.findMany({
    where: { pdfData: { not: null } },
    select: { id: true, organizationId: true, invoiceNumber: true, pdfData: true },
    orderBy: { createdAt: "asc" },
  });
  await migrateScalarRows({
    label: "Rechnung", rows, ownerType: "invoice", sourceType: "invoice-pdf", category: "invoices", numberField: "invoiceNumber",
    update: (id, pdfData) => prisma.invoice.update({ where: { id }, data: { pdfData } }),
  });
}

async function migrateLogbook() {
  const rows = await prisma.projectLogbookEntry.findMany({
    select: { id: true, organizationId: true, projectId: true, attachments: true },
    orderBy: { createdAt: "asc" },
  });
  let processedRows = 0;
  for (const row of rows) {
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    if (!attachments.some((attachment) => decodeDataUrl(attachment?.dataUrl))) continue;
    if (processedRows >= batchSize) break;
    processedRows += 1;
    const next = [];
    let changed = false;
    for (const [index, attachment] of attachments.entries()) {
      const decoded = decodeDataUrl(attachment?.dataUrl);
      if (!decoded) {
        next.push(attachment);
        continue;
      }
      totals.candidates += 1;
      try {
        const stored = await ensureStoredFile({
          organizationId: row.organizationId,
          ownerType: "project",
          ownerId: row.projectId,
          sourceType: "project-logbook-attachment",
          sourceEntityId: `${row.id}:${index}`,
          category: decoded.contentType === "application/pdf" ? "logbook-documents" : "logbook-images",
          originalName: attachment.name || `Datei-${index + 1}.${extensionFor(decoded.contentType)}`,
          contentType: decoded.contentType,
          bytes: decoded.bytes,
        });
        next.push(mode === "switch" ? {
          ...attachment,
          mimeType: decoded.contentType,
          size: decoded.bytes.byteLength,
          storageFileId: stored.id,
          dataUrl: publicFilePath(stored.id),
        } : attachment);
        changed = mode === "switch" || changed;
      } catch (error) {
        totals.failed += 1;
        next.push(attachment);
        console.error(`Logbuch ${row.id}/${index}: ${error instanceof Error ? error.message : "Fehler"}`);
      }
    }
    if (changed) {
      await prisma.projectLogbookEntry.update({ where: { id: row.id }, data: { attachments: next } });
      totals.switched += 1;
    }
  }
}

async function migrateWinterReports() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id", "organizationId", "projectId", "reportNumber", "reportPdfData" AS "pdfData"
    FROM "WinterServiceRun" WHERE "reportPdfData" IS NOT NULL ORDER BY "createdAt" ASC
  `).catch(() => []);
  await migrateScalarRows({
    label: "Winterdienstbericht", rows, ownerType: "project", ownerIdField: "projectId", sourceType: "winter-service-report-pdf", category: "winter-service-reports", numberField: "reportNumber",
    update: (id, pdfData) => prisma.$executeRawUnsafe(`UPDATE "WinterServiceRun" SET "reportPdfData" = $1 WHERE "id" = $2`, pdfData, id),
  });
}

async function migrateWinterImages() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id", "organizationId", "projectId", "beforeImages", "afterImages"
    FROM "WinterServiceRun" ORDER BY "createdAt" ASC
  `).catch(() => []);
  let processedRows = 0;
  for (const row of rows) {
    const groups = [Array.isArray(row.beforeImages) ? row.beforeImages : [], Array.isArray(row.afterImages) ? row.afterImages : []];
    if (!groups.flat().some((attachment) => decodeDataUrl(attachment?.dataUrl))) continue;
    if (processedRows >= batchSize) break;
    processedRows += 1;
    const nextGroups = [];
    let changed = false;
    let absoluteIndex = 0;
    for (const group of groups) {
      const next = [];
      for (const attachment of group) {
        const decoded = decodeDataUrl(attachment?.dataUrl);
        const index = absoluteIndex++;
        if (!decoded) { next.push(attachment); continue; }
        totals.candidates += 1;
        try {
          const sha = createHash("sha256").update(decoded.bytes).digest("hex");
          const stored = await ensureStoredFile({
            organizationId: row.organizationId,
            ownerType: "project",
            ownerId: row.projectId,
            sourceType: "winter-service-image",
            sourceEntityId: `${row.projectId}:${index}:${sha}`,
            category: "winter-service",
            originalName: attachment.name || `Winterdienst-${index + 1}.${extensionFor(decoded.contentType)}`,
            contentType: decoded.contentType,
            bytes: decoded.bytes,
          });
          next.push(mode === "switch" ? { ...attachment, mimeType: decoded.contentType, size: decoded.bytes.byteLength, storageFileId: stored.id, dataUrl: publicFilePath(stored.id) } : attachment);
          changed = mode === "switch" || changed;
        } catch (error) {
          totals.failed += 1;
          next.push(attachment);
          console.error(`Winterbild ${row.id}/${index}: ${error instanceof Error ? error.message : "Fehler"}`);
        }
      }
      nextGroups.push(next);
    }
    if (changed) {
      await prisma.$executeRawUnsafe(
        `UPDATE "WinterServiceRun" SET "beforeImages" = $1::jsonb, "afterImages" = $2::jsonb WHERE "id" = $3`,
        JSON.stringify(nextGroups[0]), JSON.stringify(nextGroups[1]), row.id
      );
      totals.switched += 1;
    }
  }
}

async function migrateEmployeeDocuments() {
  const rows = await prisma.employeeDocument.findMany({
    where: { deletedAt: null },
    select: { id: true, organizationId: true, employeeId: true, originalFileName: true, mimeType: true, fileData: true, uploadedById: true },
    orderBy: { createdAt: "asc" },
  });
  for (const row of rows.filter((item) => item.fileData.byteLength > 0).slice(0, batchSize)) {
    totals.candidates += 1;
    try {
      const bytes = Buffer.from(row.fileData);
      const sha = createHash("sha256").update(bytes).digest("hex");
      const stored = await ensureStoredFile({
        organizationId: row.organizationId,
        ownerType: "employee",
        ownerId: row.id,
        sourceType: "employee-document",
        sourceEntityId: `${row.id}:${sha}`,
        category: "employee-documents",
        originalName: row.originalFileName,
        contentType: row.mimeType,
        bytes,
      });
      if (mode === "switch") {
        await prisma.employeeDocument.update({ where: { id: row.id }, data: { fileData: new Uint8Array() } });
        totals.switched += 1;
      }
    } catch (error) {
      totals.failed += 1;
      console.error(`Mitarbeiterdokument ${row.id}: ${error instanceof Error ? error.message : "Fehler"}`);
    }
  }
}

try {
  if (scopes.has("offers")) await migrateOffers();
  if (scopes.has("invoices")) await migrateInvoices();
  if (scopes.has("logbook")) await migrateLogbook();
  if (scopes.has("winter-reports")) await migrateWinterReports();
  if (scopes.has("winter-images")) await migrateWinterImages();
  if (scopes.has("employee-documents")) await migrateEmployeeDocuments();
  console.log(JSON.stringify({ mode, batchSize, scopes: [...scopes], totals }, null, 2));
  if (totals.failed) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
