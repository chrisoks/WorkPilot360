import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionUserActor } from "@/lib/auth/actor";
import { canManageInvoices } from "@/lib/permissions";

type MonthlyFinancialReportValueRow = {
  id: string;
  organizationId: string;
  lineKey: string;
  effectiveMonth: string;
  amount: number | null;
  updatedByUserId: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const validLineKeys = new Set([
  "activated_own_work",
  "inventory_changes",
  "other_operating_income",
  "material_expenses",
  "personnel_expenses",
  "depreciation",
  "operating_costs",
  "sales_costs",
  "administration_costs",
  "participation_income",
  "securities_income",
  "interest_income",
  "financial_depreciation",
  "interest_expenses",
  "extraordinary_income",
  "extraordinary_expenses",
  "income_taxes",
  "other_taxes",
  "profit_carryforward",
  "distribution",
  "reserve_change",
]);

async function ensureMonthlyFinancialReportTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "MonthlyFinancialReportValue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "lineKey" TEXT NOT NULL,
      "effectiveMonth" TEXT NOT NULL,
      "amount" DOUBLE PRECISION,
      "updatedByUserId" TEXT,
      "updatedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "MonthlyFinancialReportValue"
    ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyFinancialReportValue_org_line_month_key"
    ON "MonthlyFinancialReportValue" ("organizationId", "lineKey", "effectiveMonth")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "MonthlyFinancialReportValue_org_month_idx"
    ON "MonthlyFinancialReportValue" ("organizationId", "effectiveMonth")
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestActor(users: User[], actorId: unknown) {
  const cleanActorId = cleanString(actorId);
  if (!cleanActorId) return null;
  const actor = users.find((candidate) => candidate.id === cleanActorId);
  return actor?.isActive ? actor : null;
}

function unauthorizedActorResponse() {
  return NextResponse.json({ error: "Aktiver Benutzer erforderlich." }, { status: 401 });
}

function forbiddenFinancialReportResponse() {
  return NextResponse.json({ error: "Du darfst Monatsberichtswerte nicht bearbeiten." }, { status: 403 });
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function cleanMonth(value: unknown) {
  const month = cleanString(value);
  return /^\d{4}-\d{2}$/.test(month) ? month : "";
}

function cleanAmount(value: unknown) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function formatRow(row: MonthlyFinancialReportValueRow) {
  return {
    id: row.id,
    lineKey: row.lineKey,
    effectiveMonth: row.effectiveMonth,
    amount: row.amount,
    updatedByUserId: row.updatedByUserId ?? "",
    updatedByName: row.updatedByName ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const requestedActorId = searchParams.get("actorId");
  const actor =
    getRequestActor(users, requestedActorId) ??
    (!cleanString(requestedActorId) ? await getSessionUserActor(req, users) : null);
  if (!actor) {
    return cleanString(requestedActorId) ? unauthorizedActorResponse() : NextResponse.json([]);
  }
  await ensureMonthlyFinancialReportTable();

  const rows = await prisma.$queryRaw<MonthlyFinancialReportValueRow[]>`
    SELECT *
    FROM "MonthlyFinancialReportValue"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "lineKey" ASC, "effectiveMonth" ASC
  `;

  return NextResponse.json(rows.map(formatRow));
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureMonthlyFinancialReportTable();

  const body = await req.json().catch(() => ({}));
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canManageInvoices(actor)) {
    return forbiddenFinancialReportResponse();
  }
  const lineKey = cleanString(body.lineKey);
  const effectiveMonth = cleanMonth(body.effectiveMonth);
  const amount = cleanAmount(body.amount);

  if (!validLineKeys.has(lineKey)) {
    return NextResponse.json({ error: "Berichtszeile ist ungültig." }, { status: 400 });
  }
  if (!effectiveMonth) {
    return NextResponse.json({ error: "Monat fehlt." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<MonthlyFinancialReportValueRow[]>`
    INSERT INTO "MonthlyFinancialReportValue" (
      "id", "organizationId", "lineKey", "effectiveMonth", "amount", "updatedByUserId", "updatedByName", "createdAt", "updatedAt"
    )
    VALUES (
      ${randomUUID()}, ${organization.id}, ${lineKey}, ${effectiveMonth}, ${amount}, ${actor.id},
      ${getUserName(actor)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("organizationId", "lineKey", "effectiveMonth")
    DO UPDATE SET
      "amount" = EXCLUDED."amount",
      "updatedByUserId" = EXCLUDED."updatedByUserId",
      "updatedByName" = EXCLUDED."updatedByName",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return NextResponse.json(formatRow(rows[0]));
}
