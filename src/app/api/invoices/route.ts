import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type InvoiceCompany = "OK solutions" | "OK immocare";

type InvoiceLineInput = {
  catalogItemId?: string;
  catalogType?: string;
  quantity?: number;
  unit?: string;
  title?: string;
  description?: string;
  unitPrice?: number;
  discountPercent?: number;
  vatRate?: number;
  laborItems?: InvoiceLineLaborInput[];
};

type InvoiceLineLaborInput = {
  userId?: string;
  employeeName?: string;
  plannedHours?: number;
  hourlyCostRate?: number;
  totalCost?: number;
};

type InvoiceInput = {
  projectId?: string;
  projectNumber?: string;
  projectTitle?: string;
  saveAsDraft?: boolean;
  billingSource?: string;
  company?: InvoiceCompany;
  customerName?: string;
  customerStreet?: string;
  customerCity?: string;
  contactName?: string;
  internalContactName?: string;
  internalPhone?: string;
  internalEmail?: string;
  plannedExecutionMonth?: string;
  introText?: string;
  closingText?: string;
  vatRate?: number;
  discountPercent?: number;
  lines?: InvoiceLineInput[];
  billedStampEntryIds?: string[];
  allowUnderbilledStampedHours?: boolean;
  suppressUnderbillingNotification?: boolean;
  documentTitle?: string;
};

type InvoiceRow = {
  id: string;
  organizationId: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  company: InvoiceCompany;
  invoiceNumber: string;
  status: string;
  billingSource: string;
  customerName: string;
  customerStreet: string;
  customerCity: string;
  contactName: string;
  internalContactName: string;
  internalPhone: string;
  internalEmail: string;
  plannedExecutionMonth: string;
  introText: string;
  closingText: string;
  netTotal: number;
  vatRate: number;
  grossTotal: number;
  discountPercent: number;
  isPaid: boolean;
  paidAt: Date | null;
  pdfData: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceLineRow = {
  id: string;
  invoiceId: string;
  catalogItemId: string;
  catalogType: string;
  position: number;
  quantity: number;
  unit: string;
  title: string;
  description: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  totalNet: number;
};

type InvoiceLineLaborRow = {
  id: string;
  invoiceId: string;
  invoiceLineId: string;
  userId: string;
  employeeName: string;
  plannedHours: number;
  hourlyCostRate: number;
  totalCost: number;
  position: number;
};

type InvoiceHistoryRow = {
  id: string;
  invoiceId: string;
  projectId: string;
  invoiceNumber: string;
  eventType: string;
  title: string;
  note: string;
  actorName: string;
  createdAt: Date;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.25, 0.29, 0.34);
const LINE = rgb(0.38, 0.38, 0.38);

async function embedInvoiceFonts(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Regular.ttf")),
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Bold.ttf")),
    ]);
    const regular = await pdfDoc.embedFont(regularBytes, { subset: true });
    const bold = await pdfDoc.embedFont(boldBytes, { subset: true });

    return { regular, bold };
  } catch {
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    return { regular, bold };
  }
}

