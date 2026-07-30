import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import {
  canArchiveProjects,
  canManageProjects,
  canReviewProjects,
} from "@/lib/permissions";
import { recordStatusTransition, seedCurrentStatusTimeline } from "@/lib/status-tracking";
import { getProjectBusinessAreaCode } from "@/lib/project-business-area";
import {
  getProjectReviewStatusAfterEdit,
  hasProjectReviewRelevantChange,
  normalizeProjectReviewStatus,
  projectReviewStatuses,
  validateProjectReviewApprovalInput,
} from "@/lib/projects/review-status";

export const dynamic = "force-dynamic";

type LocalProjectRow = {
  id: string;
  organizationId: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  status: string;
  statusCode: string | null;
  description: string | null;
  contactId: string | null;
  contactPersonId: string | null;
  addressContactId: string | null;
  objectAddressId: string | null;
  projectType: string | null;
  projectKind: string | null;
  projectRuntimeFrom: string | null;
  projectRuntimeUntil: string | null;
  billingInterval: string | null;
  recurringBillingMode: string | null;
  forecastBillingType: string | null;
  forecastNetAmount: string | null;
  trade: string | null;
  branch: string | null;
  volume: string | null;
  source: string | null;
  address: string | null;
  mapLatitude: number | null;
  mapLongitude: number | null;
  mapGeocodedAddress: string | null;
  mapGeocodeProvider: string | null;
  mapGeocodeStatus: string;
  mapGeocodeConfidence: number | null;
  mapGeocodedAt: Date | null;
  participants: string | null;
  responsibleName: string | null;
  deputyName: string | null;
  deputyFrom: string | null;
  deputyUntil: string | null;
  timeBudgetEnabled: boolean | null;
  timeBudgetHours: string | null;
  timeBudgetHistory: unknown;
  timeBudgetAllocations: unknown;
  autoBillingEnabled: boolean | null;
  autoBillingNetAmount: string | null;
  autoBillingVatRate: string | null;
  autoBillingStartMonth: string | null;
  autoBillingEndMonth: string | null;
  autoBillingTemplateMode: string | null;
  autoBillingTemplate: unknown;
  winterGritPackageItemId: string | null;
  winterGritPushPackageItemId: string | null;
  reviewStatus: string;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedProjectStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectReviewHistoryRow = {
  id: string;
  organizationId: string;
  projectId: string;
  eventType: string;
  oldStatus: string | null;
  newStatus: string;
  actorUserId: string | null;
  actorName: string;
  note: string | null;
  createdAt: Date;
};

async function ensureLocalProjectTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "WorkPilotProject" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectNumber" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "customer" TEXT,
      "status" TEXT NOT NULL DEFAULT 'Lead / Klärung',
      "statusCode" TEXT,
      "description" TEXT,
      "contactId" TEXT,
      "contactPersonId" TEXT,
      "addressContactId" TEXT,
      "objectAddressId" TEXT,
      "projectType" TEXT,
      "projectKind" TEXT,
      "projectRuntimeFrom" TEXT,
      "projectRuntimeUntil" TEXT,
      "billingInterval" TEXT,
      "recurringBillingMode" TEXT,
      "forecastBillingType" TEXT,
      "forecastNetAmount" TEXT,
      "trade" TEXT,
      "branch" TEXT,
      "volume" TEXT,
      "source" TEXT,
      "address" TEXT,
      "mapLatitude" DOUBLE PRECISION,
      "mapLongitude" DOUBLE PRECISION,
      "mapGeocodedAddress" TEXT,
      "mapGeocodeProvider" TEXT,
      "mapGeocodeStatus" TEXT NOT NULL DEFAULT 'pending',
      "mapGeocodeConfidence" INTEGER,
      "mapGeocodedAt" TIMESTAMP(3),
      "participants" TEXT,
      "responsibleName" TEXT,
      "deputyName" TEXT,
      "deputyFrom" TEXT,
      "deputyUntil" TEXT,
      "timeBudgetEnabled" BOOLEAN NOT NULL DEFAULT false,
      "timeBudgetHours" TEXT,
      "timeBudgetHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "timeBudgetAllocations" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "autoBillingEnabled" BOOLEAN NOT NULL DEFAULT false,
      "autoBillingNetAmount" TEXT,
      "autoBillingVatRate" TEXT,
      "autoBillingStartMonth" TEXT,
      "autoBillingEndMonth" TEXT,
      "autoBillingTemplateMode" TEXT,
      "autoBillingTemplate" JSONB,
      "winterGritPackageItemId" TEXT,
      "winterGritPushPackageItemId" TEXT,
      "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
      "reviewedAt" TIMESTAMP(3),
      "reviewedByUserId" TEXT,
      "reviewedByName" TEXT,
      "reviewNote" TEXT,
      "reviewedProjectStatus" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "WorkPilotProject"
    ADD COLUMN IF NOT EXISTS "customer" TEXT,
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Lead / Klärung',
    ADD COLUMN IF NOT EXISTS "statusCode" TEXT,
    ADD COLUMN IF NOT EXISTS "description" TEXT,
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "contactPersonId" TEXT,
    ADD COLUMN IF NOT EXISTS "addressContactId" TEXT,
    ADD COLUMN IF NOT EXISTS "objectAddressId" TEXT,
    ADD COLUMN IF NOT EXISTS "projectType" TEXT,
    ADD COLUMN IF NOT EXISTS "projectKind" TEXT,
    ADD COLUMN IF NOT EXISTS "projectRuntimeFrom" TEXT,
    ADD COLUMN IF NOT EXISTS "projectRuntimeUntil" TEXT,
    ADD COLUMN IF NOT EXISTS "billingInterval" TEXT,
    ADD COLUMN IF NOT EXISTS "recurringBillingMode" TEXT,
    ADD COLUMN IF NOT EXISTS "forecastBillingType" TEXT,
    ADD COLUMN IF NOT EXISTS "forecastNetAmount" TEXT,
    ADD COLUMN IF NOT EXISTS "trade" TEXT,
    ADD COLUMN IF NOT EXISTS "branch" TEXT,
    ADD COLUMN IF NOT EXISTS "volume" TEXT,
    ADD COLUMN IF NOT EXISTS "source" TEXT,
    ADD COLUMN IF NOT EXISTS "address" TEXT,
    ADD COLUMN IF NOT EXISTS "mapLatitude" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "mapLongitude" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "mapGeocodedAddress" TEXT,
    ADD COLUMN IF NOT EXISTS "mapGeocodeProvider" TEXT,
    ADD COLUMN IF NOT EXISTS "mapGeocodeStatus" TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "mapGeocodeConfidence" INTEGER,
    ADD COLUMN IF NOT EXISTS "mapGeocodedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "participants" TEXT,
    ADD COLUMN IF NOT EXISTS "responsibleName" TEXT,
    ADD COLUMN IF NOT EXISTS "deputyName" TEXT,
    ADD COLUMN IF NOT EXISTS "deputyFrom" TEXT,
    ADD COLUMN IF NOT EXISTS "deputyUntil" TEXT,
    ADD COLUMN IF NOT EXISTS "timeBudgetEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "timeBudgetHours" TEXT,
    ADD COLUMN IF NOT EXISTS "timeBudgetHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "timeBudgetAllocations" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "autoBillingEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "autoBillingNetAmount" TEXT,
    ADD COLUMN IF NOT EXISTS "autoBillingVatRate" TEXT,
    ADD COLUMN IF NOT EXISTS "autoBillingStartMonth" TEXT,
    ADD COLUMN IF NOT EXISTS "autoBillingEndMonth" TEXT,
    ADD COLUMN IF NOT EXISTS "autoBillingTemplateMode" TEXT,
    ADD COLUMN IF NOT EXISTS "autoBillingTemplate" JSONB,
    ADD COLUMN IF NOT EXISTS "winterGritPackageItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "winterGritPushPackageItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
    ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "reviewedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewNote" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewedProjectStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "WorkPilotProject_organizationId_reviewStatus_idx"
    ON "WorkPilotProject" ("organizationId", "reviewStatus")
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "WorkPilotProjectReviewHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "oldStatus" TEXT,
      "newStatus" TEXT NOT NULL,
      "actorUserId" TEXT,
      "actorName" TEXT NOT NULL,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "WorkPilotProjectReviewHistory_organizationId_projectId_crea_idx"
    ON "WorkPilotProjectReviewHistory" ("organizationId", "projectId", "createdAt")
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecurringProjectKind(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("dauerl") && normalized.includes("projekt");
}

function cleanRecurringBillingMode(value: unknown) {
  const cleaned = cleanString(value);
  return cleaned === "monthlyFlat" || cleaned === "hourly" ? cleaned : "";
}

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
}

