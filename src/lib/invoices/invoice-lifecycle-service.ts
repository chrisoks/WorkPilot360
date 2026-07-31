import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type InvoiceLifecycleDb = Prisma.TransactionClient | typeof prisma;
export type InvoiceLifecycleAction = "delete" | "restore";

const DELETED_STATUSES = ["Gelöscht", "Gel\u00c3\u00b6scht"];
const PREVIOUS_STATUS_MARKER = "Vorheriger Status: ";

export class InvoiceLifecycleServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "blocked" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "InvoiceLifecycleServiceError";
  }
}

export type InvoiceLifecycleEvaluation = {
  action: InvoiceLifecycleAction;
  reason: string;
  previousStatus: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    netTotal: number;
    grossTotal: number;
    updatedAt: string;
  };
  linkedTimeEntries: number;
  inventoryMovements: number;
  deliveryDispatches: number;
  derivedInvoices: Array<{ id: string; invoiceNumber: string; status: string }>;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

function normalizeText(value: string | undefined, maxLength: number) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function previousStatusFromDeletion(note: string | null | undefined) {
  const markerIndex = note?.lastIndexOf(PREVIOUS_STATUS_MARKER) ?? -1;
  if (markerIndex < 0) return "";
  const status = note!.slice(markerIndex + PREVIOUS_STATUS_MARKER.length).split(/[.\n]/)[0]?.trim() || "";
  return DELETED_STATUSES.includes(status) ? "" : status;
}

export function getInvoiceLifecycleConfirmationText(invoiceNumber: string, action: InvoiceLifecycleAction) {
  return `RECHNUNG ${action === "delete" ? "LÖSCHEN" : "WIEDERHERSTELLEN"} ${invoiceNumber.trim()}`;
}

export function matchesInvoiceLifecycleConfirmation(
  invoiceNumber: string,
  action: InvoiceLifecycleAction,
  confirmationText: string
) {
  return confirmationText.trim() === getInvoiceLifecycleConfirmationText(invoiceNumber, action);
}

