import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getBillingAddressSnapshot } from "@/lib/contacts/invoice-routing";
import {
  calculateOfferDraftTotals,
  calculateOfferLineNet,
  clampOfferPercent,
  cleanOfferNumber,
  cleanOfferText,
  normalizeOfferAddendumMode,
  normalizeOfferCompany,
  normalizeOfferMonth,
  normalizeOfferType,
  normalizeOfferUnit,
  validateOfferDraft,
  type CanonicalOfferDraftLine,
  type OfferAddendumMode,
  type OfferCompany,
  type OfferDraftLineInput,
  type OfferDraftTotals,
  type OfferType,
} from "@/lib/offers/offer-core";

type OfferDb = Prisma.TransactionClient | typeof prisma;

export type OfferDraftInput = {
  projectId?: string;
  company?: OfferCompany;
  offerType?: OfferType;
  addendumMode?: OfferAddendumMode;
  parentOfferId?: string;
  plannedExecutionMonth?: string;
  plannedExecutionEndMonth?: string;
  introText?: string;
  closingText?: string;
  vatRate?: number;
  discountPercent?: number;
  lines?: OfferDraftLineInput[];
};

export type OfferDraftProjectOption = {
  id: string;
  label: string;
  customerLabel: string;
  projectKind: string;
  defaultCompany: OfferCompany;
  defaultExecutionMonth: string;
  defaultExecutionEndMonth: string;
  updatedAt: string;
};

export type OfferDraftCatalogOption = {
  id: string;
  label: string;
  type: string;
  unit: string;
  description: string;
  salesPrice: number;
  vatRate: number;
  updatedAt: string;
};

export type OfferDraftParentOption = {
  id: string;
  label: string;
  projectId: string;
  updatedAt: string;
};

export type OfferDraftWorkspace = {
  projectOptions: OfferDraftProjectOption[];
  catalogOptions: OfferDraftCatalogOption[];
  parentOfferOptions: OfferDraftParentOption[];
};

export type EvaluatedOfferDraft = {
  input: {
    projectId: string;
    company: OfferCompany;
    offerType: OfferType;
    addendumMode: OfferAddendumMode;
    parentOfferId: string;
    plannedExecutionMonth: string;
    plannedExecutionEndMonth: string;
    introText: string;
    closingText: string;
    vatRate: number;
    discountPercent: number;
    lines: CanonicalOfferDraftLine[];
  };
  project: {
    id: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    customerStreet: string;
    customerCity: string;
    contactName: string;
    projectKind: string;
    updatedAt: string;
  } | null;
  parentOffer: {
    id: string;
    offerNumber: string;
    updatedAt: string;
  } | null;
  catalogVersions: Array<{ id: string; updatedAt: string }>;
  totals: OfferDraftTotals;
  missingFields: string[];
  errors: string[];
  warnings: string[];
};

export class OfferDraftServiceError extends Error {
  constructor(
    public readonly code:
      | "invalid_input"
      | "not_found"
      | "scope_mismatch"
      | "stale_context"
      | "conflict",
    message: string
  ) {
    super(message);
    this.name = "OfferDraftServiceError";
  }
}

const DEFAULT_INTRO =
  "wir danken Ihnen für Ihre Anfrage und unterbreiten Ihnen auf den folgenden Seiten unser Angebot.";
const DEFAULT_CLOSING = "Wir freuen uns auf Ihre Rückmeldung.";

function projectIsArchived(status: string | null | undefined) {
  const value = (status ?? "").toLocaleLowerCase("de-DE");
  return value.includes("archiv") || value.includes("gelöscht");
}

