import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { Prisma } from "@prisma/client";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { prisma } from "@/lib/db/client";
import { syncInvoiceInventoryMovements } from "@/lib/inventory/catalog-inventory";

type CancellationDb = Prisma.TransactionClient | typeof prisma;

const ALLOWED_STATUSES = ["Fakturiert", "Bezahlt"] as const;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.25, 0.29, 0.34);

export class InvoiceCancellationServiceError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_input"
      | "invalid_state"
      | "blocked"
      | "stale_context"
      | "conflict",
    message: string
  ) {
    super(message);
    this.name = "InvoiceCancellationServiceError";
  }
}

export type InvoiceCancellationEvaluation = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    company: string;
    customerName: string;
    customerStreet: string;
    customerCity: string;
    contactName: string;
    internalContactName: string;
    serviceDate: string;
    netTotal: number;
    vatRate: number;
    grossTotal: number;
    isPaid: boolean;
    updatedAt: string;
  };
  cancellationNumber: string;
  lineCount: number;
  releasedTimeEntryCount: number;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

async function nextCancellationNumber(db: CancellationDb, organizationId: string) {
  const rows = await db.$queryRaw<Array<{ invoiceNumber: string }>>`
    SELECT "invoiceNumber"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId} AND "invoiceNumber" LIKE 'ST-%'
  `;
  const highest = rows.reduce((value, row) => {
    const match = row.invoiceNumber.match(/^ST-(\d+)$/);
    return Math.max(value, match ? Number(match[1]) : 0);
  }, 10099);
  return `ST-${highest + 1}`;
}

export function getInvoiceCancellationConfirmationText(
  invoiceNumber: string,
  cancellationNumber: string
) {
  return `STORNIEREN ${invoiceNumber.trim()} MIT ${cancellationNumber.trim()}`;
}

export function matchesInvoiceCancellationConfirmation(
  invoiceNumber: string,
  cancellationNumber: string,
  confirmationText: string
) {
  return confirmationText.trim() ===
    getInvoiceCancellationConfirmationText(invoiceNumber, cancellationNumber);
}

