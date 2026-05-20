import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

const defaultBusinessAreas = ["Marketing", "Arbeitssicherheit", "HR", "immocare"];
const defaultTargetMonths = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

type BusinessAreaTargetRow = {
  id: string;
  businessAreaId: string;
  businessAreaName: string;
  month: string;
  amount: number;
};

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function cleanAmount(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function canManageTargets(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

async function ensureBusinessAreaTargetTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BusinessArea" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BusinessArea_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "BusinessArea_organizationId_name_key" UNIQUE ("organizationId", "name"),
      CONSTRAINT "BusinessArea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BusinessAreaTarget" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "businessAreaId" TEXT NOT NULL,
      "month" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BusinessAreaTarget_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "BusinessAreaTarget_businessAreaId_fkey" FOREIGN KEY ("businessAreaId") REFERENCES "BusinessArea"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "BusinessAreaTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "BusinessAreaTarget_organizationId_businessAreaId_month_key"
    ON "BusinessAreaTarget" ("organizationId", "businessAreaId", "month")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BusinessAreaTarget_organizationId_month_idx"
    ON "BusinessAreaTarget" ("organizationId", "month")
  `);
}

async function ensureBusinessAreas(organizationId: string) {
  await ensureBusinessAreaTargetTables();
  for (const name of defaultBusinessAreas) {
    await prisma.$executeRaw`
      INSERT INTO "BusinessArea" ("id", "organizationId", "name", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${organizationId}, ${name}, NOW(), NOW())
      ON CONFLICT ("organizationId", "name") DO NOTHING
    `;
  }
}

async function migrateYearlyTargetsToRecurringMonths(organizationId: string) {
  await prisma.$executeRaw`
    INSERT INTO "BusinessAreaTarget" ("id", "organizationId", "businessAreaId", "month", "amount", "createdAt", "updatedAt")
    SELECT md5(source."organizationId" || ':' || source."businessAreaId" || ':' || source."recurringMonth"),
      source."organizationId",
      source."businessAreaId",
      source."recurringMonth",
      source."amount",
      NOW(),
      NOW()
    FROM (
      SELECT DISTINCT ON ("businessAreaId", RIGHT("month", 2))
        "organizationId",
        "businessAreaId",
        RIGHT("month", 2) AS "recurringMonth",
        "amount",
        "updatedAt"
      FROM "BusinessAreaTarget"
      WHERE "organizationId" = ${organizationId}
        AND "month" ~ '^[0-9]{4}-[0-9]{2}$'
      ORDER BY "businessAreaId", RIGHT("month", 2), "updatedAt" DESC
    ) source
    WHERE NOT EXISTS (
      SELECT 1
      FROM "BusinessAreaTarget" target
      WHERE target."organizationId" = source."organizationId"
        AND target."businessAreaId" = source."businessAreaId"
        AND target."month" = source."recurringMonth"
    )
  `;
}

async function getTargetRows(organizationId: string, months: string[]) {
  return prisma.$queryRaw<BusinessAreaTargetRow[]>`
    SELECT
      COALESCE(t."id", '') AS "id",
      b."id" AS "businessAreaId",
      b."name" AS "businessAreaName",
      m."month" AS "month",
      COALESCE(t."amount", 0) AS "amount"
    FROM "BusinessArea" b
    CROSS JOIN UNNEST(${months}::text[]) AS m("month")
    LEFT JOIN "BusinessAreaTarget" t
      ON t."businessAreaId" = b."id"
      AND t."organizationId" = b."organizationId"
      AND t."month" = m."month"
    WHERE b."organizationId" = ${organizationId}
      AND LOWER(b."name") <> 'interne arbeiten'
    ORDER BY
      m."month" ASC,
      CASE b."name"
        WHEN 'Marketing' THEN 1
        WHEN 'Arbeitssicherheit' THEN 2
        WHEN 'HR' THEN 3
        WHEN 'immocare' THEN 4
        WHEN 'interne Arbeiten' THEN 5
        ELSE 99
      END,
      b."name" ASC
  `;
}

export async function GET(req: Request) {
  const { organization } = await getDemoContext();
  await ensureBusinessAreas(organization.id);
  await migrateYearlyTargetsToRecurringMonths(organization.id);
  const { searchParams } = new URL(req.url);
  const months = cleanString(searchParams.get("months"))
    .split(",")
    .map((month) => month.trim())
    .filter((month) => /^(?:\d{4}-)?\d{2}$/.test(month));

  return NextResponse.json(await getTargetRows(organization.id, months.length > 0 ? months : defaultTargetMonths));
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTargets(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschaeftsfuehrung duerfen Geschaeftsbereich-Sollwerte pflegen." },
      { status: 403 }
    );
  }

  await ensureBusinessAreas(organization.id);
  await migrateYearlyTargetsToRecurringMonths(organization.id);
  const rows = Array.isArray(body.targets) ? body.targets : [];
  const months: string[] = [];

  for (const row of rows) {
    const businessAreaId = cleanString(row.businessAreaId);
    const month = cleanString(row.month);
    if (!businessAreaId || !/^(?:\d{4}-)?\d{2}$/.test(month)) continue;
    months.push(month);
    await prisma.$executeRaw`
      INSERT INTO "BusinessAreaTarget" ("id", "organizationId", "businessAreaId", "month", "amount", "createdAt", "updatedAt")
      SELECT ${randomUUID()}, ${organization.id}, b."id", ${month}, ${cleanAmount(row.amount)}, NOW(), NOW()
      FROM "BusinessArea" b
      WHERE b."organizationId" = ${organization.id}
        AND b."id" = ${businessAreaId}
      ON CONFLICT ("organizationId", "businessAreaId", "month")
      DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  const uniqueMonths = Array.from(new Set(months)).sort();
  return NextResponse.json(await getTargetRows(organization.id, uniqueMonths));
}
