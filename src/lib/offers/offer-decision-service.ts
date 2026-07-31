import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type OfferDecisionDb = Prisma.TransactionClient | typeof prisma;
export type OfferDecision = "won" | "lost";

export class OfferDecisionServiceError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_state"
      | "invalid_input"
      | "blocked"
      | "stale_context"
      | "conflict",
    message: string
  ) {
    super(message);
    this.name = "OfferDecisionServiceError";
  }
}

export type OfferDecisionEvaluation = {
  decision: OfferDecision;
  reason: string;
  note: string;
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

function normalizeText(value: string | undefined, maxLength: number) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function getOfferDecisionConfirmationText(
  offerNumber: string,
  decision: OfferDecision
) {
  return `ANGEBOT ${decision === "won" ? "GEWINNEN" : "VERLIEREN"} ${offerNumber.trim()}`;
}

export function matchesOfferDecisionConfirmation(
  offerNumber: string,
  decision: OfferDecision,
  confirmationText: string
) {
  return confirmationText.trim() === getOfferDecisionConfirmationText(offerNumber, decision);
}

export async function evaluateOfferDecision(input: {
  organizationId: string;
  offerId: string;
  decision: OfferDecision;
  reason?: string;
  note?: string;
  db?: OfferDecisionDb;
}): Promise<OfferDecisionEvaluation> {
  const db = input.db ?? prisma;
  const reason = normalizeText(input.reason, 500);
  const note = normalizeText(input.note, 2000);
  const offer = await db.offer.findFirst({
    where: { id: input.offerId, organizationId: input.organizationId },
    select: {
      id: true,
      offerNumber: true,
      status: true,
      projectId: true,
      projectNumber: true,
      projectTitle: true,
      customerName: true,
      netTotal: true,
      grossTotal: true,
      lostAt: true,
      wonAt: true,
      updatedAt: true,
    },
  });
  if (!offer) {
    throw new OfferDecisionServiceError(
      "not_found",
      "Das Angebot wurde in der aktuellen Organisation nicht gefunden."
    );
  }

  const blockingIssues: string[] = [];
  if (offer.status === "Entwurf") blockingIssues.push("Angebotsentwürfe können noch nicht entschieden werden.");
  if (["Gelöscht", "Gel\u00c3\u00b6scht"].includes(offer.status)) blockingIssues.push("Gelöschte Angebote können nicht entschieden werden.");
  if (offer.wonAt) blockingIssues.push(`${offer.offerNumber} ist bereits als gewonnen markiert.`);
  if (offer.lostAt || ["Verloren", "Angebot verloren"].includes(offer.status)) {
    blockingIssues.push(`${offer.offerNumber} ist bereits als verloren markiert.`);
  }
  if (!reason) blockingIssues.push("Bitte dokumentiere einen Grund für die Angebotsentscheidung.");
  if (input.decision === "lost" && !note) {
    blockingIssues.push("Bitte dokumentiere zusätzlich einen Kommentar zum verlorenen Angebot.");
  }

  const linkedInvoices = input.decision === "lost"
    ? await db.invoice.findMany({
        where: {
          organizationId: input.organizationId,
          status: { notIn: ["Entwurf", "Gelöscht", "Gel\u00c3\u00b6scht", "Storniert"] },
          OR: [
            { sourceOfferId: offer.id },
            { sourceOfferNumber: { equals: offer.offerNumber, mode: "insensitive" } },
          ],
        },
        select: { id: true, invoiceNumber: true, status: true, updatedAt: true },
      })
    : [];
  if (linkedInvoices.length) {
    blockingIssues.push(
      `${offer.offerNumber} ist bereits mit ${linkedInvoices.map((invoice) => invoice.invoiceNumber).join(", ")} verknüpft und kann nicht als verloren markiert werden.`
    );
  }

  const warnings = [
    "Diese Entscheidung ändert ausschließlich Angebot, Angebotshistorie und Projektlogbuch. Projektstatus, Termine, Aufgaben, Rechnungen und Versand bleiben unverändert.",
  ];
  const checks: OfferDecisionEvaluation["checks"] = [
    {
      key: "offer-state",
      label: "Angebotsstatus",
      status: blockingIssues.length ? "blocked" : "ok",
      detail: blockingIssues.length ? blockingIssues.join(" · ") : `${offer.offerNumber} kann als ${input.decision === "won" ? "gewonnen" : "verloren"} markiert werden.`,
    },
    {
      key: "documentation",
      label: "Begründung",
      status: reason && (input.decision === "won" || note) ? "ok" : "blocked",
      detail: input.decision === "won" ? reason || "Grund fehlt." : `${reason || "Grund fehlt."}${note ? ` · ${note}` : " · Kommentar fehlt."}`,
    },
    {
      key: "side-effects",
      label: "Abgegrenzte Folgen",
      status: "warning",
      detail: warnings[0],
    },
  ];
  const fingerprint = stableHash({
    decision: input.decision,
    reason,
    note,
    offer: {
      id: offer.id,
      status: offer.status,
      lostAt: offer.lostAt?.toISOString() || null,
      wonAt: offer.wonAt?.toISOString() || null,
      updatedAt: offer.updatedAt.toISOString(),
    },
    linkedInvoices: linkedInvoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      updatedAt: invoice.updatedAt.toISOString(),
    })),
  });

  return {
    decision: input.decision,
    reason,
    note,
    offer: {
      id: offer.id,
      offerNumber: offer.offerNumber,
      status: offer.status,
      projectId: offer.projectId,
      projectNumber: offer.projectNumber,
      projectTitle: offer.projectTitle,
      customerName: offer.customerName,
      netTotal: offer.netTotal,
      grossTotal: offer.grossTotal,
      updatedAt: offer.updatedAt.toISOString(),
    },
    checks,
    warnings,
    blockingIssues: [...new Set(blockingIssues)],
    fingerprint,
  };
}

