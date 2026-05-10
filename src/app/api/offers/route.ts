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
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type OfferCompany = "OK solutions" | "OK immocare";

type OfferLineInput = {
  catalogItemId?: string;
  catalogType?: string;
  quantity?: number;
  unit?: string;
  title?: string;
  description?: string;
  unitPrice?: number;
  vatRate?: number;
  laborItems?: OfferLineLaborInput[];
};

type OfferLineLaborInput = {
  userId?: string;
  employeeName?: string;
  plannedHours?: number;
  hourlyCostRate?: number;
  totalCost?: number;
};

type OfferInput = {
  projectId?: string;
  projectNumber?: string;
  projectTitle?: string;
  company?: OfferCompany;
  customerName?: string;
  customerStreet?: string;
  customerCity?: string;
  contactName?: string;
  internalContactName?: string;
  internalPhone?: string;
  internalEmail?: string;
  introText?: string;
  closingText?: string;
  vatRate?: number;
  lines?: OfferLineInput[];
};

type OfferRow = {
  id: string;
  organizationId: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  company: OfferCompany;
  offerNumber: string;
  status: string;
  customerName: string;
  customerStreet: string;
  customerCity: string;
  contactName: string;
  internalContactName: string;
  internalPhone: string;
  internalEmail: string;
  introText: string;
  closingText: string;
  netTotal: number;
  vatRate: number;
  grossTotal: number;
  pdfData: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OfferLineRow = {
  id: string;
  offerId: string;
  catalogItemId: string;
  catalogType: string;
  position: number;
  quantity: number;
  unit: string;
  title: string;
  description: string;
  unitPrice: number;
  vatRate: number;
  totalNet: number;
};

type OfferLineLaborRow = {
  id: string;
  offerId: string;
  offerLineId: string;
  userId: string;
  employeeName: string;
  plannedHours: number;
  hourlyCostRate: number;
  totalCost: number;
  position: number;
};

type OfferHistoryRow = {
  id: string;
  offerId: string;
  projectId: string;
  offerNumber: string;
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

async function embedOfferFonts(pdfDoc: PDFDocument) {
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

async function ensureOfferTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Offer" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "projectTitle" TEXT NOT NULL DEFAULT '',
      "company" TEXT NOT NULL DEFAULT 'OK solutions',
      "offerNumber" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Entwurf',
      "customerName" TEXT NOT NULL DEFAULT '',
      "customerStreet" TEXT NOT NULL DEFAULT '',
      "customerCity" TEXT NOT NULL DEFAULT '',
      "contactName" TEXT NOT NULL DEFAULT '',
      "internalContactName" TEXT NOT NULL DEFAULT '',
      "internalPhone" TEXT NOT NULL DEFAULT '',
      "internalEmail" TEXT NOT NULL DEFAULT '',
      "introText" TEXT NOT NULL DEFAULT '',
      "closingText" TEXT NOT NULL DEFAULT '',
      "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "grossTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "pdfData" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "Offer_organizationId_projectId_idx"
    ON "Offer" ("organizationId", "projectId")
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "Offer_organizationId_offerNumber_key"
    ON "Offer" ("organizationId", "offerNumber")
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OfferLine" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "catalogItemId" TEXT NOT NULL DEFAULT '',
      "catalogType" TEXT NOT NULL DEFAULT '',
      "position" INTEGER NOT NULL DEFAULT 0,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
      "unit" TEXT NOT NULL DEFAULT 'Stk',
      "title" TEXT NOT NULL DEFAULT '',
      "description" TEXT NOT NULL DEFAULT '',
      "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OfferLine_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OfferHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "offerNumber" TEXT NOT NULL DEFAULT '',
      "eventType" TEXT NOT NULL DEFAULT '',
      "title" TEXT NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "actorName" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OfferLineLabor" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "offerLineId" TEXT NOT NULL,
      "userId" TEXT NOT NULL DEFAULT '',
      "employeeName" TEXT NOT NULL DEFAULT '',
      "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "hourlyCostRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OfferLineLabor_offerLineId_fkey" FOREIGN KEY ("offerLineId") REFERENCES "OfferLine"("id") ON DELETE CASCADE
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "OfferLineLabor_organizationId_offerId_idx"
    ON "OfferLineLabor" ("organizationId", "offerId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "OfferLineLabor_organizationId_offerLineId_idx"
    ON "OfferLineLabor" ("organizationId", "offerLineId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "OfferHistory_organizationId_projectId_idx"
    ON "OfferHistory" ("organizationId", "projectId", "createdAt")
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

async function getNextOfferNumber(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ offerNumber: string }>>`
    SELECT "offerNumber"
    FROM "Offer"
    WHERE "organizationId" = ${organizationId}
  `;
  const highest =
    rows
      .map((row) => Number((row.offerNumber.match(/\d+/g) ?? ["10099"]).join("")))
      .filter((value) => Number.isFinite(value))
      .sort((first, second) => second - first)[0] ?? 10099;

  return `ANG-${highest + 1}`;
}

function getTemplatePath(company: OfferCompany) {
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

async function generateOfferPdf(offer: OfferInput & { offerNumber: string }, lines: Required<OfferLineInput>[]) {
  const company = offer.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const templateBytes = await readFile(getTemplatePath(company));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const { regular, bold } = await embedOfferFonts(pdfDoc);

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

  page.drawText(offer.customerName || "-", { x: 71, y: 672, size: 8.7, font: bold, color: INK });
  page.drawText(offer.customerStreet || "", { x: 71, y: 660, size: 8.4, font: bold, color: INK });
  page.drawText(offer.customerCity || "", { x: 71, y: 648, size: 8.4, font: bold, color: INK });

  const infoRows = [
    ["Angebotsnummer", offer.offerNumber],
    ["Kundennummer", offer.projectNumber || ""],
    ["Datum", formatDate()],
    ["Ansprechpartner", offer.internalContactName || ""],
    ["Telefon", offer.internalPhone || ""],
    ["E-Mail", offer.internalEmail || ""],
  ];
  infoRows.forEach(([label, value], index) => {
    const rowY = 676 - index * 13;
    page.drawText(label, { x: 313, y: rowY, size: 8.5, font: bold, color: MUTED });
    drawRightAlignedText(page, value || "-", 552, rowY, { size: 8.5, font: regular, color: INK });
  });

  page.drawText(`Projekt: ${offer.projectTitle || "-"}`, { x: 71, y: 544, size: 10.7, font: bold, color: INK });
  page.drawText(`Angebot Nr. ${offer.offerNumber}`, { x: 71, y: 520, size: 10.7, font: bold, color: INK });
  const greeting = offer.contactName ? `Sehr geehrte/r ${offer.contactName},` : "Sehr geehrte Damen und Herren,";
  page.drawText(greeting, { x: 71, y: 492, size: 8.8, font: regular, color: INK });
  drawTextBlock(
    page,
    offer.introText || "wir danken Ihnen fuer Ihre Anfrage und unterbreiten Ihnen auf den folgenden Seiten unser Angebot.",
    71,
    472,
    { font: regular, size: 8.8, maxWidth: 480, lineHeight: 12 }
  );

  drawTableHeader(page, y, bold);
  y -= 21;

  for (const [index, line] of lines.entries()) {
    const descriptionLines = wrapText(line.description || "", regular, descriptionSize, table.titleWidth - descriptionIndent);
    const titleLines = wrapText(line.title || "-", bold, titleSize, table.titleWidth);
    const rowHeight = Math.max(31, 14 + titleLines.length * 10 + descriptionLines.length * 9);

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
    drawRightAlignedText(page, formatEuro(line.quantity * line.unitPrice), table.totalRightX, y, {
      size: rowSize,
      font: regular,
    });
    y -= rowHeight;
  }

  const netTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const vatRate = cleanNumber(offer.vatRate, 19);
  const grossTotal = netTotal * (1 + vatRate / 100);

  if (y < 165) {
    await newPage();
  }

  page.drawLine({ start: { x: 375, y: y + 12 }, end: { x: table.right, y: y + 12 }, thickness: 0.8, color: LINE });
  page.drawText("Netto", { x: 385, y, size: 8.3, font: bold, color: INK });
  drawRightAlignedText(page, formatEuro(netTotal), table.totalRightX, y, { size: 8.3, font: bold });
  page.drawText(`MwSt. ${formatQuantity(vatRate)} %`, { x: 385, y: y - 15, size: 8.3, font: regular, color: INK });
  drawRightAlignedText(page, formatEuro(grossTotal - netTotal), table.totalRightX, y - 15, {
    size: 8.3,
    font: regular,
  });
  page.drawText("Gesamt brutto", { x: 385, y: y - 32, size: 9, font: bold, color: INK });
  drawRightAlignedText(page, formatEuro(grossTotal), table.totalRightX, y - 32, { size: 9, font: bold });

  if (offer.closingText) {
    drawTextBlock(page, offer.closingText, 71, y - 66, {
      font: regular,
      size: 8.3,
      maxWidth: 330,
      lineHeight: 11,
    });
  }

  pdfDoc.setTitle(`${offer.offerNumber} ${offer.projectTitle || "Angebot"}`);
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

function normalizeOfferLines(lines: OfferLineInput[] = []) {
  return lines
    .map((line) => {
      const quantity = Math.max(cleanNumber(line.quantity, 1), 0);
      const unitPrice = cleanNumber(line.unitPrice, 0);
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
        unit: cleanString(line.unit) || "Stk",
        title: cleanString(line.title),
        description: cleanString(line.description),
        unitPrice,
        vatRate: cleanNumber(line.vatRate, 19),
        laborItems,
      };
    })
    .filter((line) => line.title || line.catalogItemId);
}

function serializeOffer(
  row: OfferRow,
  lines: OfferLineRow[] = [],
  laborRows: OfferLineLaborRow[] = []
) {
  return {
    ...row,
    netTotal: Number(row.netTotal ?? 0),
    vatRate: Number(row.vatRate ?? 19),
    grossTotal: Number(row.grossTotal ?? 0),
    pdfAvailable: Boolean(row.pdfData),
    pdfData: undefined,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    lines: lines.map((line) => ({
      ...line,
      quantity: Number(line.quantity ?? 0),
      unitPrice: Number(line.unitPrice ?? 0),
      vatRate: Number(line.vatRate ?? 19),
      totalNet: Number(line.totalNet ?? 0),
      laborItems: laborRows
        .filter((labor) => labor.offerLineId === line.id)
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

function serializeOfferHistory(row: OfferHistoryRow) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  };
}

async function addOfferHistory(input: {
  organizationId: string;
  offerId: string;
  projectId: string;
  offerNumber: string;
  eventType: string;
  title: string;
  note: string;
  actorName: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "OfferHistory" (
      "id", "organizationId", "offerId", "projectId", "offerNumber",
      "eventType", "title", "note", "actorName"
    ) VALUES (
      ${randomUUID()}, ${input.organizationId}, ${input.offerId}, ${input.projectId}, ${input.offerNumber},
      ${input.eventType}, ${input.title}, ${input.note}, ${input.actorName}
    )
  `;
}

export async function GET(req: Request) {
  const { organization } = await getDemoContext();
  await ensureOfferTables();
  const { searchParams } = new URL(req.url);
  const pdfId = cleanString(searchParams.get("pdfId"));
  const historyProjectId = cleanString(searchParams.get("historyProjectId"));

  if (pdfId) {
    const rows = await prisma.$queryRaw<Array<{ offerNumber: string; pdfData: string | null }>>`
      SELECT "offerNumber", "pdfData"
      FROM "Offer"
      WHERE "organizationId" = ${organization.id} AND "id" = ${pdfId}
      LIMIT 1
    `;
    const offer = rows[0];
    if (!offer?.pdfData) {
      return NextResponse.json({ error: "PDF wurde nicht gefunden." }, { status: 404 });
    }
    const bytes = Buffer.from(offer.pdfData, "base64");
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${offer.offerNumber}.pdf"`,
      },
    });
  }

  if (historyProjectId) {
    const historyRows = await prisma.$queryRaw<OfferHistoryRow[]>`
      SELECT *
      FROM "OfferHistory"
      WHERE "organizationId" = ${organization.id} AND "projectId" = ${historyProjectId}
      ORDER BY "createdAt" DESC
    `;
    return NextResponse.json(historyRows.map(serializeOfferHistory));
  }

  const projectId = cleanString(searchParams.get("projectId"));
  const rows = projectId
    ? await prisma.$queryRaw<OfferRow[]>`
        SELECT *
        FROM "Offer"
        WHERE "organizationId" = ${organization.id} AND "projectId" = ${projectId} AND "status" <> 'Gelöscht'
        ORDER BY "createdAt" DESC
      `
    : await prisma.$queryRaw<OfferRow[]>`
        SELECT *
        FROM "Offer"
        WHERE "organizationId" = ${organization.id} AND "status" <> 'Gelöscht'
        ORDER BY "createdAt" DESC
      `;

  const lineRows: OfferLineRow[] = [];
  const laborRows: OfferLineLaborRow[] = [];
  for (const offer of rows) {
    const rowsForOffer = await prisma.$queryRaw<OfferLineRow[]>`
      SELECT *
      FROM "OfferLine"
      WHERE "organizationId" = ${organization.id} AND "offerId" = ${offer.id}
      ORDER BY "position" ASC
    `;
    lineRows.push(...rowsForOffer);

    const laborRowsForOffer = await prisma.$queryRaw<OfferLineLaborRow[]>`
      SELECT *
      FROM "OfferLineLabor"
      WHERE "organizationId" = ${organization.id} AND "offerId" = ${offer.id}
      ORDER BY "position" ASC
    `;
    laborRows.push(...laborRowsForOffer);
  }

  return NextResponse.json(
    rows.map((row) =>
      serializeOffer(
        row,
        lineRows.filter((line) => line.offerId === row.id),
        laborRows.filter((labor) => labor.offerId === row.id)
      )
    )
  );
}

export async function POST(req: Request) {
  const { organization } = await getDemoContext();
  await ensureOfferTables();
  const body = (await req.json()) as OfferInput;
  const lines = normalizeOfferLines(body.lines);

  if (!body.projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const offerNumber = await getNextOfferNumber(organization.id);
  const id = randomUUID();
  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const pdf = await generateOfferPdf({ ...body, company, offerNumber }, lines);

  const rows = await prisma.$queryRaw<OfferRow[]>`
    INSERT INTO "Offer" (
      "id", "organizationId", "projectId", "projectNumber", "projectTitle", "company",
      "offerNumber", "status", "customerName", "customerStreet", "customerCity",
      "contactName", "internalContactName", "internalPhone", "internalEmail",
      "introText", "closingText", "netTotal", "vatRate", "grossTotal", "pdfData"
    ) VALUES (
      ${id}, ${organization.id}, ${cleanString(body.projectId)}, ${cleanString(body.projectNumber)},
      ${cleanString(body.projectTitle)}, ${company}, ${offerNumber}, ${"Entwurf"},
      ${cleanString(body.customerName)}, ${cleanString(body.customerStreet)}, ${cleanString(body.customerCity)},
      ${cleanString(body.contactName)}, ${cleanString(body.internalContactName)}, ${cleanString(body.internalPhone)},
      ${cleanString(body.internalEmail)}, ${cleanString(body.introText)}, ${cleanString(body.closingText)},
      ${pdf.netTotal}, ${pdf.vatRate}, ${pdf.grossTotal}, ${pdf.pdfData}
    )
    RETURNING *
  `;

  const savedLines: OfferLineRow[] = [];
  const savedLaborRows: OfferLineLaborRow[] = [];
  for (const [index, line] of lines.entries()) {
    const lineRows = await prisma.$queryRaw<OfferLineRow[]>`
      INSERT INTO "OfferLine" (
        "id", "organizationId", "offerId", "catalogItemId", "catalogType", "position",
        "quantity", "unit", "title", "description", "unitPrice", "vatRate", "totalNet"
      ) VALUES (
        ${randomUUID()}, ${organization.id}, ${id}, ${line.catalogItemId}, ${line.catalogType}, ${index + 1},
        ${line.quantity}, ${line.unit}, ${line.title}, ${line.description},
        ${line.unitPrice}, ${line.vatRate}, ${line.quantity * line.unitPrice}
      )
      RETURNING *
    `;
    savedLines.push(lineRows[0]);

    for (const [laborIndex, labor] of line.laborItems.entries()) {
      const laborRows = await prisma.$queryRaw<OfferLineLaborRow[]>`
        INSERT INTO "OfferLineLabor" (
          "id", "organizationId", "offerId", "offerLineId", "userId", "employeeName",
          "plannedHours", "hourlyCostRate", "totalCost", "position"
        ) VALUES (
          ${randomUUID()}, ${organization.id}, ${id}, ${lineRows[0].id}, ${labor.userId}, ${labor.employeeName},
          ${labor.plannedHours}, ${labor.hourlyCostRate}, ${labor.totalCost}, ${laborIndex + 1}
        )
        RETURNING *
      `;
      savedLaborRows.push(laborRows[0]);
    }
  }

  await addOfferHistory({
    organizationId: organization.id,
    offerId: id,
    projectId: cleanString(body.projectId),
    offerNumber,
    eventType: "created",
    title: "Angebot angelegt",
    note: `${offerNumber} wurde erstellt.`,
    actorName: cleanString(body.internalContactName) || "System",
  });

  return NextResponse.json(serializeOffer(rows[0], savedLines, savedLaborRows));
}

export async function PUT(req: Request) {
  await ensureOfferTables();
  const body = (await req.json()) as OfferInput & { offerNumber?: string };
  const lines = normalizeOfferLines(body.lines);

  if (lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const pdf = await generateOfferPdf({
    ...body,
    company,
    offerNumber: cleanString(body.offerNumber) || "VORSCHAU",
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
  await ensureOfferTables();
  const body = (await req.json()) as OfferInput & { id?: string };
  const id = cleanString(body.id);
  const lines = normalizeOfferLines(body.lines);

  if (!id) {
    return NextResponse.json({ error: "Angebot fehlt." }, { status: 400 });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const existingRows = await prisma.$queryRaw<Array<{ offerNumber: string }>>`
    SELECT "offerNumber"
    FROM "Offer"
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    LIMIT 1
  `;
  const existingOffer = existingRows[0];
  if (!existingOffer) {
    return NextResponse.json({ error: "Angebot wurde nicht gefunden." }, { status: 404 });
  }

  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const pdf = await generateOfferPdf({ ...body, company, offerNumber: existingOffer.offerNumber }, lines);

  const rows = await prisma.$queryRaw<OfferRow[]>`
    UPDATE "Offer"
    SET
      "projectId" = ${cleanString(body.projectId)},
      "projectNumber" = ${cleanString(body.projectNumber)},
      "projectTitle" = ${cleanString(body.projectTitle)},
      "company" = ${company},
      "customerName" = ${cleanString(body.customerName)},
      "customerStreet" = ${cleanString(body.customerStreet)},
      "customerCity" = ${cleanString(body.customerCity)},
      "contactName" = ${cleanString(body.contactName)},
      "internalContactName" = ${cleanString(body.internalContactName)},
      "internalPhone" = ${cleanString(body.internalPhone)},
      "internalEmail" = ${cleanString(body.internalEmail)},
      "introText" = ${cleanString(body.introText)},
      "closingText" = ${cleanString(body.closingText)},
      "netTotal" = ${pdf.netTotal},
      "vatRate" = ${pdf.vatRate},
      "grossTotal" = ${pdf.grossTotal},
      "pdfData" = ${pdf.pdfData},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    RETURNING *
  `;

  await prisma.$executeRaw`
    DELETE FROM "OfferLine"
    WHERE "organizationId" = ${organization.id} AND "offerId" = ${id}
  `;

  const savedLines: OfferLineRow[] = [];
  const savedLaborRows: OfferLineLaborRow[] = [];
  for (const [index, line] of lines.entries()) {
    const lineRows = await prisma.$queryRaw<OfferLineRow[]>`
      INSERT INTO "OfferLine" (
        "id", "organizationId", "offerId", "catalogItemId", "catalogType", "position",
        "quantity", "unit", "title", "description", "unitPrice", "vatRate", "totalNet"
      ) VALUES (
        ${randomUUID()}, ${organization.id}, ${id}, ${line.catalogItemId}, ${line.catalogType}, ${index + 1},
        ${line.quantity}, ${line.unit}, ${line.title}, ${line.description},
        ${line.unitPrice}, ${line.vatRate}, ${line.quantity * line.unitPrice}
      )
      RETURNING *
    `;
    savedLines.push(lineRows[0]);

    for (const [laborIndex, labor] of line.laborItems.entries()) {
      const laborRows = await prisma.$queryRaw<OfferLineLaborRow[]>`
        INSERT INTO "OfferLineLabor" (
          "id", "organizationId", "offerId", "offerLineId", "userId", "employeeName",
          "plannedHours", "hourlyCostRate", "totalCost", "position"
        ) VALUES (
          ${randomUUID()}, ${organization.id}, ${id}, ${lineRows[0].id}, ${labor.userId}, ${labor.employeeName},
          ${labor.plannedHours}, ${labor.hourlyCostRate}, ${labor.totalCost}, ${laborIndex + 1}
        )
        RETURNING *
      `;
      savedLaborRows.push(laborRows[0]);
    }
  }

  await addOfferHistory({
    organizationId: organization.id,
    offerId: id,
    projectId: cleanString(body.projectId),
    offerNumber: existingOffer.offerNumber,
    eventType: "updated",
    title: "Angebot bearbeitet",
    note: `${existingOffer.offerNumber} wurde aktualisiert.`,
    actorName: cleanString(body.internalContactName) || "System",
  });

  return NextResponse.json(serializeOffer(rows[0], savedLines, savedLaborRows));
}

export async function DELETE(req: Request) {
  const { organization } = await getDemoContext();
  await ensureOfferTables();
  const body = await req.json().catch(() => ({}));
  const id = cleanString(body.id);
  const actorName = cleanString(body.actorName) || "System";

  if (!id) {
    return NextResponse.json({ error: "Angebot fehlt." }, { status: 400 });
  }

  const existingRows = await prisma.$queryRaw<OfferRow[]>`
    SELECT *
    FROM "Offer"
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    LIMIT 1
  `;
  const existingOffer = existingRows[0];
  if (!existingOffer) {
    return NextResponse.json({ error: "Angebot wurde nicht gefunden." }, { status: 404 });
  }

  const rows = await prisma.$queryRaw<OfferRow[]>`
    UPDATE "Offer"
    SET "status" = 'Gelöscht', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    RETURNING *
  `;

  await addOfferHistory({
    organizationId: organization.id,
    offerId: id,
    projectId: existingOffer.projectId,
    offerNumber: existingOffer.offerNumber,
    eventType: "deleted",
    title: "Angebot gelöscht",
    note: `${existingOffer.offerNumber} wurde gelöscht.`,
    actorName,
  });

  return NextResponse.json(serializeOffer(rows[0], []));
}
