import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { Prisma } from "@prisma/client";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { prisma } from "@/lib/db/client";

type CreditDb = Prisma.TransactionClient | typeof prisma;

const ALLOWED_STATUSES = ["Fakturiert", "Bezahlt"] as const;
const INACTIVE_CREDIT_STATUSES = ["Gelöscht", "Geloescht", "Storniert"] as const;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.25, 0.29, 0.34);

export type InvoiceCreditItemInput = {
  sourceInvoiceLineId: string;
  netAmount: number;
};

export class InvoiceCreditServiceError extends Error {
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
    this.name = "InvoiceCreditServiceError";
  }
}

export type InvoiceCreditEvaluation = {
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
    serviceDate: string;
    netTotal: number;
    grossTotal: number;
    isPaid: boolean;
    updatedAt: string;
  };
  creditNumber: string;
  lines: Array<{
    id: string;
    position: number;
    title: string;
    vatRate: number;
    originalNet: number;
    alreadyCreditedNet: number;
    remainingNet: number;
    creditNet: number;
    creditGross: number;
  }>;
  totalCreditNet: number;
  totalCreditGross: number;
  remainingInvoiceNet: number;
  remainingInvoiceGross: number;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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

function normalizeItems(items: InvoiceCreditItemInput[]) {
  const merged = new Map<string, number>();
  for (const item of items) {
    const id = item.sourceInvoiceLineId.trim();
    const amount = roundMoney(Number(item.netAmount));
    if (!id || !Number.isFinite(amount)) continue;
    merged.set(id, roundMoney((merged.get(id) ?? 0) + amount));
  }
  return [...merged.entries()].map(([sourceInvoiceLineId, netAmount]) => ({
    sourceInvoiceLineId,
    netAmount,
  }));
}

async function nextCreditNumber(db: CreditDb, organizationId: string) {
  const rows = await db.$queryRaw<Array<{ invoiceNumber: string }>>`
    SELECT "invoiceNumber"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId} AND "invoiceNumber" LIKE 'GU-%'
  `;
  const highest = rows.reduce((value, row) => {
    const match = row.invoiceNumber.match(/^GU-(\d+)$/);
    return Math.max(value, match ? Number(match[1]) : 0);
  }, 10099);
  return `GU-${highest + 1}`;
}

export function getInvoiceCreditConfirmationText(
  invoiceNumber: string,
  creditNumber: string,
  grossAmount: number
) {
  return `GUTSCHRIFT ${creditNumber.trim()} ZU ${invoiceNumber.trim()} ÜBER ${grossAmount
    .toFixed(2)
    .replace(".", ",")} EUR`;
}

export function matchesInvoiceCreditConfirmation(
  invoiceNumber: string,
  creditNumber: string,
  grossAmount: number,
  confirmationText: string
) {
  return confirmationText.trim() ===
    getInvoiceCreditConfirmationText(invoiceNumber, creditNumber, grossAmount);
}

