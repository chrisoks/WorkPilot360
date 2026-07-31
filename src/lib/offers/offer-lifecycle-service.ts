import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type OfferLifecycleDb = Prisma.TransactionClient | typeof prisma;
export type OfferLifecycleAction = "delete" | "restore";

const DELETED_STATUSES = ["Gelöscht", "Gel\u00c3\u00b6scht"];
const INACTIVE_INVOICE_STATUSES = ["Gelöscht", "Gel\u00c3\u00b6scht", "Storniert", "Stornorechnung", "Gutschrift"];
const PREVIOUS_STATUS_MARKER = "Vorheriger Status: ";

export class OfferLifecycleServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "blocked" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "OfferLifecycleServiceError";
  }
}

export type OfferLifecycleEvaluation = {
  action: OfferLifecycleAction;
  reason: string;
  previousStatus: string;
  offer: {
    id: string;
    offerNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    netTotal: number;
    grossTotal: number;
    updatedAt: string;
  };
  linkedInvoices: Array<{ id: string; invoiceNumber: string; status: string }>;
  acceptanceLinksToRevoke: number;
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

function inferPreviousStatus(input: { note?: string; lostAt: Date | null; wonAt: Date | null; pdfData: string | null }) {
  const markerIndex = input.note?.lastIndexOf(PREVIOUS_STATUS_MARKER) ?? -1;
  if (markerIndex >= 0) {
    const status = input.note!.slice(markerIndex + PREVIOUS_STATUS_MARKER.length).split(/[.\n]/)[0]?.trim();
    if (status && !DELETED_STATUSES.includes(status)) return status;
  }
  if (input.lostAt) return "Verloren";
  if (input.wonAt || input.pdfData) return "Erstellt";
  return "Entwurf";
}

export function getOfferLifecycleConfirmationText(offerNumber: string, action: OfferLifecycleAction) {
  return `ANGEBOT ${action === "delete" ? "LÖSCHEN" : "WIEDERHERSTELLEN"} ${offerNumber.trim()}`;
}

export function matchesOfferLifecycleConfirmation(
  offerNumber: string,
  action: OfferLifecycleAction,
  confirmationText: string
) {
  return confirmationText.trim() === getOfferLifecycleConfirmationText(offerNumber, action);
}

export async function evaluateOfferLifecycle(input: {
  organizationId: string;
  offerId: string;
  action: OfferLifecycleAction;
  reason?: string;
  db?: OfferLifecycleDb;
}): Promise<OfferLifecycleEvaluation> {
  const db = input.db ?? prisma;
  const reason = normalizeText(input.reason, 500);
  const offer = await db.offer.findFirst({
    where: { id: input.offerId, organizationId: input.organizationId },
    select: {
      id: true, offerNumber: true, status: true, projectId: true, projectNumber: true,
      projectTitle: true, customerName: true, netTotal: true, grossTotal: true,
      lostAt: true, wonAt: true, pdfData: true, updatedAt: true,
    },
  });
  if (!offer) {
    throw new OfferLifecycleServiceError("not_found", "Das Angebot wurde in der aktuellen Organisation nicht gefunden.");
  }

  const isDeleted = DELETED_STATUSES.includes(offer.status);
  const latestDeletion = isDeleted
    ? await db.offerHistory.findFirst({
        where: { organizationId: input.organizationId, offerId: offer.id, eventType: "deleted" },
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true, createdAt: true },
      })
    : null;
  const previousStatus = inferPreviousStatus({ ...offer, note: latestDeletion?.note });
  const linkedInvoices = input.action === "delete"
    ? await db.invoice.findMany({
        where: {
          organizationId: input.organizationId,
          status: { notIn: INACTIVE_INVOICE_STATUSES },
          OR: [
            { sourceOfferId: offer.id },
            { sourceOfferNumber: { equals: offer.offerNumber, mode: "insensitive" } },
          ],
        },
        select: { id: true, invoiceNumber: true, status: true, updatedAt: true },
      })
    : [];
  const acceptanceRequests = input.action === "delete"
    ? await db.offerAcceptanceRequest.findMany({
        where: { organizationId: input.organizationId, offerId: offer.id, revokedAt: null },
        select: { id: true, status: true, acceptedAt: true, updatedAt: true },
      })
    : [];
  const acceptedRequests = acceptanceRequests.filter((request) => request.acceptedAt);
  const revocableRequests = acceptanceRequests.filter((request) => !request.acceptedAt);

  const blockingIssues: string[] = [];
  if (!reason || reason.length < 3) blockingIssues.push("Bitte dokumentiere einen nachvollziehbaren Grund mit mindestens 3 Zeichen.");
  if (input.action === "delete" && isDeleted) blockingIssues.push(`${offer.offerNumber} ist bereits gelöscht.`);
  if (input.action === "restore" && !isDeleted) blockingIssues.push(`${offer.offerNumber} ist nicht gelöscht und kann deshalb nicht wiederhergestellt werden.`);
  if (linkedInvoices.length) {
    blockingIssues.push(
      `${offer.offerNumber} ist mit ${linkedInvoices.map((invoice) => `${invoice.invoiceNumber} (${invoice.status})`).join(", ")} verknüpft und kann nicht gelöscht werden.`
    );
  }
  if (acceptedRequests.length) {
    blockingIssues.push("Das Angebot wurde bereits digital angenommen und kann nicht gelöscht werden.");
  }

  const warnings = input.action === "delete"
    ? [
        "Das Angebot wird nur ausgeblendet, nicht physisch entfernt. Positionen und PDF bleiben erhalten.",
        revocableRequests.length
          ? `${revocableRequests.length} noch nicht angenommene Annahmeverknüpfung(en) werden aus Sicherheitsgründen widerrufen.`
          : "Es wird keine Annahmeverknüpfung verändert.",
        "Projektstatus, Termine, Aufgaben, Rechnungen und Versandprotokolle bleiben unverändert.",
      ]
    : [
        `Das Angebot wird in den vorherigen fachlichen Status „${previousStatus}“ zurückgeführt.`,
        "Früher widerrufene Annahmelinks werden nicht reaktiviert.",
        "Projektstatus, Termine, Aufgaben, Rechnungen und Versandprotokolle bleiben unverändert.",
      ];
  const checks: OfferLifecycleEvaluation["checks"] = [
    {
      key: "offer-state",
      label: "Angebotsstatus",
      status: blockingIssues.length ? "blocked" : "ok",
      detail: blockingIssues.length
        ? blockingIssues.join(" · ")
        : input.action === "delete"
          ? `${offer.offerNumber} kann kontrolliert gelöscht werden.`
          : `${offer.offerNumber} kann als „${previousStatus}“ wiederhergestellt werden.`,
    },
    { key: "documentation", label: "Begründung", status: reason.length >= 3 ? "ok" : "blocked", detail: reason || "Grund fehlt." },
    { key: "side-effects", label: "Abgegrenzte Folgen", status: "warning", detail: warnings.join(" ") },
  ];
  const fingerprint = stableHash({
    action: input.action,
    reason,
    previousStatus,
    offer: { id: offer.id, status: offer.status, updatedAt: offer.updatedAt.toISOString() },
    latestDeletion: latestDeletion ? { id: latestDeletion.id, createdAt: latestDeletion.createdAt.toISOString() } : null,
    linkedInvoices: linkedInvoices.map((invoice) => ({ id: invoice.id, status: invoice.status, updatedAt: invoice.updatedAt.toISOString() })),
    acceptanceRequests: acceptanceRequests.map((request) => ({ id: request.id, status: request.status, acceptedAt: request.acceptedAt?.toISOString() || null, updatedAt: request.updatedAt.toISOString() })),
  });

  return {
    action: input.action,
    reason,
    previousStatus,
    offer: {
      id: offer.id, offerNumber: offer.offerNumber, status: offer.status, projectId: offer.projectId,
      projectNumber: offer.projectNumber, projectTitle: offer.projectTitle, customerName: offer.customerName,
      netTotal: offer.netTotal, grossTotal: offer.grossTotal, updatedAt: offer.updatedAt.toISOString(),
    },
    linkedInvoices: linkedInvoices.map(({ id, invoiceNumber, status }) => ({ id, invoiceNumber, status })),
    acceptanceLinksToRevoke: revocableRequests.length,
    checks,
    warnings,
    blockingIssues: [...new Set(blockingIssues)],
    fingerprint,
  };
}