async function ensureInvoiceTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Invoice" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "projectTitle" TEXT NOT NULL DEFAULT '',
      "company" TEXT NOT NULL DEFAULT 'OK solutions',
      "invoiceNumber" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Entwurf',
      "billingSource" TEXT NOT NULL DEFAULT 'manual',
      "customerName" TEXT NOT NULL DEFAULT '',
      "customerStreet" TEXT NOT NULL DEFAULT '',
      "customerCity" TEXT NOT NULL DEFAULT '',
      "contactName" TEXT NOT NULL DEFAULT '',
      "internalContactName" TEXT NOT NULL DEFAULT '',
      "internalPhone" TEXT NOT NULL DEFAULT '',
      "internalEmail" TEXT NOT NULL DEFAULT '',
      "plannedExecutionMonth" TEXT NOT NULL DEFAULT '',
      "introText" TEXT NOT NULL DEFAULT '',
      "closingText" TEXT NOT NULL DEFAULT '',
      "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "grossTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "isPaid" BOOLEAN NOT NULL DEFAULT false,
      "paidAt" TIMESTAMP(3),
      "pdfData" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "plannedExecutionMonth" TEXT NOT NULL DEFAULT ''
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "billingSource" TEXT NOT NULL DEFAULT 'manual'
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "Invoice_organizationId_projectId_idx"
    ON "Invoice" ("organizationId", "projectId")
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_organizationId_invoiceNumber_key"
    ON "Invoice" ("organizationId", "invoiceNumber")
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "InvoiceLine" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "catalogItemId" TEXT NOT NULL DEFAULT '',
      "catalogType" TEXT NOT NULL DEFAULT '',
      "position" INTEGER NOT NULL DEFAULT 0,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
      "unit" TEXT NOT NULL DEFAULT 'Stk',
      "title" TEXT NOT NULL DEFAULT '',
      "description" TEXT NOT NULL DEFAULT '',
      "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "InvoiceLine"
    ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "InvoiceHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "invoiceNumber" TEXT NOT NULL DEFAULT '',
      "eventType" TEXT NOT NULL DEFAULT '',
      "title" TEXT NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "actorName" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "InvoiceLineLabor" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "invoiceLineId" TEXT NOT NULL,
      "userId" TEXT NOT NULL DEFAULT '',
      "employeeName" TEXT NOT NULL DEFAULT '',
      "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "hourlyCostRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InvoiceLineLabor_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE CASCADE
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "InvoiceLineLabor_organizationId_invoiceId_idx"
    ON "InvoiceLineLabor" ("organizationId", "invoiceId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "InvoiceLineLabor_organizationId_invoiceLineId_idx"
    ON "InvoiceLineLabor" ("organizationId", "invoiceLineId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "InvoiceHistory_organizationId_projectId_idx"
    ON "InvoiceHistory" ("organizationId", "projectId", "createdAt")
  `;

  await prisma.$executeRaw`
    UPDATE "Invoice" invoice
    SET "status" = 'Entwurf', "updatedAt" = CURRENT_TIMESTAMP
    WHERE invoice."status" = 'Fakturiert'
      AND EXISTS (
        SELECT 1
        FROM "InvoiceHistory" history
        WHERE history."organizationId" = invoice."organizationId"
          AND history."invoiceId" = invoice."id"
          AND history."title" = 'Rechnungsentwurf gespeichert'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "InvoiceHistory" history
        WHERE history."organizationId" = invoice."organizationId"
          AND history."invoiceId" = invoice."id"
          AND history."title" IN ('Rechnung angelegt', 'Rechnung bearbeitet', 'Rechnung fakturiert')
      )
  `;
}

async function ensureInvoiceTimeEntryColumns() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectTimeEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'project',
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "userId" TEXT,
      "employee" TEXT,
      "entrySource" TEXT NOT NULL DEFAULT 'stamped',
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMs" BIGINT NOT NULL DEFAULT 0,
      "pauseMs" BIGINT NOT NULL DEFAULT 0,
      "comment" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "userId" TEXT,
    ADD COLUMN IF NOT EXISTS "entrySource" TEXT NOT NULL DEFAULT 'stamped',
    ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3)
  `;
}

function getBilledStampEntryIds(input: unknown) {
  return Array.isArray(input)
    ? input.map((item) => cleanString(item)).filter(Boolean)
    : [];
}

function getInvoiceLaborHours(lines: Array<{ laborItems: Array<{ plannedHours: number }> }>) {
  return lines.reduce(
    (sum, line) =>
      sum + line.laborItems.reduce((lineSum, labor) => lineSum + Number(labor.plannedHours || 0), 0),
    0
  );
}

async function getStampedHoursForInvoiceCheck(input: {
  organizationId: string;
  projectId: string;
  stampEntryIds: string[];
}) {
  if (input.stampEntryIds.length === 0) return 0;
  await ensureInvoiceTimeEntryColumns();
  const rows = await prisma.$queryRaw<Array<{ hours: number | null }>>`
    SELECT COALESCE(SUM("durationMs")::double precision / 3600000, 0) AS "hours"
    FROM "ProjectTimeEntry"
    WHERE "organizationId" = ${input.organizationId}
      AND "projectId" = ${input.projectId}
      AND "mode" = 'project'
      AND "id" IN (${Prisma.join(input.stampEntryIds)})
      AND ("invoiceId" IS NULL OR "invoiceId" = '')
  `;
  return Number(rows[0]?.hours ?? 0);
}

async function markStampedHoursAsInvoiced(input: {
  organizationId: string;
  projectId: string;
  invoiceId: string;
  invoiceNumber: string;
  stampEntryIds: string[];
}) {
  if (input.stampEntryIds.length === 0) return;
  await ensureInvoiceTimeEntryColumns();
  await prisma.$executeRaw`
    UPDATE "ProjectTimeEntry"
    SET "invoiceId" = ${input.invoiceId},
        "invoiceNumber" = ${input.invoiceNumber},
        "invoicedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${input.organizationId}
      AND "projectId" = ${input.projectId}
      AND "mode" = 'project'
      AND "id" IN (${Prisma.join(input.stampEntryIds)})
      AND ("invoiceId" IS NULL OR "invoiceId" = '')
  `;
}

async function notifyManagementAboutUnderbilling(input: {
  organizationId: string;
  projectId: string;
  projectLabel: string;
  invoiceNumber: string;
  stampedHours: number;
  invoiceHours: number;
}) {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;

  const recipients = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "User"
    WHERE "organizationId" = ${input.organizationId}
      AND "isActive" = true
      AND (
        "role" = 'GESCHAEFTSFUEHRER'
        OR LOWER(CONCAT("firstName", ' ', "lastName")) IN ('christian eid', 'ramona eid')
      )
  `;

  for (const recipient of recipients) {
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id",
        "organizationId",
        "userId",
        "taskId",
        "channel",
        "subject",
        "body",
        "linkTarget",
        "linkTargetId",
        "linkLabel",
        "sentAt",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${input.organizationId},
        ${recipient.id},
        NULL,
        'app',
        'Achtung Projekt mit weniger Stunden fakturiert als gestempelt',
        ${`${input.projectLabel}: In ${input.invoiceNumber} wurden ${input.invoiceHours.toFixed(2)} Std. fakturiert, aber ${input.stampedHours.toFixed(2)} Std. produktiv gestempelt.`},
        'project',
        ${input.projectId},
        'Projekt öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanPercent(value: unknown) {
  return Math.min(Math.max(cleanNumber(value, 0), 0), 100);
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeUnit(value: unknown) {
  const unit = cleanString(value);
  const aliases: Record<string, string> = {
    h: "Std",
    std: "Std",
    stunde: "Std",
    stunden: "Std",
    stk: "Stk",
    stück: "Stk",
    stueck: "Stk",
    pauschale: "Pauschal",
    pauschal: "Pauschal",
    liter: "L",
    ltr: "L",
  };
  return aliases[unit.toLowerCase()] ?? unit;
}

function getLineBaseNet(line: Pick<Required<InvoiceLineInput>, "quantity" | "unitPrice">) {
  return line.quantity * line.unitPrice;
}

function getLineDiscountAmount(line: Pick<Required<InvoiceLineInput>, "quantity" | "unitPrice" | "discountPercent">) {
  return roundMoney(getLineBaseNet(line) * (line.discountPercent / 100));
}

function getLineTotalNet(line: Pick<Required<InvoiceLineInput>, "quantity" | "unitPrice" | "discountPercent">) {
  return roundMoney(getLineBaseNet(line) - getLineDiscountAmount(line));
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate() {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];

  normalized.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
  });

  return lines;
}

function drawTextBlock(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: { font: PDFFont; size: number; maxWidth: number; lineHeight?: number; color?: ReturnType<typeof rgb> }
) {
  const lineHeight = options.lineHeight ?? options.size + 3;
  let cursorY = y;
  wrapText(text, options.font, options.size, options.maxWidth).forEach((line) => {
    if (line) {
      page.drawText(line, {
        x,
        y: cursorY,
        size: options.size,
        font: options.font,
        color: options.color ?? INK,
      });
    }
    cursorY -= lineHeight;
  });
  return cursorY;
}

async function getNextinvoiceNumber(organizationId: string, prefix = "RE") {
  const invoiceNumberPrefix = prefix.toUpperCase();
  const rows = await prisma.$queryRaw<Array<{ invoiceNumber: string }>>`
    SELECT "invoiceNumber"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId}
      AND "invoiceNumber" LIKE ${`${invoiceNumberPrefix}-%`}
  `;
  const invoiceNumberPattern = new RegExp(`^${invoiceNumberPrefix}-(\\d+)$`);
  const highest =
    rows
      .map((row) => Number(row.invoiceNumber.match(invoiceNumberPattern)?.[1] ?? "10099"))
      .filter((value) => Number.isFinite(value))
      .sort((first, second) => second - first)[0] ?? 10099;

  return `${invoiceNumberPrefix}-${highest + 1}`;
}

function getTemplatePath(company: InvoiceCompany) {
  return path.join(
    process.cwd(),
    "public",
    "offer-templates",
    company === "OK immocare" ? "ok-immocare.pdf" : "ok-solutions.pdf"
  );
}

async function addTemplatePage(pdfDoc: PDFDocument, templateDoc: PDFDocument, pageIndex: 0 | 1) {
  const [templatePage] = await pdfDoc.copyPages(templateDoc, [pageIndex]);
  pdfDoc.addPage(templatePage);
  return templatePage;
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  options: { font: PDFFont; size: number; color?: ReturnType<typeof rgb> }
) {
  const width = options.font.widthOfTextAtSize(text, options.size);
  page.drawText(text, {
    x: rightX - width,
    y,
    size: options.size,
    font: options.font,
    color: options.color ?? INK,
  });
}

async function generateInvoicePdf(Invoice: InvoiceInput & { invoiceNumber: string }, lines: Required<InvoiceLineInput>[]) {
  const company = Invoice.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const templateBytes = await readFile(getTemplatePath(company));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const { regular, bold } = await embedInvoiceFonts(pdfDoc);

  const table = {
    left: 75,
    right: 548,
    posX: 78,
    quantityX: 112,
    titleX: 158,
    unitPriceRightX: 475,
    totalRightX: 545,
    titleWidth: 238,
  };
  const headerSize = 8.2;
  const rowSize = 7.8;
  const descriptionSize = 7.5;
  const titleSize = 7.8;
  const descriptionIndent = 8;
  const bottomLimit = 96;

  let page = await addTemplatePage(pdfDoc, templateDoc, 0);
  let y = 432;
  let currentPageIndex = 0;

  const drawTableHeader = (targetPage: PDFPage, headerY: number, headerFont: PDFFont) => {
    targetPage.drawLine({
      start: { x: table.left, y: headerY + 11 },
      end: { x: table.right, y: headerY + 11 },
      thickness: 0.8,
      color: LINE,
    });
    targetPage.drawText("Pos", { x: table.posX, y: headerY, size: headerSize, font: headerFont, color: INK });
    targetPage.drawText("Menge", { x: table.quantityX, y: headerY, size: headerSize, font: headerFont, color: INK });
    targetPage.drawText("Bezeichnung", { x: table.titleX, y: headerY, size: headerSize, font: headerFont, color: INK });
    drawRightAlignedText(targetPage, "Einheitspreis", table.unitPriceRightX, headerY, {
      size: headerSize,
      font: headerFont,
    });
    drawRightAlignedText(targetPage, "Gesamt", table.totalRightX, headerY, {
      size: headerSize,
      font: headerFont,
    });
    targetPage.drawLine({
      start: { x: table.left, y: headerY - 8 },
      end: { x: table.right, y: headerY - 8 },
      thickness: 0.8,
      color: LINE,
    });
  };

  const newPage = async () => {
    page = await addTemplatePage(pdfDoc, templateDoc, 1);
    currentPageIndex += 1;
    y = 713;
    drawTableHeader(page, y, bold);
    y -= 16;
  };

  page.drawText(Invoice.customerName || "-", { x: 71, y: 672, size: 8.7, font: bold, color: INK });
  page.drawText(Invoice.customerStreet || "", { x: 71, y: 660, size: 8.4, font: bold, color: INK });
  page.drawText(Invoice.customerCity || "", { x: 71, y: 648, size: 8.4, font: bold, color: INK });

  const documentTitle = cleanString(Invoice.documentTitle) || "Rechnung";
  const isDraftDocument = documentTitle === "Rechnungsentwurf";
  const infoRows = [
    [
      documentTitle === "Stornorechnung"
        ? "Stornonummer"
        : "Rechnungsnummer",
      isDraftDocument ? "-" : Invoice.invoiceNumber,
    ],
    ["Kundennummer", Invoice.projectNumber || ""],
    ["Datum", formatDate()],
    ["Ansprechpartner", Invoice.internalContactName || ""],
    ["Telefon", Invoice.internalPhone || ""],
    ["E-Mail", Invoice.internalEmail || ""],
  ];
  infoRows.forEach(([label, value], index) => {
    const rowY = 676 - index * 13;
    page.drawText(label, { x: 313, y: rowY, size: 8.5, font: bold, color: MUTED });
    drawRightAlignedText(page, value || "-", 552, rowY, { size: 8.5, font: regular, color: INK });
  });

  page.drawText(`Projekt: ${Invoice.projectTitle || "-"}`, { x: 71, y: 544, size: 10.7, font: bold, color: INK });
  page.drawText(
    isDraftDocument ? documentTitle : `${documentTitle} Nr. ${Invoice.invoiceNumber}`,
    { x: 71, y: 520, size: 10.7, font: bold, color: INK }
  );
  const greeting = Invoice.contactName ? `Sehr geehrte/r ${Invoice.contactName},` : "Sehr geehrte Damen und Herren,";
  page.drawText(greeting, { x: 71, y: 492, size: 8.8, font: regular, color: INK });
  drawTextBlock(
    page,
    Invoice.introText || "wir danken Ihnen fuer Ihre Anfrage und stellen wir Ihnen folgende Leistungen in Rechnung.",
    71,
    472,
    { font: regular, size: 8.8, maxWidth: 480, lineHeight: 12 }
  );

  drawTableHeader(page, y, bold);
  y -= 21;

  for (const [index, line] of lines.entries()) {
    const descriptionLines = wrapText(line.description || "", regular, descriptionSize, table.titleWidth - descriptionIndent);
    const titleLines = wrapText(line.title || "-", bold, titleSize, table.titleWidth);
    const lineDiscountAmount = getLineDiscountAmount(line);
    const lineTotalNet = getLineTotalNet(line);
    const rowHeight = Math.max(
      31,
      14 + titleLines.length * 10 + descriptionLines.length * 9 + (line.discountPercent > 0 ? 10 : 0)
    );

    if (y - rowHeight < bottomLimit) {
      await newPage();
    }

    const position = String(index + 1).padStart(3, "0");
    page.drawText(position, { x: table.posX, y, size: rowSize, font: regular, color: INK });
    page.drawText(`${formatQuantity(line.quantity)} ${line.unit}`, {
      x: table.quantityX,
      y,
      size: rowSize,
      font: regular,
      color: INK,
    });
    let textY = y;
    titleLines.forEach((titleLine) => {
      page.drawText(titleLine, { x: table.titleX, y: textY, size: titleSize, font: bold, color: INK });
      textY -= 10;
    });
    descriptionLines.forEach((descriptionLine) => {
      page.drawText(descriptionLine, {
        x: table.titleX + descriptionIndent,
        y: textY,
        size: descriptionSize,
        font: regular,
        color: INK,
      });
      textY -= 9;
    });
    drawRightAlignedText(page, formatEuro(line.unitPrice), table.unitPriceRightX, y, {
      size: rowSize,
      font: regular,
    });
    drawRightAlignedText(page, formatEuro(lineTotalNet), table.totalRightX, y, {
      size: rowSize,
      font: regular,
    });
    if (line.discountPercent > 0) {
      drawRightAlignedText(
        page,
        `( Rabatt ${formatQuantity(line.discountPercent)}% ${formatEuro(lineDiscountAmount)} )`,
        table.totalRightX,
        y - 11,
        { size: 6.6, font: regular, color: MUTED }
      );
    }
    y -= rowHeight;
  }

  const netBeforeInvoiceDiscount = lines.reduce((sum, line) => sum + getLineTotalNet(line), 0);
  const invoiceDiscountPercent = cleanPercent(Invoice.discountPercent);
  const invoiceDiscountAmount = roundMoney(netBeforeInvoiceDiscount * (invoiceDiscountPercent / 100));
  const netTotal = roundMoney(netBeforeInvoiceDiscount - invoiceDiscountAmount);
  const vatRate = cleanNumber(Invoice.vatRate, 19);
  const grossTotal = roundMoney(netTotal * (1 + vatRate / 100));

  if (y < (invoiceDiscountPercent > 0 ? 195 : 165)) {
    await newPage();
  }

  page.drawLine({ start: { x: 375, y: y + 12 }, end: { x: table.right, y: y + 12 }, thickness: 0.8, color: LINE });
  let totalsY = y;
  if (invoiceDiscountPercent > 0) {
    page.drawText("Nettobetrag (ohne Rabatt)", { x: 385, y: totalsY, size: 8.3, font: bold, color: INK });
    drawRightAlignedText(page, formatEuro(netBeforeInvoiceDiscount), table.totalRightX, totalsY, { size: 8.3, font: bold });
    totalsY -= 15;
    page.drawText(`Rabatt ${formatQuantity(invoiceDiscountPercent)}%`, { x: 385, y: totalsY, size: 8.3, font: regular, color: INK });
    drawRightAlignedText(page, `-${formatEuro(invoiceDiscountAmount)}`, table.totalRightX, totalsY, {
      size: 8.3,
      font: regular,
    });
    totalsY -= 15;
  }
  page.drawText("Netto", { x: 385, y: totalsY, size: 8.3, font: bold, color: INK });
  drawRightAlignedText(page, formatEuro(netTotal), table.totalRightX, totalsY, { size: 8.3, font: bold });
  page.drawText(`MwSt. ${formatQuantity(vatRate)} %`, { x: 385, y: totalsY - 15, size: 8.3, font: regular, color: INK });
  drawRightAlignedText(page, formatEuro(grossTotal - netTotal), table.totalRightX, totalsY - 15, {
    size: 8.3,
    font: regular,
  });
  page.drawText("Gesamt brutto", { x: 385, y: totalsY - 32, size: 9, font: bold, color: INK });
  drawRightAlignedText(page, formatEuro(grossTotal), table.totalRightX, totalsY - 32, { size: 9, font: bold });

  if (Invoice.closingText) {
    drawTextBlock(page, Invoice.closingText, 71, totalsY - 66, {
      font: regular,
      size: 8.3,
      maxWidth: 330,
      lineHeight: 11,
    });
  }

  pdfDoc.setTitle(`${Invoice.invoiceNumber} ${Invoice.projectTitle || "Rechnung"}`);
  pdfDoc.setSubject(company);
  pdfDoc.setProducer("WorkPilot360");
  pdfDoc.setCreator("WorkPilot360");

  const bytes = await pdfDoc.save();
  return {
    pdfData: Buffer.from(bytes).toString("base64"),
    netTotal,
    vatRate,
    grossTotal,
    pageCount: currentPageIndex + 1,
  };
}

function normalizeInvoiceLines(lines: InvoiceLineInput[] = []) {
  return lines
    .map((line) => {
      const quantity = Math.max(cleanNumber(line.quantity, 1), 0);
      const unitPrice = cleanNumber(line.unitPrice, 0);
      const discountPercent = cleanPercent(line.discountPercent);
      const catalogType = cleanString(line.catalogType);
      const canPlanLabor = catalogType === "service" || catalogType === "package";
      const laborItems = canPlanLabor && Array.isArray(line.laborItems)
        ? line.laborItems
            .reduce((items, labor) => {
              const alreadyPlanned = items.reduce((sum, item) => sum + item.plannedHours, 0);
              const availableHours = Math.max(quantity - alreadyPlanned, 0);
              const plannedHours = Math.max(cleanNumber(labor.plannedHours, 0), 0);
              const hourlyCostRate = Math.max(cleanNumber(labor.hourlyCostRate, 0), 0);
              const cappedHours = Math.min(plannedHours, availableHours);
              const item = {
                userId: cleanString(labor.userId),
                employeeName: cleanString(labor.employeeName),
                plannedHours: cappedHours,
                hourlyCostRate,
                totalCost: cappedHours * hourlyCostRate,
              };
              return [...items, item];
            }, [] as Array<{
              userId: string;
              employeeName: string;
              plannedHours: number;
              hourlyCostRate: number;
              totalCost: number;
            }>)
            .filter((labor) => labor.userId || labor.employeeName || labor.plannedHours > 0)
        : [];
      return {
        catalogItemId: cleanString(line.catalogItemId),
        catalogType,
        quantity,
        unit: normalizeUnit(line.unit) || "Stk",
        title: cleanString(line.title),
        description: cleanString(line.description),
        unitPrice,
        discountPercent,
        vatRate: cleanNumber(line.vatRate, 19),
        laborItems,
      };
    })
    .filter((line) => line.title || line.catalogItemId);
}

function serializeInvoice(
  row: InvoiceRow,
  lines: InvoiceLineRow[] = [],
  laborRows: InvoiceLineLaborRow[] = []
) {
  const billingSource = cleanString(row.billingSource) || "manual";
  return {
    ...row,
    billingSource,
    netTotal: Number(row.netTotal ?? 0),
    vatRate: Number(row.vatRate ?? 19),
    grossTotal: Number(row.grossTotal ?? 0),
    discountPercent: Number(row.discountPercent ?? 0),
    isPaid: Boolean(row.isPaid),
    paidAt: row.paidAt?.toISOString?.() ?? row.paidAt ?? "",
    plannedExecutionMonth: row.plannedExecutionMonth ?? "",
    pdfAvailable: Boolean(row.pdfData),
    pdfData: undefined,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    lines: lines.map((line) => ({
      ...line,
      quantity: Number(line.quantity ?? 0),
      unitPrice: Number(line.unitPrice ?? 0),
      discountPercent: Number(line.discountPercent ?? 0),
      vatRate: Number(line.vatRate ?? 19),
      totalNet: Number(line.totalNet ?? 0),
      laborItems: laborRows
        .filter((labor) => labor.invoiceLineId === line.id)
        .sort((first, second) => Number(first.position ?? 0) - Number(second.position ?? 0))
        .map((labor) => ({
          ...labor,
          plannedHours: Number(labor.plannedHours ?? 0),
          hourlyCostRate: Number(labor.hourlyCostRate ?? 0),
          totalCost: Number(labor.totalCost ?? 0),
        })),
    })),
  };
}

function serializeInvoiceHistory(row: InvoiceHistoryRow) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  };
}

async function getInvoiceLinesForInvoice(organizationId: string, invoiceId: string) {
  return prisma.$queryRaw<InvoiceLineRow[]>`
    SELECT *
    FROM "InvoiceLine"
    WHERE "organizationId" = ${organizationId} AND "invoiceId" = ${invoiceId}
    ORDER BY "position" ASC
  `;
}

async function getInvoiceLaborRowsForInvoice(organizationId: string, invoiceId: string) {
  return prisma.$queryRaw<InvoiceLineLaborRow[]>`
    SELECT *
    FROM "InvoiceLineLabor"
    WHERE "organizationId" = ${organizationId} AND "invoiceId" = ${invoiceId}
    ORDER BY "position" ASC
  `;
}

async function addInvoiceHistory(input: {
  organizationId: string;
  invoiceId: string;
  projectId: string;
  invoiceNumber: string;
  eventType: string;
  title: string;
  note: string;
  actorName: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "InvoiceHistory" (
      "id", "organizationId", "invoiceId", "projectId", "invoiceNumber",
      "eventType", "title", "note", "actorName"
    ) VALUES (
      ${randomUUID()}, ${input.organizationId}, ${input.invoiceId}, ${input.projectId}, ${input.invoiceNumber},
      ${input.eventType}, ${input.title}, ${input.note}, ${input.actorName}
    )
  `;
}