export async function evaluateInvoiceCredit(input: {
  organizationId: string;
  invoiceId: string;
  items?: InvoiceCreditItemInput[];
  db?: CreditDb;
}): Promise<InvoiceCreditEvaluation> {
  const db = input.db ?? prisma;
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) {
    throw new InvoiceCreditServiceError(
      "not_found",
      "Die Rechnung wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (!(ALLOWED_STATUSES as readonly string[]).includes(invoice.status)) {
    throw new InvoiceCreditServiceError(
      "invalid_state",
      `${invoice.invoiceNumber} kann im Status ${invoice.status} nicht teilgutgeschrieben werden.`
    );
  }
  const creditNumber = await nextCreditNumber(db, input.organizationId);
  const previousCredits = await db.invoice.findMany({
    where: {
      organizationId: input.organizationId,
      sourceInvoiceId: invoice.id,
      status: { notIn: [...INACTIVE_CREDIT_STATUSES] },
    },
    include: { lines: true },
    orderBy: { createdAt: "asc" },
  });
  const alreadyCreditedByLine = new Map<string, number>();
  for (const credit of previousCredits) {
    for (const line of credit.lines) {
      if (!line.sourceInvoiceLineId) continue;
      alreadyCreditedByLine.set(
        line.sourceInvoiceLineId,
        roundMoney(
          (alreadyCreditedByLine.get(line.sourceInvoiceLineId) ?? 0) +
            Math.abs(Number(line.totalNet))
        )
      );
    }
  }
  const requested = new Map(
    normalizeItems(input.items ?? []).map((item) => [item.sourceInvoiceLineId, item.netAmount])
  );
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  if (!invoice.lines.length) {
    blockingIssues.push("Die Rechnung hat keine Positionen und kann nicht sicher korrigiert werden.");
  }
  for (const id of requested.keys()) {
    if (!invoice.lines.some((line) => line.id === id)) {
      blockingIssues.push("Mindestens eine ausgewählte Position gehört nicht zur Referenzrechnung.");
      break;
    }
  }
  const lines = invoice.lines.map((line) => {
    const originalNet = roundMoney(Math.abs(Number(line.totalNet)));
    const alreadyCreditedNet = roundMoney(alreadyCreditedByLine.get(line.id) ?? 0);
    const remainingNet = roundMoney(Math.max(0, originalNet - alreadyCreditedNet));
    const creditNet = roundMoney(requested.get(line.id) ?? 0);
    if (creditNet < 0) {
      blockingIssues.push(`Die Gutschrift für „${line.title || `Position ${line.position}`}“ darf nicht negativ eingegeben werden.`);
    }
    if (creditNet > remainingNet) {
      blockingIssues.push(
        `Für „${line.title || `Position ${line.position}`}“ sind nur noch ${formatEuro(remainingNet)} netto gutschreibbar.`
      );
    }
    return {
      id: line.id,
      position: line.position,
      title: line.title || `Position ${line.position}`,
      vatRate: Number(line.vatRate),
      originalNet,
      alreadyCreditedNet,
      remainingNet,
      creditNet,
      creditGross: roundMoney(creditNet * (1 + Number(line.vatRate) / 100)),
    };
  });
  const selectedLines = lines.filter((line) => line.creditNet > 0);
  const totalCreditNet = roundMoney(selectedLines.reduce((sum, line) => sum + line.creditNet, 0));
  const totalCreditGross = roundMoney(selectedLines.reduce((sum, line) => sum + line.creditGross, 0));
  const remainingInvoiceNet = roundMoney(lines.reduce((sum, line) => sum + line.remainingNet, 0));
  const remainingInvoiceGross = roundMoney(
    lines.reduce((sum, line) => sum + roundMoney(line.remainingNet * (1 + line.vatRate / 100)), 0)
  );
  if (!selectedLines.length) {
    blockingIssues.push("Wähle mindestens eine Rechnungsposition mit einem Gutschriftbetrag größer 0,00 EUR netto aus.");
  }
  if (totalCreditNet >= remainingInvoiceNet && remainingInvoiceNet > 0) {
    blockingIssues.push(
      "Die Auswahl würde den gesamten noch offenen Rechnungswert aufheben. Nutze dafür den gesonderten Vollstorno-Prozess oder lasse den Sonderfall durch die Buchhaltung prüfen."
    );
  }
  if (invoice.isPaid || invoice.status === "Bezahlt") {
    warnings.push(
      "Die Rechnung ist als bezahlt gekennzeichnet. Die Teilgutschrift löst keine Auszahlung und keine separate Zahlungsbuchung aus."
    );
  }
  warnings.push(
    "Eine finanzielle Teilgutschrift gibt weder Zeiten zur Abrechnung frei noch bucht sie Material zurück. Rückgabe und Leistungsänderung bleiben getrennte Prozesse."
  );
  const checks: InvoiceCreditEvaluation["checks"] = [
    {
      key: "reference",
      label: "Referenzrechnung",
      status: invoice.lines.length ? "ok" : "blocked",
      detail: `${invoice.invoiceNumber} · ${invoice.status} · ${invoice.lines.length} Position(en)`,
    },
    {
      key: "remaining",
      label: "Noch gutschreibbar",
      status: "ok",
      detail: `${formatEuro(remainingInvoiceNet)} netto / ${formatEuro(remainingInvoiceGross)} brutto vor dieser Korrektur.`,
    },
    {
      key: "amount",
      label: "Ausgewählte Teilgutschrift",
      status: selectedLines.length && !blockingIssues.length ? "ok" : "blocked",
      detail: `${formatEuro(totalCreditNet)} netto / ${formatEuro(totalCreditGross)} brutto auf ${selectedLines.length} Position(en).`,
    },
    {
      key: "operational-effects",
      label: "Zeit und Lager",
      status: "warning",
      detail: "Keine automatische Zeitfreigabe und keine Materialrückbuchung.",
    },
  ];
  const fingerprint = stableHash({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      isPaid: invoice.isPaid,
      updatedAt: invoice.updatedAt.toISOString(),
      netTotal: invoice.netTotal,
      grossTotal: invoice.grossTotal,
    },
    creditNumber,
    lines: lines.map((line) => ({
      id: line.id,
      originalNet: line.originalNet,
      alreadyCreditedNet: line.alreadyCreditedNet,
      remainingNet: line.remainingNet,
      creditNet: line.creditNet,
      vatRate: line.vatRate,
    })),
    previousCredits: previousCredits.map((credit) => ({
      id: credit.id,
      invoiceNumber: credit.invoiceNumber,
      status: credit.status,
      updatedAt: credit.updatedAt.toISOString(),
    })),
  });
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
      serviceDate: invoice.serviceDate,
      netTotal: Number(invoice.netTotal),
      grossTotal: Number(invoice.grossTotal),
      isPaid: invoice.isPaid,
      updatedAt: invoice.updatedAt.toISOString(),
    },
    creditNumber,
    lines,
    totalCreditNet,
    totalCreditGross,
    remainingInvoiceNet,
    remainingInvoiceGross,
    checks,
    warnings,
    blockingIssues: [...new Set(blockingIssues)],
    fingerprint,
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const rows: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let current = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        if (current) rows.push(current);
        current = word;
      }
    }
    if (current) rows.push(current);
  }
  return rows;
}

