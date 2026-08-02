import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canAccessEmployeeCosts } from "@/lib/permissions";
import {
  employeeCostDefaults,
  EmployeeCostManagementServiceError,
  type EmployeeCostField,
  type EmployeeCostValues,
  evaluateEmployeeCostChange,
  executeEmployeeCostChange,
} from "@/lib/employee-costs/employee-cost-management-service";

type EmployeeCostRow = {
  id: string;
  organizationId: string;
  userId: string;
  monthlySalary: number;
  fullCostFactor: number;
  annualHours: number;
  vacationDays: number;
  trainingDays: number;
  sickDays: number;
  hoursPerDay: number;
  updatedByUserId: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const defaultCost = employeeCostDefaults;

function formatCost(row: EmployeeCostRow | null, userId: string) {
  return {
    id: row?.id ?? "",
    userId,
    monthlySalary: row?.monthlySalary ?? defaultCost.monthlySalary,
    fullCostFactor: row?.fullCostFactor ?? defaultCost.fullCostFactor,
    annualHours: row?.annualHours ?? defaultCost.annualHours,
    vacationDays: row?.vacationDays ?? defaultCost.vacationDays,
    trainingDays: row?.trainingDays ?? defaultCost.trainingDays,
    sickDays: row?.sickDays ?? defaultCost.sickDays,
    hoursPerDay: row?.hoursPerDay ?? defaultCost.hoursPerDay,
    updatedByUserId: row?.updatedByUserId ?? "",
    updatedByName: row?.updatedByName ?? "",
    createdAt: row?.createdAt?.toISOString() ?? "",
    updatedAt: row?.updatedAt?.toISOString() ?? "",
  };
}

async function ensureEmployeeCostTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "EmployeeCostCalculation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "monthlySalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "fullCostFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.35,
      "annualHours" DOUBLE PRECISION NOT NULL DEFAULT 2080,
      "vacationDays" DOUBLE PRECISION NOT NULL DEFAULT 30,
      "trainingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "sickDays" DOUBLE PRECISION NOT NULL DEFAULT 10,
      "hoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
      "updatedByUserId" TEXT,
      "updatedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmployeeCostCalculation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeCostCalculation_organizationId_userId_key"
    ON "EmployeeCostCalculation" ("organizationId", "userId")
  `;
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getActorName(actor: { firstName: string; lastName: string }) {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

async function assertTargetEmployee(organizationId: string, userId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "User" WHERE id = ${userId} AND "organizationId" = ${organizationId} LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function GET(request: Request) {
  const { organization, users } = await getDemoContext();
  await ensureEmployeeCostTable();

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "";
  const actorId = url.searchParams.get("actorId") ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  const actorResult = await getSessionBoundActor(request, users, actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canAccessEmployeeCosts(actor)) {
    return NextResponse.json({ error: "Kein Zugriff auf Lohnkosten." }, { status: 403 });
  }

  const targetExists = await assertTargetEmployee(organization.id, userId);
  if (!targetExists) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
  }

  const rows = await prisma.$queryRaw<EmployeeCostRow[]>`
    SELECT *
    FROM "EmployeeCostCalculation"
    WHERE "organizationId" = ${organization.id} AND "userId" = ${userId}
    LIMIT 1
  `;

  return NextResponse.json(formatCost(rows[0] ?? null, userId));
}

export async function PUT(request: Request) {
  const { organization, users } = await getDemoContext();
  await ensureEmployeeCostTable();

  const body = await readJsonBody(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  const actorId = typeof body.actorId === "string" ? body.actorId : "";

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  const actorResult = await getSessionBoundActor(request, users, actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canAccessEmployeeCosts(actor)) {
    return NextResponse.json({ error: "Kein Zugriff auf Lohnkosten." }, { status: 403 });
  }

  const targetExists = await assertTargetEmployee(organization.id, userId);
  if (!targetExists) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
  }

  const changes: EmployeeCostValues = {};
  for (const field of Object.keys(employeeCostDefaults) as EmployeeCostField[]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) changes[field] = body[field];
  }

  try {
    const evaluation = await evaluateEmployeeCostChange({ organizationId: organization.id, userId, changes });
    if (evaluation.blockingIssues.length) return NextResponse.json({ error: evaluation.blockingIssues.join(" · "), evaluation }, { status: 400 });
    const row = await prisma.$transaction(
      (tx) => executeEmployeeCostChange({
        tx,
        organizationId: organization.id,
        userId,
        changes,
        actorId: actor.id,
        actorName: getActorName(actor),
        requestId: `employee-cost-ui:${randomUUID()}`,
        expectedFingerprint: evaluation.fingerprint,
        source: "employee-cost-ui",
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json(formatCost(row, userId));
  } catch (error) {
    if (error instanceof EmployeeCostManagementServiceError) {
      const status = error.code === "not_found" ? 404 : error.code === "stale_context" ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
