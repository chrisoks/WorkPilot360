import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { Prisma } from "@prisma/client";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";
import { prisma } from "@/lib/db/client";
import {
  cleanupStorageBackedPayload,
  persistStorageBackedPayload,
  prepareStorageBackedPayload,
} from "@/lib/storage/document-file";
import {
  formatInvoicePaymentDate,
  getBerlinDateKey,
  normalizeInvoicePaymentDate,
} from "@/lib/invoices/invoice-payment-service";

type InvoiceReminderDb = Prisma.TransactionClient | typeof prisma;

const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.25, 0.29, 0.34);

export class InvoiceReminderServiceError extends Error {
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
    this.name = "InvoiceReminderServiceError";
  }
}

export type InvoiceReminderEvaluation = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    customerStreet: string;
    customerCity: string;
    contactName: string;
    internalContactName: string;
    company: string;
    dueDate: string;
    grossTotal: number;
    reminderLevel: number;
    lastReminderAt: string;
    updatedAt: string;
  };
  reminderDate: string;
  paymentDeadline: string;
  nextReminderLevel: number;
  documentNumber: string;
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
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function addReminderDays(dateKey: string, days: number) {
  const normalized = normalizeInvoicePaymentDate(dateKey);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + Math.min(Math.max(Math.trunc(days), 0), 365));
  return date.toISOString().slice(0, 10);
}

export function getInvoiceReminderConfirmationText(
  documentNumber: string,
  paymentDeadline: string
) {
  return `MAHNUNG ${documentNumber.trim()} BIS ${formatInvoicePaymentDate(paymentDeadline)}`;
}

export function matchesInvoiceReminderConfirmation(
  documentNumber: string,
  paymentDeadline: string,
  confirmationText: string
) {
  return (
    confirmationText.trim() ===
    getInvoiceReminderConfirmationText(documentNumber, paymentDeadline)
  );
}

function berlinDateKey(value: Date | null | undefined) {
  return value ? getBerlinDateKey(value) : "";
}

