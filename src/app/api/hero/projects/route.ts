import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canArchiveProjects, canManageProjects } from "@/lib/permissions";
import { recordStatusTransition, seedCurrentStatusTimeline } from "@/lib/status-tracking";
import { getProjectBusinessAreaCode } from "@/lib/project-business-area";

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
  createdAt: Date;
  updatedAt: Date;
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
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
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

function formatLocalProject(project: LocalProjectRow) {
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
    participants: project.participants ?? "",
    responsibleName: project.responsibleName ?? "",
    deputyName: project.deputyName ?? "",
    deputyFrom: project.deputyFrom ?? "",
    deputyUntil: project.deputyUntil ?? "",
    createdAt: formatDateTime(project.createdAt),
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

  const projects = await prisma.$queryRaw<LocalProjectRow[]>`
    SELECT *
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
  `;

  return projects.map(formatLocalProject);
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
  const currentRows = await prisma.$queryRaw<Array<{ status: string; createdAt: Date }>>`
    SELECT status, "createdAt"
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
      "winterGritPushPackageItemId"
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
      ${cleanString(body.winterGritPushPackageItemId) || null}
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
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const savedProject = rows[0];
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

  return NextResponse.json(formatLocalProject(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  return POST(req);
}
