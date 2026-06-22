import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type DemoUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
};

type ActiveStampSessionRow = {
  id: string;
  organizationId: string;
  userId: string;
  employee: string | null;
  mode: string;
  projectId: string;
  projectLabel: string | null;
  marketingContentItemId: string | null;
  marketingContentTitle: string | null;
  marketingContentType: string | null;
  comment: string | null;
  startedAt: Date;
  accumulatedMs: bigint | number;
  pauseStartedAt: Date | null;
  pauseMs: bigint | number;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectTimeEntryRow = {
  id: string;
  organizationId: string;
  mode: string | null;
  projectId: string;
  projectLabel: string | null;
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
  createdAt: Date;
};

let activeStampSessionTablePromise: Promise<void> | null = null;
let projectTimeEntryTablePromise: Promise<void> | null = null;

async function ensureActiveStampSessionTableOnce() {
  const existingTable = await prisma.$queryRaw<Array<{ exists: string | null }>>`
    SELECT to_regclass('"ActiveStampSession"')::text as "exists"
  `;

  if (!existingTable[0]?.exists) {
    await prisma.$executeRaw`
      CREATE TABLE "ActiveStampSession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "employee" TEXT,
        "mode" TEXT NOT NULL DEFAULT 'project',
        "projectId" TEXT NOT NULL,
        "projectLabel" TEXT,
        "startedAt" TIMESTAMP(3) NOT NULL,
        "accumulatedMs" BIGINT NOT NULL DEFAULT 0,
        "pauseStartedAt" TIMESTAMP(3),
        "pauseMs" BIGINT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  await prisma.$executeRaw`
    ALTER TABLE "ActiveStampSession"
    ADD COLUMN IF NOT EXISTS "employee" TEXT,
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "projectLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentTitle" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentType" TEXT,
    ADD COLUMN IF NOT EXISTS "comment" TEXT,
    ADD COLUMN IF NOT EXISTS "accumulatedMs" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "pauseStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "pauseMs" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "ActiveStampSession_organizationId_userId_key"
    ON "ActiveStampSession" ("organizationId", "userId")
  `;
}

async function ensureActiveStampSessionTable() {
  activeStampSessionTablePromise ??= ensureActiveStampSessionTableOnce().catch((error) => {
    activeStampSessionTablePromise = null;
    throw error;
  });

  return activeStampSessionTablePromise;
}

async function ensureProjectTimeEntryTableOnce() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectTimeEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'project',
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "userId" TEXT,
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

async function ensureProjectTimeEntryTable() {
  projectTimeEntryTablePromise ??= ensureProjectTimeEntryTableOnce().catch((error) => {
    projectTimeEntryTablePromise = null;
    throw error;
  });

  return projectTimeEntryTablePromise;
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

function unauthorizedUserResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

function toMillis(value: bigint | number) {
  return Number(value);
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
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

function formatDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function getBerlinOffsetMs(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const berlinTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return berlinTimeAsUtc - Math.floor(timestampMs / 1000) * 1000;
}

function normalizeStoredStampDate(date: Date | null, nowMs = Date.now()) {
  if (!date) return null;

  const timestampMs = date.getTime();
  if (!Number.isFinite(timestampMs) || timestampMs <= nowMs + 60_000) return date;

  const correctedTimestampMs = timestampMs - getBerlinOffsetMs(timestampMs);
  if (correctedTimestampMs <= nowMs + 60_000) return new Date(correctedTimestampMs);

  return date;
}

function formatSession(row: ActiveStampSessionRow | null) {
  if (!row) return null;
  const startedAt = normalizeStoredStampDate(row.startedAt) ?? row.startedAt;
  const pauseStartedAt = normalizeStoredStampDate(row.pauseStartedAt);

  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    employee: row.employee ?? "",
    mode: row.mode === "unproductive" ? "unproductive" : "project",
    projectId: row.projectId,
    projectLabel: row.projectLabel ?? "",
    marketingContentItemId: row.marketingContentItemId ?? "",
    marketingContentTitle: row.marketingContentTitle ?? "",
    marketingContentType: row.marketingContentType ?? "",
    comment: row.comment ?? "",
    startedAt: startedAt.toISOString(),
    accumulatedMs: toMillis(row.accumulatedMs),
    pauseStartedAt: pauseStartedAt?.toISOString() ?? null,
    pauseMs: toMillis(row.pauseMs),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatEntry(entry: ProjectTimeEntryRow) {
  return {
    id: entry.id,
    mode: entry.mode === "unproductive" ? "unproductive" : "project",
    projectId: entry.projectId,
    projectLabel: entry.projectLabel ?? "",
    userId: entry.userId ?? "",
    employee: entry.employee ?? "",
    entrySource: entry.entrySource === "manual" ? "manual" : "stamped",
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMs: toMillis(entry.durationMs),
    pauseMs: toMillis(entry.pauseMs),
    laborCostRateSnapshot: Number(entry.laborCostRateSnapshot ?? 0),
    laborCostSnapshot: Number(entry.laborCostSnapshot ?? 0),
    costSnapshotAt: entry.costSnapshotAt?.toISOString() ?? "",
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
    createdAt: entry.createdAt.toISOString(),
  };
}

async function getActiveSession(organizationId: string, userId: string) {
  const rows = await prisma.$queryRaw<ActiveStampSessionRow[]>`
    SELECT *
    FROM "ActiveStampSession"
    WHERE "organizationId" = ${organizationId}
      AND "userId" = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = cleanString(searchParams.get("userId"));

  const { organization } = await getDemoContext();
  await ensureActiveStampSessionTable();

  if (!userId) {
    const sessions = await prisma.$queryRaw<ActiveStampSessionRow[]>`
      SELECT *
      FROM "ActiveStampSession"
      WHERE "organizationId" = ${organization.id}
      ORDER BY "startedAt" DESC
    `;

    return NextResponse.json(sessions.map(formatSession));
  }

  const session = await getActiveSession(organization.id, userId);

  return NextResponse.json(formatSession(session));
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = cleanString(body.action);

  if (action === "stop") {
    return stopSession(body);
  }

  if (action !== "start") {
    return NextResponse.json({ error: "Unbekannte Stempelaktion." }, { status: 400 });
  }

  const userId = cleanString(body.userId);
  const mode = cleanString(body.mode) === "unproductive" ? "unproductive" : "project";
  const projectId = cleanString(body.projectId) || (mode === "unproductive" ? "__unproductive__" : "");
  const comment = cleanString(body.comment);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Bitte ein Projekt angeben." }, { status: 400 });
  }

  if (!comment) {
    return NextResponse.json({ error: "Bitte kurz eintragen, was du gerade machst." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();

  const stampUser = getRequestUser(users, userId);
  if (!stampUser) {
    return unauthorizedUserResponse();
  }
  const existingSession = await getActiveSession(organization.id, userId);

  if (existingSession) {
    return NextResponse.json(
      {
        error:
          "Es läuft bereits eine Stempelung. Bitte zuerst über Wechsel oder Stop abschließen und Arbeit fertig/unterbrochen auswählen.",
      },
      { status: 409 }
    );
  }

  const now = new Date();
  const rows = await prisma.$queryRaw<ActiveStampSessionRow[]>`
    INSERT INTO "ActiveStampSession" (
      "id",
      "organizationId",
      "userId",
      "employee",
      "mode",
      "projectId",
      "projectLabel",
      "marketingContentItemId",
      "marketingContentTitle",
      "marketingContentType",
      "comment",
      "startedAt",
      "accumulatedMs",
      "pauseStartedAt",
      "pauseMs",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${userId},
      ${getUserName(stampUser)},
      ${mode},
      ${projectId},
      ${cleanString(body.projectLabel) || null},
      ${cleanString(body.marketingContentItemId) || null},
      ${cleanString(body.marketingContentTitle) || null},
      ${cleanString(body.marketingContentType) || null},
      ${comment},
      ${now},
      ${0},
      ${null},
      ${0},
      ${now},
      ${now}
    )
    RETURNING *
  `;

  return NextResponse.json(formatSession(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const action = cleanString(body.action);
  const userId = cleanString(body.userId);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "Unbekannte Stempelaktion." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();
  const stampUser = getRequestUser(users, userId);
  if (!stampUser) {
    return unauthorizedUserResponse();
  }
  const session = await getActiveSession(organization.id, userId);

  if (!session) {
    return NextResponse.json({ error: "Keine aktive Stempelung gefunden." }, { status: 404 });
  }

  const now = new Date();

  if (action === "pause") {
    if (session.pauseStartedAt) {
      return NextResponse.json(formatSession(session));
    }

    const startedAt = normalizeStoredStampDate(session.startedAt, now.getTime()) ?? session.startedAt;
    const accumulatedMs = toMillis(session.accumulatedMs) + Math.max(0, now.getTime() - startedAt.getTime());
    const rows = await prisma.$queryRaw<ActiveStampSessionRow[]>`
      UPDATE "ActiveStampSession"
      SET "accumulatedMs" = ${accumulatedMs},
          "pauseStartedAt" = ${now},
          "updatedAt" = ${now}
      WHERE "organizationId" = ${organization.id}
        AND "userId" = ${userId}
      RETURNING *
    `;

    return NextResponse.json(formatSession(rows[0]));
  }

  if (!session.pauseStartedAt) {
    return NextResponse.json(formatSession(session));
  }

  const pauseStartedAt = normalizeStoredStampDate(session.pauseStartedAt, now.getTime()) ?? session.pauseStartedAt;
  const pauseMs = toMillis(session.pauseMs) + Math.max(0, now.getTime() - pauseStartedAt.getTime());
  const rows = await prisma.$queryRaw<ActiveStampSessionRow[]>`
    UPDATE "ActiveStampSession"
    SET "pauseMs" = ${pauseMs},
        "startedAt" = ${now},
        "pauseStartedAt" = NULL,
        "updatedAt" = ${now}
    WHERE "organizationId" = ${organization.id}
      AND "userId" = ${userId}
    RETURNING *
  `;

  return NextResponse.json(formatSession(rows[0]));
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  return stopSession(body);
}

async function stopSession(body: Record<string, unknown>) {
  const userId = cleanString(body.userId);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();
  await ensureProjectTimeEntryTable();

  const stampUser = getRequestUser(users, userId);
  if (!stampUser) {
    return unauthorizedUserResponse();
  }

  const session = await getActiveSession(organization.id, userId);

  if (!session) {
    return NextResponse.json({ error: "Keine aktive Stempelung gefunden." }, { status: 404 });
  }

  const now = new Date();
  const isPaused = Boolean(session.pauseStartedAt);
  const sessionStartedAt = normalizeStoredStampDate(session.startedAt, now.getTime()) ?? session.startedAt;
  const pauseStartedAt = normalizeStoredStampDate(session.pauseStartedAt, now.getTime());
  const durationMs =
    toMillis(session.accumulatedMs) + (isPaused ? 0 : Math.max(0, now.getTime() - sessionStartedAt.getTime()));
  const pauseMs =
    toMillis(session.pauseMs) + (pauseStartedAt ? Math.max(0, now.getTime() - pauseStartedAt.getTime()) : 0);
  const finalComment = cleanString(body.comment) || cleanString(session.comment) || "";
  const requestedCompletionStatus = cleanString(body.completionStatus);
  const completionStatus =
    session.mode === "project" && ["finished", "interrupted"].includes(requestedCompletionStatus)
      ? requestedCompletionStatus
      : "";

  if (session.mode === "project" && !completionStatus) {
    return NextResponse.json(
      {
        error:
          "Projektstempelungen können nur über Arbeit fertig oder Arbeit unterbrochen abgeschlossen werden.",
      },
      { status: 400 }
    );
  }

  if (durationMs <= 0) {
    return NextResponse.json({ error: "Die Laufzeit muss größer als 0 sein." }, { status: 400 });
  }

  const laborCostRateSnapshot = await getEmployeeHourlyCostRateSnapshot(organization.id, session.userId);
  const laborCostSnapshot = roundMoney((durationMs / 3_600_000) * laborCostRateSnapshot);

  const rows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    INSERT INTO "ProjectTimeEntry" (
      "id",
      "organizationId",
      "mode",
      "projectId",
      "projectLabel",
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
      "editHistory"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${session.mode === "unproductive" ? "unproductive" : "project"},
      ${session.mode === "unproductive" ? "__unproductive__" : session.projectId},
      ${session.projectLabel || (session.mode === "unproductive" ? "Unproduktiv" : null)},
      ${session.userId},
      ${session.employee || null},
      ${"stamped"},
      ${formatDateKey(sessionStartedAt)},
      ${formatTime(sessionStartedAt)},
      ${formatTime(now)},
      ${durationMs},
      ${pauseMs},
      ${laborCostRateSnapshot},
      ${laborCostSnapshot},
      CURRENT_TIMESTAMP,
      ${finalComment || null},
      ${session.marketingContentItemId || null},
      ${session.marketingContentType || null},
      ${completionStatus || null},
      ${"not_required"},
      CAST(${"[]"} AS jsonb)
    )
    RETURNING *
  `;

  await prisma.$executeRaw`
    DELETE FROM "ActiveStampSession"
    WHERE "organizationId" = ${organization.id}
      AND "userId" = ${userId}
  `;

  return NextResponse.json(formatEntry(rows[0]), { status: 201 });
}