export async function evaluateInvoiceReminder(input: {
  organizationId: string;
  invoiceId: string;
  reminderDate?: string;
  paymentDeadline?: string;
  now?: Date;
  db?: InvoiceReminderDb;
}): Promise<InvoiceReminderEvaluation> {
  const db = input.db ?? prisma;
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
  });
  if (!invoice) {
    throw new InvoiceReminderServiceError(
      "not_found",
      "Die Rechnung wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (invoice.isPaid || invoice.status === "Bezahlt") {
    throw new InvoiceReminderServiceError(
      "invalid_state",
      `${invoice.invoiceNumber} ist bereits bezahlt und darf nicht gemahnt werden.`
    );
  }
  if (invoice.status !== "Fakturiert") {
    throw new InvoiceReminderServiceError(
      "invalid_state",
      `${invoice.invoiceNumber} kann im Status ${invoice.status} nicht gemahnt werden.`
    );
  }

  const todayKey = getBerlinDateKey(input.now ?? new Date());
  const reminderDate = normalizeInvoicePaymentDate(input.reminderDate ?? todayKey);
  const paymentDeadline = normalizeInvoicePaymentDate(
    input.paymentDeadline ?? addReminderDays(reminderDate || todayKey, 7)
  );
  const currentReminderLevel = Math.max(0, Number(invoice.reminderLevel ?? 0));
  const nextReminderLevel = Math.min(currentReminderLevel + 1, 3);
  const documentNumber = `MA-${invoice.invoiceNumber}-${nextReminderLevel}`;
  const checks: InvoiceReminderEvaluation["checks"] = [];
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  if (!reminderDate) {
    const issue = "Ein gültiges Mahndatum ist erforderlich.";
    blockingIssues.push(issue);
    checks.push({ key: "reminder-date", label: "Mahndatum", status: "blocked", detail: issue });
  } else if (reminderDate > todayKey) {
    const issue = "Das Mahndatum darf nicht in der Zukunft liegen.";
    blockingIssues.push(issue);
    checks.push({ key: "reminder-date", label: "Mahndatum", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "reminder-date",
      label: "Mahndatum",
      status: "ok",
      detail: `Mahnung vom ${formatInvoicePaymentDate(reminderDate)}.`,
    });
  }

  const dueDate = normalizeInvoicePaymentDate(invoice.dueDate);
  if (!dueDate) {
    const issue = "Die Rechnung hat kein gültiges Fälligkeitsdatum.";
    blockingIssues.push(issue);
    checks.push({ key: "overdue", label: "Fälligkeit", status: "blocked", detail: issue });
  } else if (!reminderDate || dueDate >= reminderDate) {
    const issue = "Die Rechnung ist am gewählten Mahndatum noch nicht überfällig.";
    blockingIssues.push(issue);
    checks.push({ key: "overdue", label: "Fälligkeit", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "overdue",
      label: "Fälligkeit",
      status: "ok",
      detail: `Die Rechnung ist seit ${formatInvoicePaymentDate(dueDate)} fällig.`,
    });
  }

  if (!paymentDeadline || !reminderDate || paymentDeadline <= reminderDate) {
    const issue = "Die neue Zahlungsfrist muss nach dem Mahndatum liegen.";
    blockingIssues.push(issue);
    checks.push({ key: "deadline", label: "Neue Zahlungsfrist", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "deadline",
      label: "Neue Zahlungsfrist",
      status: "ok",
      detail: `Neue Zahlungsfrist bis ${formatInvoicePaymentDate(paymentDeadline)}.`,
    });
  }

  if (currentReminderLevel >= 3) {
    const issue = "Mahnstufe 3 ist bereits erreicht. Eine weitere automatische Mahnung ist gesperrt.";
    blockingIssues.push(issue);
    checks.push({ key: "level", label: "Mahnstufe", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "level",
      label: "Mahnstufe",
      status: "ok",
      detail: `Mit der Bestätigung wird Mahnstufe ${nextReminderLevel} erzeugt.`,
    });
  }

  const lastReminderDate = berlinDateKey(invoice.lastReminderAt);
  if (lastReminderDate && reminderDate && lastReminderDate >= reminderDate) {
    const issue = `Für ${formatInvoicePaymentDate(lastReminderDate)} ist bereits eine Mahnung erfasst.`;
    blockingIssues.push(issue);
    checks.push({ key: "duplicate", label: "Doppelte Mahnung", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "duplicate",
      label: "Doppelte Mahnung",
      status: "ok",
      detail: "Für das gewählte Mahndatum liegt noch keine Mahnung vor.",
    });
  }

  if (!invoice.customerName.trim()) {
    const issue = "Für die Mahnung fehlt der Kundenname.";
    blockingIssues.push(issue);
    checks.push({ key: "recipient", label: "Empfänger", status: "blocked", detail: issue });
  } else if (!invoice.customerStreet.trim() || !invoice.customerCity.trim()) {
    const warning = "Die postalische Kundenanschrift ist unvollständig.";
    warnings.push(warning);
    checks.push({ key: "recipient", label: "Empfänger", status: "warning", detail: warning });
  } else {
    checks.push({
      key: "recipient",
      label: "Empfänger",
      status: "ok",
      detail: `${invoice.customerName}, ${invoice.customerStreet}, ${invoice.customerCity}`,
    });
  }

  if (!(Number(invoice.grossTotal) > 0)) {
    const issue = "Der offene Rechnungsbetrag muss größer als 0,00 € sein.";
    blockingIssues.push(issue);
    checks.push({ key: "amount", label: "Offener Betrag", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "amount",
      label: "Offener Betrag",
      status: "ok",
      detail: `${formatEuro(Number(invoice.grossTotal))} werden vollständig angemahnt.`,
    });
  }

  const fingerprint = stableHash({
    invoice: {
      id: invoice.id,
      status: invoice.status,
      isPaid: invoice.isPaid,
      paidAt: invoice.paidAt?.toISOString() ?? "",
      updatedAt: invoice.updatedAt.toISOString(),
      dueDate: invoice.dueDate,
      grossTotal: invoice.grossTotal,
      reminderLevel: currentReminderLevel,
      lastReminderAt: invoice.lastReminderAt?.toISOString() ?? "",
      customerName: invoice.customerName,
      customerStreet: invoice.customerStreet,
      customerCity: invoice.customerCity,
      contactName: invoice.contactName,
      internalContactName: invoice.internalContactName,
    },
    reminderDate,
    paymentDeadline,
    nextReminderLevel,
    documentNumber,
    checks,
    warnings,
    blockingIssues,
  });

  return {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      projectId: invoice.projectId,
      projectNumber: invoice.projectNumber,
      projectTitle: invoice.projectTitle,
      customerName: invoice.customerName,
      customerStreet: invoice.customerStreet,
      customerCity: invoice.customerCity,
      contactName: invoice.contactName,
      internalContactName: invoice.internalContactName,
      company: invoice.company,
      dueDate: invoice.dueDate,
      grossTotal: Number(invoice.grossTotal),
      reminderLevel: currentReminderLevel,
      lastReminderAt: invoice.lastReminderAt?.toISOString() ?? "",
      updatedAt: invoice.updatedAt.toISOString(),
    },
    reminderDate,
    paymentDeadline,
    nextReminderLevel,
    documentNumber,
    checks,
    warnings,
    blockingIssues,
    fingerprint,
  };
}

