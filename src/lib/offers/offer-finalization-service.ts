import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  evaluateOfferDraft,
  OfferDraftServiceError,
  type OfferDraftInput,
} from "@/lib/offers/offer-draft-service";
import {
  generateOfferPdf,
  type OfferInput,
  type OfferLineInput,
} from "@/app/api/offers/route";

type OfferFinalizationDb = Prisma.TransactionClient | typeof prisma;

export class OfferFinalizationServiceError extends Error {
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
    this.name = "OfferFinalizationServiceError";
  }
}

export type OfferFinalizationEvaluation = {
  offer: {
    id: string;
    offerNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    company: string;
    offerType: string;
    plannedExecutionMonth: string;
    plannedExecutionEndMonth: string;
    netTotal: number;
    vatRate: number;
    grossTotal: number;
    lineCount: number;
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

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function getOfferFinalizationConfirmationText(offerNumber: string) {
  return `ANGEBOT FINALISIEREN ${offerNumber.trim()}`;
}

export function matchesOfferFinalizationConfirmation(
  offerNumber: string,
  confirmationText: string
) {
  return confirmationText.trim() === getOfferFinalizationConfirmationText(offerNumber);
}

function draftFromOffer(offer: {
  projectId: string;
  company: string;
  offerType: string;
  addendumMode: string;
  parentOfferId: string;
  plannedExecutionMonth: string;
  plannedExecutionEndMonth: string;
  introText: string;
  closingText: string;
  vatRate: number;
  discountPercent: number;
  lines: Array<{
    catalogItemId: string;
    catalogType: string;
    quantity: number;
    unit: string;
    title: string;
    description: string;
    unitPrice: number;
    discountPercent: number;
  }>;
}): OfferDraftInput {
  return {
    projectId: offer.projectId,
    company: offer.company === "OK immocare" ? "OK immocare" : "OK solutions",
    offerType: offer.offerType === "addendum" ? "addendum" : "base",
    addendumMode:
      offer.addendumMode === "replacement" || offer.addendumMode === "reduction"
        ? offer.addendumMode
        : "addition",
    parentOfferId: offer.parentOfferId,
    plannedExecutionMonth: offer.plannedExecutionMonth,
    plannedExecutionEndMonth: offer.plannedExecutionEndMonth,
    introText: offer.introText,
    closingText: offer.closingText,
    vatRate: offer.vatRate,
    discountPercent: offer.discountPercent,
    lines: offer.lines,
  };
}

export async function evaluateOfferFinalization(input: {
  organizationId: string;
  offerId: string;
  db?: OfferFinalizationDb;
}): Promise<OfferFinalizationEvaluation> {
  const db = input.db ?? prisma;
  const offer = await db.offer.findFirst({
    where: { id: input.offerId, organizationId: input.organizationId },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!offer) {
    throw new OfferFinalizationServiceError(
      "not_found",
      "Das Angebot wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (offer.status !== "Entwurf") {
    throw new OfferFinalizationServiceError(
      "invalid_state",
      offer.status === "Erstellt"
        ? `${offer.offerNumber} ist bereits finalisiert.`
        : `${offer.offerNumber} kann im Status ${offer.status} nicht finalisiert werden.`
    );
  }

  let evaluated;
  try {
    evaluated = await evaluateOfferDraft({
      organizationId: input.organizationId,
      draft: draftFromOffer(offer),
      db,
      restrictToCatalog: false,
    });
  } catch (error) {
    if (error instanceof OfferDraftServiceError) {
      throw new OfferFinalizationServiceError("blocked", error.message);
    }
    throw error;
  }

  const blockingIssues = [...evaluated.missingFields, ...evaluated.errors];
  const totalsChanged =
    Math.abs(evaluated.totals.netTotal - offer.netTotal) > 0.005 ||
    Math.abs(evaluated.totals.grossTotal - offer.grossTotal) > 0.005 ||
    Math.abs(evaluated.totals.vatRate - offer.vatRate) > 0.005;
  if (totalsChanged) {
    blockingIssues.push(
      "Die gespeicherten Angebotssummen stimmen nicht mehr mit den Positionsdaten überein."
    );
  }
  const canonicalBlockingIssues = [...new Set(blockingIssues)];
  const warnings = [...new Set(evaluated.warnings)];
  const checks: OfferFinalizationEvaluation["checks"] = [
    {
      key: "status",
      label: "Entwurfsstatus",
      status: "ok",
      detail: `${offer.offerNumber} ist ein finalisierbarer Entwurf.`,
    },
    {
      key: "positions",
      label: "Positionen und Kalkulation",
      status: canonicalBlockingIssues.length ? "blocked" : "ok",
      detail: canonicalBlockingIssues.length
        ? canonicalBlockingIssues.join(" · ")
        : `${offer.lines.length} Position(en), ${evaluated.totals.netTotal.toFixed(2)} EUR netto und ${evaluated.totals.grossTotal.toFixed(2)} EUR brutto sind konsistent.`,
    },
    {
      key: "execution-period",
      label: "Ausführungszeitraum",
      status: evaluated.input.plannedExecutionMonth ? "ok" : "blocked",
      detail: evaluated.input.plannedExecutionEndMonth
        ? `${evaluated.input.plannedExecutionMonth} bis ${evaluated.input.plannedExecutionEndMonth}`
        : evaluated.input.plannedExecutionMonth || "Ausführungsmonat fehlt.",
    },
    {
      key: "side-effects",
      label: "Getrennte Folgeschritte",
      status: "warning",
      detail:
        "Finalisierung erzeugt das Angebots-PDF, aber keinen Versand, keine Gewonnen-/Verloren-Markierung und keine automatische Projektstatusänderung.",
    },
  ];
  const fingerprint = stableHash({
    offer: {
      id: offer.id,
      status: offer.status,
      updatedAt: offer.updatedAt.toISOString(),
      netTotal: offer.netTotal,
      vatRate: offer.vatRate,
      grossTotal: offer.grossTotal,
      lines: offer.lines.map((line) => ({
        id: line.id,
        position: line.position,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        totalNet: line.totalNet,
        updatedAt: line.updatedAt.toISOString(),
      })),
    },
    project: evaluated.project,
    parentOffer: evaluated.parentOffer,
    catalogVersions: evaluated.catalogVersions,
    checks,
    warnings,
    blockingIssues: canonicalBlockingIssues,
  });

  return {
    offer: {
      id: offer.id,
      offerNumber: offer.offerNumber,
      status: offer.status,
      projectId: offer.projectId,
      projectNumber: offer.projectNumber,
      projectTitle: offer.projectTitle,
      customerName: offer.customerName,
      company: offer.company,
      offerType: offer.offerType,
      plannedExecutionMonth: offer.plannedExecutionMonth,
      plannedExecutionEndMonth: offer.plannedExecutionEndMonth,
      netTotal: offer.netTotal,
      vatRate: offer.vatRate,
      grossTotal: offer.grossTotal,
      lineCount: offer.lines.length,
      updatedAt: offer.updatedAt.toISOString(),
    },
    checks,
    warnings,
    blockingIssues: canonicalBlockingIssues,
    fingerprint,
  };
}

export async function finalizeOfferDraft(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  offerId: string;
  actorName: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`workpilot:offer-finalize:${input.organizationId}:${input.offerId}`})
    )
  `;
  const evaluated = await evaluateOfferFinalization({
    organizationId: input.organizationId,
    offerId: input.offerId,
    db: input.tx,
  });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new OfferFinalizationServiceError(
      "stale_context",
      "Angebot oder Finalisierungsprüfung haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluated.blockingIssues.length) {
    throw new OfferFinalizationServiceError("blocked", evaluated.blockingIssues.join(" · "));
  }
  const offer = await input.tx.offer.findFirstOrThrow({
    where: {
      id: input.offerId,
      organizationId: input.organizationId,
      status: "Entwurf",
    },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  const pdfLines: Required<OfferLineInput>[] = offer.lines.map((line) => ({
    catalogItemId: line.catalogItemId,
    catalogType: line.catalogType,
    isLaborPosition: line.isLaborPosition,
    quantity: line.quantity,
    unit: line.unit,
    title: line.title,
    description: line.description,
    unitPrice: line.unitPrice,
    discountPercent: line.discountPercent,
    laborCostRateKey: line.laborCostRateKey,
    laborCostRate: line.laborCostRate,
    vatRate: line.vatRate,
    laborItems: [],
  }));
  const pdfInput: OfferInput & { offerNumber: string } = {
    offerNumber: offer.offerNumber,
    projectId: offer.projectId,
    projectNumber: offer.projectNumber,
    projectTitle: offer.projectTitle,
    company: offer.company === "OK immocare" ? "OK immocare" : "OK solutions",
    offerType: offer.offerType === "addendum" ? "addendum" : "base",
    addendumMode:
      offer.addendumMode === "replacement" || offer.addendumMode === "reduction"
        ? offer.addendumMode
        : "addition",
    plannedExecutionEndMonth: offer.plannedExecutionEndMonth,
    parentOfferId: offer.parentOfferId,
    customerName: offer.customerName,
    customerStreet: offer.customerStreet,
    customerCity: offer.customerCity,
    contactName: offer.contactName,
    internalContactName: offer.internalContactName,
    internalPhone: offer.internalPhone,
    internalEmail: offer.internalEmail,
    plannedExecutionMonth: offer.plannedExecutionMonth,
    introText: offer.introText,
    closingText: offer.closingText,
    vatRate: offer.vatRate,
    discountPercent: offer.discountPercent,
  };
  const pdf = await generateOfferPdf(pdfInput, pdfLines);
  const updated = await input.tx.offer.updateMany({
    where: {
      id: input.offerId,
      organizationId: input.organizationId,
      status: "Entwurf",
    },
    data: {
      status: "Erstellt",
      pdfData: pdf.pdfData,
      netTotal: pdf.netTotal,
      vatRate: pdf.vatRate,
      grossTotal: pdf.grossTotal,
    },
  });
  if (updated.count !== 1) {
    throw new OfferFinalizationServiceError(
      "conflict",
      "Das Angebot wurde zwischenzeitlich verändert oder bereits finalisiert."
    );
  }
  const finalized = await input.tx.offer.findUniqueOrThrow({ where: { id: offer.id } });
  await input.tx.offerHistory.create({
    data: {
      organizationId: input.organizationId,
      offerId: finalized.id,
      projectId: finalized.projectId,
      offerNumber: finalized.offerNumber,
      eventType: "finalized",
      title: "Angebot finalisiert",
      note: `${finalized.offerNumber} wurde${
        input.source === "jarvis" ? " durch JARVIS" : ""
      } finalisiert und als PDF erzeugt. Versand, Verkaufsentscheidung und Projektstatus blieben unverändert.`,
      actorName: input.actorName,
    },
  });
  return finalized;
}