function forbiddenProjectResponse() {
  return NextResponse.json(
    { error: "Du darfst Projekte nicht verwalten." },
    { status: 403 }
  );
}

function forbiddenProjectArchiveResponse() {
  return NextResponse.json(
    { error: "Du darfst Projekte nicht archivieren." },
    { status: 403 }
  );
}

function isArchivedProjectStatus(status: string) {
  return normalizeProjectStatus(status) === "Archiviert";
}

function cleanBudgetHistory(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;

      return {
        id: cleanString(candidate.id) || randomUUID(),
        changedAt: cleanString(candidate.changedAt),
        changedBy: cleanString(candidate.changedBy),
        previousHours: cleanString(candidate.previousHours),
        nextHours: cleanString(candidate.nextHours),
      };
    })
    .filter(Boolean);
}

function cleanBudgetAllocations(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      const month = cleanString(candidate.month);

      if (!month) return null;

      return {
        id: cleanString(candidate.id) || randomUUID(),
        month,
        hours: cleanString(candidate.hours),
      };
    })
    .filter(Boolean);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatLocalProject(
  project: LocalProjectRow,
  reviewHistory: ProjectReviewHistoryRow[] = []
) {
  const isRecurringProject = isRecurringProjectKind(project.projectKind ?? "");
  const recurringBillingMode =
    cleanRecurringBillingMode(project.recurringBillingMode) || (isRecurringProject ? "monthlyFlat" : "");

  return {
    id: project.id,
    projectNumber: project.projectNumber,
    title: project.title,
    customer: project.customer ?? "",
    status: normalizeProjectStatus(project.status),
    statusCode: project.statusCode ?? "",
    description: project.description ?? "",
    contactId: project.contactId ?? "",
    contactPersonId: project.contactPersonId ?? "",
    addressContactId: project.addressContactId ?? "",
    objectAddressId: project.objectAddressId ?? "",
    projectType: project.projectType ?? "",
    businessAreaCode: getProjectBusinessAreaCode(project),
    projectKind: project.projectKind ?? "",
    projectRuntimeFrom: project.projectRuntimeFrom ?? "",
    projectRuntimeUntil: project.projectRuntimeUntil ?? "",
    billingInterval: project.billingInterval ?? "",
    recurringBillingMode,
    forecastBillingType: project.forecastBillingType ?? "",
    forecastNetAmount: project.forecastNetAmount ?? "",
    trade: project.trade ?? "",
    branch: project.branch ?? "",
    volume: project.volume ?? "",
    source: project.source ?? "",
    address: project.address ?? "",
    mapLatitude: project.mapLatitude,
    mapLongitude: project.mapLongitude,
    mapGeocodedAddress: project.mapGeocodedAddress ?? "",
    mapGeocodeProvider: project.mapGeocodeProvider ?? "",
    mapGeocodeStatus: project.mapGeocodeStatus || "pending",
    mapGeocodeConfidence: project.mapGeocodeConfidence,
    mapGeocodedAt: project.mapGeocodedAt?.toISOString() ?? "",
    participants: project.participants ?? "",
    responsibleName: project.responsibleName ?? "",
    deputyName: project.deputyName ?? "",
    deputyFrom: project.deputyFrom ?? "",
    deputyUntil: project.deputyUntil ?? "",
    createdAt: formatDateTime(project.createdAt),
    updatedAt: project.updatedAt.toISOString(),
    timeBudgetEnabled: Boolean(project.timeBudgetEnabled),
    timeBudgetHours: project.timeBudgetHours ?? "",
    timeBudgetHistory: cleanBudgetHistory(project.timeBudgetHistory),
    timeBudgetAllocations: cleanBudgetAllocations(project.timeBudgetAllocations),
    autoBillingEnabled: Boolean(project.autoBillingEnabled),
    autoBillingNetAmount: project.autoBillingNetAmount ?? "",
    autoBillingVatRate: project.autoBillingVatRate ?? "",
    autoBillingStartMonth: project.autoBillingStartMonth ?? "",
    autoBillingEndMonth: project.autoBillingEndMonth ?? "",
    autoBillingTemplateMode: project.autoBillingTemplateMode ?? "previous",
    autoBillingTemplate: project.autoBillingTemplate ?? null,
    winterGritPackageItemId: project.winterGritPackageItemId ?? "",
    winterGritPushPackageItemId: project.winterGritPushPackageItemId ?? "",
    reviewStatus: normalizeProjectReviewStatus(project.reviewStatus),
    reviewedAt: project.reviewedAt?.toISOString() ?? "",
    reviewedByUserId: project.reviewedByUserId ?? "",
    reviewedByName: project.reviewedByName ?? "",
    reviewNote: project.reviewNote ?? "",
    reviewedProjectStatus: project.reviewedProjectStatus ?? "",
    reviewHistory: reviewHistory.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      oldStatus: entry.oldStatus ?? "",
      newStatus: entry.newStatus,
      actorUserId: entry.actorUserId ?? "",
      actorName: entry.actorName,
      note: entry.note ?? "",
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

function normalizeProjectStatus(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("angebotserstellung") || normalized === "angebot") return "Angebot";
  if (
    normalized.includes("kundenentscheidung") ||
    normalized.includes("kundenrückmeldung") ||
    normalized.includes("kundenrueckmeldung")
  ) {
    return "Warten auf Kunde";
  }
  if (
    normalized.includes("umsetzungsplanung") ||
    normalized.includes("planungsphase") ||
    normalized.includes("planung bereit")
  ) {
    return "Zur Planung bereit";
  }
  if (
    normalized === "geplant" ||
    normalized.includes("fest geplant") ||
    normalized.includes("planungstermin")
  ) {
    return "Geplant";
  }
  if (normalized.includes("arbeit unterbrochen") || normalized.includes("unterbrochen")) return "Arbeit unterbrochen";
  if (normalized.includes("in umsetzung")) return "Umsetzung";
  if (normalized.includes("umsetzung")) return "Umsetzung";
  if (
    normalized.includes("abnahme") ||
    normalized.includes("endkontrolle") ||
    normalized.includes("abrechnungspr")
  ) {
    return "Abrechnungsprüfung";
  }
  if (normalized.includes("kundenrechnung") || normalized.includes("abrechnung")) {
    return "Zur Abrechnung bereit";
  }
  if (normalized.includes("abgeschlossen")) return "Abgeschlossen";
  if (normalized.includes("archiviert")) return "Archiviert";
  if (normalized.includes("reklamation") || normalized.includes("nacharbeit")) return "Abrechnungsprüfung";
  if (normalized.includes("neu") || normalized.includes("akquise") || normalized.includes("erstkontakt")) {
    return "Lead / Klärung";
  }

  return status || "Lead / Klärung";
}

async function getLocalProjects(organizationId: string) {
  await ensureLocalProjectTable();

  const [projects, reviewHistory] = await Promise.all([
    prisma.$queryRaw<LocalProjectRow[]>`
      SELECT *
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "createdAt" DESC
    `,
    prisma.$queryRaw<ProjectReviewHistoryRow[]>`
      SELECT *
      FROM "WorkPilotProjectReviewHistory"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "createdAt" DESC
    `,
  ]);
  const historyByProjectId = new Map<string, ProjectReviewHistoryRow[]>();
  for (const entry of reviewHistory) {
    historyByProjectId.set(entry.projectId, [
      ...(historyByProjectId.get(entry.projectId) ?? []),
      entry,
    ]);
  }

  return projects.map((project) =>
    formatLocalProject(project, historyByProjectId.get(project.id) ?? [])
  );
}

async function validateProjectContactReferences(
  organizationId: string,
  input: {
    contactId: string;
    contactPersonId: string;
    addressContactId: string;
  }
) {
  const contactIds = Array.from(
    new Set([input.contactId, input.contactPersonId, input.addressContactId].map(cleanString).filter(Boolean))
  );
  if (contactIds.length === 0) return null;

  const rows = await prisma.$queryRaw<Array<{ id: string; parentCompanyId: string | null }>>`
    SELECT "id", "parentCompanyId"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
      AND "id" IN (${Prisma.join(contactIds)})
  `;
  const foundIds = new Set(rows.map((row) => row.id));
  const missingIds = contactIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return `Kontaktbezug ist ungueltig oder gehoert nicht zur Organisation: ${missingIds.join(", ")}`;
  }

  const mainContactId = cleanString(input.contactId);
  const linkedContactIds = [cleanString(input.contactPersonId), cleanString(input.addressContactId)].filter(Boolean);
  if (mainContactId && linkedContactIds.length > 0) {
    const invalidLinkedIds = linkedContactIds.filter((id) => {
      const row = rows.find((candidate) => candidate.id === id);
      return row?.parentCompanyId && row.parentCompanyId !== mainContactId;
    });
    if (invalidLinkedIds.length > 0) {
      return `Ansprechpartner oder Adresskontakt passt nicht zum ausgewaehlten Hauptkontakt: ${invalidLinkedIds.join(", ")}`;
    }
  }

  return null;
}