export async function evaluateInvoiceLifecycle(input: {
  organizationId: string;
  invoiceId: string;
  action: InvoiceLifecycleAction;
  reason?: string;
  db?: InvoiceLifecycleDb;
}): Promise<InvoiceLifecycleEvaluation> {
  const db = input.db ?? prisma;
  const reason = normalizeText(input.reason, 500);
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      projectId: true,
      projectNumber: true,
      projectTitle: true,
      customerName: true,
      netTotal: true,
      grossTotal: true,
      isPaid: true,
      pdfData: true,
      updatedAt: true,
    },
  });
  if (!invoice) {
    throw new InvoiceLifecycleServiceError("not_found", "Die Rechnung wurde in der aktuellen Organisation nicht gefunden.");
  }

  const isDeleted = DELETED_STATUSES.includes(invoice.status);
  const latestDeletion = isDeleted
    ? await db.invoiceHistory.findFirst({
        where: { organizationId: input.organizationId, invoiceId: invoice.id, eventType: "deleted" },
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true, createdAt: true },
      })
    : null;
  const previousStatus = input.action === "delete" ? invoice.status : previousStatusFromDeletion(latestDeletion?.note);
  const [linkedTimeEntries, inventoryMovements, deliveryDispatches, derivedInvoices] = await Promise.all([
    db.projectTimeEntry.count({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        OR: [{ invoiceId: invoice.id }, { invoiceNumber: invoice.invoiceNumber }],
      },
    }),
    db.catalogInventoryMovement.count({
      where: { organizationId: input.organizationId, referenceType: "invoice", referenceId: invoice.id },
    }),
    db.documentMailDispatch.count({
      where: { organizationId: input.organizationId, documentKind: "invoice", documentId: invoice.id },
    }),
    db.invoice.findMany({
      where: {
        organizationId: input.organizationId,
        sourceInvoiceId: invoice.id,
        status: { notIn: DELETED_STATUSES },
      },
      select: { id: true, invoiceNumber: true, status: true },
    }),
  ]);

  const blockingIssues: string[] = [];
  if (!reason || reason.length < 3) blockingIssues.push("Bitte dokumentiere einen nachvollziehbaren Grund mit mindestens 3 Zeichen.");
  if (input.action === "delete" && isDeleted) blockingIssues.push(`${invoice.invoiceNumber} ist bereits gelöscht.`);
  if (input.action === "restore" && !isDeleted) blockingIssues.push(`${invoice.invoiceNumber} ist nicht gelöscht und kann deshalb nicht wiederhergestellt werden.`);
  if (input.action === "delete" && invoice.status !== "Entwurf") {
    blockingIssues.push(
      `${invoice.invoiceNumber} ist im Status „${invoice.status}“. Nur Rechnungsentwürfe dürfen gelöscht werden; fakturierte Belege müssen storniert oder korrigiert werden.`
    );
  }
  if (input.action === "restore" && !previousStatus) {
    blockingIssues.push("Der frühere Status dieser Altlöschung ist nicht sicher dokumentiert. Die Rechnung muss fachlich manuell geprüft werden.");
  }
  if (input.action === "restore" && previousStatus && previousStatus !== "Entwurf") {
    blockingIssues.push(`Die Rechnung war vor der Löschung im Status „${previousStatus}“. Nur gelöschte Entwürfe dürfen automatisch wiederhergestellt werden.`);
  }
  if (invoice.isPaid) blockingIssues.push("Eine als bezahlt markierte Rechnung darf nicht gelöscht oder automatisch wiederhergestellt werden.");
  if (linkedTimeEntries) blockingIssues.push(`${linkedTimeEntries} Stempelung(en) sind mit der Rechnung verknüpft. Nutze den Storno- oder Korrekturprozess.`);
  if (inventoryMovements) blockingIssues.push(`${inventoryMovements} Lagerbewegung(en) sind mit der Rechnung verknüpft. Nutze den Storno- oder Korrekturprozess.`);
  if (deliveryDispatches) blockingIssues.push(`${deliveryDispatches} Versandprotokoll(e) sind mit der Rechnung verknüpft. Der Beleg darf nicht gelöscht werden.`);
  if (derivedInvoices.length) {
    blockingIssues.push(`Die Rechnung besitzt Folgebelege: ${derivedInvoices.map((item) => `${item.invoiceNumber} (${item.status})`).join(", ")}.`);
  }

  const warnings = input.action === "delete"
    ? [
        "Der Rechnungsentwurf wird nur ausgeblendet, nicht physisch entfernt. Positionen und Entwurfs-PDF bleiben erhalten.",
        "Fakturierte, versendete, bezahlte oder anderweitig weiterverarbeitete Rechnungen werden nicht gelöscht, sondern über Storno oder Korrektur berichtigt.",
        "Stempelungen, Lager, Zahlungen, Mahnungen, Versandprotokolle, Angebote und Projektstatus bleiben unverändert.",
      ]
    : [
        "Der gelöschte Rechnungsentwurf wird wieder als „Entwurf“ sichtbar.",
        "Es werden keine früheren Stempel-, Lager-, Zahlungs-, Mahn- oder Versandverknüpfungen erzeugt.",
        "Angebote und Projektstatus bleiben unverändert.",
      ];
  const checks: InvoiceLifecycleEvaluation["checks"] = [
    {
      key: "invoice-state",
      label: "Rechnungsstatus",
      status: blockingIssues.length ? "blocked" : "ok",
      detail: blockingIssues.length
        ? blockingIssues.join(" · ")
        : input.action === "delete"
          ? `${invoice.invoiceNumber} ist ein unverarbeiteter Entwurf und kann kontrolliert gelöscht werden.`
          : `${invoice.invoiceNumber} kann kontrolliert als Entwurf wiederhergestellt werden.`,
    },
    { key: "documentation", label: "Begründung", status: reason.length >= 3 ? "ok" : "blocked", detail: reason || "Grund fehlt." },
    { key: "side-effects", label: "Abgegrenzte Folgen", status: "warning", detail: warnings.join(" ") },
  ];
  const fingerprint = stableHash({
    action: input.action,
    reason,
    previousStatus,
    invoice: { id: invoice.id, status: invoice.status, isPaid: invoice.isPaid, hasPdf: Boolean(invoice.pdfData), updatedAt: invoice.updatedAt.toISOString() },
    latestDeletion: latestDeletion ? { id: latestDeletion.id, createdAt: latestDeletion.createdAt.toISOString(), note: latestDeletion.note } : null,
    linkedTimeEntries,
    inventoryMovements,
    deliveryDispatches,
    derivedInvoices,
  });

  return {
    action: input.action,
    reason,
    previousStatus,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      projectId: invoice.projectId,
      projectNumber: invoice.projectNumber,
      projectTitle: invoice.projectTitle,
      customerName: invoice.customerName,
      netTotal: invoice.netTotal,
      grossTotal: invoice.grossTotal,
      updatedAt: invoice.updatedAt.toISOString(),
    },
    linkedTimeEntries,
    inventoryMovements,
    deliveryDispatches,
    derivedInvoices,
    checks,
    warnings,
    blockingIssues: [...new Set(blockingIssues)],
    fingerprint,
  };
}