export async function executeOfferDecision(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  offerId: string;
  decision: OfferDecision;
  reason: string;
  note?: string;
  actorId: string;
  actorName: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`workpilot:offer-decision:${input.organizationId}:${input.offerId}`})
    )
  `;
  const evaluated = await evaluateOfferDecision({ ...input, db: input.tx });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new OfferDecisionServiceError(
      "stale_context",
      "Angebot oder Entscheidungsgrund haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluated.blockingIssues.length) {
    throw new OfferDecisionServiceError("blocked", evaluated.blockingIssues.join(" · "));
  }

  const now = new Date();
  const changed = await input.tx.offer.updateMany({
    where: {
      id: input.offerId,
      organizationId: input.organizationId,
      status: { notIn: ["Entwurf", "Gelöscht", "Gel\u00c3\u00b6scht", "Verloren", "Angebot verloren"] },
      wonAt: null,
      lostAt: null,
    },
    data: input.decision === "won"
      ? { wonAt: now, wonByName: input.actorName, wonReason: evaluated.reason }
      : {
          status: "Verloren",
          lostReason: evaluated.reason,
          lostNote: evaluated.note,
          lostAt: now,
          wonAt: null,
          wonByName: "",
          wonReason: "",
        },
  });
  if (changed.count !== 1) {
    throw new OfferDecisionServiceError(
      "conflict",
      "Das Angebot wurde zwischenzeitlich verändert oder bereits entschieden."
    );
  }

  const result = await input.tx.offer.findFirstOrThrow({
    where: { id: input.offerId, organizationId: input.organizationId },
  });
  const label = input.decision === "won" ? "gewonnen" : "verloren";
  const detail = input.decision === "lost" ? ` Grund: ${evaluated.reason}. Kommentar: ${evaluated.note}.` : ` Grund: ${evaluated.reason}.`;
  await input.tx.offerHistory.create({
    data: {
      organizationId: input.organizationId,
      offerId: result.id,
      projectId: result.projectId,
      offerNumber: result.offerNumber,
      eventType: input.decision,
      title: `Angebot ${label}`,
      note: `${result.offerNumber} wurde${input.source === "jarvis" ? " durch JARVIS" : ""} als ${label} markiert.${detail}`,
      actorName: input.actorName,
    },
  });
  await input.tx.projectLogbookEntry.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      projectId: result.projectId,
      title: `Angebot ${label}`,
      body: `${result.offerNumber} wurde${input.source === "jarvis" ? " durch JARVIS" : ""} als ${label} markiert.${detail}`,
      author: input.actorName,
      authorUserId: input.actorId,
      source: input.source === "jarvis" ? "jarvis" : "manual",
    },
  });
  return result;
}
