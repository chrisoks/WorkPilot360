import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type ProjectTimeEntryRow = {
  id: string;
  organizationId: string;
  mode: string | null;
  projectId: string;
  projectLabel: string | null;
  employee: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMs: bigint | number;
  pauseMs: bigint | number;
  comment: string | null;
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
      "employee" TEXT,
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMs" BIGINT NOT NULL DEFAULT 0,
      "pauseMs" BIGINT NOT NULL DEFAULT 0,
      "comment" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project'
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseMilliseconds(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function formatEntry(entry: ProjectTimeEntryRow) {
  return {
    id: entry.id,
    mode: entry.mode === "unproductive" ? "unproductive" : "project",
    projectId: entry.projectId,
    projectLabel: entry.projectLabel ?? "",
    employee: entry.employee ?? "",
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMs: Number(entry.durationMs),
    pauseMs: Number(entry.pauseMs),
    comment: entry.comment ?? "",
  };
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  const entries = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    SELECT *
    FROM "ProjectTimeEntry"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;

  return NextResponse.json(entries.map(formatEntry));
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

  const { organization } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  const id = cleanString(body.id) || randomUUID();
  const projectLabel = cleanString(body.projectLabel);
  const employee = cleanString(body.employee);
  const date = cleanString(body.date);
  const startTime = cleanString(body.startTime);
  const endTime = cleanString(body.endTime);
  const pauseMs = parseMilliseconds(body.pauseMs);
  const comment = cleanString(body.comment);

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "Datum und Uhrzeit fehlen." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    INSERT INTO "ProjectTimeEntry" (
      "id",
      "organizationId",
      "mode",
      "projectId",
      "projectLabel",
      "employee",
      "date",
      "startTime",
      "endTime",
      "durationMs",
      "pauseMs",
      "comment"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${mode},
      ${projectId},
      ${projectLabel || null},
      ${employee || null},
      ${date},
      ${startTime},
      ${endTime},
      ${durationMs},
      ${pauseMs},
      ${comment || null}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "mode" = EXCLUDED."mode",
      "projectLabel" = EXCLUDED."projectLabel",
      "employee" = EXCLUDED."employee",
      "date" = EXCLUDED."date",
      "startTime" = EXCLUDED."startTime",
      "endTime" = EXCLUDED."endTime",
      "durationMs" = EXCLUDED."durationMs",
      "pauseMs" = EXCLUDED."pauseMs",
      "comment" = EXCLUDED."comment"
    RETURNING *
  `;

  return NextResponse.json(formatEntry(rows[0]), { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = cleanString(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Zeiteintrag fehlt." }, { status: 400 });
  }

  const { organization } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  await prisma.$executeRaw`
    DELETE FROM "ProjectTimeEntry"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  return NextResponse.json({ ok: true });
}