function drawRight(page: PDFPage, text: string, rightX: number, y: number, font: PDFFont, size: number) {
  page.drawText(text, { x: rightX - font.widthOfTextAtSize(text, size), y, font, size, color: INK });
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

async function renderCreditPdf(evaluation: InvoiceCreditEvaluation, reason: string) {
  const templateName = evaluation.invoice.company === "OK immocare" ? "ok-immocare.pdf" : "ok-solutions.pdf";
  const template = await PDFDocument.load(
    await readFile(path.join(process.cwd(), "public", "offer-templates", templateName))
  );
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFonts(pdf);
  let pageIndex = 0;
  const addPage = async () => {
    const sourceIndex = pageIndex === 0 ? 0 : Math.min(1, template.getPageCount() - 1);
    const [nextPage] = await pdf.copyPages(template, [sourceIndex]);
    pdf.addPage(nextPage);
    pageIndex += 1;
    return nextPage;
  };
  let page = await addPage();
  const invoice = evaluation.invoice;
  page.drawText(invoice.customerName || "-", { x: 71, y: 672, size: 8.7, font: bold, color: INK });
  page.drawText(invoice.customerStreet || "", { x: 71, y: 660, size: 8.4, font: bold, color: INK });
  page.drawText(invoice.customerCity || "", { x: 71, y: 648, size: 8.4, font: bold, color: INK });
  const info = [
    ["Gutschriftnummer", evaluation.creditNumber],
    ["Referenzrechnung", invoice.invoiceNumber],
    ["Belegdatum", formatDate()],
    ["Leistungsdatum", invoice.serviceDate || "-"],
    ["Projektnummer", invoice.projectNumber || "-"],
  ];
  info.forEach(([label, value], index) => {
    const y = 676 - index * 13;
    page.drawText(label, { x: 313, y, size: 8.5, font: bold, color: MUTED });
    drawRight(page, value, 552, y, regular, 8.5);
  });
  page.drawText(`Projekt: ${invoice.projectTitle || "-"}`, { x: 71, y: 544, size: 10.7, font: bold, color: INK });
  page.drawText(`Teilgutschrift Nr. ${evaluation.creditNumber}`, { x: 71, y: 520, size: 10.7, font: bold, color: INK });
  page.drawText(invoice.contactName ? `Sehr geehrte/r ${invoice.contactName},` : "Sehr geehrte Damen und Herren,", { x: 71, y: 492, size: 8.8, font: regular, color: INK });
  page.drawText(`zur Rechnung ${invoice.invoiceNumber} schreiben wir folgende Beträge gut:`, { x: 71, y: 472, size: 8.8, font: regular, color: INK });
  const drawHeader = (target: PDFPage, headerY: number) => {
    target.drawText("Pos", { x: 78, y: headerY, size: 8, font: bold, color: INK });
    target.drawText("Bezeichnung", { x: 125, y: headerY, size: 8, font: bold, color: INK });
    drawRight(target, "Netto", 455, headerY, bold, 8);
    drawRight(target, "Brutto", 545, headerY, bold, 8);
  };
  let y = 432;
  drawHeader(page, y);
  y -= 22;
  for (const line of evaluation.lines.filter((candidate) => candidate.creditNet > 0)) {
    if (y < 125) {
      page = await addPage();
      y = 713;
      drawHeader(page, y);
      y -= 22;
    }
    page.drawText(String(line.position).padStart(3, "0"), { x: 78, y, size: 7.6, font: regular, color: INK });
    const title = wrapText(line.title, bold, 7.6, 245).slice(0, 2);
    title.forEach((row, index) => page.drawText(row, { x: 125, y: y - index * 9, size: 7.6, font: bold, color: INK }));
    drawRight(page, formatEuro(-line.creditNet), 455, y, regular, 7.6);
    drawRight(page, formatEuro(-line.creditGross), 545, y, regular, 7.6);
    y -= Math.max(28, title.length * 10 + 10);
  }
  if (y < 165) {
    page = await addPage();
    y = 713;
  }
  page.drawText("Gutschrift netto", { x: 365, y, size: 8.3, font: bold, color: INK });
  drawRight(page, formatEuro(-evaluation.totalCreditNet), 545, y, bold, 8.3);
  page.drawText("Gutschrift brutto", { x: 365, y: y - 18, size: 9, font: bold, color: INK });
  drawRight(page, formatEuro(-evaluation.totalCreditGross), 545, y - 18, bold, 9);
  const reasonRows = wrapText(`Grund: ${reason}`, regular, 8.1, 465).slice(0, 4);
  reasonRows.forEach((row, index) => page.drawText(row, { x: 71, y: y - 55 - index * 10, size: 8.1, font: regular, color: INK }));
  pdf.setTitle(`${evaluation.creditNumber} ${invoice.projectTitle || "Teilgutschrift"}`);
  return Buffer.from(await pdf.save()).toString("base64");
}

export async function createInvoiceCredit(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  invoiceId: string;
  actorName: string;
  actorUserId?: string;
  reason: string;
  items: InvoiceCreditItemInput[];
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new InvoiceCreditServiceError(
      "invalid_input",
      "Für die Teilgutschrift ist ein nachvollziehbarer Grund mit 3 bis 500 Zeichen erforderlich."
    );
  }
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${`workpilot:invoice-credit-number:${input.organizationId}`}))
  `;
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${`workpilot:invoice-credit:${input.organizationId}:${input.invoiceId}`}))
  `;
  const evaluation = await evaluateInvoiceCredit({
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    items: input.items,
    db: input.tx,
  });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluation.fingerprint) {
    throw new InvoiceCreditServiceError(
      "stale_context",
      "Rechnung, Restbeträge, GU-Nummer oder frühere Gutschriften haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluation.blockingIssues.length) {
    throw new InvoiceCreditServiceError("blocked", evaluation.blockingIssues.join(" · "));
  }
  const original = await input.tx.invoice.findFirstOrThrow({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    include: { lines: true },
  });
  const selected = evaluation.lines.filter((line) => line.creditNet > 0);
  const sourceLines = new Map(original.lines.map((line) => [line.id, line]));
  const pdfData = await renderCreditPdf(evaluation, reason);
  const creditId = randomUUID();
  const vatRates = [...new Set(selected.map((line) => line.vatRate))];
  const creditInvoice = await input.tx.invoice.create({
    data: {
      id: creditId,
      organizationId: input.organizationId,
      projectId: original.projectId,
      projectNumber: original.projectNumber,
      projectTitle: original.projectTitle,
      company: original.company,
      invoiceNumber: evaluation.creditNumber,
      status: "Gutschrift",
      billingSource: "credit-note",
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
      sourceInvoiceId: original.id,
      sourceInvoiceNumber: original.invoiceNumber,
      correctionReason: reason,
      introText: `Teilgutschrift zur Rechnung ${original.invoiceNumber}.`,
      closingText: `Grund: ${reason}`,
      netTotal: -evaluation.totalCreditNet,
      vatRate: vatRates.length === 1 ? vatRates[0] : 0,
      grossTotal: -evaluation.totalCreditGross,
      discountPercent: 0,
      paymentTermDays: 0,
      dueDate: "",
      pdfData,
      lines: {
        create: selected.map((line, index) => {
          const source = sourceLines.get(line.id);
          if (!source) {
            throw new InvoiceCreditServiceError("stale_context", "Eine Referenzposition ist nicht mehr vorhanden.");
          }
          return {
            organizationId: input.organizationId,
            sourceInvoiceLineId: source.id,
            catalogItemId: source.catalogItemId,
            catalogType: source.catalogType,
            position: index + 1,
            quantity: 1,
            unit: "Pauschal",
            title: `Teilgutschrift: ${source.title || `Position ${source.position}`}`,
            description: `Zu ${original.invoiceNumber}, Position ${source.position}. Grund: ${reason}`,
            unitPrice: -line.creditNet,
            discountPercent: 0,
            isLaborPosition: false,
            materialUnitCostSnapshot: 0,
            materialCostSnapshot: 0,
            laborUnitCostSnapshot: 0,
            laborCostSnapshot: 0,
            packageComponentsSnapshot: [] as Prisma.InputJsonValue,
            catalogCostSnapshotVersion: source.catalogCostSnapshotVersion,
            costSnapshotAt: source.costSnapshotAt,
            vatRate: line.vatRate,
            totalNet: -line.creditNet,
          };
        }),
      },
    },
    include: { lines: { include: { laborItems: true } } },
  });
  await input.tx.invoiceHistory.createMany({
    data: [
      {
        id: randomUUID(),
        organizationId: input.organizationId,
        invoiceId: original.id,
        projectId: original.projectId,
        invoiceNumber: original.invoiceNumber,
        eventType: "credit-created",
        title: "Teilgutschrift erstellt",
        note: `${creditInvoice.invoiceNumber}: ${formatEuro(-evaluation.totalCreditGross)} brutto. Grund: ${reason}`,
        actorName: input.actorName,
      },
      {
        id: randomUUID(),
        organizationId: input.organizationId,
        invoiceId: creditInvoice.id,
        projectId: original.projectId,
        invoiceNumber: creditInvoice.invoiceNumber,
        eventType: "created-from-invoice",
        title: "Gutschrift aus Rechnung erstellt",
        note: `Referenz ${original.invoiceNumber}. Grund: ${reason}`,
        actorName: input.actorName,
      },
    ],
  });
  await input.tx.projectLogbookEntry.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      projectId: original.projectId,
      title: "Rechnungskorrektur / Teilgutschrift",
      body: `Zu Rechnung ${original.invoiceNumber} wurde ${creditInvoice.invoiceNumber} über ${formatEuro(-evaluation.totalCreditGross)} brutto erstellt. Grund: ${reason}`,
      author: input.actorName,
      authorUserId: input.actorUserId ?? null,
      visibleFor: [],
      attachments: [],
      projectMonth: original.serviceDate?.slice(0, 7) || null,
      source: input.source === "jarvis" ? "jarvis-invoice-credit" : "invoice-credit",
      callReference: `invoice-credit:${creditInvoice.id}`,
    },
  });
  return {
    originalInvoiceId: original.id,
    creditInvoice,
    totalCreditNet: evaluation.totalCreditNet,
    totalCreditGross: evaluation.totalCreditGross,
  };
}
