import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

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

const allowedNames = new Set(["ramona eid", "christian eid"]);

const defaultCost = {
  monthlySalary: 0,
  fullCostFactor: 1.35,
  annualHours: 2080,
  vacationDays: 30,
  trainingDays: 0,
  sickDays: 10,
  hoursPerDay: 8,
};

function parseNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

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

async function getAllowedActor(organizationId: string, actorId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; firstName: string; lastName: string }>>`
    SELECT id, "firstName", "lastName"
    FROM "User"
    WHERE id = ${actorId} AND "organizationId" = ${organizationId}
    LIMIT 1
  `;
  const actor = rows[0];
  if (!actor) return null;

  const normalizedName = `${actor.firstName} ${actor.lastName}`.trim().toLowerCase();
  return allowedNames.has(normalizedName) ? { ...actor, name: `${actor.firstName} ${actor.lastName}` } : null;
}

async function assertTargetEmployee(organizationId: string, userId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "User" WHERE id = ${userId} AND "organizationId" = ${organizationId} LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function GET(request: Request) {
  const { organization } = await getDemoContext();
  await ensureEmployeeCostTable();

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "";
  const actorId = url.searchParams.get("actorId") ?? "";

  if (!userId || !actorId) {
    return NextResponse.json({ error: "Mitarbeiter und Benutzer fehlen." }, { status: 400 });
  }

  const actor = await getAllowedActor(organization.id, actorId);
  if (!actor) {
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
  const { organization } = await getDemoContext();
  await ensureEmployeeCostTable();

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const actorId = typeof body.actorId === "string" ? body.actorId : "";

  if (!userId || !actorId) {
    return NextResponse.json({ error: "Mitarbeiter und Benutzer fehlen." }, { status: 400 });
  }

  const actor = await getAllowedActor(organization.id, actorId);
  if (!actor) {
    return NextResponse.json({ error: "Kein Zugriff auf Lohnkosten." }, { status: 403 });
  }

  const targetExists = await assertTargetEmployee(organization.id, userId);
  if (!targetExists) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
  }

  const monthlySalary = parseNumber(body.monthlySalary, defaultCost.monthlySalary);
  const fullCostFactor = parseNumber(body.fullCostFactor, defaultCost.fullCostFactor);
  const annualHours = parseNumber(body.annualHours, defaultCost.annualHours);
  const vacationDays = parseNumber(body.vacationDays, defaultCost.vacationDays);
  const trainingDays = parseNumber(body.trainingDays, defaultCost.trainingDays);
  const sickDays = parseNumber(body.sickDays, defaultCost.sickDays);
  const hoursPerDay = parseNumber(body.hoursPerDay, defaultCost.hoursPerDay);

  const rows = await prisma.$queryRaw<EmployeeCostRow[]>`
    INSERT INTO "EmployeeCostCalculation" (
      id,
      "organizationId",
      "userId",
      "monthlySalary",
      "fullCostFactor",
      "annualHours",
      "vacationDays",
      "trainingDays",
      "sickDays",
      "hoursPerDay",
      "updatedByUserId",
      "updatedByName",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${userId},
      ${monthlySalary},
      ${fullCostFactor},
      ${annualHours},
      ${vacationDays},
      ${trainingDays},
      ${sickDays},
      ${hoursPerDay},
      ${actor.id},
      ${actor.name},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("organizationId", "userId") DO UPDATE SET
      "monthlySalary" = EXCLUDED."monthlySalary",
      "fullCostFactor" = EXCLUDED."fullCostFactor",
      "annualHours" = EXCLUDED."annualHours",
      "vacationDays" = EXCLUDED."vacationDays",
      "trainingDays" = EXCLUDED."trainingDays",
      "sickDays" = EXCLUDED."sickDays",
      "hoursPerDay" = EXCLUDED."hoursPerDay",
      "updatedByUserId" = EXCLUDED."updatedByUserId",
      "updatedByName" = EXCLUDED."updatedByName",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return NextResponse.json(formatCost(rows[0], userId));
}
