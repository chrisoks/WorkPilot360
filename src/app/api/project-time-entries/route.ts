import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canApproveProjectOvertime, canManageProjectTimeEntries, canViewInternalCostData } from "@/lib/permissions";

type DemoUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
};

type ProjectTimeEntryRow = {
  id: string;
  organizationId: string;
  mode: string | null;
  projectId: string;
  projectLabel: string | null;
  trade: string | null;
  planningEntryId: string | null;
  planningBillingGroupId: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  userId: string | null;
  employee: string | null;
  entrySource: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMs: bigint | number;
  pauseMs: bigint | number;
  laborCostRateSnapshot: number;
  laborCostSnapshot: number;
  costSnapshotAt: Date | null;
  comment: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  marketingContentItemId: string | null;
  marketingContentType: string | null;
  completionStatus: string | null;
  overtimeApprovalStatus: string | null;
  overtimeApprovedByUserId: string | null;
  overtimeApprovedByName: string | null;
  overtimeApprovedAt: Date | null;
  editHistory: unknown;
  deletedAt: Date | null;
  createdAt: Date;
};

async function ensureProjectTimeEntryTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectTimeEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'project',
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "trade" TEXT,
      "planningEntryId" TEXT,
      "planningBillingGroupId" TEXT,
      "billingCatalogItemId" TEXT,
      "billingCatalogItemLabel" TEXT,
      "userId" TEXT,
      "employee" TEXT,
      "entrySource" TEXT NOT NULL DEFAULT 'stamped',
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMs" BIGINT NOT NULL DEFAULT 0,
      "pauseMs" BIGINT NOT NULL DEFAULT 0,
      "laborCostRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "costSnapshotAt" TIMESTAMP(3),
      "comment" TEXT,
      "invoiceId" TEXT,
      "invoiceNumber" TEXT,
      "invoicedAt" TIMESTAMP(3),
      "completionStatus" TEXT,
      "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'not_required',
      "overtimeApprovedByUserId" TEXT,
      "overtimeApprovedByName" TEXT,
      "overtimeApprovedAt" TIMESTAMP(3),
      "editHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "deletedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "userId" TEXT,
    ADD COLUMN IF NOT EXISTS "trade" TEXT,
    ADD COLUMN IF NOT EXISTS "planningEntryId" TEXT,
    ADD COLUMN IF NOT EXISTS "planningBillingGroupId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "entrySource" TEXT NOT NULL DEFAULT 'stamped',
    ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "laborCostRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "costSnapshotAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentType" TEXT,
    ADD COLUMN IF NOT EXISTS "completionStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "editHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: Pick<DemoUser, "firstName" | "lastName" | "email">) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function getRequestUser(users: DemoUser[], userId: unknown) {
  if (typeof userId !== "string" || !userId.trim()) {
    return null;
  }

  return users.find((user) => user.id === userId.trim() && user.isActive) ?? null;
}