function contactLabel(contact: {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null) {
  if (!contact) return "";
  return (
    cleanOfferText(contact.companyName, 300) ||
    [contact.firstName, contact.lastName]
      .map((value) => cleanOfferText(value, 150))
      .filter(Boolean)
      .join(" ")
  );
}

function defaultCompanyForProject(project: {
  projectType: string | null;
  projectNumber: string;
}) {
  return (project.projectType ?? "").toLocaleLowerCase("de-DE").includes("immocare") ||
    project.projectNumber.toLocaleLowerCase("de-DE").startsWith("oki")
    ? ("OK immocare" as const)
    : ("OK solutions" as const);
}

function isRecurringProject(projectKind: string | null | undefined) {
  return (projectKind ?? "").toLocaleLowerCase("de-DE").startsWith("dauer");
}

export async function loadOfferDraftWorkspace(
  organizationId: string,
  db: OfferDb = prisma
): Promise<OfferDraftWorkspace> {
  const [projects, catalogItems, parentOffers] = await Promise.all([
    db.workPilotProject.findMany({
      where: { organizationId },
      orderBy: [{ projectNumber: "asc" }, { title: "asc" }],
      select: {
        id: true,
        projectNumber: true,
        title: true,
        customer: true,
        status: true,
        projectType: true,
        projectKind: true,
        projectRuntimeFrom: true,
        projectRuntimeUntil: true,
        updatedAt: true,
      },
    }),
    db.catalogItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ type: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        name: true,
        type: true,
        unit: true,
        description: true,
        salesPrice: true,
        vatRate: true,
        updatedAt: true,
      },
    }),
    db.offer.findMany({
      where: {
        organizationId,
        status: { notIn: ["Gelöscht", "Geloescht", "Archiviert"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        offerNumber: true,
        projectId: true,
        projectTitle: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);
  return {
    projectOptions: projects
      .filter((project) => !projectIsArchived(project.status))
      .map((project) => ({
        id: project.id,
        label: `${project.projectNumber || project.id} · ${project.title}`,
        customerLabel: project.customer || "",
        projectKind: project.projectKind || "",
        defaultCompany: defaultCompanyForProject(project),
        defaultExecutionMonth: isRecurringProject(project.projectKind)
          ? cleanOfferText(project.projectRuntimeFrom, 10).slice(0, 7)
          : "",
        defaultExecutionEndMonth: isRecurringProject(project.projectKind)
          ? cleanOfferText(project.projectRuntimeUntil, 10).slice(0, 7)
          : "",
        updatedAt: project.updatedAt.toISOString(),
      })),
    catalogOptions: catalogItems.map((item) => ({
      id: item.id,
      label: `${item.number} · ${item.name}`,
      type: item.type,
      unit: item.unit || "Stk",
      description: item.description || "",
      salesPrice: Number(item.salesPrice || 0),
      vatRate: Number(item.vatRate || 19),
      updatedAt: item.updatedAt.toISOString(),
    })),
    parentOfferOptions: parentOffers.map((offer) => ({
      id: offer.id,
      label: `${offer.offerNumber} · ${offer.projectTitle || "Angebot"} · ${offer.status}`,
      projectId: offer.projectId,
      updatedAt: offer.updatedAt.toISOString(),
    })),
  };
}

export async function evaluateOfferDraft(input: {
  organizationId: string;
  draft: OfferDraftInput;
  db?: OfferDb;
  restrictToCatalog?: boolean;
}): Promise<EvaluatedOfferDraft> {
  const db = input.db ?? prisma;
  const projectId = cleanOfferText(input.draft.projectId, 120);
  const project = projectId
    ? await db.workPilotProject.findFirst({
        where: { id: projectId, organizationId: input.organizationId },
        select: {
          id: true,
          projectNumber: true,
          title: true,
          customer: true,
          status: true,
          projectType: true,
          projectKind: true,
          projectRuntimeFrom: true,
          projectRuntimeUntil: true,
          address: true,
          contactId: true,
          contactPersonId: true,
          updatedAt: true,
        },
      })
    : null;
  if (project && projectIsArchived(project.status)) {
    throw new OfferDraftServiceError(
      "invalid_input",
      "Für ein archiviertes Projekt kann kein Angebotsentwurf angelegt werden."
    );
  }
  const [customerContact, personContact] = project
    ? await Promise.all([
        project.contactId
          ? db.contact.findFirst({
              where: {
                id: project.contactId,
                organizationId: input.organizationId,
              },
              select: {
                type: true,
                companyName: true,
                firstName: true,
                lastName: true,
                addressLine1: true,
                addressLine2: true,
                street: true,
                postalCode: true,
                city: true,
                country: true,
                hasDifferentBillingAddress: true,
                billingName: true,
                billingStreet: true,
                billingAddressLine1: true,
                billingAddressLine2: true,
                billingPostalCode: true,
                billingCity: true,
                billingCountry: true,
              },
            })
          : null,
        project.contactPersonId
          ? db.contact.findFirst({
              where: {
                id: project.contactPersonId,
                organizationId: input.organizationId,
              },
              select: {
                companyName: true,
                firstName: true,
                lastName: true,
              },
            })
          : null,
      ])
    : [null, null];

  const requestedLines = Array.isArray(input.draft.lines)
    ? input.draft.lines.slice(0, 30)
    : [];
  const catalogIds = [
    ...new Set(
      requestedLines
        .map((line) => cleanOfferText(line.catalogItemId, 120))
        .filter(Boolean)
    ),
  ];
  const catalogItems = catalogIds.length
    ? await db.catalogItem.findMany({
        where: {
          organizationId: input.organizationId,
          id: { in: catalogIds },
          isActive: true,
        },
        select: {
          id: true,
          type: true,
          name: true,
          unit: true,
          description: true,
          salesPrice: true,
          vatRate: true,
          updatedAt: true,
        },
      })
    : [];
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines: CanonicalOfferDraftLine[] = [];
  for (const [index, requested] of requestedLines.entries()) {
    const catalogItemId = cleanOfferText(requested.catalogItemId, 120);
    const catalogItem = catalogItemId
      ? catalogById.get(catalogItemId)
      : undefined;
    if (catalogItemId && !catalogItem) {
      errors.push(
        `Position ${index + 1}: Der Katalogeintrag ist nicht aktiv oder gehört nicht zur Organisation.`
      );
      continue;
    }
    if (input.restrictToCatalog && !catalogItem) {
      errors.push(
        `Position ${index + 1}: JARVIS-Angebote müssen eine aktive Katalogposition verwenden.`
      );
      continue;
    }
    const quantity = cleanOfferNumber(requested.quantity, 1);
    const catalogPrice = Number(catalogItem?.salesPrice || 0);
    const requestedPrice =
      requested.unitPrice === undefined
        ? catalogPrice
        : cleanOfferNumber(requested.unitPrice, catalogPrice);
    if (
      catalogItem &&
      requested.unitPrice !== undefined &&
      Math.abs(requestedPrice - catalogPrice) > 0.004
    ) {
      warnings.push(
        `Position ${index + 1}: ${requestedPrice.toFixed(2)} € weicht vom aktuellen Katalogpreis ${catalogPrice.toFixed(2)} € ab.`
      );
    }
    const discountPercent = clampOfferPercent(requested.discountPercent);
    const line = {
      catalogItemId,
      catalogType: catalogItem?.type || cleanOfferText(requested.catalogType, 40),
      quantity,
      unit:
        normalizeOfferUnit(requested.unit || catalogItem?.unit) || "Stk",
      title:
        cleanOfferText(catalogItem?.name || requested.title, 500),
      description: cleanOfferText(
        requested.description ?? catalogItem?.description,
        4000
      ),
      unitPrice: requestedPrice,
      discountPercent,
      vatRate: Number(catalogItem?.vatRate || input.draft.vatRate || 19),
      totalNet: calculateOfferLineNet({
        quantity,
        unitPrice: requestedPrice,
        discountPercent,
      }),
    };
    lines.push(line);
  }

  const offerType = normalizeOfferType(input.draft.offerType);
  const parentOfferId =
    offerType === "addendum"
      ? cleanOfferText(input.draft.parentOfferId, 120)
      : "";
  const parentOffer = parentOfferId
    ? await db.offer.findFirst({
        where: {
          id: parentOfferId,
          organizationId: input.organizationId,
          projectId,
          status: { notIn: ["Gelöscht", "Geloescht", "Archiviert"] },
        },
        select: { id: true, offerNumber: true, updatedAt: true },
      })
    : null;
  if (parentOfferId && !parentOffer) {
    errors.push(
      "Das Bezugsangebot gehört nicht zum ausgewählten Projekt oder ist nicht mehr verfügbar."
    );
  }

  const defaultCompany = project
    ? defaultCompanyForProject(project)
    : ("OK solutions" as const);
  const company = input.draft.company
    ? normalizeOfferCompany(input.draft.company)
    : defaultCompany;
  const plannedExecutionMonth =
    normalizeOfferMonth(input.draft.plannedExecutionMonth) ||
    (project && isRecurringProject(project.projectKind)
      ? normalizeOfferMonth(
          cleanOfferText(project.projectRuntimeFrom, 10).slice(0, 7)
        )
      : "");
  const plannedExecutionEndMonth =
    normalizeOfferMonth(input.draft.plannedExecutionEndMonth) ||
    (project && isRecurringProject(project.projectKind)
      ? normalizeOfferMonth(
          cleanOfferText(project.projectRuntimeUntil, 10).slice(0, 7)
        )
      : "");
  const vatRate = Math.min(
    Math.max(cleanOfferNumber(input.draft.vatRate, 19), 0),
    100
  );
  const discountPercent = clampOfferPercent(input.draft.discountPercent);
  const validation = validateOfferDraft({
    projectId,
    offerType,
    parentOfferId,
    plannedExecutionMonth,
    plannedExecutionEndMonth,
    requiresExecutionEndMonth: Boolean(
      project && isRecurringProject(project.projectKind)
    ),
    lines,
  });
  errors.push(...validation.errors);
  const addressParts = cleanOfferText(project?.address, 1000)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const billingAddress = project ? getBillingAddressSnapshot(customerContact ? { id: project.contactId || "", ...customerContact } : null, {
    customerName: project.customer || "",
    customerStreet: addressParts[0] || project.address || "",
    customerCity: addressParts.slice(1).join(", "),
    customerCountry: "Deutschland",
  }) : null;

  return {
    input: {
      projectId,
      company,
      offerType,
      addendumMode: normalizeOfferAddendumMode(input.draft.addendumMode),
      parentOfferId,
      plannedExecutionMonth,
      plannedExecutionEndMonth,
      introText:
        cleanOfferText(input.draft.introText, 4000) || DEFAULT_INTRO,
      closingText:
        cleanOfferText(input.draft.closingText, 4000) || DEFAULT_CLOSING,
      vatRate,
      discountPercent,
      lines,
    },
    project: project && billingAddress
      ? {
          id: project.id,
          projectNumber: project.projectNumber || project.id,
          projectTitle: project.title,
          customerName: billingAddress.customerName,
          customerStreet: billingAddress.customerStreet,
          customerCity: billingAddress.customerCity,
          contactName: contactLabel(personContact),
          projectKind: project.projectKind || "",
          updatedAt: project.updatedAt.toISOString(),
        }
      : null,
    parentOffer: parentOffer
      ? {
          id: parentOffer.id,
          offerNumber: parentOffer.offerNumber,
          updatedAt: parentOffer.updatedAt.toISOString(),
        }
      : null,
    catalogVersions: catalogItems.map((item) => ({
      id: item.id,
      updatedAt: item.updatedAt.toISOString(),
    })),
    totals: calculateOfferDraftTotals(lines, discountPercent, vatRate),
    missingFields: validation.missingFields,
    errors,
    warnings,
  };
}

async function getNextOfferNumber(
  tx: Prisma.TransactionClient,
  organizationId: string
) {
  await tx.$queryRaw<Array<{ locked: number }>>`
    SELECT 1::INTEGER AS "locked"
    FROM (
      SELECT pg_advisory_xact_lock(
        hashtext(${"workpilot-offer-number:" + organizationId})
      )
    ) AS "offerNumberLock"
  `;
  const rows = await tx.$queryRaw<
    Array<{ nextNumber: bigint | number | string }>
  >`
    SELECT (
      COALESCE(
        MAX(
          CASE
            WHEN "offerNumber" ~ '[0-9]+$'
              THEN substring("offerNumber" FROM '([0-9]+)$')::BIGINT
            ELSE NULL
          END
        ),
        10099
      ) + 1
    ) AS "nextNumber"
    FROM "Offer"
    WHERE "organizationId" = ${organizationId}
  `;
  const next = Number(rows[0]?.nextNumber ?? 10100);
  if (!Number.isSafeInteger(next) || next < 1) {
    throw new OfferDraftServiceError(
      "conflict",
      "Die nächste Angebotsnummer konnte nicht sicher ermittelt werden."
    );
  }
  return `ANG-${next}`;
}

export async function createConfirmedOfferDraft(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  actorName: string;
  draft: OfferDraftInput;
  source: "jarvis" | "ui";
}) {
  const evaluated = await evaluateOfferDraft({
    organizationId: input.organizationId,
    draft: input.draft,
    db: input.tx,
    restrictToCatalog: input.source === "jarvis",
  });
  if (
    evaluated.missingFields.length > 0 ||
    evaluated.errors.length > 0 ||
    !evaluated.project
  ) {
    throw new OfferDraftServiceError(
      "invalid_input",
      [...evaluated.missingFields, ...evaluated.errors].join(" ") ||
        "Der Angebotsentwurf ist unvollständig."
    );
  }
  const offerNumber = await getNextOfferNumber(
    input.tx,
    input.organizationId
  );
  const offer = await input.tx.offer.create({
    data: {
      organizationId: input.organizationId,
      projectId: evaluated.project.id,
      projectNumber: evaluated.project.projectNumber,
      projectTitle: evaluated.project.projectTitle,
      company: evaluated.input.company,
      offerType: evaluated.input.offerType,
      addendumMode: evaluated.input.addendumMode,
      plannedExecutionEndMonth:
        evaluated.input.plannedExecutionEndMonth,
      parentOfferId: evaluated.input.parentOfferId,
      offerNumber,
      status: "Entwurf",
      customerName: evaluated.project.customerName,
      customerStreet: evaluated.project.customerStreet,
      customerCity: evaluated.project.customerCity,
      contactName: evaluated.project.contactName,
      internalContactName: cleanOfferText(input.actorName, 300),
      plannedExecutionMonth: evaluated.input.plannedExecutionMonth,
      introText: evaluated.input.introText,
      closingText: evaluated.input.closingText,
      netTotal: evaluated.totals.netTotal,
      vatRate: evaluated.totals.vatRate,
      grossTotal: evaluated.totals.grossTotal,
      discountPercent: evaluated.input.discountPercent,
      lines: {
        create: evaluated.input.lines.map((line, index) => ({
          organizationId: input.organizationId,
          catalogItemId: line.catalogItemId,
          catalogType: line.catalogType,
          position: index + 1,
          quantity: line.quantity,
          unit: line.unit,
          title: line.title,
          description: line.description,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          isLaborPosition: line.catalogType === "service",
          vatRate: line.vatRate,
          totalNet: line.totalNet,
        })),
      },
    },
    select: { id: true, offerNumber: true },
  });
  await input.tx.offerHistory.create({
    data: {
      organizationId: input.organizationId,
      offerId: offer.id,
      projectId: evaluated.project.id,
      offerNumber,
      eventType: "created",
      title: "Angebotsentwurf gespeichert",
      note: `${
        evaluated.input.offerType === "addendum"
          ? "Nachtragsangebot"
          : "Angebot"
      } ${offerNumber} wurde ${
        input.source === "jarvis" ? "über JARVIS " : ""
      }als Entwurf gespeichert.`,
      actorName: cleanOfferText(input.actorName, 300),
    },
  });
  return {
    id: offer.id,
    offerNumber: offer.offerNumber,
    projectId: evaluated.project.id,
    netTotal: evaluated.totals.netTotal,
    grossTotal: evaluated.totals.grossTotal,
  };
}