async function cancelInvoice(input: {
  organizationId: string;
  invoiceId: string;
  actorName: string;
}) {
  try {
  const existingRows = await prisma.$queryRaw<InvoiceRow[]>`
    SELECT *
    FROM "Invoice"
    WHERE "organizationId" = ${input.organizationId} AND "id" = ${input.invoiceId}
    LIMIT 1
  `;
  const existingInvoice = existingRows[0];
  if (!existingInvoice) {
    return NextResponse.json({ error: "Rechnung wurde nicht gefunden." }, { status: 404 });
  }
  if (["Storniert", "Stornorechnung", "Gelöscht"].includes(existingInvoice.status)) {
    return NextResponse.json({ error: "Diese Rechnung kann nicht storniert werden." }, { status: 400 });
  }

  const originalLines = await getInvoiceLinesForInvoice(input.organizationId, input.invoiceId);
  const originalLaborRows = await getInvoiceLaborRowsForInvoice(input.organizationId, input.invoiceId);
  if (originalLines.length === 0) {
    return NextResponse.json({ error: "Die Rechnung hat keine Positionen." }, { status: 400 });
  }

  const cancellationNumber = await getNextinvoiceNumber(input.organizationId, "ST");
  const cancellationId = randomUUID();
  const cancellationLines = originalLines.map((line) => ({
    catalogItemId: line.catalogItemId,
    catalogType: line.catalogType,
    quantity: Number(line.quantity ?? 0),
    unit: line.unit || "Stk",
    title: line.title || "-",
    description: [line.description, `Storno zu Rechnung ${existingInvoice.invoiceNumber}`].filter(Boolean).join("\n"),
    unitPrice: -Math.abs(Number(line.unitPrice ?? 0)),
    discountPercent: Number(line.discountPercent ?? 0),
    vatRate: Number(line.vatRate ?? existingInvoice.vatRate ?? 19),
    laborItems: [],
  })) as Required<InvoiceLineInput>[];
  const pdf = await generateInvoicePdf(
    {
      projectId: existingInvoice.projectId,
      projectNumber: existingInvoice.projectNumber,
      projectTitle: existingInvoice.projectTitle,
      company: existingInvoice.company,
      customerName: existingInvoice.customerName,
      customerStreet: existingInvoice.customerStreet,
      customerCity: existingInvoice.customerCity,
      contactName: existingInvoice.contactName,
      internalContactName: existingInvoice.internalContactName,
      internalPhone: existingInvoice.internalPhone,
      internalEmail: existingInvoice.internalEmail,
      introText: `hiermit stornieren wir die Rechnung ${existingInvoice.invoiceNumber} vollständig.`,
      closingText: "Diese Stornorechnung hebt die ursprüngliche Rechnung auf.",
      vatRate: Number(existingInvoice.vatRate ?? 19),
      discountPercent: Number(existingInvoice.discountPercent ?? 0),
      invoiceNumber: cancellationNumber,
      documentTitle: "Stornorechnung",
    },
    cancellationLines
  );

  const cancellationRows = await prisma.$queryRaw<InvoiceRow[]>`
    INSERT INTO "Invoice" (
      "id", "organizationId", "projectId", "projectNumber", "projectTitle", "company",
      "invoiceNumber", "status", "customerName", "customerStreet", "customerCity",
      "contactName", "internalContactName", "internalPhone", "internalEmail",
      "plannedExecutionMonth", "introText", "closingText", "discountPercent", "netTotal", "vatRate", "grossTotal", "pdfData", "updatedAt"
    ) VALUES (
      ${cancellationId}, ${input.organizationId}, ${existingInvoice.projectId}, ${existingInvoice.projectNumber},
      ${existingInvoice.projectTitle}, ${existingInvoice.company}, ${cancellationNumber}, ${"Stornorechnung"},
      ${existingInvoice.customerName}, ${existingInvoice.customerStreet}, ${existingInvoice.customerCity},
      ${existingInvoice.contactName}, ${existingInvoice.internalContactName}, ${existingInvoice.internalPhone},
      ${existingInvoice.internalEmail}, ${existingInvoice.plannedExecutionMonth ?? ""}, ${`hiermit stornieren wir die Rechnung ${existingInvoice.invoiceNumber} vollständig.`},
      ${"Diese Stornorechnung hebt die ursprüngliche Rechnung auf."},
      ${Number(existingInvoice.discountPercent ?? 0)}, ${pdf.netTotal}, ${pdf.vatRate}, ${pdf.grossTotal}, ${pdf.pdfData}, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  const savedLines: InvoiceLineRow[] = [];
  const savedLaborRows: InvoiceLineLaborRow[] = [];
  for (const [index, line] of cancellationLines.entries()) {
    const lineRows = await prisma.$queryRaw<InvoiceLineRow[]>`
      INSERT INTO "InvoiceLine" (
        "id", "organizationId", "invoiceId", "catalogItemId", "catalogType", "position",
        "quantity", "unit", "title", "description", "unitPrice", "discountPercent", "vatRate", "totalNet", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${input.organizationId}, ${cancellationId}, ${line.catalogItemId}, ${line.catalogType}, ${index + 1},
        ${line.quantity}, ${line.unit}, ${line.title}, ${line.description},
        ${line.unitPrice}, ${line.discountPercent}, ${line.vatRate}, ${getLineTotalNet(line)}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    savedLines.push(lineRows[0]);

    const originalLine = originalLines[index];
    const laborForLine = originalLaborRows.filter((labor) => labor.invoiceLineId === originalLine.id);
    for (const [laborIndex, labor] of laborForLine.entries()) {
      const laborRows = await prisma.$queryRaw<InvoiceLineLaborRow[]>`
        INSERT INTO "InvoiceLineLabor" (
          "id", "organizationId", "invoiceId", "invoiceLineId", "userId", "employeeName",
          "plannedHours", "hourlyCostRate", "totalCost", "position", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${input.organizationId}, ${cancellationId}, ${lineRows[0].id}, ${labor.userId}, ${labor.employeeName},
          ${-Math.abs(Number(labor.plannedHours ?? 0))}, ${Number(labor.hourlyCostRate ?? 0)}, ${-Math.abs(Number(labor.totalCost ?? 0))}, ${laborIndex + 1}, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      savedLaborRows.push(laborRows[0]);
    }
  }

  const originalRows = await prisma.$queryRaw<InvoiceRow[]>`
    UPDATE "Invoice"
    SET "status" = 'Storniert', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${input.organizationId} AND "id" = ${input.invoiceId}
    RETURNING *
  `;

  await prisma.$executeRaw`
    UPDATE "ProjectTimeEntry"
    SET "invoiceId" = NULL, "invoiceNumber" = NULL, "invoicedAt" = NULL
    WHERE "organizationId" = ${input.organizationId} AND "invoiceId" = ${input.invoiceId}
  `;

  await addInvoiceHistory({
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    projectId: existingInvoice.projectId,
    invoiceNumber: existingInvoice.invoiceNumber,
    eventType: "cancelled",
    title: "Rechnung storniert",
    note: `${existingInvoice.invoiceNumber} wurde mit ${cancellationNumber} storniert.`,
    actorName: input.actorName,
  });
  await addInvoiceHistory({
    organizationId: input.organizationId,
    invoiceId: cancellationId,
    projectId: existingInvoice.projectId,
    invoiceNumber: cancellationNumber,
    eventType: "created",
    title: "Stornorechnung erstellt",
    note: `${cancellationNumber} wurde als Storno zu ${existingInvoice.invoiceNumber} erstellt.`,
    actorName: input.actorName,
  });

  return NextResponse.json({
    originalInvoice: serializeInvoice(originalRows[0], originalLines, originalLaborRows),
    cancellationInvoice: serializeInvoice(cancellationRows[0], savedLines, savedLaborRows),
  });
  } catch (error) {
    console.error("Invoice cancellation failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Stornorechnung konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { organization } = await getDemoContext();
  await ensureInvoiceTables();
  const { searchParams } = new URL(req.url);
  const pdfId = cleanString(searchParams.get("pdfId"));
  const historyProjectId = cleanString(searchParams.get("historyProjectId"));

  if (pdfId) {
    const rows = await prisma.$queryRaw<InvoiceRow[]>`
      SELECT *
      FROM "Invoice"
      WHERE "organizationId" = ${organization.id} AND "id" = ${pdfId}
      LIMIT 1
    `;
    const Invoice = rows[0];
    if (!Invoice) {
      return NextResponse.json({ error: "PDF wurde nicht gefunden." }, { status: 404 });
    }
    if (Invoice.status === "Entwurf") {
      const lineRows = await getInvoiceLinesForInvoice(organization.id, Invoice.id);
      const draftLines = lineRows.map((line) => ({
        catalogItemId: line.catalogItemId,
        catalogType: line.catalogType,
        quantity: Number(line.quantity ?? 0),
        unit: line.unit || "Stk",
        title: line.title || "-",
        description: line.description || "",
        unitPrice: Number(line.unitPrice ?? 0),
        discountPercent: Number(line.discountPercent ?? 0),
        vatRate: Number(line.vatRate ?? Invoice.vatRate ?? 19),
        laborItems: [],
      })) as Required<InvoiceLineInput>[];
      const draftPdf = await generateInvoicePdf(
        {
          projectId: Invoice.projectId,
          projectNumber: Invoice.projectNumber,
          projectTitle: Invoice.projectTitle,
          company: Invoice.company,
          customerName: Invoice.customerName,
          customerStreet: Invoice.customerStreet,
          customerCity: Invoice.customerCity,
          contactName: Invoice.contactName,
          internalContactName: Invoice.internalContactName,
          internalPhone: Invoice.internalPhone,
          internalEmail: Invoice.internalEmail,
          plannedExecutionMonth: Invoice.plannedExecutionMonth,
          introText: Invoice.introText,
          closingText: Invoice.closingText,
          vatRate: Number(Invoice.vatRate ?? 19),
          discountPercent: Number(Invoice.discountPercent ?? 0),
          invoiceNumber: Invoice.invoiceNumber,
          documentTitle: "Rechnungsentwurf",
        },
        draftLines
      );
      const bytes = Buffer.from(draftPdf.pdfData ?? "", "base64");
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Rechnungsentwurf-${Invoice.projectNumber || Invoice.id}.pdf"`,
        },
      });
    }
    if (!Invoice.pdfData) {
      return NextResponse.json({ error: "PDF wurde nicht gefunden." }, { status: 404 });
    }
    const bytes = Buffer.from(Invoice.pdfData, "base64");
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${Invoice.invoiceNumber}.pdf"`,
      },
    });
  }

  if (historyProjectId) {
    const historyRows = await prisma.$queryRaw<InvoiceHistoryRow[]>`
      SELECT *
      FROM "InvoiceHistory"
      WHERE "organizationId" = ${organization.id} AND "projectId" = ${historyProjectId}
      ORDER BY "createdAt" DESC
    `;
    return NextResponse.json(historyRows.map(serializeInvoiceHistory));
  }

  const projectId = cleanString(searchParams.get("projectId"));
  const rows = projectId
    ? await prisma.$queryRaw<InvoiceRow[]>`
        SELECT *
        FROM "Invoice"
        WHERE "organizationId" = ${organization.id} AND "projectId" = ${projectId} AND "status" <> 'Gelöscht'
        ORDER BY "createdAt" DESC
      `
    : await prisma.$queryRaw<InvoiceRow[]>`
        SELECT *
        FROM "Invoice"
        WHERE "organizationId" = ${organization.id} AND "status" <> 'Gelöscht'
        ORDER BY "createdAt" DESC
      `;

  const lineRows: InvoiceLineRow[] = [];
  const laborRows: InvoiceLineLaborRow[] = [];
  for (const Invoice of rows) {
    const rowsForInvoice = await prisma.$queryRaw<InvoiceLineRow[]>`
      SELECT *
      FROM "InvoiceLine"
      WHERE "organizationId" = ${organization.id} AND "invoiceId" = ${Invoice.id}
      ORDER BY "position" ASC
    `;
    lineRows.push(...rowsForInvoice);

    const laborRowsForInvoice = await prisma.$queryRaw<InvoiceLineLaborRow[]>`
      SELECT *
      FROM "InvoiceLineLabor"
      WHERE "organizationId" = ${organization.id} AND "invoiceId" = ${Invoice.id}
      ORDER BY "position" ASC
    `;
    laborRows.push(...laborRowsForInvoice);
  }

  return NextResponse.json(
    rows.map((row) =>
      serializeInvoice(
        row,
        lineRows.filter((line) => line.invoiceId === row.id),
        laborRows.filter((labor) => labor.invoiceId === row.id)
      )
    )
  );
}

