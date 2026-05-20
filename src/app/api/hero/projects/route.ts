import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

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
  projectType: string | null;
  projectKind: string | null;
  projectRuntimeFrom: string | null;
  projectRuntimeUntil: string | null;
  billingInterval: string | null;
  forecastBillingType: string | null;
  forecastNetAmount: string | null;
  trade: string | null;
  branch: string | null;
  volume: string | null;
  source: string | null;
  address: string | null;
  participants: string | null;
  responsibleName: string | null;
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
      "projectType" TEXT,
      "projectKind" TEXT,
      "projectRuntimeFrom" TEXT,
      "projectRuntimeUntil" TEXT,
      "billingInterval" TEXT,
      "forecastBillingType" TEXT,
      "forecastNetAmount" TEXT,
      "trade" TEXT,
      "branch" TEXT,
      "volume" TEXT,
      "source" TEXT,
      "address" TEXT,
      "participants" TEXT,
      "responsibleName" TEXT,
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
    ADD COLUMN IF NOT EXISTS "projectType" TEXT,
    ADD COLUMN IF NOT EXISTS "projectKind" TEXT,
    ADD COLUMN IF NOT EXISTS "projectRuntimeFrom" TEXT,
    ADD COLUMN IF NOT EXISTS "projectRuntimeUntil" TEXT,
    ADD COLUMN IF NOT EXISTS "billingInterval" TEXT,
    ADD COLUMN IF NOT EXISTS "forecastBillingType" TEXT,
    ADD COLUMN IF NOT EXISTS "forecastNetAmount" TEXT,
    ADD COLUMN IF NOT EXISTS "trade" TEXT,
    ADD COLUMN IF NOT EXISTS "branch" TEXT,
    ADD COLUMN IF NOT EXISTS "volume" TEXT,
    ADD COLUMN IF NOT EXISTS "source" TEXT,
    ADD COLUMN IF NOT EXISTS "address" TEXT,
    ADD COLUMN IF NOT EXISTS "participants" TEXT,
    ADD COLUMN IF NOT EXISTS "responsibleName" TEXT,
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
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    projectType: project.projectType ?? "",
    projectKind: project.projectKind ?? "",
    projectRuntimeFrom: project.projectRuntimeFrom ?? "",
    projectRuntimeUntil: project.projectRuntimeUntil ?? "",
    billingInterval: project.billingInterval ?? "",
    forecastBillingType: project.forecastBillingType ?? "",
    forecastNetAmount: project.forecastNetAmount ?? "",
    trade: project.trade ?? "",
    branch: project.branch ?? "",
    volume: project.volume ?? "",
    source: project.source ?? "",
    address: project.address ?? "",
    participants: project.participants ?? "",
    responsibleName: project.responsibleName ?? "",
    createdAt: formatDateTime(project.createdAt),
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
  if (normalized.includes("umsetzung")) return "Umsetzung";
  if (normalized.includes("abnahme") || normalized.includes("endkontrolle")) return "Endkontrolle";
  if (normalized.includes("kundenrechnung") || normalized.includes("abrechnung")) {
    return "Zur Abrechnung bereit";
  }
  if (normalized.includes("abgeschlossen")) return "Abgeschlossen";
  if (normalized.includes("archiviert")) return "Archiviert";
  if (normalized.includes("reklamation") || normalized.includes("nacharbeit")) return "Endkontrolle";
  if (normalized.includes("neu") || normalized.includes("akquise") || normalized.includes("erstkontakt")) {
    return "Lead / Klärung";
  }

  return status || "Lead / Klärung";
}

async function getLocalProjects() {
  const { organization } = await getDemoContext();
  await ensureLocalProjectTable();

  const projects = await prisma.$queryRaw<LocalProjectRow[]>`
    SELECT *
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;

  return projects.map(formatLocalProject);
}

export async function GET() {
  return NextResponse.json(await getLocalProjects());
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
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
      "projectType",
      "projectKind",
      "projectRuntimeFrom",
      "projectRuntimeUntil",
      "billingInterval",
      "forecastBillingType",
      "forecastNetAmount",
      "trade",
      "branch",
      "volume",
      "source",
      "address",
      "participants",
      "responsibleName",
      "timeBudgetHours",
      "timeBudgetHistory",
      "timeBudgetAllocations",
      "autoBillingEnabled",
      "autoBillingNetAmount",
      "autoBillingVatRate",
      "autoBillingStartMonth",
      "autoBillingEndMonth",
      "autoBillingTemplateMode",
      "autoBillingTemplate"
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
      ${cleanString(body.projectType) || null},
      ${cleanString(body.projectKind) || null},
      ${cleanString(body.projectRuntimeFrom) || null},
      ${cleanString(body.projectRuntimeUntil) || null},
      ${cleanString(body.billingInterval) || null},
      ${cleanString(body.forecastBillingType) || null},
      ${cleanString(body.forecastNetAmount) || null},
      ${cleanString(body.trade) || null},
      ${cleanString(body.branch) || null},
      ${cleanString(body.volume) || null},
      ${cleanString(body.source) || null},
      ${cleanString(body.address) || null},
      ${cleanString(body.participants) || null},
      ${cleanString(body.responsibleName) || null},
      ${cleanString(body.timeBudgetHours) || null},
      ${JSON.stringify(cleanBudgetHistory(body.timeBudgetHistory))}::jsonb,
      ${JSON.stringify(cleanBudgetAllocations(body.timeBudgetAllocations))}::jsonb,
      ${Boolean(body.autoBillingEnabled)},
      ${cleanString(body.autoBillingNetAmount) || null},
      ${cleanString(body.autoBillingVatRate) || null},
      ${cleanString(body.autoBillingStartMonth) || null},
      ${cleanString(body.autoBillingEndMonth) || null},
      ${cleanString(body.autoBillingTemplateMode) || "previous"},
      ${JSON.stringify(body.autoBillingTemplate ?? null)}::jsonb
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
      "projectType" = EXCLUDED."projectType",
      "projectKind" = EXCLUDED."projectKind",
      "projectRuntimeFrom" = EXCLUDED."projectRuntimeFrom",
      "projectRuntimeUntil" = EXCLUDED."projectRuntimeUntil",
      "billingInterval" = EXCLUDED."billingInterval",
      "forecastBillingType" = EXCLUDED."forecastBillingType",
      "forecastNetAmount" = EXCLUDED."forecastNetAmount",
      "trade" = EXCLUDED."trade",
      "branch" = EXCLUDED."branch",
      "volume" = EXCLUDED."volume",
      "source" = EXCLUDED."source",
      "address" = EXCLUDED."address",
      "participants" = EXCLUDED."participants",
      "responsibleName" = EXCLUDED."responsibleName",
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
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return NextResponse.json(formatLocalProject(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  return POST(req);
}
