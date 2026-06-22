import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";

type NoteRow = {
  id: string;
  organizationId: string;
  scope: string;
  customerId: string | null;
  customerName: string | null;
  projectId: string | null;
  projectTitle: string | null;
  title: string;
  body: string;
  category: string;
  priority: string;
  isActive: boolean;
  requiresStampConfirmation: boolean;
  requiresProjectCreateConfirmation: boolean;
  confirmationFrequency: string;
  validFrom: string | null;
  validUntil: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AcknowledgementRow = {
  id: string;
  organizationId: string;
  noteId: string;
  customerId: string | null;
  projectId: string | null;
  userId: string | null;
  userName: string | null;
  context: string;
  acknowledgedAt: Date;
  noteTitle: string | null;
};

async function ensureNoteTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CustomerProjectNote" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "scope" TEXT NOT NULL DEFAULT 'customer',
      "customerId" TEXT,
      "customerName" TEXT,
      "projectId" TEXT,
      "projectTitle" TEXT,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Allgemein',
      "priority" TEXT NOT NULL DEFAULT 'normal',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "requiresStampConfirmation" BOOLEAN NOT NULL DEFAULT false,
      "requiresProjectCreateConfirmation" BOOLEAN NOT NULL DEFAULT false,
      "confirmationFrequency" TEXT NOT NULL DEFAULT 'always',
      "validFrom" TEXT,
      "validUntil" TEXT,
      "createdByUserId" TEXT,
      "createdByName" TEXT,
      "archivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CustomerProjectNote"
    ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'customer',
    ADD COLUMN IF NOT EXISTS "customerId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerName" TEXT,
    ADD COLUMN IF NOT EXISTS "projectId" TEXT,
    ADD COLUMN IF NOT EXISTS "projectTitle" TEXT,
    ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Allgemein',
    ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "requiresStampConfirmation" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "requiresProjectCreateConfirmation" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "confirmationFrequency" TEXT NOT NULL DEFAULT 'always',
    ADD COLUMN IF NOT EXISTS "validFrom" TEXT,
    ADD COLUMN IF NOT EXISTS "validUntil" TEXT,
    ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CustomerProjectNoteAcknowledgement" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "noteId" TEXT NOT NULL,
      "customerId" TEXT,
      "projectId" TEXT,
      "userId" TEXT,
      "userName" TEXT,
      "context" TEXT NOT NULL,
      "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "noteTitle" TEXT
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "CustomerProjectNote_org_customer_idx"
    ON "CustomerProjectNote" ("organizationId", "customerId")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "CustomerProjectNote_org_project_idx"
    ON "CustomerProjectNote" ("organizationId", "projectId")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "CustomerProjectNoteAck_org_note_idx"
    ON "CustomerProjectNoteAcknowledgement" ("organizationId", "noteId")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "CustomerProjectNoteAck_org_user_context_idx"
    ON "CustomerProjectNoteAcknowledgement" ("organizationId", "userId", "context")
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
}