export async function executeInvoiceLifecycle(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  invoiceId: string;
  action: InvoiceLifecycleAction;
  reason: string;
  actorId: string;
  actorName: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:invoice-lifecycle:${input.organizationId}:${input.invoiceId}`}))`;
  const evaluated = await evaluateInvoiceLifecycle({ ...input, db: input.tx });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new InvoiceLifecycleServiceError("stale_context", "Rechnung oder Verknüpfungen haben sich geändert. Bitte öffne eine neue Vorschau.");
  }
  if (evaluated.blockingIssues.length) {
    throw new InvoiceLifecycleServiceError("blocked", evaluated.blockingIssues.join(" · "));
  }

  const targetStatus = input.action === "delete" ? "Gelöscht" : "Entwurf";
  const changed = await input.tx.invoice.updateMany({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
      ...(input.action === "delete" ? { status: "Entwurf" } : { status: { in: DELETED_STATUSES } }),
    },
    data: { status: targetStatus },
  });
  if (changed.count !== 1) {
    throw new InvoiceLifecycleServiceError("conflict", "Die Rechnung wurde zwischenzeitlich verändert.");
  }

  const result = await input.tx.invoice.findFirstOrThrow({ where: { id: input.invoiceId, organizationId: input.organizationId } });
  const verb = input.action === "delete" ? "gelöscht" : "wiederhergestellt";
  const statusDetail = input.action === "delete" ? ` ${PREVIOUS_STATUS_MARKER}${evaluated.invoice.status}.` : " Wiederhergestellter Status: Entwurf.";
  const note = `${result.invoiceNumber} wurde${input.source === "jarvis" ? " durch JARVIS" : ""} kontrolliert ${verb}. Grund: ${evaluated.reason}.${statusDetail}`;
  await input.tx.invoiceHistory.create({
    data: {
      organizationId: input.organizationId,
      invoiceId: result.id,
      projectId: result.projectId,
      invoiceNumber: result.invoiceNumber,
      eventType: input.action === "delete" ? "deleted" : "restored",
      title: `Rechnungsentwurf ${verb}`,
      note,
      actorName: input.actorName,
    },
  });
  await input.tx.projectLogbookEntry.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      projectId: result.projectId,
      title: `Rechnungsentwurf ${verb}`,
      body: note,
      author: input.actorName,
      authorUserId: input.actorId,
      source: input.source === "jarvis" ? "jarvis" : "manual",
    },
  });
  return result;
}