export async function evaluateInvoiceCancellation(input: {
  organizationId: string;
  invoiceId: string;
  db?: CancellationDb;
}): Promise<InvoiceCancellationEvaluation> {
  const db = input.db ?? prisma;
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    include: {
      lines: {
        orderBy: { position: "asc" },
        include: { laborItems: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!invoice) {
    throw new InvoiceCancellationServiceError(
      "not_found",
      "Die Rechnung wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (!(ALLOWED_STATUSES as readonly string[]).includes(invoice.status)) {
    throw new InvoiceCancellationServiceError(
      "invalid_state",
      `${invoice.invoiceNumber} kann im Status ${invoice.status} nicht storniert werden.`
    );
  }
  const cancellationNumber = await nextCancellationNumber(db, input.organizationId);
  const releasedTimeEntryCount = await db.projectTimeEntry.count({
    where: {
      organizationId: input.organizationId,
      invoiceId: invoice.id,
      deletedAt: null,
    },
  });
  const checks: InvoiceCancellationEvaluation["checks"] = [];
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  if (!invoice.lines.length) {
    const issue = "Die Rechnung hat keine Positionen und kann nicht sicher storniert werden.";
    blockingIssues.push(issue);
    checks.push({ key: "lines", label: "Positionen", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "lines",
      label: "Positionen",
      status: "ok",
      detail: `${invoice.lines.length} Position(en) werden vollständig gegengebucht.`,
    });
  }
  if (invoice.isPaid || invoice.status === "Bezahlt") {
    const warning =
      "Die Rechnung ist als bezahlt gekennzeichnet. Das Vollstorno löst keine Rückzahlung und keine separate Zahlungsbuchung aus.";
    warnings.push(warning);
    checks.push({ key: "payment", label: "Zahlungsstatus", status: "warning", detail: warning });
  } else {
    checks.push({
      key: "payment",
      label: "Zahlungsstatus",
      status: "ok",
      detail: "Die Rechnung ist nicht als bezahlt gekennzeichnet.",
    });
  }
  checks.push({
    key: "time",
    label: "Abgerechnete Zeiten",
    status: "ok",
    detail: releasedTimeEntryCount
      ? `${releasedTimeEntryCount} verknüpfte Zeiteinträge werden wieder zur Abrechnung freigegeben.`
      : "Es sind keine verknüpften Zeiteinträge freizugeben.",
  });
  checks.push({
    key: "amount",
    label: "Gegenbuchung",
    status: "ok",
    detail: `${formatEuro(invoice.grossTotal)} werden vollständig mit ${formatEuro(-Math.abs(invoice.grossTotal))} gegengebucht.`,
  });
  const fingerprintData = {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      isPaid: invoice.isPaid,
      paidAt: invoice.paidAt?.toISOString() ?? "",
      netTotal: invoice.netTotal,
      vatRate: invoice.vatRate,
      grossTotal: invoice.grossTotal,
      updatedAt: invoice.updatedAt.toISOString(),
    },
    cancellationNumber,
    releasedTimeEntryCount,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      totalNet: line.totalNet,
      updatedAt: line.updatedAt.toISOString(),
      laborItems: line.laborItems.map((labor) => ({
        id: labor.id,
        plannedHours: labor.plannedHours,
        totalCost: labor.totalCost,
        updatedAt: labor.updatedAt.toISOString(),
      })),
    })),
  };
  return {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      projectId: invoice.projectId,
      projectNumber: invoice.projectNumber,
      projectTitle: invoice.projectTitle,
      company: invoice.company,
      customerName: invoice.customerName,
      customerStreet: invoice.customerStreet,
      customerCity: invoice.customerCity,
      contactName: invoice.contactName,
      internalContactName: invoice.internalContactName,
      serviceDate: invoice.serviceDate,
      netTotal: Number(invoice.netTotal),
      vatRate: Number(invoice.vatRate),
      grossTotal: Number(invoice.grossTotal),
      isPaid: invoice.isPaid,
      updatedAt: invoice.updatedAt.toISOString(),
    },
    cancellationNumber,
    lineCount: invoice.lines.length,
    releasedTimeEntryCount,
    checks,
    warnings,
    blockingIssues,
    fingerprint: stableHash(fingerprintData),
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) result.push(line);
        line = word;
      }
    }
    if (line) result.push(line);
    if (!words.length) result.push("");
  }
  return result;
}

function drawRight(page: PDFPage, text: string, rightX: number, y: number, font: PDFFont, size: number) {
  page.drawText(text, {
    x: rightX - font.widthOfTextAtSize(text, size),
    y,
    font,
    size,
    color: INK,
  });
}

