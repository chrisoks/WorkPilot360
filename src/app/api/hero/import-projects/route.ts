import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import {
  getHeroCustomerName,
  getHeroProjectDescription,
  getHeroProjectTitle,
  listHeroProjects,
} from "@/lib/hero/client";

export const dynamic = "force-dynamic";

type ImportedProjectRow = {
  id: string;
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
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;
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

export async function POST() {
  const { organization } = await getDemoContext();
  await ensureLocalProjectTable();

  const heroProjects = await listHeroProjects();
  let imported = 0;
  let skipped = 0;

  for (const project of heroProjects) {
    const rows = await prisma.$queryRaw<ImportedProjectRow[]>`
      INSERT INTO "WorkPilotProject" (
        "id",
        "organizationId",
        "projectNumber",
        "title",
        "customer",
        "status",
        "statusCode",
        "description"
      )
      VALUES (
        ${String(project.id)},
        ${organization.id},
        ${project.project_nr ?? ""},
        ${getHeroProjectTitle(project)},
        ${getHeroCustomerName(project) || null},
        ${normalizeProjectStatus(project.current_project_match_status?.name ?? "")},
        ${String(project.current_project_match_status?.status_code ?? "") || null},
        ${getHeroProjectDescription(project) || null}
      )
      ON CONFLICT ("id") DO NOTHING
      RETURNING "id"
    `;

    if (rows.length > 0) {
      imported += 1;
    } else {
      skipped += 1;
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    total: heroProjects.length,
  });
}