async function validateProjectObjectAddress(
  organizationId: string,
  input: {
    contactId: string;
    addressContactId: string;
    objectAddressId: string;
    projectType: string;
    branch: string;
  }
) {
  const isImmocare = `${input.projectType} ${input.branch}`.toLowerCase().includes("immocare");
  if (input.objectAddressId) {
    const rows = await prisma.$queryRaw<Array<{ id: string; customerId: string; isActive: boolean }>>`
      SELECT "id", "customerId", "isActive"
      FROM "ObjectAddress"
      WHERE "organizationId" = ${organizationId}
        AND "id" = ${input.objectAddressId}
      LIMIT 1
    `;
    const address = rows[0];
    if (!address || !address.isActive) return "Die ausgewählte Objektadresse ist ungültig oder inaktiv.";
    if (input.contactId && address.customerId !== input.contactId) {
      return "Die ausgewählte Objektadresse gehört nicht zum Projektkunden.";
    }
    return null;
  }

  if (input.addressContactId) {
    const rows = await prisma.$queryRaw<Array<{ street: string | null; postalCode: string | null; city: string | null }>>`
      SELECT "street", "postalCode", "city"
      FROM "Contact"
      WHERE "organizationId" = ${organizationId}
        AND "id" = ${input.addressContactId}
      LIMIT 1
    `;
    const address = rows[0];
    if (address?.street?.trim() && address.postalCode?.trim() && address.city?.trim()) return null;
    return "Die ausgewählte Hauptadresse ist unvollständig.";
  }

  return isImmocare ? "Bitte wähle für das Immocare-Projekt eine Objektadresse aus." : null;
}