function cleanDate(value: unknown) {
  const date = cleanString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function formatDateTime(value: Date | null) {
  return value ? value.toISOString() : "";
}

function formatNote(row: NoteRow, acknowledgements: AcknowledgementRow[] = []) {
  return {
    id: row.id,
    scope: row.scope,
    customerId: row.customerId ?? "",
    customerName: row.customerName ?? "",
    projectId: row.projectId ?? "",
    projectTitle: row.projectTitle ?? "",
    title: row.title,
    body: row.body,
    category: row.category,
    priority: row.priority,
    isActive: row.isActive,
    requiresStampConfirmation: row.requiresStampConfirmation,
    requiresProjectCreateConfirmation: row.requiresProjectCreateConfirmation,
    confirmationFrequency: row.confirmationFrequency,
    validFrom: row.validFrom ?? "",
    validUntil: row.validUntil ?? "",
    createdByUserId: row.createdByUserId ?? "",
    createdByName: row.createdByName ?? "",
    archivedAt: formatDateTime(row.archivedAt),
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
    acknowledgements: acknowledgements.map((ack) => ({
      id: ack.id,
      noteId: ack.noteId,
      customerId: ack.customerId ?? "",
      projectId: ack.projectId ?? "",
      userId: ack.userId ?? "",
      userName: ack.userName ?? "",
      context: ack.context,
      acknowledgedAt: formatDateTime(ack.acknowledgedAt),
      noteTitle: ack.noteTitle ?? "",
    })),
  };
}

function isNoteActiveForDate(note: NoteRow, todayKey: string) {
  if (!note.isActive || note.archivedAt) return false;
  if (note.validFrom && note.validFrom > todayKey) return false;
  if (note.validUntil && note.validUntil < todayKey) return false;
  return true;
}

function isAcknowledgedForFrequency(
  note: NoteRow,
  acknowledgements: AcknowledgementRow[],
  context: string,
  userId: string,
  todayKey: string
) {
  if (note.confirmationFrequency === "always") return false;
  const matching = acknowledgements.filter(
    (ack) => ack.noteId === note.id && ack.context === context && (!userId || ack.userId === userId)
  );
  if (note.confirmationFrequency === "once_per_user") return matching.length > 0;
  if (note.confirmationFrequency === "daily") {
    return matching.some((ack) => ack.acknowledgedAt.toISOString().slice(0, 10) === todayKey);
  }
  return false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const requestedActorId = url.searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return cleanString(requestedActorId) ? sessionBoundActorResponse(actorResult) : NextResponse.json([]);
  }
  const actor = actorResult.actor;

  await ensureNoteTables();

  const customerId = cleanString(url.searchParams.get("customerId"));
  const projectId = cleanString(url.searchParams.get("projectId"));
  const context = cleanString(url.searchParams.get("context"));
  const userId = cleanString(url.searchParams.get("userId"));
  const todayKey = new Date().toISOString().slice(0, 10);

  if (!customerId && !projectId) {
    return NextResponse.json({ error: "Kunde oder Projekt fehlt." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<NoteRow[]>`
    SELECT *
    FROM "CustomerProjectNote"
    WHERE "organizationId" = ${organization.id}
      AND "archivedAt" IS NULL
      AND (
        (${customerId} <> '' AND "customerId" = ${customerId})
        OR (${projectId} <> '' AND "projectId" = ${projectId})
      )
    ORDER BY "priority" DESC, "createdAt" DESC
  `;

  const acknowledgements = rows.length
    ? await prisma.$queryRaw<AcknowledgementRow[]>`
        SELECT *
        FROM "CustomerProjectNoteAcknowledgement"
        WHERE "organizationId" = ${organization.id}
        ORDER BY "acknowledgedAt" DESC
      `
    : [];
  const rowIds = new Set(rows.map((row) => row.id));
  const visibleAcknowledgements = acknowledgements.filter((ack) => rowIds.has(ack.noteId));

  let visibleRows = rows;
  if (context === "stamp" || context === "projectCreate") {
    visibleRows = rows.filter((note) => {
      if (!isNoteActiveForDate(note, todayKey)) return false;
      if (context === "stamp" && !note.requiresStampConfirmation) return false;
      if (context === "projectCreate" && !note.requiresProjectCreateConfirmation) return false;
      return !isAcknowledgedForFrequency(note, visibleAcknowledgements, context, userId, todayKey);
    });
  }

  return NextResponse.json(
    visibleRows.map((note) =>
      formatNote(
        note,
        visibleAcknowledgements.filter((ack) => ack.noteId === note.id)
      )
    )
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  await ensureNoteTables();

  const scope = cleanString(body.scope) === "project" ? "project" : "customer";
  const id = cleanString(body.id) || randomUUID();
  const title = cleanString(body.title);
  const noteBody = cleanString(body.body);
  const customerId = cleanString(body.customerId);
  const projectId = cleanString(body.projectId);

  if (!title) return NextResponse.json({ error: "Titel fehlt." }, { status: 400 });
  if (!noteBody) return NextResponse.json({ error: "Hinweistext fehlt." }, { status: 400 });
  if (scope === "customer" && !customerId) return NextResponse.json({ error: "Kunde fehlt." }, { status: 400 });
  if (scope === "project" && !projectId) return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });

  await prisma.$executeRaw`
    INSERT INTO "CustomerProjectNote" (
      "id",
      "organizationId",
      "scope",
      "customerId",
      "customerName",
      "projectId",
      "projectTitle",
      "title",
      "body",
      "category",
      "priority",
      "isActive",
      "requiresStampConfirmation",
      "requiresProjectCreateConfirmation",
      "confirmationFrequency",
      "validFrom",
      "validUntil",
      "createdByUserId",
      "createdByName"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${scope},
      ${customerId || null},
      ${cleanString(body.customerName) || null},
      ${projectId || null},
      ${cleanString(body.projectTitle) || null},
      ${title},
      ${noteBody},
      ${cleanString(body.category) || "Allgemein"},
      ${cleanString(body.priority) || "normal"},
      ${body.isActive !== false},
      ${Boolean(body.requiresStampConfirmation)},
      ${Boolean(body.requiresProjectCreateConfirmation)},
      ${cleanString(body.confirmationFrequency) || "always"},
      ${cleanDate(body.validFrom) || null},
      ${cleanDate(body.validUntil) || null},
      ${actor.id},
      ${getActorName(actor)}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "scope" = EXCLUDED."scope",
      "customerId" = EXCLUDED."customerId",
      "customerName" = EXCLUDED."customerName",
      "projectId" = EXCLUDED."projectId",
      "projectTitle" = EXCLUDED."projectTitle",
      "title" = EXCLUDED."title",
      "body" = EXCLUDED."body",
      "category" = EXCLUDED."category",
      "priority" = EXCLUDED."priority",
      "isActive" = EXCLUDED."isActive",
      "requiresStampConfirmation" = EXCLUDED."requiresStampConfirmation",
      "requiresProjectCreateConfirmation" = EXCLUDED."requiresProjectCreateConfirmation",
      "confirmationFrequency" = EXCLUDED."confirmationFrequency",
      "validFrom" = EXCLUDED."validFrom",
      "validUntil" = EXCLUDED."validUntil",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({ ok: true, id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const actorName = getActorName(actor);

  await ensureNoteTables();

  const action = cleanString(body.action);
  const id = cleanString(body.id);

  if (action === "archive") {
    if (!id) return NextResponse.json({ error: "Hinweis fehlt." }, { status: 400 });
    await prisma.$executeRaw`
      UPDATE "CustomerProjectNote"
      SET "archivedAt" = CURRENT_TIMESTAMP,
          "isActive" = false,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id}
        AND "id" = ${id}
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === "acknowledge") {
    const noteIds = Array.isArray(body.noteIds)
      ? body.noteIds.map((value: unknown) => cleanString(value)).filter(Boolean)
      : id
        ? [id]
        : [];
    const context = cleanString(body.context);
    if (noteIds.length === 0) return NextResponse.json({ error: "Hinweis fehlt." }, { status: 400 });
    if (!context) return NextResponse.json({ error: "Kontext fehlt." }, { status: 400 });

    const allNotes = await prisma.$queryRaw<NoteRow[]>`
      SELECT *
      FROM "CustomerProjectNote"
      WHERE "organizationId" = ${organization.id}
    `;
    const noteIdSet = new Set(noteIds);
    const notes = allNotes.filter((note) => noteIdSet.has(note.id));

    for (const note of notes) {
      await prisma.$executeRaw`
        INSERT INTO "CustomerProjectNoteAcknowledgement" (
          "id",
          "organizationId",
          "noteId",
          "customerId",
          "projectId",
          "userId",
          "userName",
          "context",
          "noteTitle"
        )
        VALUES (
          ${randomUUID()},
          ${organization.id},
          ${note.id},
          ${cleanString(body.customerId) || note.customerId || null},
          ${cleanString(body.projectId) || note.projectId || null},
          ${actor.id},
          ${actorName},
          ${context},
          ${note.title}
        )
      `;
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Aktion nicht unterstuetzt." }, { status: 400 });
}
