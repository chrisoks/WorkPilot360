import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type InvoicePaymentDb = Prisma.TransactionClient | typeof prisma;

export class InvoicePaymentServiceError extends Error {
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
    this.name = "InvoicePaymentServiceError";
  }
}

export type InvoicePaymentEvaluation = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    serviceDate: string;
    dueDate: string;
    grossTotal: number;
    isPaid: boolean;
    paidAt: string;
    updatedAt: string;
  };
  paymentDate: string;
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

export function getBerlinDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Berlin",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function normalizeInvoicePaymentDate(value: unknown) {
  const dateKey = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const parsed = new Date(`${dateKey}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateKey
    ? dateKey
    : "";
}

export function formatInvoicePaymentDate(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : dateKey;
}

export function getInvoicePaymentConfirmationText(
  invoiceNumber: string,
  paymentDate: string
) {
  return `BEZAHLT ${invoiceNumber.trim()} AM ${formatInvoicePaymentDate(paymentDate)}`;
}

export function matchesInvoicePaymentConfirmation(
  invoiceNumber: string,
  paymentDate: string,
  confirmationText: string
) {
  return (
    confirmationText.trim() ===
    getInvoicePaymentConfirmationText(invoiceNumber, paymentDate)
  );
}

export async function evaluateInvoicePayment(input: {
  organizationId: string;
  invoiceId: string;
  paymentDate?: string;
  now?: Date;
  db?: InvoicePaymentDb;
}): Promise<InvoicePaymentEvaluation> {
  const db = input.db ?? prisma;
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
  });
  if (!invoice) {
    throw new InvoicePaymentServiceError(
      "not_found",
      "Die Rechnung wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (invoice.isPaid || invoice.status === "Bezahlt") {
    throw new InvoicePaymentServiceError(
      "invalid_state",
      `${invoice.invoiceNumber} ist bereits als bezahlt gekennzeichnet.`
    );
  }
  if (invoice.status !== "Fakturiert") {
    throw new InvoicePaymentServiceError(
      "invalid_state",
      `${invoice.invoiceNumber} kann im Status ${invoice.status} nicht als bezahlt markiert werden.`
    );
  }

  const todayKey = getBerlinDateKey(input.now ?? new Date());
  const paymentDate = normalizeInvoicePaymentDate(input.paymentDate ?? todayKey);
  const checks: InvoicePaymentEvaluation["checks"] = [];
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  if (!paymentDate) {
    const issue = "Ein gültiges Zahlungsdatum ist erforderlich.";
    blockingIssues.push(issue);
    checks.push({ key: "payment-date", label: "Zahlungsdatum", status: "blocked", detail: issue });
  } else if (paymentDate > todayKey) {
    const issue = "Das Zahlungsdatum darf nicht in der Zukunft liegen.";
    blockingIssues.push(issue);
    checks.push({ key: "payment-date", label: "Zahlungsdatum", status: "blocked", detail: issue });
  } else {
    checks.push({
      key: "payment-date",
      label: "Zahlungsdatum",
      status: "ok",
      detail: `Zahlungseingang am ${formatInvoicePaymentDate(paymentDate)}.`,
    });
  }

  if (paymentDate && invoice.serviceDate && paymentDate < invoice.serviceDate) {
    const warning = "Das Zahlungsdatum liegt vor dem Leistungsdatum der Rechnung.";
    warnings.push(warning);
    checks.push({ key: "date-order", label: "Datumsreihenfolge", status: "warning", detail: warning });
  } else {
    checks.push({
      key: "date-order",
      label: "Datumsreihenfolge",
      status: "ok",
      detail: "Das Zahlungsdatum liegt nicht vor dem Leistungsdatum.",
    });
  }

  checks.push({
    key: "full-payment",
    label: "Vollständiger Zahlungseingang",
    status: "ok",
    detail: `Mit der Bestätigung werden ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(invoice.grossTotal)} vollständig als bezahlt gekennzeichnet. Teilzahlungen sind nicht enthalten.`,
  });

  const fingerprint = stableHash({
    invoice: {
      id: invoice.id,
      status: invoice.status,
      isPaid: invoice.isPaid,
      paidAt: invoice.paidAt?.toISOString() ?? "",
      updatedAt: invoice.updatedAt.toISOString(),
      grossTotal: invoice.grossTotal,
      dueDate: invoice.dueDate,
    },
    paymentDate,
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
      serviceDate: invoice.serviceDate,
      dueDate: invoice.dueDate,
      grossTotal: invoice.grossTotal,
      isPaid: invoice.isPaid,
      paidAt: invoice.paidAt?.toISOString() ?? "",
      updatedAt: invoice.updatedAt.toISOString(),
    },
    paymentDate,
    checks,
    warnings,
    blockingIssues,
    fingerprint,
  };
}

export async function markInvoicePaid(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  invoiceId: string;
  paymentDate: string;
  actorName: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`workpilot:invoice-paid:${input.organizationId}:${input.invoiceId}`})
    )
  `;
  const evaluated = await evaluateInvoicePayment({
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    paymentDate: input.paymentDate,
    db: input.tx,
  });
  if (
    input.expectedFingerprint &&
    input.expectedFingerprint !== evaluated.fingerprint
  ) {
    throw new InvoicePaymentServiceError(
      "stale_context",
      "Rechnung oder Zahlungsangaben haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluated.blockingIssues.length) {
    throw new InvoicePaymentServiceError(
      "blocked",
      evaluated.blockingIssues.join(" · ")
    );
  }
  const paidAt = new Date(`${evaluated.paymentDate}T12:00:00.000Z`);
  const updated = await input.tx.invoice.updateMany({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
      status: "Fakturiert",
      isPaid: false,
    },
    data: {
      isPaid: true,
      paidAt,
      status: "Bezahlt",
    },
  });
  if (updated.count !== 1) {
    throw new InvoicePaymentServiceError(
      "conflict",
      "Die Rechnung wurde zwischenzeitlich verändert oder bereits als bezahlt markiert."
    );
  }
  const invoice = await input.tx.invoice.findUniqueOrThrow({
    where: { id: input.invoiceId },
  });
  await input.tx.invoiceHistory.create({
    data: {
      organizationId: input.organizationId,
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      invoiceNumber: invoice.invoiceNumber,
      eventType: "paid",
      title: "Rechnung als bezahlt markiert",
      note: `${invoice.invoiceNumber} wurde${input.source === "jarvis" ? " durch JARVIS" : ""} mit Zahlungsdatum ${formatInvoicePaymentDate(evaluated.paymentDate)} vollständig als bezahlt markiert.`,
      actorName: input.actorName,
    },
  });
  return invoice;
}