async function embedFonts(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Regular.ttf")),
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Bold.ttf")),
    ]);
    return {
      regular: await pdfDoc.embedFont(regularBytes, { subset: true }),
      bold: await pdfDoc.embedFont(boldBytes, { subset: true }),
    };
  } catch {
    return {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    };
  }
}

function splitWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const chunks: string[] = [];
  let chunk = "";
  for (const char of Array.from(word)) {
    const candidate = `${chunk}${char}`;
    if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else chunk = candidate;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean).flatMap((word) => splitWord(word, font, size, maxWidth));
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawBlock(page: PDFPage, text: string, x: number, y: number, options: { font: PDFFont; size: number; maxWidth: number; lineHeight?: number }) {
  let cursorY = y;
  for (const line of wrapText(text, options.font, options.size, options.maxWidth)) {
    if (line) page.drawText(line, { x, y: cursorY, size: options.size, font: options.font, color: INK });
    cursorY -= options.lineHeight ?? options.size + 3;
  }
}

function drawRight(page: PDFPage, text: string, rightX: number, y: number, options: { font: PDFFont; size: number }) {
  page.drawText(text, {
    x: rightX - options.font.widthOfTextAtSize(text, options.size),
    y,
    size: options.size,
    font: options.font,
    color: INK,
  });
}