export async function POST(req: Request) {
  const { organization } = await getDemoContext();
  await ensureInvoiceTables();
  const body = (await req.json()) as InvoiceInput;
  const lines = normalizeInvoiceLines(body.lines);
  const saveAsDraft = Boolean(body.saveAsDraft);

  if (!body.projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  if (!saveAsDraft && lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const billedStampEntryIds = saveAsDraft ? [] : getBilledStampEntryIds(body.billedStampEntryIds);
  const stampedHours = saveAsDraft
    ? 0
    : await getStampedHoursForInvoiceCheck({
        organizationId: organization.id,
        projectId: cleanString(body.projectId),
        stampEntryIds: billedStampEntryIds,
      });
  const invoiceLaborHours = saveAsDraft ? 0 : getInvoiceLaborHours(lines);
  const isUnderbilledStampedHours = stampedHours > 0 && invoiceLaborHours + 0.01 < stampedHours;

  if (isUnderbilledStampedHours && !body.allowUnderbilledStampedHours) {
    return NextResponse.json(
      {
        error: `Es wurden ${stampedHours.toFixed(2)} Std. gestempelt, aber nur ${invoiceLaborHours.toFixed(2)} Std. fakturiert.`,
        requiresUnderbillingConfirmation: true,
        stampedHours,
        invoiceLaborHours,
      },
      { status: 409 }
    );
  }

  const invoiceNumber = await getNextinvoiceNumber(organization.id);
  const id = randomUUID();
  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const billingSource = cleanString(body.billingSource) === "batch" ? "batch" : "manual";
  const pdf =
    lines.length > 0
      ? await generateInvoicePdf(
          { ...body, company, invoiceNumber, documentTitle: saveAsDraft ? "Rechnungsentwurf" : "Rechnung" },
          lines
        )
      : { netTotal: 0, vatRate: cleanNumber(body.vatRate, 19), grossTotal: 0, pdfData: null };

  const rows = await prisma.$queryRaw<InvoiceRow[]>`
    INSERT INTO "Invoice" (
      "id", "organizationId", "projectId", "projectNumber", "projectTitle", "company",
      "invoiceNumber", "status", "billingSource", "customerName", "customerStreet", "customerCity",
      "contactName", "internalContactName", "internalPhone", "internalEmail",
      "plannedExecutionMonth", "introText", "closingText", "discountPercent", "netTotal", "vatRate", "grossTotal", "pdfData", "updatedAt"
    ) VALUES (
      ${id}, ${organization.id}, ${cleanString(body.projectId)}, ${cleanString(body.projectNumber)},
      ${cleanString(body.projectTitle)}, ${company}, ${invoiceNumber}, ${saveAsDraft ? "Entwurf" : "Fakturiert"}, ${billingSource},
      ${cleanString(body.customerName)}, ${cleanString(body.customerStreet)}, ${cleanString(body.customerCity)},
      ${cleanString(body.contactName)}, ${cleanString(body.internalContactName)}, ${cleanString(body.internalPhone)},
      ${cleanString(body.internalEmail)}, ${cleanString(body.plannedExecutionMonth)}, ${cleanString(body.introText)}, ${cleanString(body.closingText)},
      ${cleanPercent(body.discountPercent)}, ${pdf.netTotal}, ${pdf.vatRate}, ${pdf.grossTotal}, ${pdf.pdfData}, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  const savedLines: InvoiceLineRow[] = [];
  const savedLaborRows: InvoiceLineLaborRow[] = [];
  for (const [index, line] of lines.entries()) {
    const lineRows = await prisma.$queryRaw<InvoiceLineRow[]>`
      INSERT INTO "InvoiceLine" (
        "id", "organizationId", "invoiceId", "catalogItemId", "catalogType", "position",
        "quantity", "unit", "title", "description", "unitPrice", "discountPercent", "vatRate", "totalNet", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${organization.id}, ${id}, ${line.catalogItemId}, ${line.catalogType}, ${index + 1},
        ${line.quantity}, ${line.unit}, ${line.title}, ${line.description},
        ${line.unitPrice}, ${line.discountPercent}, ${line.vatRate}, ${getLineTotalNet(line)}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    savedLines.push(lineRows[0]);

    for (const [laborIndex, labor] of line.laborItems.entries()) {
      const laborRows = await prisma.$queryRaw<InvoiceLineLaborRow[]>`
        INSERT INTO "InvoiceLineLabor" (
          "id", "organizationId", "invoiceId", "invoiceLineId", "userId", "employeeName",
          "plannedHours", "hourlyCostRate", "totalCost", "position", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${organization.id}, ${id}, ${lineRows[0].id}, ${labor.userId}, ${labor.employeeName},
          ${labor.plannedHours}, ${labor.hourlyCostRate}, ${labor.totalCost}, ${laborIndex + 1}, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      savedLaborRows.push(laborRows[0]);
    }
  }


  await addInvoiceHistory({
    organizationId: organization.id,
    invoiceId: id,
    projectId: cleanString(body.projectId),
    invoiceNumber,
    eventType: "created",
    title: saveAsDraft ? "Rechnungsentwurf gespeichert" : "Rechnung angelegt",
    note: `${invoiceNumber} wurde ${saveAsDraft ? "als Entwurf gespeichert" : "erstellt"}.`,
    actorName: cleanString(body.internalContactName) || "System",
  });

  if (!saveAsDraft) {
    await markStampedHoursAsInvoiced({
      organizationId: organization.id,
      projectId: cleanString(body.projectId),
      invoiceId: id,
      invoiceNumber,
      stampEntryIds: billedStampEntryIds,
    });
  }

  if (!saveAsDraft && isUnderbilledStampedHours && !body.suppressUnderbillingNotification) {
    await notifyManagementAboutUnderbilling({
      organizationId: organization.id,
      projectId: cleanString(body.projectId),
      projectLabel: `${cleanString(body.projectNumber)} | ${cleanString(body.projectTitle)}`,
      invoiceNumber,
      stampedHours,
      invoiceHours: invoiceLaborHours,
    });
  }

  return NextResponse.json(serializeInvoice(rows[0], savedLines, savedLaborRows));
}

export async function PUT(req: Request) {
  await ensureInvoiceTables();
  const body = (await req.json()) as InvoiceInput & { invoiceNumber?: string };
  const lines = normalizeInvoiceLines(body.lines);

  if (lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const pdf = await generateInvoicePdf({
    ...body,
    company,
    invoiceNumber: cleanString(body.invoiceNumber) || "VORSCHAU",
  }, lines);

  return NextResponse.json({
    pdfDataUrl: `data:application/pdf;base64,${pdf.pdfData}`,
    netTotal: pdf.netTotal,
    vatRate: pdf.vatRate,
    grossTotal: pdf.grossTotal,
    pageCount: pdf.pageCount,
  });
}

export async function PATCH(req: Request) {
  const { organization } = await getDemoContext();
  await ensureInvoiceTables();
  const body = (await req.json()) as InvoiceInput & { id?: string; action?: string; actorName?: string };
  const id = cleanString(body.id);
  const saveAsDraft = Boolean(body.saveAsDraft);

  if (!id) {
    return NextResponse.json({ error: "Rechnung fehlt." }, { status: 400 });
  }

  if (cleanString(body.action) === "cancel") {
    return cancelInvoice({
      organizationId: organization.id,
      invoiceId: id,
      actorName: cleanString(body.actorName) || "System",
    });
  }

  if (cleanString(body.action) === "mark-paid") {
    const rows = await prisma.$queryRaw<InvoiceRow[]>`
      UPDATE "Invoice"
      SET "isPaid" = true,
          "paidAt" = COALESCE("paidAt", CURRENT_TIMESTAMP),
          "status" = CASE
            WHEN "status" = 'Fakturiert' THEN 'Bezahlt'
            ELSE "status"
          END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id} AND "id" = ${id}
      RETURNING *
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "Rechnung wurde nicht gefunden." }, { status: 404 });
    }

    await addInvoiceHistory({
      organizationId: organization.id,
      invoiceId: id,
      projectId: rows[0].projectId,
      invoiceNumber: rows[0].invoiceNumber,
      eventType: "paid",
      title: "Rechnung als bezahlt markiert",
      note: `${rows[0].invoiceNumber} wurde als bezahlt markiert.`,
      actorName: cleanString(body.actorName) || "System",
    });

    return NextResponse.json(serializeInvoice(rows[0], []));
  }

  const lines = normalizeInvoiceLines(body.lines);

  if (!saveAsDraft && lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const billedStampEntryIds = saveAsDraft ? [] : getBilledStampEntryIds(body.billedStampEntryIds);
  const stampedHours = saveAsDraft
    ? 0
    : await getStampedHoursForInvoiceCheck({
        organizationId: organization.id,
        projectId: cleanString(body.projectId),
        stampEntryIds: billedStampEntryIds,
      });
  const invoiceLaborHours = saveAsDraft ? 0 : getInvoiceLaborHours(lines);
  const isUnderbilledStampedHours = stampedHours > 0 && invoiceLaborHours + 0.01 < stampedHours;

  if (isUnderbilledStampedHours && !body.allowUnderbilledStampedHours) {
    return NextResponse.json(
      {
        error: `Es wurden ${stampedHours.toFixed(2)} Std. gestempelt, aber nur ${invoiceLaborHours.toFixed(2)} Std. fakturiert.`,
        requiresUnderbillingConfirmation: true,
        stampedHours,
        invoiceLaborHours,
      },
      { status: 409 }
    );
  }

  const existingRows = await prisma.$queryRaw<Array<{ invoiceNumber: string; status: string; billingSource: string }>>`
    SELECT "invoiceNumber", "status", "billingSource"
    FROM "Invoice"
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    LIMIT 1
  `;
  const existingInvoice = existingRows[0];
  if (!existingInvoice) {
    return NextResponse.json({ error: "Rechnung wurde nicht gefunden." }, { status: 404 });
  }
  const finalizesDraft = !saveAsDraft && existingInvoice.status === "Entwurf";

  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const requestedBillingSource = cleanString(body.billingSource);
  const billingSource =
    requestedBillingSource === "batch" || requestedBillingSource === "manual"
      ? requestedBillingSource
      : cleanString(existingInvoice.billingSource) || "manual";
  const pdf =
    lines.length > 0
      ? await generateInvoicePdf(
          {
            ...body,
            company,
            invoiceNumber: existingInvoice.invoiceNumber,
            documentTitle: saveAsDraft ? "Rechnungsentwurf" : "Rechnung",
          },
          lines
        )
      : { netTotal: 0, vatRate: cleanNumber(body.vatRate, 19), grossTotal: 0, pdfData: null };

  const rows = await prisma.$queryRaw<InvoiceRow[]>`
    UPDATE "Invoice"
    SET
      "projectId" = ${cleanString(body.projectId)},
      "projectNumber" = ${cleanString(body.projectNumber)},
      "projectTitle" = ${cleanString(body.projectTitle)},
      "company" = ${company},
      "billingSource" = ${billingSource},
      "customerName" = ${cleanString(body.customerName)},
      "customerStreet" = ${cleanString(body.customerStreet)},
      "customerCity" = ${cleanString(body.customerCity)},
      "contactName" = ${cleanString(body.contactName)},
      "internalContactName" = ${cleanString(body.internalContactName)},
      "internalPhone" = ${cleanString(body.internalPhone)},
      "internalEmail" = ${cleanString(body.internalEmail)},
      "plannedExecutionMonth" = ${cleanString(body.plannedExecutionMonth)},
      "introText" = ${cleanString(body.introText)},
      "closingText" = ${cleanString(body.closingText)},
      "discountPercent" = ${cleanPercent(body.discountPercent)},
      "netTotal" = ${pdf.netTotal},
      "vatRate" = ${pdf.vatRate},
      "grossTotal" = ${pdf.grossTotal},
      "pdfData" = ${pdf.pdfData},
      "status" = CASE
        WHEN ${saveAsDraft} THEN 'Entwurf'
        WHEN "status" = 'Entwurf' THEN 'Fakturiert'
        ELSE "status"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    RETURNING *
  `;

  await prisma.$executeRaw`
    DELETE FROM "InvoiceLine"
    WHERE "organizationId" = ${organization.id} AND "invoiceId" = ${id}
  `;

  const savedLines: InvoiceLineRow[] = [];
  const savedLaborRows: InvoiceLineLaborRow[] = [];
  for (const [index, line] of lines.entries()) {
    const lineRows = await prisma.$queryRaw<InvoiceLineRow[]>`
      INSERT INTO "InvoiceLine" (
        "id", "organizationId", "invoiceId", "catalogItemId", "catalogType", "position",
        "quantity", "unit", "title", "description", "unitPrice", "discountPercent", "vatRate", "totalNet", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${organization.id}, ${id}, ${line.catalogItemId}, ${line.catalogType}, ${index + 1},
        ${line.quantity}, ${line.unit}, ${line.title}, ${line.description},
        ${line.unitPrice}, ${line.discountPercent}, ${line.vatRate}, ${getLineTotalNet(line)}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    savedLines.push(lineRows[0]);

    for (const [laborIndex, labor] of line.laborItems.entries()) {
      const laborRows = await prisma.$queryRaw<InvoiceLineLaborRow[]>`
        INSERT INTO "InvoiceLineLabor" (
          "id", "organizationId", "invoiceId", "invoiceLineId", "userId", "employeeName",
          "plannedHours", "hourlyCostRate", "totalCost", "position", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${organization.id}, ${id}, ${lineRows[0].id}, ${labor.userId}, ${labor.employeeName},
          ${labor.plannedHours}, ${labor.hourlyCostRate}, ${labor.totalCost}, ${laborIndex + 1}, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      savedLaborRows.push(laborRows[0]);
    }
  }


  await addInvoiceHistory({
    organizationId: organization.id,
    invoiceId: id,
    projectId: cleanString(body.projectId),
    invoiceNumber: existingInvoice.invoiceNumber,
    eventType: "updated",
    title: saveAsDraft
      ? "Rechnungsentwurf gespeichert"
      : finalizesDraft
        ? "Rechnung fakturiert"
        : "Rechnung bearbeitet",
    note: `${existingInvoice.invoiceNumber} wurde ${
      saveAsDraft ? "als Entwurf gespeichert" : finalizesDraft ? "fakturiert" : "aktualisiert"
    }.`,
    actorName: cleanString(body.internalContactName) || "System",
  });

  if (!saveAsDraft) {
    await markStampedHoursAsInvoiced({
      organizationId: organization.id,
      projectId: cleanString(body.projectId),
      invoiceId: id,
      invoiceNumber: existingInvoice.invoiceNumber,
      stampEntryIds: billedStampEntryIds,
    });
  }

  if (!saveAsDraft && isUnderbilledStampedHours && !body.suppressUnderbillingNotification) {
    await notifyManagementAboutUnderbilling({
      organizationId: organization.id,
      projectId: cleanString(body.projectId),
      projectLabel: `${cleanString(body.projectNumber)} | ${cleanString(body.projectTitle)}`,
      invoiceNumber: existingInvoice.invoiceNumber,
      stampedHours,
      invoiceHours: invoiceLaborHours,
    });
  }

  return NextResponse.json(serializeInvoice(rows[0], savedLines, savedLaborRows));
}