function formatDateKeyDisplay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value || "-";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function parseMilliseconds(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function isHourlyRecurringProject(organizationId: string, projectId: string) {
  if (!projectId || projectId === "__unproductive__") return false;

  const rows = await prisma.$queryRaw<Array<{ projectKind: string | null; recurringBillingMode: string | null }>>`
    SELECT "projectKind", "recurringBillingMode"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  const project = rows[0];
  if (!project) return false;

  return (
    project.recurringBillingMode === "hourly" &&
    (project.projectKind ?? "").toLowerCase().includes("dauerl")
  );
}

async function getEmployeeHourlyCostRateSnapshot(organizationId: string, userId: string) {
  if (!userId) return 0;
  const rows = await prisma.$queryRaw<Array<{
    monthlySalary: number;
    fullCostFactor: number;
    annualHours: number;
    vacationDays: number;
    trainingDays: number;
    sickDays: number;
    hoursPerDay: number;
  }>>`
    SELECT "monthlySalary", "fullCostFactor", "annualHours", "vacationDays", "trainingDays", "sickDays", "hoursPerDay"
    FROM "EmployeeCostCalculation"
    WHERE "organizationId" = ${organizationId} AND "userId" = ${userId}
    LIMIT 1
  `;
  const cost = rows[0];
  if (!cost) return 0;
  const deductionHours =
    (Number(cost.vacationDays || 0) + Number(cost.trainingDays || 0) + Number(cost.sickDays || 0)) *
    Number(cost.hoursPerDay || 0);
  const sellableAnnualHours = Math.max(0, Number(cost.annualHours || 0) - deductionHours);
  if (sellableAnnualHours <= 0) return 0;
  return roundMoney((Number(cost.monthlySalary || 0) * 12 * Number(cost.fullCostFactor || 0)) / sellableAnnualHours);
}

function normalizeDateKeyValue(value: string) {
  const trimmedValue = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) return trimmedValue;

  const germanMatch = trimmedValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})/);
  if (!germanMatch) return trimmedValue;

  const [, dayValue, monthValue, yearValue] = germanMatch;
  const parsedYear = Number(yearValue);
  const year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;

  return `${year}-${monthValue.padStart(2, "0")}-${dayValue.padStart(2, "0")}`;
}

function formatEntry(entry: ProjectTimeEntryRow, options: { includeInternalCosts?: boolean } = {}) {
  const includeInternalCosts = options.includeInternalCosts === true;
  return {
    id: entry.id,
    mode: entry.mode === "unproductive" ? "unproductive" : "project",
    projectId: entry.projectId,
    projectLabel: entry.projectLabel ?? "",
    trade: entry.trade ?? "",
    planningEntryId: entry.planningEntryId ?? "",
    planningBillingGroupId: entry.planningBillingGroupId ?? "",
    billingCatalogItemId: entry.billingCatalogItemId ?? "",
    billingCatalogItemLabel: entry.billingCatalogItemLabel ?? "",
    userId: entry.userId ?? "",
    employee: entry.employee ?? "",
    entrySource: entry.entrySource === "manual" ? "manual" : "stamped",
    date: normalizeDateKeyValue(entry.date),
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMs: Number(entry.durationMs),
    pauseMs: Number(entry.pauseMs),
    laborCostRateSnapshot: includeInternalCosts ? Number(entry.laborCostRateSnapshot ?? 0) : 0,
    laborCostSnapshot: includeInternalCosts ? Number(entry.laborCostSnapshot ?? 0) : 0,
    costSnapshotAt: includeInternalCosts ? entry.costSnapshotAt?.toISOString() ?? "" : "",
    comment: entry.comment ?? "",
    invoiceId: entry.invoiceId ?? "",
    invoiceNumber: entry.invoiceNumber ?? "",
    invoicedAt: entry.invoicedAt?.toISOString() ?? "",
    marketingContentItemId: entry.marketingContentItemId ?? "",
    marketingContentType: entry.marketingContentType ?? "",
    completionStatus:
      entry.completionStatus === "finished" || entry.completionStatus === "interrupted"
        ? entry.completionStatus
        : "",
    overtimeApprovalStatus:
      entry.overtimeApprovalStatus === "pending" || entry.overtimeApprovalStatus === "approved"
        ? entry.overtimeApprovalStatus
        : "not_required",
    overtimeApprovedByUserId: entry.overtimeApprovedByUserId ?? "",
    overtimeApprovedByName: entry.overtimeApprovedByName ?? "",
    overtimeApprovedAt: entry.overtimeApprovedAt?.toISOString() ?? "",
    editHistory: Array.isArray(entry.editHistory) ? entry.editHistory : [],
    deletedAt: entry.deletedAt?.toISOString() ?? "",
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  const requestedActorId = searchParams.get("actorUserId");
  const projectIdFilter = cleanString(searchParams.get("projectId"));
  const includeDeleted = searchParams.get("includeDeleted") === "1";
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    if (!requestedActorId && actorResult.status === 401) {
      return NextResponse.json([]);
    }

    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const includeInternalCosts = canViewInternalCostData(actor);

  const canManageTimeEntries = canManageProjectTimeEntries(actor);
  const entries = projectIdFilter
    ? canManageTimeEntries
      ? includeDeleted
        ? await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
            ORDER BY "createdAt" DESC
          `
        : await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
              AND "deletedAt" IS NULL
            ORDER BY "createdAt" DESC
          `
      : includeDeleted
        ? await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
              AND "userId" = ${actor.id}
            ORDER BY "createdAt" DESC
          `
        : await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
              AND "userId" = ${actor.id}
              AND "deletedAt" IS NULL
            ORDER BY "createdAt" DESC
          `
    : canManageTimeEntries
      ? await prisma.$queryRaw<ProjectTimeEntryRow[]>`
          SELECT *
          FROM "ProjectTimeEntry"
          WHERE "organizationId" = ${organization.id}
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
        `
      : await prisma.$queryRaw<ProjectTimeEntryRow[]>`
          SELECT *
          FROM "ProjectTimeEntry"
          WHERE "organizationId" = ${organization.id}
            AND "userId" = ${actor.id}
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
        `;

  return NextResponse.json(entries.map((entry) => formatEntry(entry, { includeInternalCosts })));
}

export async function POST(req: Request) {
  const body = await req.json();
  const mode = cleanString(body.mode) === "unproductive" ? "unproductive" : "project";
  const projectId = cleanString(body.projectId) || (mode === "unproductive" ? "__unproductive__" : "");
  const durationMs = parseMilliseconds(body.durationMs);

  if (!projectId) {
    return NextResponse.json({ error: "Bitte ein Projekt angeben." }, { status: 400 });
  }

  if (!durationMs) {
    return NextResponse.json({ error: "Bitte eine Laufzeit angeben." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  const actorResult = await getSessionBoundActor(req, users, body.actorUserId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const includeInternalCosts = canViewInternalCostData(actor);

  const actorName = getUserName(actor);
  const actorCanManageProjectTime = canManageProjectTimeEntries(actor);
  const actorCanApproveOvertime = canApproveProjectOvertime(actor);
  const id = cleanString(body.id) || randomUUID();
  const projectLabel = cleanString(body.projectLabel);
  const trade = mode === "project" ? cleanString(body.trade) : "";
  const planningEntryId = cleanString(body.planningEntryId);
  const planningBillingGroupId = cleanString(body.planningBillingGroupId);
  const billingCatalogItemId = cleanString(body.billingCatalogItemId);
  const billingCatalogItemLabel = cleanString(body.billingCatalogItemLabel);
  const userId = cleanString(body.userId);
  const targetUser = getRequestUser(users, userId);
  if (!targetUser) {
    return NextResponse.json({ error: "Bitte einen aktiven Mitarbeiter zuweisen." }, { status: 400 });
  }

  const employee = getUserName(targetUser);
  const entrySource = cleanString(body.entrySource) === "manual" ? "manual" : "stamped";
  const date = normalizeDateKeyValue(cleanString(body.date));
  const startTime = cleanString(body.startTime);
  const endTime = cleanString(body.endTime);
  const pauseMs = parseMilliseconds(body.pauseMs);
  const comment = cleanString(body.comment);
  const marketingContentItemId = cleanString(body.marketingContentItemId);
  const marketingContentType = cleanString(body.marketingContentType);
  const completionStatus =
    mode === "project" && ["finished", "interrupted"].includes(cleanString(body.completionStatus))
      ? cleanString(body.completionStatus)
      : "";
  const requestedOvertimeApprovalStatus = ["pending", "approved"].includes(cleanString(body.overtimeApprovalStatus))
    ? cleanString(body.overtimeApprovalStatus)
    : "not_required";
  const incomingEditHistory: unknown[] = Array.isArray(body.editHistory) ? body.editHistory : [];

  const existingRows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    SELECT *
    FROM "ProjectTimeEntry"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const existingEntry = existingRows[0] ?? null;

  if (!actorCanManageProjectTime) {
    const isOwnManualEntry =
      targetUser.id === actor.id && entrySource === "manual" && (!existingEntry || existingEntry.entrySource === "manual");
    if (!isOwnManualEntry) {
      return NextResponse.json(
        { error: "Du darfst nur eigene manuelle Zeiteintraege anlegen oder bearbeiten." },
        { status: 403 }
      );
    }
  }

  const overtimeApprovalStatus = actorCanApproveOvertime
    ? requestedOvertimeApprovalStatus
    : existingEntry?.overtimeApprovalStatus ?? "not_required";
  const overtimeApprovedByUserId =
    actorCanApproveOvertime && overtimeApprovalStatus === "approved"
      ? actor.id
      : existingEntry?.overtimeApprovedByUserId ?? "";
  const overtimeApprovedByName =
    actorCanApproveOvertime && overtimeApprovalStatus === "approved"
      ? actorName
      : existingEntry?.overtimeApprovedByName ?? "";
  const overtimeApprovedAt =
    actorCanApproveOvertime && overtimeApprovalStatus === "approved"
      ? cleanString(body.overtimeApprovedAt) || new Date().toISOString()
      : existingEntry?.overtimeApprovedAt?.toISOString() ?? "";
  const editHistory = incomingEditHistory.map((entry, index) =>
    index === 0 && entry && typeof entry === "object"
      ? { ...(entry as Record<string, unknown>), actorUserId: actor.id, actorName }
      : entry
  );
  const laborCostRateSnapshot = await getEmployeeHourlyCostRateSnapshot(organization.id, targetUser.id);
  const laborCostSnapshot = roundMoney((durationMs / 3_600_000) * laborCostRateSnapshot);

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "Datum und Uhrzeit fehlen." }, { status: 400 });
  }

  if (mode === "project" && !trade && (await isHourlyRecurringProject(organization.id, projectId))) {
    return NextResponse.json(
      { error: "Bitte fuer diese Stundenabrechnung ein Gewerk auswaehlen." },
      { status: 400 }
    );
  }

  const rows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    INSERT INTO "ProjectTimeEntry" (
      "id",
      "organizationId",
      "mode",
      "projectId",
      "projectLabel",
      "trade",
      "planningEntryId",
      "planningBillingGroupId",
      "billingCatalogItemId",
      "billingCatalogItemLabel",
      "userId",
      "employee",
      "entrySource",
      "date",
      "startTime",
      "endTime",
      "durationMs",
      "pauseMs",
      "laborCostRateSnapshot",
      "laborCostSnapshot",
      "costSnapshotAt",
      "comment",
      "marketingContentItemId",
      "marketingContentType",
      "completionStatus",
      "overtimeApprovalStatus",
      "overtimeApprovedByUserId",
      "overtimeApprovedByName",
      "overtimeApprovedAt",
      "editHistory"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${mode},
      ${projectId},
      ${projectLabel || null},
      ${trade || null},
      ${planningEntryId || null},
      ${planningBillingGroupId || null},
      ${billingCatalogItemId || null},
      ${billingCatalogItemLabel || null},
      ${targetUser.id},
      ${employee || null},
      ${entrySource},
      ${date},
      ${startTime},
      ${endTime},
      ${durationMs},
      ${pauseMs},
      ${laborCostRateSnapshot},
      ${laborCostSnapshot},
      CURRENT_TIMESTAMP,
      ${comment || null},
      ${marketingContentItemId || null},
      ${marketingContentType || null},
      ${completionStatus || null},
      ${overtimeApprovalStatus},
      ${overtimeApprovedByUserId || null},
      ${overtimeApprovedByName || null},
      ${overtimeApprovedAt ? new Date(overtimeApprovedAt) : null},
      CAST(${JSON.stringify(editHistory)} AS jsonb)
    )
    ON CONFLICT ("id") DO UPDATE SET
      "mode" = EXCLUDED."mode",
      "projectLabel" = EXCLUDED."projectLabel",
      "trade" = EXCLUDED."trade",
      "planningEntryId" = EXCLUDED."planningEntryId",
      "planningBillingGroupId" = EXCLUDED."planningBillingGroupId",
      "billingCatalogItemId" = EXCLUDED."billingCatalogItemId",
      "billingCatalogItemLabel" = EXCLUDED."billingCatalogItemLabel",
      "userId" = EXCLUDED."userId",
      "employee" = EXCLUDED."employee",
      "entrySource" = EXCLUDED."entrySource",
      "date" = EXCLUDED."date",
      "startTime" = EXCLUDED."startTime",
      "endTime" = EXCLUDED."endTime",
      "durationMs" = EXCLUDED."durationMs",
      "pauseMs" = EXCLUDED."pauseMs",
      "laborCostRateSnapshot" = EXCLUDED."laborCostRateSnapshot",
      "laborCostSnapshot" = EXCLUDED."laborCostSnapshot",
      "costSnapshotAt" = EXCLUDED."costSnapshotAt",
      "comment" = EXCLUDED."comment",
      "marketingContentItemId" = EXCLUDED."marketingContentItemId",
      "marketingContentType" = EXCLUDED."marketingContentType",
      "completionStatus" = EXCLUDED."completionStatus",
      "overtimeApprovalStatus" = EXCLUDED."overtimeApprovalStatus",
      "overtimeApprovedByUserId" = EXCLUDED."overtimeApprovedByUserId",
      "overtimeApprovedByName" = EXCLUDED."overtimeApprovedByName",
      "overtimeApprovedAt" = EXCLUDED."overtimeApprovedAt",
      "editHistory" = EXCLUDED."editHistory"
    RETURNING *
  `;

  return NextResponse.json(formatEntry(rows[0], { includeInternalCosts }), { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = cleanString(searchParams.get("id"));
  const historyId = cleanString(searchParams.get("historyId"));
  const note = cleanString(searchParams.get("note")) || "Zeiteintrag gelöscht";

  if (!id) {
    return NextResponse.json({ error: "Zeiteintrag fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorUserId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const includeInternalCosts = canViewInternalCostData(actor);

  const actorName = getUserName(actor);
  const actorCanManageProjectTime = canManageProjectTimeEntries(actor);

  const existingRows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    SELECT *
    FROM "ProjectTimeEntry"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const existingEntry = existingRows[0];
  if (!existingEntry) {
    return NextResponse.json({ ok: true });
  }

  if (historyId) {
    if (actor.role !== Role.GESCHAEFTSFUEHRER) {
      return NextResponse.json(
        { error: "Nur Gesch\u00e4ftsf\u00fchrer d\u00fcrfen Historieneintr\u00e4ge l\u00f6schen." },
        { status: 403 }
      );
    }

    const currentHistory = Array.isArray(existingEntry.editHistory) ? existingEntry.editHistory : [];
    const nextHistory = currentHistory.filter((entry) => {
      if (!entry || typeof entry !== "object") return true;
      return String((entry as { id?: unknown }).id ?? "") !== historyId;
    });
    const rows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
      UPDATE "ProjectTimeEntry"
      SET "editHistory" = CAST(${JSON.stringify(nextHistory)} AS jsonb)
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
      RETURNING *
    `;

    return NextResponse.json(formatEntry(rows[0], { includeInternalCosts }));
  }

  if (
    !actorCanManageProjectTime &&
    (existingEntry.entrySource !== "manual" || existingEntry.userId !== actor.id)
  ) {
    return NextResponse.json(
      { error: "Du darfst diesen Zeiteintrag nicht loeschen." },
      { status: 403 }
    );
  }

  const currentHistory = Array.isArray(existingEntry.editHistory) ? existingEntry.editHistory : [];
  const deleteHistory = {
    id: randomUUID(),
    actorUserId: actor.id,
    actorName,
    event: "Zeiteintrag gelöscht",
    note,
    previousValue: `${formatDateKeyDisplay(existingEntry.date)} ${existingEntry.startTime}-${existingEntry.endTime}, ${Number(existingEntry.durationMs)} ms`,
    nextValue: "Gelöscht",
    createdAt: new Date().toISOString(),
  };

  const rows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    UPDATE "ProjectTimeEntry"
    SET "deletedAt" = CURRENT_TIMESTAMP,
        "editHistory" = CAST(${JSON.stringify([deleteHistory, ...currentHistory])} AS jsonb)
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;

  return NextResponse.json(formatEntry(rows[0], { includeInternalCosts }));
}
