import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { canManageMasterData } from "@/lib/permissions";

const defaultPlanningGroups = [
  { planningBoard: "OK solutions", planningGroup: "Marketing" },
  { planningBoard: "OK solutions", planningGroup: "Arb.Sich." },
  { planningBoard: "OK solutions", planningGroup: "HR" },
  { planningBoard: "OK immocare", planningGroup: "VZK" },
  { planningBoard: "OK immocare", planningGroup: "TZK" },
];

type PlanningGroupCapacityRow = {
  id: string;
  planningBoard: string;
  planningGroup: string;
  manualSvsPerHour: number | null;
  manualOverridesAutomatic: boolean;
  automaticOverridesManual: boolean;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const raw = cleanString(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function ensurePlanningGroupCapacityTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlanningGroupCapacitySetting" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "planningBoard" TEXT NOT NULL,
      "planningGroup" TEXT NOT NULL,
      "manualSvsPerHour" DOUBLE PRECISION,
      "manualOverridesAutomatic" BOOLEAN NOT NULL DEFAULT false,
      "automaticOverridesManual" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PlanningGroupCapacitySetting_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "PlanningGroupCapacitySetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PlanningGroupCapacitySetting_org_board_group_key"
    ON "PlanningGroupCapacitySetting" ("organizationId", "planningBoard", "planningGroup")
  `);
}

async function getRows(organizationId: string) {
  await ensurePlanningGroupCapacityTable();
  const savedRows = await prisma.$queryRaw<PlanningGroupCapacityRow[]>`
    SELECT
      "id",
      "planningBoard",
      "planningGroup",
      "manualSvsPerHour",
      "manualOverridesAutomatic",
      "automaticOverridesManual"
    FROM "PlanningGroupCapacitySetting"
    WHERE "organizationId" = ${organizationId}
  `;
  const savedByKey = new Map(savedRows.map((row) => [`${row.planningBoard}:${row.planningGroup}`, row]));

  return defaultPlanningGroups.map((group) => {
    const saved = savedByKey.get(`${group.planningBoard}:${group.planningGroup}`);
    return {
      id: saved?.id ?? "",
      planningBoard: group.planningBoard,
      planningGroup: group.planningGroup,
      manualSvsPerHour: saved?.manualSvsPerHour ?? null,
      manualOverridesAutomatic: saved?.manualOverridesAutomatic ?? false,
      automaticOverridesManual: saved?.automaticOverridesManual ?? true,
    };
  });
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  return NextResponse.json(await getRows(organization.id));
}

export async function PUT(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  if (!canManageMasterData(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Planungsgruppen-SVS pflegen." },
      { status: 403 }
    );
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  await ensurePlanningGroupCapacityTable();

  for (const row of rows) {
    const planningBoard = cleanString(row.planningBoard);
    const planningGroup = cleanString(row.planningGroup);
    if (!planningBoard || !planningGroup) continue;
    const isKnownGroup = defaultPlanningGroups.some(
      (group) => group.planningBoard === planningBoard && group.planningGroup === planningGroup
    );
    if (!isKnownGroup) continue;

    const manualSvsPerHour = cleanOptionalAmount(row.manualSvsPerHour);
    const manualOverridesAutomatic = Boolean(row.manualOverridesAutomatic);
    const automaticOverridesManual = Boolean(row.automaticOverridesManual);
    if (manualOverridesAutomatic && automaticOverridesManual) {
      return NextResponse.json(
        { error: "Bitte nur eine Übersteuerungsrichtung pro Planungsgruppe aktivieren." },
        { status: 400 }
      );
    }
    if (manualOverridesAutomatic && manualSvsPerHour === null) {
      return NextResponse.json(
        { error: "Wenn der manuelle Wert automatische Werte übersteuern soll, muss ein Ziel-SVS gepflegt sein." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "PlanningGroupCapacitySetting" (
        "id",
        "organizationId",
        "planningBoard",
        "planningGroup",
        "manualSvsPerHour",
        "manualOverridesAutomatic",
        "automaticOverridesManual",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${planningBoard},
        ${planningGroup},
        ${manualSvsPerHour},
        ${manualOverridesAutomatic},
        ${automaticOverridesManual},
        NOW(),
        NOW()
      )
      ON CONFLICT ("organizationId", "planningBoard", "planningGroup")
      DO UPDATE SET
        "manualSvsPerHour" = EXCLUDED."manualSvsPerHour",
        "manualOverridesAutomatic" = EXCLUDED."manualOverridesAutomatic",
        "automaticOverridesManual" = EXCLUDED."automaticOverridesManual",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  return NextResponse.json(await getRows(organization.id));
}