export async function DELETE(req: Request) {
  const { organization } = await getDemoContext();
  await ensureInvoiceTables();
  const body = await req.json().catch(() => ({}));
  const id = cleanString(body.id);
  const actorId = cleanString(body.actorId);
  const actorName = cleanString(body.actorName) || "System";

  if (!id) {
    return NextResponse.json({ error: "Rechnung fehlt." }, { status: 400 });
  }

  if (!actorId) {
    return NextResponse.json({ error: "Benutzer fehlt." }, { status: 403 });
  }

  const actorRows = await prisma.$queryRaw<Array<{ role: string }>>`
    SELECT "role"
    FROM "User"
    WHERE "organizationId" = ${organization.id}
      AND "id" = ${actorId}
      AND "isActive" = true
    LIMIT 1
  `;
  if (actorRows[0]?.role !== "GESCHAEFTSFUEHRER") {
    return NextResponse.json(
      { error: "Nur Geschäftsführer dürfen Rechnungen löschen." },
      { status: 403 }
    );
  }

  const existingRows = await prisma.$queryRaw<InvoiceRow[]>`
    SELECT *
    FROM "Invoice"
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    LIMIT 1
  `;
  const existingInvoice = existingRows[0];
  if (!existingInvoice) {
    return NextResponse.json({ error: "Rechnung wurde nicht gefunden." }, { status: 404 });
  }

  const rows = await prisma.$queryRaw<InvoiceRow[]>`
    UPDATE "Invoice"
    SET "status" = 'Gelöscht', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    RETURNING *
  `;


  await ensureInvoiceTimeEntryColumns();
  await prisma.$executeRaw`
    UPDATE "ProjectTimeEntry"
    SET "invoiceId" = '',
        "invoiceNumber" = '',
        "invoicedAt" = NULL
    WHERE "organizationId" = ${organization.id}
      AND "invoiceId" = ${id}
  `;

  await addInvoiceHistory({
    organizationId: organization.id,
    invoiceId: id,
    projectId: existingInvoice.projectId,
    invoiceNumber: existingInvoice.invoiceNumber,
    eventType: "deleted",
    title: "Rechnung gelöscht",
    note: `${existingInvoice.invoiceNumber} wurde gelöscht.`,
    actorName,
  });

  return NextResponse.json(serializeInvoice(rows[0], []));
}


