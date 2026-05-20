import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type ActiveStampSessionRow = {
  id: string;
  organizationId: string;
  userId: string;
  employee: string | null;
  mode: string;
  projectId: string;
  projectLabel: string | null;
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
  comment: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  overtimeApprovalStatus: string | null;
  overtimeApprovedByUserId: string | null;
  overtimeApprovedByName: string | null;
  overtimeApprovedAt: Date | null;
  editHistory: unknown;
  createdAt: Date;
};

async function ensureActiveStampSessionTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ActiveStampSession" (
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

  await prisma.$executeRaw`
    ALTER TABLE "ActiveStampSession"
    ADD COLUMN IF NOT EXISTS "employee" TEXT,
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "projectLabel" TEXT,
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

async function ensureProjectTimeEntryTable() {
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
      "comment" TEXT,
      "invoiceId" TEXT,
      "invoiceNumber" TEXT,
      "invoicedAt" TIMESTAMP(3),
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
    ADD COLUMN IF NOT EXISTS "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "editHistory" JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toMillis(value: bigint | number) {
  return Number(value);
}

function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date);
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
    comment: entry.comment ?? "",
    invoiceId: entry.invoiceId ?? "",
    invoiceNumber: entry.invoiceNumber ?? "",
    invoicedAt: entry.invoicedAt?.toISOString() ?? "",
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

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Bitte ein Projekt angeben." }, { status: 400 });
  }

  const { organization } = await getDemoContext();
  await ensureActiveStampSessionTable();
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
      ${cleanString(body.employee) || null},
      ${mode},
      ${projectId},
      ${cleanString(body.projectLabel) || null},
      ${now},
      ${0},
      ${null},
      ${0},
      ${now},
      ${now}
    )
    ON CONFLICT ("organizationId", "userId") DO UPDATE SET
      "id" = EXCLUDED."id",
      "employee" = EXCLUDED."employee",
      "mode" = EXCLUDED."mode",
      "projectId" = EXCLUDED."projectId",
      "projectLabel" = EXCLUDED."projectLabel",
      "startedAt" = EXCLUDED."startedAt",
      "accumulatedMs" = 0,
      "pauseStartedAt" = NULL,
      "pauseMs" = 0,
      "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt"
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

  const { organization } = await getDemoContext();
  await ensureActiveStampSessionTable();
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

  const { organization } = await getDemoContext();
  await ensureActiveStampSessionTable();
  await ensureProjectTimeEntryTable();

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

  if (durationMs <= 0) {
    return NextResponse.json({ error: "Die Laufzeit muss größer als 0 sein." }, { status: 400 });
  }

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
      "comment",
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
      ${cleanString(body.comment) || null},
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