async function validateProjectReviewApproval(
  organizationId: string,
  project: LocalProjectRow
) {
  const offers = await prisma.offer.findMany({
    where: {
      organizationId,
      projectId: project.id,
    },
    select: { status: true },
  });
  return validateProjectReviewApprovalInput({
    ...project,
    offerStatuses: offers.map((offer) => offer.status),
  });
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const requestedActorId = searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  return NextResponse.json(await getLocalProjects(organization.id));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageProjects(actor)) {
    return forbiddenProjectResponse();
  }
  await ensureLocalProjectTable();

  const id = cleanString(body.id) || randomUUID();
  if (body.action === "set-review-status") {
    if (!canReviewProjects(actor)) {
      return NextResponse.json(
        { error: "Du darfst Projekte nicht fachlich freigeben." },
        { status: 403 }
      );
    }
    if (!projectReviewStatuses.includes(body.reviewStatus)) {
      return NextResponse.json(
        { error: "Der gewünschte Prüfstatus ist ungültig." },
        { status: 400 }
      );
    }
    const projectRows = await prisma.$queryRaw<LocalProjectRow[]>`
      SELECT *
      FROM "WorkPilotProject"
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
      LIMIT 1
    `;
    const project = projectRows[0];
    if (!project) {
      return NextResponse.json(
        { error: "Projekt wurde nicht gefunden." },
        { status: 404 }
      );
    }
    const reviewStatus = normalizeProjectReviewStatus(body.reviewStatus);
    if (reviewStatus === "approved") {
      const problems = await validateProjectReviewApproval(
        organization.id,
        project
      );
      if (problems.length > 0) {
        return NextResponse.json(
          {
            error:
              "Das Projekt kann noch nicht fachlich freigegeben werden: " +
              problems.join("; ") +
              ".",
          },
          { status: 400 }
        );
      }
    }
    const reviewNote = cleanString(body.reviewNote) || null;
    const reviewedAt = reviewStatus === "approved" ? new Date() : null;
    const reviewedByUserId = reviewStatus === "approved" ? actor.id : null;
    const reviewedByName =
      reviewStatus === "approved" ? getActorName(actor) : null;
    const reviewedProjectStatus =
      reviewStatus === "approved" ? project.status : null;
    const updatedRows = await prisma.$queryRaw<LocalProjectRow[]>`
      UPDATE "WorkPilotProject"
      SET
        "reviewStatus" = ${reviewStatus},
        "reviewedAt" = ${reviewedAt},
        "reviewedByUserId" = ${reviewedByUserId},
        "reviewedByName" = ${reviewedByName},
        "reviewNote" = ${reviewNote},
        "reviewedProjectStatus" = ${reviewedProjectStatus},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
      RETURNING *
    `;
    const historyRows = await prisma.$queryRaw<ProjectReviewHistoryRow[]>`
      INSERT INTO "WorkPilotProjectReviewHistory" (
        "id", "organizationId", "projectId", "eventType", "oldStatus",
        "newStatus", "actorUserId", "actorName", "note"
      )
      VALUES (
        ${randomUUID()}, ${organization.id}, ${id},
        ${reviewStatus === "approved" ? "review_approved" : "review_status_changed"},
        ${normalizeProjectReviewStatus(project.reviewStatus)},
        ${reviewStatus}, ${actor.id}, ${getActorName(actor)}, ${reviewNote}
      )
      RETURNING *
    `;
    const previousHistory = await prisma.$queryRaw<ProjectReviewHistoryRow[]>`
      SELECT *
      FROM "WorkPilotProjectReviewHistory"
      WHERE "organizationId" = ${organization.id}
        AND "projectId" = ${id}
        AND "id" <> ${historyRows[0].id}
      ORDER BY "createdAt" DESC
    `;
    return NextResponse.json(
      formatLocalProject(updatedRows[0], [
        historyRows[0],
        ...previousHistory,
      ])
    );
  }
  const projectNumber = cleanString(body.projectNumber);
  const title = cleanString(body.title);

  if (!projectNumber) {
    return NextResponse.json({ error: "Projektnummer fehlt." }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Projektname fehlt." }, { status: 400 });
  }

  const status = normalizeProjectStatus(cleanString(body.status));
  if (isArchivedProjectStatus(status) && !canArchiveProjects(actor)) {
    return forbiddenProjectArchiveResponse();
  }
  const contactReferenceError = await validateProjectContactReferences(organization.id, {
    contactId: cleanString(body.contactId),
    contactPersonId: cleanString(body.contactPersonId),
    addressContactId: cleanString(body.addressContactId),
  });
  if (contactReferenceError) {
    return NextResponse.json({ error: contactReferenceError }, { status: 400 });
  }
  const objectAddressError = await validateProjectObjectAddress(organization.id, {
    contactId: cleanString(body.contactId),
    addressContactId: cleanString(body.addressContactId),
    objectAddressId: cleanString(body.objectAddressId),
    projectType: cleanString(body.projectType),
    branch: cleanString(body.branch),
  });
  if (objectAddressError) {
    return NextResponse.json({ error: objectAddressError }, { status: 400 });
  }
  const currentRows = await prisma.$queryRaw<LocalProjectRow[]>`
    SELECT *
    FROM "WorkPilotProject"
    WHERE id = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const currentProject = currentRows[0] ?? null;
  const projectKind = cleanString(body.projectKind);
  const incomingRecurringBillingMode = cleanRecurringBillingMode(body.recurringBillingMode);
  if (isRecurringProjectKind(projectKind) && !incomingRecurringBillingMode && !currentProject) {
    return NextResponse.json(
      { error: "Bitte wähle das Abrechnungsmodell für diesen Dauerläufer aus." },
      { status: 400 }
    );
  }
  const recurringBillingMode =
    isRecurringProjectKind(projectKind) && !incomingRecurringBillingMode ? "monthlyFlat" : incomingRecurringBillingMode;
  const reviewCandidate: Record<string, unknown> = {
    projectNumber,
    title,
    contactId: cleanString(body.contactId),
    contactPersonId: cleanString(body.contactPersonId),
    addressContactId: cleanString(body.addressContactId),
    objectAddressId: cleanString(body.objectAddressId),
    projectType: cleanString(body.projectType),
    projectKind,
    projectRuntimeFrom: cleanString(body.projectRuntimeFrom),
    projectRuntimeUntil: cleanString(body.projectRuntimeUntil),
    billingInterval: cleanString(body.billingInterval),
    recurringBillingMode,
    forecastBillingType: cleanString(body.forecastBillingType),
    forecastNetAmount: cleanString(body.forecastNetAmount),
    trade: cleanString(body.trade),
    branch: cleanString(body.branch),
    address: cleanString(body.address),
    responsibleName: cleanString(body.responsibleName),
    timeBudgetEnabled: Boolean(body.timeBudgetEnabled),
    timeBudgetHours: cleanString(body.timeBudgetHours),
    autoBillingEnabled: Boolean(body.autoBillingEnabled),
    autoBillingNetAmount: cleanString(body.autoBillingNetAmount),
    autoBillingVatRate: cleanString(body.autoBillingVatRate),
    autoBillingStartMonth: cleanString(body.autoBillingStartMonth),
    autoBillingEndMonth: cleanString(body.autoBillingEndMonth),
    autoBillingTemplateMode: cleanString(body.autoBillingTemplateMode) || "previous",
  };
  const reviewWasInvalidated = Boolean(
    currentProject &&
      normalizeProjectReviewStatus(currentProject.reviewStatus) === "approved" &&
      hasProjectReviewRelevantChange(
        currentProject as unknown as Record<string, unknown>,
        reviewCandidate
      )
  );
  const reviewStatus = currentProject
    ? getProjectReviewStatusAfterEdit({
        previousStatus: currentProject.reviewStatus,
        hasRelevantChange: reviewWasInvalidated,
      })
    : "unreviewed";
  const reviewedAt = reviewWasInvalidated ? null : currentProject?.reviewedAt ?? null;
  const reviewedByUserId = reviewWasInvalidated
    ? null
    : currentProject?.reviewedByUserId ?? null;
  const reviewedByName = reviewWasInvalidated
    ? null
    : currentProject?.reviewedByName ?? null;
  const reviewNote = reviewWasInvalidated
    ? null
    : currentProject?.reviewNote ?? null;
  const reviewedProjectStatus = reviewWasInvalidated
    ? null
    : currentProject?.reviewedProjectStatus ?? null;

  const rows = await prisma.$queryRaw<LocalProjectRow[]>`
    INSERT INTO "WorkPilotProject" (
      "id",
      "organizationId",
      "projectNumber",
      "title",
      "customer",
      "status",
      "statusCode",
      "description",
      "contactId",
      "contactPersonId",
      "addressContactId",
      "objectAddressId",
      "projectType",
      "projectKind",
      "projectRuntimeFrom",
      "projectRuntimeUntil",
      "billingInterval",
      "recurringBillingMode",
      "forecastBillingType",
      "forecastNetAmount",
      "trade",
      "branch",
      "volume",
      "source",
      "address",
      "participants",
      "responsibleName",
      "deputyName",
      "deputyFrom",
      "deputyUntil",
      "timeBudgetEnabled",
      "timeBudgetHours",
      "timeBudgetHistory",
      "timeBudgetAllocations",
      "autoBillingEnabled",
      "autoBillingNetAmount",
      "autoBillingVatRate",
      "autoBillingStartMonth",
      "autoBillingEndMonth",
      "autoBillingTemplateMode",
      "autoBillingTemplate",
      "winterGritPackageItemId",
      "winterGritPushPackageItemId",
      "reviewStatus",
      "reviewedAt",
      "reviewedByUserId",
      "reviewedByName",
      "reviewNote",
      "reviewedProjectStatus"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${projectNumber},
      ${title},
      ${cleanString(body.customer) || null},
      ${status || "Lead / Klärung"},
      ${cleanString(body.statusCode) || null},
      ${cleanString(body.description) || null},
      ${cleanString(body.contactId) || null},
      ${cleanString(body.contactPersonId) || null},
      ${cleanString(body.addressContactId) || null},
      ${cleanString(body.objectAddressId) || null},
      ${cleanString(body.projectType) || null},
      ${projectKind || null},
      ${cleanString(body.projectRuntimeFrom) || null},
      ${cleanString(body.projectRuntimeUntil) || null},
      ${cleanString(body.billingInterval) || null},
      ${recurringBillingMode || null},
      ${cleanString(body.forecastBillingType) || null},
      ${cleanString(body.forecastNetAmount) || null},
      ${cleanString(body.trade) || null},
      ${cleanString(body.branch) || null},
      ${cleanString(body.volume) || null},
      ${cleanString(body.source) || null},
      ${cleanString(body.address) || null},
      ${cleanString(body.participants) || null},
      ${cleanString(body.responsibleName) || null},
      ${cleanString(body.deputyName) || null},
      ${cleanString(body.deputyFrom) || null},
      ${cleanString(body.deputyUntil) || null},
      ${Boolean(body.timeBudgetEnabled)},
      ${cleanString(body.timeBudgetHours) || null},
      ${JSON.stringify(cleanBudgetHistory(body.timeBudgetHistory))}::jsonb,
      ${JSON.stringify(cleanBudgetAllocations(body.timeBudgetAllocations))}::jsonb,
      ${Boolean(body.autoBillingEnabled)},
      ${cleanString(body.autoBillingNetAmount) || null},
      ${cleanString(body.autoBillingVatRate) || null},
      ${cleanString(body.autoBillingStartMonth) || null},
      ${cleanString(body.autoBillingEndMonth) || null},
      ${cleanString(body.autoBillingTemplateMode) || "previous"},
      ${JSON.stringify(body.autoBillingTemplate ?? null)}::jsonb,
      ${cleanString(body.winterGritPackageItemId) || null},
      ${cleanString(body.winterGritPushPackageItemId) || null},
      ${reviewStatus},
      ${reviewedAt},
      ${reviewedByUserId},
      ${reviewedByName},
      ${reviewNote},
      ${reviewedProjectStatus}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "projectNumber" = EXCLUDED."projectNumber",
      "title" = EXCLUDED."title",
      "customer" = EXCLUDED."customer",
      "status" = EXCLUDED."status",
      "statusCode" = EXCLUDED."statusCode",
      "description" = EXCLUDED."description",
      "contactId" = EXCLUDED."contactId",
      "contactPersonId" = EXCLUDED."contactPersonId",
      "addressContactId" = EXCLUDED."addressContactId",
      "objectAddressId" = EXCLUDED."objectAddressId",
      "projectType" = EXCLUDED."projectType",
      "projectKind" = EXCLUDED."projectKind",
      "projectRuntimeFrom" = EXCLUDED."projectRuntimeFrom",
      "projectRuntimeUntil" = EXCLUDED."projectRuntimeUntil",
      "billingInterval" = EXCLUDED."billingInterval",
      "recurringBillingMode" = EXCLUDED."recurringBillingMode",
      "forecastBillingType" = EXCLUDED."forecastBillingType",
      "forecastNetAmount" = EXCLUDED."forecastNetAmount",
      "trade" = EXCLUDED."trade",
      "branch" = EXCLUDED."branch",
      "volume" = EXCLUDED."volume",
      "source" = EXCLUDED."source",
      "address" = EXCLUDED."address",
      "mapLatitude" = CASE WHEN "WorkPilotProject"."address" IS DISTINCT FROM EXCLUDED."address" THEN NULL ELSE "WorkPilotProject"."mapLatitude" END,
      "mapLongitude" = CASE WHEN "WorkPilotProject"."address" IS DISTINCT FROM EXCLUDED."address" THEN NULL ELSE "WorkPilotProject"."mapLongitude" END,
      "mapGeocodedAddress" = CASE WHEN "WorkPilotProject"."address" IS DISTINCT FROM EXCLUDED."address" THEN NULL ELSE "WorkPilotProject"."mapGeocodedAddress" END,
      "mapGeocodeProvider" = CASE WHEN "WorkPilotProject"."address" IS DISTINCT FROM EXCLUDED."address" THEN NULL ELSE "WorkPilotProject"."mapGeocodeProvider" END,
      "mapGeocodeStatus" = CASE WHEN "WorkPilotProject"."address" IS DISTINCT FROM EXCLUDED."address" THEN 'pending' ELSE "WorkPilotProject"."mapGeocodeStatus" END,
      "mapGeocodeConfidence" = CASE WHEN "WorkPilotProject"."address" IS DISTINCT FROM EXCLUDED."address" THEN NULL ELSE "WorkPilotProject"."mapGeocodeConfidence" END,
      "mapGeocodedAt" = CASE WHEN "WorkPilotProject"."address" IS DISTINCT FROM EXCLUDED."address" THEN NULL ELSE "WorkPilotProject"."mapGeocodedAt" END,
      "participants" = EXCLUDED."participants",
      "responsibleName" = EXCLUDED."responsibleName",
      "deputyName" = EXCLUDED."deputyName",
      "deputyFrom" = EXCLUDED."deputyFrom",
      "deputyUntil" = EXCLUDED."deputyUntil",
      "timeBudgetEnabled" = EXCLUDED."timeBudgetEnabled",
      "timeBudgetHours" = EXCLUDED."timeBudgetHours",
      "timeBudgetHistory" = EXCLUDED."timeBudgetHistory",
      "timeBudgetAllocations" = EXCLUDED."timeBudgetAllocations",
      "autoBillingEnabled" = EXCLUDED."autoBillingEnabled",
      "autoBillingNetAmount" = EXCLUDED."autoBillingNetAmount",
      "autoBillingVatRate" = EXCLUDED."autoBillingVatRate",
      "autoBillingStartMonth" = EXCLUDED."autoBillingStartMonth",
      "autoBillingEndMonth" = EXCLUDED."autoBillingEndMonth",
      "autoBillingTemplateMode" = EXCLUDED."autoBillingTemplateMode",
      "autoBillingTemplate" = EXCLUDED."autoBillingTemplate",
      "winterGritPackageItemId" = EXCLUDED."winterGritPackageItemId",
      "winterGritPushPackageItemId" = EXCLUDED."winterGritPushPackageItemId",
      "reviewStatus" = EXCLUDED."reviewStatus",
      "reviewedAt" = EXCLUDED."reviewedAt",
      "reviewedByUserId" = EXCLUDED."reviewedByUserId",
      "reviewedByName" = EXCLUDED."reviewedByName",
      "reviewNote" = EXCLUDED."reviewNote",
      "reviewedProjectStatus" = EXCLUDED."reviewedProjectStatus",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const savedProject = rows[0];
  if (reviewWasInvalidated) {
    await prisma.$executeRaw`
      INSERT INTO "WorkPilotProjectReviewHistory" (
        "id", "organizationId", "projectId", "eventType", "oldStatus",
        "newStatus", "actorUserId", "actorName", "note"
      )
      VALUES (
        ${randomUUID()}, ${organization.id}, ${savedProject.id},
        'review_invalidated', 'approved', 'needs_review',
        ${actor.id}, ${getActorName(actor)},
        'Die fachliche Freigabe wurde automatisch aufgehoben, weil prüfrelevante Projektdaten geändert wurden.'
      )
    `;
  }
  const entityLabel = `${savedProject.projectNumber || savedProject.id} | ${savedProject.title}`;
  if (currentProject) {
    await recordStatusTransition({
      organizationId: organization.id,
      entityType: "project",
      entityId: savedProject.id,
      entityLabel,
      fromStatus: currentProject.status,
      toStatus: savedProject.status,
      actorUserId: actor.id,
      actorName: getActorName(actor),
      note: "Projektstatus geändert.",
    });
  } else {
    await seedCurrentStatusTimeline({
      organizationId: organization.id,
      entityType: "project",
      entityId: savedProject.id,
      entityLabel,
      status: savedProject.status,
      startedAt: savedProject.createdAt,
    });
  }

  const reviewHistory = await prisma.$queryRaw<ProjectReviewHistoryRow[]>`
    SELECT *
    FROM "WorkPilotProjectReviewHistory"
    WHERE "organizationId" = ${organization.id}
      AND "projectId" = ${savedProject.id}
    ORDER BY "createdAt" DESC
  `;
  return NextResponse.json(formatLocalProject(savedProject, reviewHistory), { status: 201 });
}

export async function PATCH(req: Request) {
  return POST(req);
}
