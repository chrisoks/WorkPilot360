import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  evaluateInvoiceDraft,
  InvoiceDraftServiceError,
  type InvoiceDraftInput,
} from "@/lib/invoices/invoice-draft-service";
import { getMissingHourlyBillingCustomerTextDates } from "@/lib/invoices/hourly-billing-details";

type InvoiceFinalizationDb = Prisma.TransactionClient | typeof prisma;

export class InvoiceFinalizationServiceError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_state"
      | "blocked"
      | "stale_context"
      | "conflict",
    message: string
  ) {
    super(message);
    this.name = "InvoiceFinalizationServiceError";
  }
}

export type InvoiceFinalizationEvaluation = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    company: string;
    serviceDate: string;
    dueDate: string;
    netTotal: number;
    vatRate: number;
    grossTotal: number;
    updatedAt: string;
  };
  preflight: Array<{
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

export function getInvoiceFinalizationConfirmationText(invoiceNumber: string) {
  return `FAKTURIEREN ${invoiceNumber.trim()}`;
}

export function matchesInvoiceFinalizationConfirmation(
  invoiceNumber: string,
  confirmationText: string
) {
  return (
    confirmationText.trim() ===
    getInvoiceFinalizationConfirmationText(invoiceNumber)
  );
}

function draftFromInvoice(invoice: {
  projectId: string;
  company: string;
  serviceDate: string;
  plannedExecutionMonth: string;
  sourceOfferId: string;
  introText: string;
  closingText: string;
  vatRate: number;
  discountPercent: number;
  paymentTermDays: number;
  dueDate: string;
  lines: Array<{
    catalogItemId: string;
    catalogType: string;
    quantity: number;
    unit: string;
    title: string;
    description: string;
    unitPrice: number;
    discountPercent: number;
    vatRate: number;
  }>;
}): InvoiceDraftInput {
  return {
    projectId: invoice.projectId,
    company:
      invoice.company === "OK immocare" ? "OK immocare" : "OK solutions",
    serviceDate: invoice.serviceDate,
    plannedExecutionMonth: invoice.plannedExecutionMonth,
    sourceOfferId: invoice.sourceOfferId,
    introText: invoice.introText,
    closingText: invoice.closingText,
    vatRate: invoice.vatRate,
    discountPercent: invoice.discountPercent,
    paymentTermDays: invoice.paymentTermDays,
    dueDate: invoice.dueDate,
    lines: invoice.lines,
  };
}

export async function evaluateInvoiceFinalization(input: {
  organizationId: string;
  invoiceId: string;
  db?: InvoiceFinalizationDb;
}): Promise<InvoiceFinalizationEvaluation> {
  const db = input.db ?? prisma;
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) {
    throw new InvoiceFinalizationServiceError(
      "not_found",
      "Die Rechnung wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (invoice.status !== "Entwurf") {
    throw new InvoiceFinalizationServiceError(
      "invalid_state",
      invoice.status === "Fakturiert" || invoice.status === "Bezahlt"
        ? `${invoice.invoiceNumber} ist bereits fakturiert.`
        : `${invoice.invoiceNumber} kann im Status ${invoice.status} nicht fakturiert werden.`
    );
  }

  let evaluated;
  try {
    evaluated = await evaluateInvoiceDraft({
      organizationId: input.organizationId,
      draft: draftFromInvoice(invoice),
      db,
      excludeInvoiceId: invoice.id,
    });
  } catch (error) {
    if (error instanceof InvoiceDraftServiceError) {
      throw new InvoiceFinalizationServiceError("blocked", error.message);
    }
    throw error;
  }

  const blockingIssues = [...evaluated.missingFields, ...evaluated.errors];
  for (const line of invoice.lines) {
    const missingDates = getMissingHourlyBillingCustomerTextDates(
      line.hourlyBillingDetails
    );
    if (missingDates.length > 0) {
      blockingIssues.push(
        `Bitte Kundentext für ${line.title || "Position"} am ${missingDates.join(", ")} ergänzen.`
      );
    }
  }
  const totalsChanged =
    Math.abs(evaluated.totals.netTotal - invoice.netTotal) > 0.005 ||
    Math.abs(evaluated.totals.grossTotal - invoice.grossTotal) > 0.005 ||
    Math.abs(evaluated.totals.vatRate - invoice.vatRate) > 0.005;
  if (totalsChanged) {
    blockingIssues.push(
      "Die gespeicherten Rechnungssummen stimmen nicht mehr mit den Positionsdaten überein."
    );
  }
  blockingIssues.push(
    ...evaluated.preflight
      .filter((check) => check.status === "blocked")
      .map((check) => check.detail)
  );
  const canonicalBlockingIssues = [...new Set(blockingIssues)];
  const warnings = [
    ...evaluated.warnings,
    ...evaluated.preflight
      .filter((check) => check.status === "warning")
      .map((check) => check.detail),
  ];
  const fingerprint = stableHash({
    invoice: {
      id: invoice.id,
      status: invoice.status,
      updatedAt: invoice.updatedAt.toISOString(),
      netTotal: invoice.netTotal,
      vatRate: invoice.vatRate,
      grossTotal: invoice.grossTotal,
    },
    project: evaluated.project,
    sourceOffer: evaluated.sourceOffer,
    catalogVersions: evaluated.catalogVersions,
    preflight: evaluated.preflight,
    warnings: [...new Set(warnings)],
    blockingIssues: canonicalBlockingIssues,
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
      company: invoice.company,
      serviceDate: invoice.serviceDate,
      dueDate: invoice.dueDate,
      netTotal: invoice.netTotal,
      vatRate: invoice.vatRate,
      grossTotal: invoice.grossTotal,
      updatedAt: invoice.updatedAt.toISOString(),
    },
    preflight: evaluated.preflight,
    warnings: [...new Set(warnings)],
    blockingIssues: canonicalBlockingIssues,
    fingerprint,
  };
}

export async function finalizeInvoiceDraft(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  invoiceId: string;
  actorName: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`workpilot:invoice-finalize:${input.organizationId}:${input.invoiceId}`})
    )
  `;
  const evaluated = await evaluateInvoiceFinalization({
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    db: input.tx,
  });
  if (
    input.expectedFingerprint &&
    input.expectedFingerprint !== evaluated.fingerprint
  ) {
    throw new InvoiceFinalizationServiceError(
      "stale_context",
      "Rechnung oder Fakturavorprüfung haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluated.blockingIssues.length) {
    throw new InvoiceFinalizationServiceError(
      "blocked",
      evaluated.blockingIssues.join(" · ")
    );
  }
  const updated = await input.tx.invoice.updateMany({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
      status: "Entwurf",
    },
    data: { status: "Fakturiert" },
  });
  if (updated.count !== 1) {
    throw new InvoiceFinalizationServiceError(
      "conflict",
      "Die Rechnung wurde zwischenzeitlich verändert oder bereits fakturiert."
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
      eventType: "finalized",
      title: "Rechnung fakturiert",
      note: `${invoice.invoiceNumber} wurde${
        input.source === "jarvis" ? " durch JARVIS" : ""
      } fakturiert. Ein Versand wurde nicht ausgelöst.`,
      actorName: input.actorName,
    },
  });
  return invoice;
}