async function renderReminderPdf(evaluation: InvoiceReminderEvaluation, actorName: string) {
  const company = evaluation.invoice.company === "OK immocare" ? "ok-immocare.pdf" : "ok-solutions.pdf";
  const templateBytes = await readFile(path.join(process.cwd(), "public", "offer-templates", company));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const [page] = await pdfDoc.copyPages(templateDoc, [0]);
  pdfDoc.addPage(page);
  const { regular, bold } = await embedFonts(pdfDoc);
  const invoice = evaluation.invoice;

  page.drawText(invoice.customerName || "-", { x: 71, y: 672, size: 8.7, font: bold, color: INK });
  page.drawText(invoice.customerStreet || "", { x: 71, y: 660, size: 8.4, font: bold, color: INK });
  page.drawText(invoice.customerCity || "", { x: 71, y: 648, size: 8.4, font: bold, color: INK });
  const rows = [
    ["Mahnung", evaluation.documentNumber],
    ["Referenzrechnung", invoice.invoiceNumber],
    ["Datum", formatInvoicePaymentDate(evaluation.reminderDate)],
    ["Fällig am", formatInvoicePaymentDate(invoice.dueDate)],
    ["Mahnstufe", String(evaluation.nextReminderLevel)],
    ["Neue Zahlungsfrist", formatInvoicePaymentDate(evaluation.paymentDeadline)],
  ];
  rows.forEach(([label, value], index) => {
    const y = 676 - index * 13;
    page.drawText(label, { x: 313, y, size: 8.5, font: bold, color: MUTED });
    drawRight(page, value, 552, y, { size: 8.5, font: regular });
  });

  page.drawText(`Mahnung zu Rechnung ${invoice.invoiceNumber}`, { x: 71, y: 520, size: 11, font: bold, color: INK });
  page.drawText(invoice.contactName ? `Sehr geehrte/r ${invoice.contactName},` : "Sehr geehrte Damen und Herren,", { x: 71, y: 492, size: 8.8, font: regular, color: INK });
  drawBlock(page, [
    `unsere Rechnung ${invoice.invoiceNumber} über ${formatEuro(invoice.grossTotal)} war am ${formatInvoicePaymentDate(invoice.dueDate)} zur Zahlung fällig.`,
    "Leider konnten wir bislang keinen Zahlungseingang feststellen.",
    `Bitte überweisen Sie den offenen Betrag bis spätestens ${formatInvoicePaymentDate(evaluation.paymentDeadline)} unter Angabe der Rechnungsnummer.`,
  ].join("\n\n"), 71, 468, { font: regular, size: 8.8, maxWidth: 480, lineHeight: 13 });
  drawBlock(page, `Sollte sich Ihre Zahlung mit diesem Schreiben überschneiden, betrachten Sie diese Mahnung bitte als gegenstandslos.\n\nMit freundlichen Grüßen\n\n${invoice.internalContactName || actorName || "System"}`, 71, 348, { font: regular, size: 8.8, maxWidth: 480, lineHeight: 13 });
  pdfDoc.setTitle(`${evaluation.documentNumber} ${invoice.customerName || "Mahnung"}`);
  const pdfBytes = await pdfDoc.save();
  const dataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`;
  return {
    documentNumber: evaluation.documentNumber,
    fileName: `${evaluation.documentNumber}.pdf`,
    bytes: Buffer.from(pdfBytes),
    attachment: {
      name: `${evaluation.documentNumber}.pdf`,
      type: "Dokument",
      mimeType: "application/pdf",
      size: dataUrl.length,
      dataUrl,
    },
  };
}

export async function createInvoiceReminder(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  invoiceId: string;
  reminderDate: string;
  paymentDeadline: string;
  actorName: string;
  actorUserId?: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`workpilot:invoice-reminder:${input.organizationId}:${input.invoiceId}`})
    )
  `;
  const evaluated = await evaluateInvoiceReminder({
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    reminderDate: input.reminderDate,
    paymentDeadline: input.paymentDeadline,
    db: input.tx,
  });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new InvoiceReminderServiceError(
      "stale_context",
      "Rechnung oder Mahndaten haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluated.blockingIssues.length) {
    throw new InvoiceReminderServiceError("blocked", evaluated.blockingIssues.join(" · "));
  }

  const document = await renderReminderPdf(evaluated, input.actorName);
  const updated = await input.tx.invoice.updateMany({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
      status: "Fakturiert",
      isPaid: false,
      reminderLevel: evaluated.invoice.reminderLevel,
    },
    data: {
      reminderLevel: evaluated.nextReminderLevel,
      lastReminderAt: new Date(`${evaluated.reminderDate}T12:00:00.000Z`),
    },
  });
  if (updated.count !== 1) {
    throw new InvoiceReminderServiceError(
      "conflict",
      "Die Rechnung wurde zwischenzeitlich verändert oder bereits gemahnt."
    );
  }
  const invoice = await input.tx.invoice.findFirstOrThrow({
    where: { id: input.invoiceId, organizationId: input.organizationId },
  });
  const preparedPdf = await prepareStorageBackedPayload({
    organizationId: input.organizationId,
    ownerType: "project",
    ownerId: invoice.projectId,
    sourceType: "invoice-reminder-pdf",
    category: "invoice-reminders",
    originalName: document.fileName,
    contentType: "application/pdf",
    bytes: document.bytes,
    createdByUserId: input.actorUserId,
  });
  try {
    await persistStorageBackedPayload(input.tx, preparedPdf);
    await input.tx.projectLogbookEntry.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        projectId: invoice.projectId,
        title: "Dokumente: Mahnung",
        body: `Mahnung ${document.documentNumber} zu Rechnung ${invoice.invoiceNumber} erstellt.`,
        author: input.actorName || "System",
        authorUserId: input.actorUserId || null,
        visibleFor: ["GF", "Büro", "Mitarbeiter"],
        attachments: preparedPdf.prepared.attachments,
        source: input.source,
      },
    });
    await input.tx.invoiceHistory.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: invoice.id,
        projectId: invoice.projectId,
        invoiceNumber: invoice.invoiceNumber,
        eventType: "reminder-document",
        title: `Mahnung ${document.documentNumber} erstellt`,
        note: `${document.fileName} wurde${input.source === "jarvis" ? " durch JARVIS" : ""} unter Dokumente: Mahnung abgelegt. Neue Zahlungsfrist: ${formatInvoicePaymentDate(evaluated.paymentDeadline)}.`,
        actorName: input.actorName,
      },
    });
  } catch (error) {
    await cleanupStorageBackedPayload(preparedPdf);
    throw error;
  }
  return { invoice, evaluation: evaluated, reminderDocument: { documentNumber: document.documentNumber, fileName: document.fileName } };
}
