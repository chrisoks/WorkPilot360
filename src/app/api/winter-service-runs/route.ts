import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDemoContext } from "@/lib/demo/context";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { canArchiveProjects, canCreateProjectLogbookEntries } from "@/lib/permissions";
import {
  cleanupPreparedStorageUploads,
  persistPreparedStoredFiles,
  prepareStorageAttachments,
} from "@/lib/storage/file-pilot";
import {
  cleanupStorageBackedPayload,
  persistStorageBackedPayload,
  prepareStorageBackedPayload,
  resolveStorageBackedBytes,
} from "@/lib/storage/document-file";

type WinterServiceImage = {
  name: string;
  type: "Bild";
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  storageFileId?: string;
};

class WinterServiceReportImageError extends Error {
  constructor(imageName: string, options?: { cause?: unknown }) {
    super(
      `Das Nachweisbild „${imageName || "Unbenannt"}“ konnte nicht sicher geladen werden. Der Tätigkeitsbericht wurde nicht erzeugt.`,
      options
    );
    this.name = "WinterServiceReportImageError";
  }
}

type WinterServiceRunRow = {
  id: string;
  organizationId: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  customerName: string;
  contactId: string;
  contactPersonId: string;
  serviceDate: string;
  month: string;
  serviceType: string;
  status: string;
  beforeImages: unknown;
  afterImages: unknown;
  reportStatus: string;
  reportNumber: string;
  reportPdfData: string | null;
  reportGeneratedAt: Date | null;
  sentStatus: string;
  sentAt: Date | null;
  sentTo: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceLineId: string;
  billingAction: string;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectReferenceRow = {
  id: string;
  status: string;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MAX_WINTER_SERVICE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_WINTER_SERVICE_IMAGE_TOTAL_BYTES = 48 * 1024 * 1024;
const MAX_WINTER_SERVICE_REPORT_BYTES = 12 * 1024 * 1024;
const ALLOWED_WINTER_SERVICE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_WINTER_SERVICE_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function forbiddenWinterServiceResponse() {
  return NextResponse.json(
    { error: "Du darfst diesen Winterdienst-Einsatz nicht veraendern." },
    { status: 403 }
  );
}

function isArchivedProjectStatus(status: string) {
  return status.trim().toLowerCase().includes("archiviert");
}

function formatFileSize(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function getAttachmentExtension(name: string) {
  return name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
}

function estimateDataUrlBytes(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",");
  const payload = separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : dataUrl;
  if (!payload) return 0;
  if (dataUrl.slice(0, separatorIndex).toLowerCase().includes(";base64")) {
    return Math.ceil((payload.length * 3) / 4);
  }
  return payload.length;
}

function getImageBytes(image: WinterServiceImage) {
  return Math.max(
    Number.isFinite(image.size) ? Number(image.size) : 0,
    image.dataUrl ? estimateDataUrlBytes(image.dataUrl) : 0
  );
}

function isAllowedWinterServiceImage(image: WinterServiceImage) {
  const mimeType = (image.mimeType || "").toLowerCase();
  const extension = getAttachmentExtension(image.name);
  return (
    ALLOWED_WINTER_SERVICE_IMAGE_MIME_TYPES.has(mimeType) ||
    (!mimeType && ALLOWED_WINTER_SERVICE_IMAGE_EXTENSIONS.has(extension)) ||
    ALLOWED_WINTER_SERVICE_IMAGE_EXTENSIONS.has(extension)
  );
}

function cleanImages(value: unknown): WinterServiceImage[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<WinterServiceImage[]>((images, item) => {
    if (!item || typeof item !== "object") return images;
    const candidate = item as Partial<WinterServiceImage>;
    const name = cleanString(candidate.name);
    const dataUrl = cleanString(candidate.dataUrl);
    if (!name || !dataUrl) return images;
    images.push({
      name,
      type: "Bild",
      mimeType: cleanString(candidate.mimeType) || "image/jpeg",
      size: Number.isFinite(Number(candidate.size)) ? Number(candidate.size) : 0,
      dataUrl,
      storageFileId: cleanString(candidate.storageFileId),
    });
    return images;
  }, []);
}

function validateWinterServiceImages(images: WinterServiceImage[]) {
  let totalBytes = 0;

  for (const image of images) {
    if (!image.dataUrl?.startsWith("data:") && !image.dataUrl?.startsWith("/api/files/")) {
      return {
        status: 400,
        error: `Bild "${image.name}" hat ein ungueltiges Datenformat.`,
      };
    }

    if (!isAllowedWinterServiceImage(image)) {
      return {
        status: 400,
        error: `Bildtyp von "${image.name}" ist nicht erlaubt.`,
      };
    }

    const imageBytes = getImageBytes(image);
    if (imageBytes > MAX_WINTER_SERVICE_IMAGE_BYTES) {
      return {
        status: 413,
        error: `Bild "${image.name}" ist zu gross. Erlaubt sind maximal ${formatFileSize(
          MAX_WINTER_SERVICE_IMAGE_BYTES
        )} pro Bild.`,
      };
    }

    totalBytes += imageBytes;
  }

  if (totalBytes > MAX_WINTER_SERVICE_IMAGE_TOTAL_BYTES) {
    return {
      status: 413,
      error: `Die Winterdienst-Bilder sind zusammen zu gross. Erlaubt sind maximal ${formatFileSize(
        MAX_WINTER_SERVICE_IMAGE_TOTAL_BYTES
      )} pro Einsatz.`,
    };
  }

  return null;
}

async function getProjectReference(organizationId: string, projectId: string) {
  const rows = await prisma.$queryRaw<ProjectReferenceRow[]>`
    SELECT "id", "status"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function assertWritableProject(organizationId: string, projectId: string, actor: User) {
  const project = await getProjectReference(organizationId, projectId);
  if (!project) {
    return NextResponse.json({ error: "Projekt wurde nicht gefunden." }, { status: 404 });
  }
  if (isArchivedProjectStatus(project.status) && !canArchiveProjects(actor)) {
    return NextResponse.json(
      { error: "Archivierte Projekte duerfen nicht mehr im Logbuch veraendert werden." },
      { status: 403 }
    );
  }
  return null;
}

function getMonthFromDate(value: string) {
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : "";
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatRun(row: WinterServiceRunRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectNumber: row.projectNumber,
    projectTitle: row.projectTitle,
    customerName: row.customerName,
    contactId: row.contactId,
    contactPersonId: row.contactPersonId,
    serviceDate: row.serviceDate,
    month: row.month,
    serviceType: row.serviceType,
    status: row.status,
    beforeImages: cleanImages(row.beforeImages),
    afterImages: cleanImages(row.afterImages),
    reportStatus: row.reportStatus,
    reportNumber: row.reportNumber,
    reportPdfAvailable: Boolean(row.reportPdfData),
    reportGeneratedAt: formatDateTime(row.reportGeneratedAt),
    sentStatus: row.sentStatus,
    sentAt: formatDateTime(row.sentAt),
    sentTo: row.sentTo,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    invoiceLineId: row.invoiceLineId,
    billingAction: row.billingAction,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureWinterServiceRunTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "WinterServiceRun" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "projectTitle" TEXT NOT NULL DEFAULT '',
      "customerName" TEXT NOT NULL DEFAULT '',
      "contactId" TEXT NOT NULL DEFAULT '',
      "contactPersonId" TEXT NOT NULL DEFAULT '',
      "serviceDate" TEXT NOT NULL,
      "month" TEXT NOT NULL,
      "serviceType" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'offen',
      "beforeImages" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "afterImages" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "reportStatus" TEXT NOT NULL DEFAULT 'offen',
      "reportNumber" TEXT NOT NULL DEFAULT '',
      "reportPdfData" TEXT,
      "reportGeneratedAt" TIMESTAMP(3),
      "sentStatus" TEXT NOT NULL DEFAULT 'offen',
      "sentAt" TIMESTAMP(3),
      "sentTo" TEXT NOT NULL DEFAULT '',
      "invoiceId" TEXT NOT NULL DEFAULT '',
      "invoiceNumber" TEXT NOT NULL DEFAULT '',
      "invoiceLineId" TEXT NOT NULL DEFAULT '',
      "billingAction" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function embedFonts(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit);
  } catch {
    // pdf-lib can still render with built-in fonts.
  }
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size = 10,
  color = rgb(0.08, 0.12, 0.2)
) {
  page.drawText(text, { x, y, font, size, color });
}

async function drawImageGrid(
  pdfDoc: PDFDocument,
  page: PDFPage,
  images: WinterServiceImage[],
  x: number,
  startY: number,
  fonts: { regular: PDFFont; bold: PDFFont },
  organizationId: string,
  projectId: string
) {
  const width = 150;
  const height = 105;
  const gap = 16;

  for (const [index, image] of images.slice(0, 6).entries()) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const left = x + col * (width + gap);
    const top = startY - row * (height + 34);
    page.drawRectangle({
      x: left,
      y: top - height,
      width,
      height,
      borderColor: rgb(0.75, 0.82, 0.9),
      borderWidth: 1,
      color: rgb(0.96, 0.98, 1),
    });

    try {
      let bytes: Buffer;
      if (image.storageFileId) {
        const stored = await resolveStorageBackedBytes({
          organizationId,
          payload: `stored-file:${image.storageFileId}`,
          expectedOwnerType: "project",
          expectedOwnerId: projectId,
        });
        if (!stored) throw new Error("winter_service_image_missing");
        bytes = stored;
      } else {
        const base64 = image.dataUrl?.split(",")[1] ?? "";
        bytes = Buffer.from(base64, "base64");
      }
      const embedded =
        image.mimeType?.toLowerCase().includes("png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
      const scale = Math.min(width / embedded.width, height / embedded.height);
      const imageWidth = embedded.width * scale;
      const imageHeight = embedded.height * scale;
      page.drawImage(embedded, {
        x: left + (width - imageWidth) / 2,
        y: top - height + (height - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight,
      });
    } catch (error) {
      throw new WinterServiceReportImageError(image.name, { cause: error });
    }
    drawText(page, image.name.slice(0, 28), left, top - height - 12, fonts.regular, 7, rgb(0.35, 0.42, 0.52));
  }
}

async function getNextReportNumber(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ reportNumber: string }>>`
    SELECT "reportNumber"
    FROM "WinterServiceRun"
    WHERE "organizationId" = ${organizationId} AND "reportNumber" <> ''
    ORDER BY "reportGeneratedAt" DESC NULLS LAST, "createdAt" DESC
    LIMIT 1
  `;
  const number = Number((rows[0]?.reportNumber || "").replace(/\D/g, ""));
  return `TB-${String(Number.isFinite(number) && number > 0 ? number + 1 : 1001).padStart(5, "0")}`;
}

async function generateActivityReportPdf(row: WinterServiceRunRow, reportNumber: string) {
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  page.drawRectangle({ x: 0, y: A4_HEIGHT - 92, width: A4_WIDTH, height: 92, color: rgb(0.04, 0.09, 0.16) });
  drawText(page, "Tätigkeitsbericht Winterdienst", 42, A4_HEIGHT - 48, fonts.bold, 20, rgb(1, 1, 1));
  drawText(page, reportNumber, 42, A4_HEIGHT - 72, fonts.regular, 11, rgb(0.8, 0.88, 1));

  drawText(page, "Kunde", 42, 710, fonts.bold, 9);
  drawText(page, row.customerName || "-", 150, 710, fonts.regular, 10);
  drawText(page, "Projekt", 42, 690, fonts.bold, 9);
  drawText(page, `${row.projectNumber} | ${row.projectTitle}`.slice(0, 72), 150, 690, fonts.regular, 10);
  drawText(page, "Einsatzdatum", 42, 670, fonts.bold, 9);
  drawText(page, formatDate(row.serviceDate), 150, 670, fonts.regular, 10);
  drawText(page, "Einsatzart", 42, 650, fonts.bold, 9);
  drawText(page, row.serviceType || "Winterdiensteinsatz", 150, 650, fonts.regular, 10);

  drawText(page, "Sehr geehrte Damen und Herren,", 42, 612, fonts.regular, 10);
  drawText(page, "anbei erhalten Sie den Tätigkeitsbericht zum durchgeführten Winterdiensteinsatz.", 42, 594, fonts.regular, 10);

  drawText(page, "Vorherbilder", 42, 555, fonts.bold, 13);
  await drawImageGrid(pdfDoc, page, cleanImages(row.beforeImages), 42, 532, fonts, row.organizationId, row.projectId);

  drawText(page, "Nachherbilder", 42, 275, fonts.bold, 13);
  await drawImageGrid(pdfDoc, page, cleanImages(row.afterImages), 42, 252, fonts, row.organizationId, row.projectId);

  drawText(page, "Mit freundlichen Grüßen", 42, 44, fonts.regular, 10);
  drawText(page, "WorkPilot360", 42, 28, fonts.bold, 10);

  pdfDoc.setTitle(`${reportNumber} Tätigkeitsbericht Winterdienst`);
  return Buffer.from(await pdfDoc.save()).toString("base64");
}

async function ensureProjectLogbookEntryTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectLogbookEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "title" TEXT,
      "body" TEXT NOT NULL,
      "author" TEXT,
      "colleague" TEXT,
      "visibleFor" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function addProjectDocumentLogbookEntry(
  tx: Prisma.TransactionClient,
  row: WinterServiceRunRow,
  reportNumber: string,
  attachment: Record<string, unknown>,
  actor: User
) {
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
  const existing = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "ProjectLogbookEntry"
    WHERE "organizationId" = ${row.organizationId}
      AND "projectId" = ${row.projectId}
      AND "title" = 'Dokumente: Tätigkeitsberichte'
      AND "attachments"::text ILIKE ${`%${reportNumber}.pdf%`}
    LIMIT 1
  `;
  if (existing.length > 0) return;

  await tx.$executeRaw`
    INSERT INTO "ProjectLogbookEntry" (
      "id", "organizationId", "projectId", "title", "body", "author", "colleague", "visibleFor", "attachments"
    ) VALUES (
      ${randomUUID()}, ${row.organizationId}, ${row.projectId}, ${"Dokumente: Tätigkeitsberichte"},
      ${`Tätigkeitsbericht ${reportNumber} automatisch erstellt.`}, ${actorName}, ${""},
      ${JSON.stringify(["Geschaeftsfuehrer", "Vertriebler", "Niederlassungsleiter", "Buchhaltung"])}::jsonb,
      ${JSON.stringify([attachment])}::jsonb
    )
  `;
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureWinterServiceRunTable();
  const { searchParams } = new URL(req.url);
  const requestedActorId = searchParams.get("actorId");
  const pdfId = cleanString(searchParams.get("pdfId"));
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return !cleanString(requestedActorId) && !pdfId ? NextResponse.json([]) : sessionBoundActorResponse(actorResult);
  }

  if (pdfId) {
    const rows = await prisma.$queryRaw<WinterServiceRunRow[]>`
      SELECT * FROM "WinterServiceRun"
      WHERE "organizationId" = ${organization.id} AND "id" = ${pdfId}
      LIMIT 1
    `;
    const run = rows[0];
    if (!run?.reportPdfData) {
      return NextResponse.json({ error: "Tätigkeitsbericht wurde nicht gefunden." }, { status: 404 });
    }
    let bytes: Buffer;
    try {
      const resolved = await resolveStorageBackedBytes({
        organizationId: organization.id,
        payload: run.reportPdfData,
        expectedOwnerType: "project",
        expectedOwnerId: run.projectId,
      });
      if (!resolved) throw new Error("winter_service_report_missing");
      bytes = resolved;
    } catch (error) {
      console.error("Winter service report could not be loaded", error);
      return NextResponse.json(
        { error: "Der Tätigkeitsbericht ist vorübergehend nicht verfügbar." },
        { status: 503, headers: { "Retry-After": "30" } }
      );
    }
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${run.reportNumber || "Taetigkeitsbericht"}.pdf"`,
      },
    });
  }

  const month = cleanString(searchParams.get("month"));
  const rows = month
    ? await prisma.$queryRaw<WinterServiceRunRow[]>`
        SELECT * FROM "WinterServiceRun"
        WHERE "organizationId" = ${organization.id} AND "month" = ${month}
        ORDER BY "serviceDate" DESC, "createdAt" DESC
      `
    : await prisma.$queryRaw<WinterServiceRunRow[]>`
        SELECT * FROM "WinterServiceRun"
        WHERE "organizationId" = ${organization.id}
        ORDER BY "serviceDate" DESC, "createdAt" DESC
      `;

  return NextResponse.json(rows.map(formatRun));
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureWinterServiceRunTable();
  const body = await req.json().catch(() => ({}));
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canCreateProjectLogbookEntries(actor)) {
    return forbiddenWinterServiceResponse();
  }
  const serviceDate = cleanString(body.serviceDate);
  const month = cleanString(body.month) || getMonthFromDate(serviceDate);
  const projectId = cleanString(body.projectId);

  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }
  if (!serviceDate || !month) {
    return NextResponse.json({ error: "Einsatzdatum fehlt." }, { status: 400 });
  }
  const projectError = await assertWritableProject(organization.id, projectId, actor);
  if (projectError) {
    return projectError;
  }
  const beforeImages = cleanImages(body.beforeImages);
  const afterImages = cleanImages(body.afterImages);
  const imageError = validateWinterServiceImages([...beforeImages, ...afterImages]);
  if (imageError) {
    return NextResponse.json({ error: imageError.error }, { status: imageError.status });
  }

  const id = cleanString(body.id) || randomUUID();
  const combinedImages = [...beforeImages, ...afterImages];
  const preparedImages = await prepareStorageAttachments({
    organizationId: organization.id,
    ownerType: "project",
    ownerId: projectId,
    sourceType: "winter-service-image",
    category: "winter-service",
    createdByUserId: actor.id,
    attachments: combinedImages,
  });
  const storedBeforeImages = preparedImages.attachments.slice(0, beforeImages.length);
  const storedAfterImages = preparedImages.attachments.slice(beforeImages.length);
  let rows: WinterServiceRunRow[];
  try {
    rows = await prisma.$transaction(async (tx) => {
      await persistPreparedStoredFiles(tx, preparedImages);
      return tx.$queryRaw<WinterServiceRunRow[]>`
        INSERT INTO "WinterServiceRun" (
      "id", "organizationId", "projectId", "projectNumber", "projectTitle", "customerName",
      "contactId", "contactPersonId", "serviceDate", "month", "serviceType",
      "beforeImages", "afterImages", "updatedAt"
    ) VALUES (
      ${id}, ${organization.id}, ${projectId}, ${cleanString(body.projectNumber)},
      ${cleanString(body.projectTitle)}, ${cleanString(body.customerName)}, ${cleanString(body.contactId)},
      ${cleanString(body.contactPersonId)}, ${serviceDate}, ${month}, ${cleanString(body.serviceType)},
      ${JSON.stringify(storedBeforeImages)}::jsonb,
      ${JSON.stringify(storedAfterImages)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "projectId" = EXCLUDED."projectId",
      "projectNumber" = EXCLUDED."projectNumber",
      "projectTitle" = EXCLUDED."projectTitle",
      "customerName" = EXCLUDED."customerName",
      "contactId" = EXCLUDED."contactId",
      "contactPersonId" = EXCLUDED."contactPersonId",
      "serviceDate" = EXCLUDED."serviceDate",
      "month" = EXCLUDED."month",
      "serviceType" = EXCLUDED."serviceType",
      "beforeImages" = EXCLUDED."beforeImages",
      "afterImages" = EXCLUDED."afterImages",
      "updatedAt" = CURRENT_TIMESTAMP
        RETURNING *
      `;
    });
  } catch (error) {
    await cleanupPreparedStorageUploads(preparedImages);
    throw error;
  }

  return NextResponse.json(formatRun(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureWinterServiceRunTable();
  const body = await req.json().catch(() => ({}));
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canCreateProjectLogbookEntries(actor)) {
    return forbiddenWinterServiceResponse();
  }
  const id = cleanString(body.id);
  const action = cleanString(body.action);

  if (!id) return NextResponse.json({ error: "Einsatz fehlt." }, { status: 400 });

  const currentRows = await prisma.$queryRaw<WinterServiceRunRow[]>`
    SELECT * FROM "WinterServiceRun"
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    LIMIT 1
  `;
  const current = currentRows[0];
  if (!current) return NextResponse.json({ error: "Einsatz wurde nicht gefunden." }, { status: 404 });
  const projectError = await assertWritableProject(organization.id, current.projectId, actor);
  if (projectError) {
    return projectError;
  }

  if (action === "generate-report") {
    if (current.reportStatus === "erstellt" && current.reportPdfData) {
      return NextResponse.json(formatRun(current));
    }

    const beforeImages = cleanImages(current.beforeImages);
    const afterImages = cleanImages(current.afterImages);
    if (beforeImages.length === 0 || afterImages.length === 0) {
      return NextResponse.json(
        { error: "Für den Tätigkeitsbericht wird mindestens ein Vorher- und ein Nachherbild benötigt." },
        { status: 409 }
      );
    }

    const reportNumber = current.reportNumber || (await getNextReportNumber(organization.id));
    let reportPdfData = "";
    try {
      reportPdfData = await generateActivityReportPdf(current, reportNumber);
    } catch (error) {
      if (error instanceof WinterServiceReportImageError) {
        return NextResponse.json(
          { error: error.message, code: "report_image_unavailable" },
          { status: 503, headers: { "Retry-After": "30" } }
        );
      }
      throw error;
    }
    const reportBytes = Math.round((reportPdfData.length * 3) / 4);
    if (reportBytes > MAX_WINTER_SERVICE_REPORT_BYTES) {
      return NextResponse.json(
        {
          error: `Winterdienst-Taetigkeitsbericht ist zu gross. Erlaubt sind maximal ${formatFileSize(
            MAX_WINTER_SERVICE_REPORT_BYTES
          )} pro Datei.`,
        },
        { status: 413 }
      );
    }
    const preparedPdf = await prepareStorageBackedPayload({
      organizationId: organization.id,
      ownerType: "project",
      ownerId: current.projectId,
      sourceType: "winter-service-report-pdf",
      category: "winter-service-reports",
      originalName: `${reportNumber}.pdf`,
      contentType: "application/pdf",
      bytes: Buffer.from(reportPdfData, "base64"),
      createdByUserId: actor.id,
    });
    const reportPayload = preparedPdf.reference ?? reportPdfData;
    const reportAttachment = preparedPdf.prepared.attachments[0] ?? {
      name: `${reportNumber}.pdf`,
      type: "Dokument",
      mimeType: "application/pdf",
      size: reportBytes,
      dataUrl: `data:application/pdf;base64,${reportPdfData}`,
    };
    await ensureProjectLogbookEntryTable();
    let rows: WinterServiceRunRow[];
    try {
      rows = await prisma.$transaction(async (tx) => {
        await persistStorageBackedPayload(tx, preparedPdf);
        const updated = await tx.$queryRaw<WinterServiceRunRow[]>`
          UPDATE "WinterServiceRun"
          SET "reportStatus" = 'erstellt',
              "reportNumber" = ${reportNumber},
              "reportPdfData" = ${reportPayload},
              "reportGeneratedAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "organizationId" = ${organization.id} AND "id" = ${id}
          RETURNING *
        `;
        await addProjectDocumentLogbookEntry(tx, updated[0], reportNumber, reportAttachment, actor);
        return updated;
      });
    } catch (error) {
      await cleanupStorageBackedPayload(preparedPdf);
      throw error;
    }
    return NextResponse.json(formatRun(rows[0]));
  }

  if (action === "mark-sent") {
    const rows = await prisma.$queryRaw<WinterServiceRunRow[]>`
      UPDATE "WinterServiceRun"
      SET "sentStatus" = 'versendet',
          "sentAt" = CURRENT_TIMESTAMP,
          "sentTo" = ${cleanString(body.sentTo)},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id} AND "id" = ${id}
      RETURNING *
    `;
    return NextResponse.json(formatRun(rows[0]));
  }

  if (action === "mark-billed") {
    const rows = await prisma.$queryRaw<WinterServiceRunRow[]>`
      UPDATE "WinterServiceRun"
      SET "invoiceId" = ${cleanString(body.invoiceId)},
          "invoiceNumber" = ${cleanString(body.invoiceNumber)},
          "invoiceLineId" = ${cleanString(body.invoiceLineId)},
          "billingAction" = ${cleanString(body.billingAction)},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id} AND "id" = ${id}
      RETURNING *
    `;
    return NextResponse.json(formatRun(rows[0]));
  }

  return NextResponse.json({ error: "Aktion ist ungültig." }, { status: 400 });
}