async function embedFonts(pdf: PDFDocument) {
  try {
    pdf.registerFontkit(fontkit);
    const [regular, bold] = await Promise.all([
      readFile(path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf")),
      readFile(path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf")),
    ]);
    return {
      regular: await pdf.embedFont(regular, { subset: true }),
      bold: await pdf.embedFont(bold, { subset: true }),
    };
  } catch {
    return {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
  }
}

async function renderCancellationPdf(
  evaluation: InvoiceCancellationEvaluation,
  lines: Array<{ quantity: number; unit: string; title: string; description: string; unitPrice: number; totalNet: number }>
) {
  const templateName = evaluation.invoice.company === "OK immocare" ? "ok-immocare.pdf" : "ok-solutions.pdf";
  const template = await PDFDocument.load(
    await readFile(path.join(process.cwd(), "public", "offer-templates", templateName))
  );
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFonts(pdf);
  let pageIndex = 0;
  const addPage = async () => {
    const sourceIndex = pageIndex === 0 ? 0 : Math.min(1, template.getPageCount() - 1);
    const [page] = await pdf.copyPages(template, [sourceIndex]);
    pdf.addPage(page);
    pageIndex += 1;
    return page;
  };
  let page = await addPage();
  const invoice = evaluation.invoice;
  page.drawText(invoice.customerName || "-", { x: 71, y: 672, size: 8.7, font: bold, color: INK });
  page.drawText(invoice.customerStreet || "", { x: 71, y: 660, size: 8.4, font: bold, color: INK });
  page.drawText(invoice.customerCity || "", { x: 71, y: 648, size: 8.4, font: bold, color: INK });
  const info = [
    ["Stornonummer", evaluation.cancellationNumber],
    ["Referenzrechnung", invoice.invoiceNumber],
    ["Rechnungsdatum", formatDate()],
    ["Leistungsdatum", invoice.serviceDate || "-"],
    ["Projektnummer", invoice.projectNumber || "-"],
  ];
  info.forEach(([label, value], index) => {
    const y = 676 - index * 13;
    page.drawText(label, { x: 313, y, size: 8.5, font: bold, color: MUTED });
    drawRight(page, value, 552, y, regular, 8.5);
  });
  page.drawText(`Projekt: ${invoice.projectTitle || "-"}`, { x: 71, y: 544, size: 10.7, font: bold, color: INK });
  page.drawText(`Stornorechnung Nr. ${evaluation.cancellationNumber}`, { x: 71, y: 520, size: 10.7, font: bold, color: INK });
  page.drawText(invoice.contactName ? `Sehr geehrte/r ${invoice.contactName},` : "Sehr geehrte Damen und Herren,", { x: 71, y: 492, size: 8.8, font: regular, color: INK });
  page.drawText(`hiermit stornieren wir die Rechnung ${invoice.invoiceNumber} vollständig.`, { x: 71, y: 472, size: 8.8, font: regular, color: INK });

  const drawHeader = (target: PDFPage, y: number) => {
    target.drawText("Pos", { x: 78, y, size: 8, font: bold, color: INK });
    target.drawText("Menge", { x: 112, y, size: 8, font: bold, color: INK });
    target.drawText("Bezeichnung", { x: 168, y, size: 8, font: bold, color: INK });
    drawRight(target, "Einzelpreis", 475, y, bold, 8);
    drawRight(target, "Gesamt", 545, y, bold, 8);
  };
  let y = 432;
  drawHeader(page, y);
  y -= 22;
  for (const [index, line] of lines.entries()) {
    const titleLines = wrapText(line.title || "-", bold, 7.6, 190);
    const descriptionLines = wrapText(line.description, regular, 7.1, 190).slice(0, 4);
    const height = Math.max(28, 13 + titleLines.length * 9 + descriptionLines.length * 8);
    if (y - height < 105) {
      page = await addPage();
      y = 713;
      drawHeader(page, y);
      y -= 22;
    }
    page.drawText(String(index + 1).padStart(3, "0"), { x: 78, y, size: 7.6, font: regular, color: INK });
    page.drawText(`${line.quantity} ${line.unit}`, { x: 112, y, size: 7.6, font: regular, color: INK });
    let textY = y;
    for (const row of titleLines) {
      page.drawText(row, { x: 168, y: textY, size: 7.6, font: bold, color: INK });
      textY -= 9;
    }
    for (const row of descriptionLines) {
      if (row) page.drawText(row, { x: 176, y: textY, size: 7.1, font: regular, color: MUTED });
      textY -= 8;
    }
    drawRight(page, formatEuro(line.unitPrice), 475, y, regular, 7.6);
    drawRight(page, formatEuro(line.totalNet), 545, y, regular, 7.6);
    y -= height;
  }
  if (y < 175) {
    page = await addPage();
    y = 713;
  }
  page.drawText("Netto", { x: 385, y, size: 8.3, font: bold, color: INK });
  drawRight(page, formatEuro(-Math.abs(invoice.netTotal)), 545, y, bold, 8.3);
  page.drawText(`MwSt. ${invoice.vatRate} %`, { x: 385, y: y - 15, size: 8.3, font: regular, color: INK });
  drawRight(page, formatEuro(-Math.abs(invoice.grossTotal - invoice.netTotal)), 545, y - 15, regular, 8.3);
  page.drawText("Gesamt brutto", { x: 385, y: y - 32, size: 9, font: bold, color: INK });
  drawRight(page, formatEuro(-Math.abs(invoice.grossTotal)), 545, y - 32, bold, 9);
  page.drawText("Diese Stornorechnung hebt die ursprüngliche Rechnung vollständig auf.", { x: 71, y: y - 66, size: 8.3, font: regular, color: INK });
  pdf.setTitle(`${evaluation.cancellationNumber} ${invoice.projectTitle || "Stornorechnung"}`);
  const bytes = await pdf.save();
  return Buffer.from(bytes).toString("base64");
}

export async function createInvoiceCancellation(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  invoiceId: string;
  actorName: string;
  actorUserId?: string;
  reason: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new InvoiceCancellationServiceError(
      "invalid_input",
      "Für das Vollstorno ist ein nachvollziehbarer Grund mit 3 bis 500 Zeichen erforderlich."
    );
  }
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${`workpilot:invoice-cancellation-number:${input.organizationId}`}))
  `;
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${`workpilot:invoice-cancellation:${input.organizationId}:${input.invoiceId}`}))
  `;
  const evaluation = await evaluateInvoiceCancellation({
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    db: input.tx,
  });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluation.fingerprint) {
    throw new InvoiceCancellationServiceError(
      "stale_context",
      "Rechnung, Positionen, ST-Nummer oder Verknüpfungen haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluation.blockingIssues.length) {
    throw new InvoiceCancellationServiceError("blocked", evaluation.blockingIssues.join(" · "));
  }
  const original = await input.tx.invoice.findFirstOrThrow({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    include: {
      lines: { orderBy: { position: "asc" }, include: { laborItems: { orderBy: { position: "asc" } } } },
    },
  });
  const pdfData = await renderCancellationPdf(
    evaluation,
    original.lines.map((line) => ({
      quantity: line.quantity,
      unit: line.unit,
      title: line.title,
      description: [line.description, `Storno zu Rechnung ${original.invoiceNumber}`].filter(Boolean).join(" · "),
      unitPrice: -Math.abs(line.unitPrice),
      totalNet: -Math.abs(line.totalNet),
    }))
  );
  const cancellationId = randomUUID();
  const cancellation = await input.tx.invoice.create({
    data: {
      id: cancellationId,
      organizationId: input.organizationId,
      projectId: original.projectId,
      projectNumber: original.projectNumber,
      projectTitle: original.projectTitle,
      company: original.company,
      invoiceNumber: evaluation.cancellationNumber,
      status: "Stornorechnung",
      billingSource: "cancellation",
      customerName: original.customerName,
      customerStreet: original.customerStreet,
      customerCity: original.customerCity,
      contactName: original.contactName,
      internalContactName: original.internalContactName,
      internalPhone: original.internalPhone,
      internalEmail: original.internalEmail,
      plannedExecutionMonth: original.plannedExecutionMonth,
      serviceDate: original.serviceDate,
      sourceOfferId: original.sourceOfferId,
      sourceOfferNumber: original.sourceOfferNumber,
      introText: `hiermit stornieren wir die Rechnung ${original.invoiceNumber} vollständig.`,
      closingText: "Diese Stornorechnung hebt die ursprüngliche Rechnung vollständig auf.",
      netTotal: -Math.abs(original.netTotal),
      vatRate: original.vatRate,
      grossTotal: -Math.abs(original.grossTotal),
      discountPercent: original.discountPercent,
      paymentTermDays: original.paymentTermDays,
      pdfData,
      lines: {
        create: original.lines.map((line) => ({
          organizationId: input.organizationId,
          catalogItemId: line.catalogItemId,
          catalogType: line.catalogType,
          position: line.position,
          quantity: line.quantity,
          unit: line.unit,
          title: line.title,
          description: [line.description, `Storno zu Rechnung ${original.invoiceNumber}`].filter(Boolean).join("\n"),
          unitPrice: -Math.abs(line.unitPrice),
          discountPercent: line.discountPercent,
          isLaborPosition: line.isLaborPosition,
          materialUnitCostSnapshot: line.materialUnitCostSnapshot,
          materialCostSnapshot: -Math.abs(line.materialCostSnapshot),
          laborUnitCostSnapshot: line.laborUnitCostSnapshot,
          laborCostSnapshot: -Math.abs(line.laborCostSnapshot),
          packageComponentsSnapshot: line.packageComponentsSnapshot as Prisma.InputJsonValue,
          catalogCostSnapshotVersion: line.catalogCostSnapshotVersion,
          costSnapshotAt: line.costSnapshotAt,
          vatRate: line.vatRate,
          totalNet: -Math.abs(line.totalNet),
          laborItems: {
            create: line.laborItems.map((labor) => ({
              organizationId: input.organizationId,
              invoiceId: cancellationId,
              userId: labor.userId,
              employeeName: labor.employeeName,
              plannedHours: -Math.abs(labor.plannedHours),
              hourlyCostRate: labor.hourlyCostRate,
              totalCost: -Math.abs(labor.totalCost),
              position: labor.position,
            })),
          },
        })),
      },
    },
    include: { lines: { include: { laborItems: true } } },
  });
  const updated = await input.tx.invoice.updateMany({
    where: {
      id: original.id,
      organizationId: input.organizationId,
      status: original.status,
      updatedAt: original.updatedAt,
    },
    data: { status: "Storniert" },
  });
  if (updated.count !== 1) {
    throw new InvoiceCancellationServiceError(
      "conflict",
      "Die Rechnung wurde zwischenzeitlich verändert oder bereits storniert."
    );
  }
  await input.tx.projectTimeEntry.updateMany({
    where: { organizationId: input.organizationId, invoiceId: original.id, deletedAt: null },
    data: { invoiceId: null, invoiceNumber: null, invoicedAt: null },
  });
  await input.tx.invoiceHistory.createMany({
    data: [
      {
        organizationId: input.organizationId,
        invoiceId: original.id,
        projectId: original.projectId,
        invoiceNumber: original.invoiceNumber,
        eventType: "cancelled",
        title: "Rechnung storniert",
        note: `Vollstorno durch ${evaluation.cancellationNumber}. Grund: ${reason}`,
        actorName: input.actorName,
      },
      {
        organizationId: input.organizationId,
        invoiceId: cancellation.id,
        projectId: cancellation.projectId,
        invoiceNumber: cancellation.invoiceNumber,
        eventType: "cancellation-created",
        title: "Stornorechnung erstellt",
        note: `Vollständige Gegenbuchung zu ${original.invoiceNumber}. Grund: ${reason}`,
        actorName: input.actorName,
      },
    ],
  });
  await input.tx.projectLogbookEntry.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      projectId: original.projectId,
      title: "Rechnung",
      body: `Rechnung ${original.invoiceNumber} wurde vollständig storniert. Stornorechnung ${cancellation.invoiceNumber}. Grund: ${reason}`,
      author: input.actorName || "System",
      authorUserId: input.actorUserId || null,
      visibleFor: ["GF", "Büro", "Mitarbeiter"],
      attachments: [],
      source: input.source,
    },
  });
  await syncInvoiceInventoryMovements({
    db: input.tx,
    organizationId: input.organizationId,
    invoiceId: original.id,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    useExistingTransaction: true,
  });
  return { originalInvoiceId: original.id, cancellationInvoice: cancellation, evaluation };
}