export async function executeOfferLifecycle(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  offerId: string;
  action: OfferLifecycleAction;
  reason: string;
  actorId: string;
  actorName: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:offer-lifecycle:${input.organizationId}:${input.offerId}`}))`;
  const evaluated = await evaluateOfferLifecycle({ ...input, db: input.tx });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new OfferLifecycleServiceError("stale_context", "Angebot oder Verknüpfungen haben sich geändert. Bitte öffne eine neue Vorschau.");
  }
  if (evaluated.blockingIssues.length) {
    throw new OfferLifecycleServiceError("blocked", evaluated.blockingIssues.join(" · "));
  }

  const targetStatus = input.action === "delete" ? "Gelöscht" : evaluated.previousStatus;
  const changed = await input.tx.offer.updateMany({
    where: {
      id: input.offerId,
      organizationId: input.organizationId,
      ...(input.action === "delete" ? { status: { notIn: DELETED_STATUSES } } : { status: { in: DELETED_STATUSES } }),
    },
    data: { status: targetStatus },
  });
  if (changed.count !== 1) {
    throw new OfferLifecycleServiceError("conflict", "Das Angebot wurde zwischenzeitlich verändert.");
  }

  if (input.action === "delete") {
    await input.tx.offerAcceptanceRequest.updateMany({
      where: { organizationId: input.organizationId, offerId: input.offerId, revokedAt: null, acceptedAt: null },
      data: { status: "revoked", revokedAt: new Date() },
    });
  }
  const result = await input.tx.offer.findFirstOrThrow({ where: { id: input.offerId, organizationId: input.organizationId } });
  const verb = input.action === "delete" ? "gelöscht" : "wiederhergestellt";
  const statusDetail = input.action === "delete" ? ` ${PREVIOUS_STATUS_MARKER}${evaluated.offer.status}.` : ` Wiederhergestellter Status: ${evaluated.previousStatus}.`;
  const note = `${result.offerNumber} wurde${input.source === "jarvis" ? " durch JARVIS" : ""} kontrolliert ${verb}. Grund: ${evaluated.reason}.${statusDetail}`;
  await input.tx.offerHistory.create({
    data: {
      organizationId: input.organizationId,
      offerId: result.id,
      projectId: result.projectId,
      offerNumber: result.offerNumber,
      eventType: input.action === "delete" ? "deleted" : "restored",
      title: `Angebot ${verb}`,
      note,
      actorName: input.actorName,
    },
  });
  await input.tx.projectLogbookEntry.create({
    data: {
      id: randomUUID(), organizationId: input.organizationId, projectId: result.projectId,
      title: `Angebot ${verb}`, body: note, author: input.actorName, authorUserId: input.actorId,
      source: input.source === "jarvis" ? "jarvis" : "manual",
    },
  });
  return result;
}
