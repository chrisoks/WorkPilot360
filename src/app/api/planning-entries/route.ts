import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type PlanningEntryRow = {
  id: string;
  organizationId: string;
  source: string;
  board: string;
  groupName: string;
  userId: string | null;
  employeeName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  title: string;
  description: string | null;
  customer: string | null;
  projectId: string | null;
  projectLabel: string | null;
  offerId: string | null;
  offerLineId: string | null;
  offerLabel: string | null;
  offerTotalMinutes: number | null;
  offerPlannedMinutes: number | null;
  approvalStatus: string | null;
  requestedByUserId: string | null;
  requestedByName: string | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PlanningEntryHistoryRow = {
  id: string;
  organizationId: string;
  planningEntryId: string;
  projectId: string | null;
  eventType: string;
  actorUserId: string | null;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: Date;
};

async function ensurePlanningEntryTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "PlanningEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'manual',
      "board" TEXT NOT NULL,
      "groupName" TEXT NOT NULL,
      "userId" TEXT,
      "employeeName" TEXT,
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMinutes" INTEGER NOT NULL DEFAULT 0,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "customer" TEXT,
      "projectId" TEXT,
      "projectLabel" TEXT,
      "offerId" TEXT,
      "offerLineId" TEXT,
      "offerLabel" TEXT,
      "offerTotalMinutes" INTEGER,
      "offerPlannedMinutes" INTEGER,
      "approvalStatus" TEXT NOT NULL DEFAULT 'confirmed',
      "requestedByUserId" TEXT,
      "requestedByName" TEXT,
      "approvedByUserId" TEXT,
      "approvedAt" TIMESTAMP(3),
      "deletedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "PlanningEntry"
    ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'confirmed',
    ADD COLUMN IF NOT EXISTS "requestedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "requestedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "PlanningEntryHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "planningEntryId" TEXT NOT NULL,
      "projectId" TEXT,
      "eventType" TEXT NOT NULL,
      "actorUserId" TEXT,
      "actorName" TEXT,
      "fromStatus" TEXT,
      "toStatus" TEXT,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanMinutes(value: unknown) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
}

function cleanApprovalStatus(value: unknown) {
  return cleanString(value) === "requested" ? "requested" : "confirmed";
}

function getMinutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return Math.max(0, end - start);
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function getTimeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function hasTimeOverlap(first: PlanningEntryRow, second: PlanningEntryRow) {
  return (
    Math.max(getTimeMinutes(first.startTime), getTimeMinutes(second.startTime)) <
    Math.min(getTimeMinutes(first.endTime), getTimeMinutes(second.endTime))
  );
}

function isCreatedAfter(first: PlanningEntryRow, second: PlanningEntryRow) {
  const firstTime = first.createdAt.getTime();
  const secondTime = second.createdAt.getTime();

  if (firstTime === secondTime) return first.id > second.id;
  return firstTime > secondTime;
}

function formatHistoryEntry(entry: PlanningEntryHistoryRow) {
  return {
    id: entry.id,
    planningEntryId: entry.planningEntryId,
    projectId: entry.projectId ?? "",
    eventType: entry.eventType,
    actorUserId: entry.actorUserId ?? "",
    actorName: entry.actorName ?? "",
    fromStatus: entry.fromStatus ?? "",
    toStatus: entry.toStatus ?? "",
    note: entry.note ?? "",
    createdAt: entry.createdAt.toISOString(),
  };
}

function formatEntry(entry: PlanningEntryRow, histories: PlanningEntryHistoryRow[] = []) {
  return {
    id: entry.id,
    source: entry.source === "offer" ? "offer" : "manual",
    board: entry.board,
    groupName: entry.groupName,
    userId: entry.userId ?? "",
    employeeName: entry.employeeName ?? "",
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMinutes: entry.durationMinutes,
    title: entry.title,
    description: entry.description ?? "",
    customer: entry.customer ?? "",
    projectId: entry.projectId ?? "",
    projectLabel: entry.projectLabel ?? "",
    offerId: entry.offerId ?? "",
    offerLineId: entry.offerLineId ?? "",
    offerLabel: entry.offerLabel ?? "",
    offerTotalMinutes: entry.offerTotalMinutes ?? 0,
    offerPlannedMinutes: entry.offerPlannedMinutes ?? 0,
    approvalStatus: entry.approvalStatus === "requested" ? "requested" : "confirmed",
    requestedByUserId: entry.requestedByUserId ?? "",
    requestedByName: entry.requestedByName ?? "",
    approvedByUserId: entry.approvedByUserId ?? "",
    approvedAt: entry.approvedAt?.toISOString() ?? "",
    deletedAt: entry.deletedAt?.toISOString() ?? "",
    createdAt: entry.createdAt.toISOString(),
    history: histories.map(formatHistoryEntry),
  };
}

async function createPlanningHistoryEvent(input: {
  organizationId: string;
  planningEntryId: string;
  projectId: string;
  eventType: string;
  actorUserId: string;
  actorName: string;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "PlanningEntryHistory" (
      "id",
      "organizationId",
      "planningEntryId",
      "projectId",
      "eventType",
      "actorUserId",
      "actorName",
      "fromStatus",
      "toStatus",
      "note",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.organizationId},
      ${input.planningEntryId},
      ${input.projectId || null},
      ${input.eventType},
      ${input.actorUserId || null},
      ${input.actorName || null},
      ${input.fromStatus || null},
      ${input.toStatus || null},
      ${input.note || null},
      CURRENT_TIMESTAMP
    )
  `;
}

async function notifyPlanningResponsibles(entry: PlanningEntryRow, organizationId: string) {
  if (entry.approvalStatus !== "requested") return;

  await ensureNotificationLinkColumns();
  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "planningResponsibleFor" JSONB DEFAULT '[]'::jsonb
  `;

  const responsibilityKey = `${entry.board}:${entry.groupName}`;
  const recipients = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id, email
    FROM "User"
    WHERE "organizationId" = ${organizationId}
      AND "isActive" = true
      AND COALESCE("planningResponsibleFor", '[]'::jsonb) ? ${responsibilityKey}
  `;

  for (const recipient of recipients) {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Notification"
      WHERE "userId" = ${recipient.id}
        AND "linkTarget" = 'planning-entry'
        AND "linkTargetId" = ${entry.id}
      LIMIT 1
    `;

    if (existing.length > 0) continue;

    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id",
        "organizationId",
        "userId",
        "taskId",
        "channel",
        "subject",
        "body",
        "linkTarget",
        "linkTargetId",
        "linkLabel",
        "sentAt",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${organizationId},
        ${recipient.id},
        NULL,
        'app_email',
        'Terminwunsch freigeben',
        ${`Für ${entry.groupName} ist ein Terminwunsch am ${entry.date} von ${entry.startTime} bis ${entry.endTime} freizugeben: ${entry.title}. E-Mail an ${recipient.email} wurde vorgemerkt.`},
        'planning-entry',
        ${entry.id},
        'Termin öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

async function notifyPlanningOverlap(entry: PlanningEntryRow, organizationId: string, actorUserId = "") {
  if (!entry.userId) return;

  await ensureNotificationLinkColumns();
  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "planningResponsibleFor" JSONB DEFAULT '[]'::jsonb
  `;

  const overlaps = await prisma.$queryRaw<PlanningEntryRow[]>`
    SELECT *
    FROM "PlanningEntry"
    WHERE "organizationId" = ${organizationId}
      AND "id" <> ${entry.id}
      AND "userId" = ${entry.userId}
      AND "date" = ${entry.date}
      AND "deletedAt" IS NULL
  `;

  const conflictingEntries = overlaps.filter(
    (candidate) => isCreatedAfter(entry, candidate) && hasTimeOverlap(entry, candidate)
  );
  if (conflictingEntries.length === 0) return;

  const responsibilityKey = `${entry.board}:${entry.groupName}`;
  let recipients = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id, email
    FROM "User"
    WHERE "organizationId" = ${organizationId}
      AND "isActive" = true
      AND COALESCE("planningResponsibleFor", '[]'::jsonb) ? ${responsibilityKey}
  `;

  if (recipients.length === 0 && actorUserId) {
    recipients = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id, email
      FROM "User"
      WHERE "organizationId" = ${organizationId}
        AND "isActive" = true
        AND id = ${actorUserId}
      LIMIT 1
    `;
  }

  for (const recipient of recipients) {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Notification"
      WHERE "userId" = ${recipient.id}
        AND "linkTarget" = 'planning-entry-overlap'
        AND "linkTargetId" = ${entry.id}
        AND "readAt" IS NULL
      LIMIT 1
    `;

    if (existing.length > 0) continue;

    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id",
        "organizationId",
        "userId",
        "taskId",
        "channel",
        "subject",
        "body",
        "linkTarget",
        "linkTargetId",
        "linkLabel",
        "sentAt",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${organizationId},
        ${recipient.id},
        NULL,
        'app_email',
        'Achtung ein Mitarbeiter ist doppelt verplant - bitte prüfen',
        ${`${entry.employeeName ?? "Ein Mitarbeiter"} ist am ${entry.date} von ${entry.startTime} bis ${entry.endTime} parallel verplant. Bitte prüfen.`},
        'planning-entry-overlap',
        ${entry.id},
        'Konflikt öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensurePlanningEntryTable();

  const entries = await prisma.$queryRaw<PlanningEntryRow[]>`
    SELECT *
    FROM "PlanningEntry"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "date" ASC, "startTime" ASC
  `;
  const entryIds = entries.map((entry) => entry.id);
  const histories =
    entryIds.length > 0
      ? await prisma.$queryRaw<PlanningEntryHistoryRow[]>`
          SELECT *
          FROM "PlanningEntryHistory"
          WHERE "organizationId" = ${organization.id}
            AND "planningEntryId" IN (${Prisma.join(entryIds)})
          ORDER BY "createdAt" ASC
        `
      : [];
  const historiesByEntryId = new Map<string, PlanningEntryHistoryRow[]>();
  for (const history of histories) {
    historiesByEntryId.set(history.planningEntryId, [
      ...(historiesByEntryId.get(history.planningEntryId) ?? []),
      history,
    ]);
  }

  return NextResponse.json(
    entries.map((entry) => formatEntry(entry, historiesByEntryId.get(entry.id) ?? []))
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
  await ensurePlanningEntryTable();

  const id = cleanString(body.id) || randomUUID();
  const source = cleanString(body.source) === "offer" ? "offer" : "manual";
  const board = cleanString(body.board);
  const groupName = cleanString(body.groupName);
  const userId = cleanString(body.userId);
  const employeeName = cleanString(body.employeeName);
  const date = cleanString(body.date);
  const startTime = cleanString(body.startTime);
  const endTime = cleanString(body.endTime);
  const durationMinutes = cleanMinutes(body.durationMinutes) || getMinutesBetween(startTime, endTime);
  const title = cleanString(body.title);
  const description = cleanString(body.description);
  const customer = cleanString(body.customer);
  const projectId = cleanString(body.projectId);
  const projectLabel = cleanString(body.projectLabel);
  const offerId = cleanString(body.offerId);
  const offerLineId = cleanString(body.offerLineId);
  const offerLabel = cleanString(body.offerLabel);
  const offerTotalMinutes = cleanMinutes(body.offerTotalMinutes);
  const offerPlannedMinutes = cleanMinutes(body.offerPlannedMinutes);
  const approvalStatus = cleanApprovalStatus(body.approvalStatus);
  const requestedByUserId = cleanString(body.requestedByUserId);
  const requestedByName = cleanString(body.requestedByName);
  const approvedByUserId = cleanString(body.approvedByUserId);
  const actorUserId = cleanString(body.actorUserId);
  const actorName = cleanString(body.actorName);

  if (!board || !groupName || !date || !isValidTime(startTime) || !isValidTime(endTime)) {
    return NextResponse.json({ error: "Planungsboard, Gruppe, Datum und Uhrzeit sind Pflicht." }, { status: 400 });
  }

  if (!durationMinutes) {
    return NextResponse.json({ error: "Bitte eine gültige Dauer planen." }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Bitte einen Titel angeben." }, { status: 400 });
  }

  const existingRows = await prisma.$queryRaw<PlanningEntryRow[]>`
    SELECT *
    FROM "PlanningEntry"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const existingEntry = existingRows[0] ?? null;

  const rows = await prisma.$queryRaw<PlanningEntryRow[]>`
    INSERT INTO "PlanningEntry" (
      "id",
      "organizationId",
      "source",
      "board",
      "groupName",
      "userId",
      "employeeName",
      "date",
      "startTime",
      "endTime",
      "durationMinutes",
      "title",
      "description",
      "customer",
      "projectId",
      "projectLabel",
      "offerId",
      "offerLineId",
      "offerLabel",
      "offerTotalMinutes",
      "offerPlannedMinutes",
      "approvalStatus",
      "requestedByUserId",
      "requestedByName",
      "approvedByUserId",
      "approvedAt"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${source},
      ${board},
      ${groupName},
      ${userId || null},
      ${employeeName || null},
      ${date},
      ${startTime},
      ${endTime},
      ${durationMinutes},
      ${title},
      ${description || null},
      ${customer || null},
      ${projectId || null},
      ${projectLabel || null},
      ${offerId || null},
      ${offerLineId || null},
      ${offerLabel || null},
      ${offerTotalMinutes || null},
      ${offerPlannedMinutes || null},
      ${approvalStatus},
      ${requestedByUserId || null},
      ${requestedByName || null},
      ${approvedByUserId || null},
      ${approvalStatus === "confirmed" && approvedByUserId ? new Date() : null}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "source" = EXCLUDED."source",
      "board" = EXCLUDED."board",
      "groupName" = EXCLUDED."groupName",
      "userId" = EXCLUDED."userId",
      "employeeName" = EXCLUDED."employeeName",
      "date" = EXCLUDED."date",
      "startTime" = EXCLUDED."startTime",
      "endTime" = EXCLUDED."endTime",
      "durationMinutes" = EXCLUDED."durationMinutes",
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "customer" = EXCLUDED."customer",
      "projectId" = EXCLUDED."projectId",
      "projectLabel" = EXCLUDED."projectLabel",
      "offerId" = EXCLUDED."offerId",
      "offerLineId" = EXCLUDED."offerLineId",
      "offerLabel" = EXCLUDED."offerLabel",
      "offerTotalMinutes" = EXCLUDED."offerTotalMinutes",
      "offerPlannedMinutes" = EXCLUDED."offerPlannedMinutes",
      "approvalStatus" = EXCLUDED."approvalStatus",
      "requestedByUserId" = EXCLUDED."requestedByUserId",
      "requestedByName" = EXCLUDED."requestedByName",
      "approvedByUserId" = EXCLUDED."approvedByUserId",
      "approvedAt" = CASE
        WHEN EXCLUDED."approvalStatus" = 'confirmed' AND "PlanningEntry"."approvalStatus" = 'requested'
          THEN CURRENT_TIMESTAMP
        ELSE "PlanningEntry"."approvedAt"
      END,
      "deletedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const savedEntry = rows[0];

  if (!existingEntry) {
    await createPlanningHistoryEvent({
      organizationId: organization.id,
      planningEntryId: savedEntry.id,
      projectId,
      eventType: approvalStatus === "requested" ? "requested" : "created",
      actorUserId: actorUserId || requestedByUserId || approvedByUserId,
      actorName: actorName || requestedByName,
      toStatus: approvalStatus,
      note:
        approvalStatus === "requested"
          ? "Terminwunsch angelegt"
          : "Planungstermin angelegt",
    });
  }

  if (
    existingEntry &&
    existingEntry.approvalStatus === "requested" &&
    savedEntry.approvalStatus === "confirmed"
  ) {
    await createPlanningHistoryEvent({
      organizationId: organization.id,
      planningEntryId: savedEntry.id,
      projectId: savedEntry.projectId ?? "",
      eventType: "approved",
      actorUserId: actorUserId || approvedByUserId,
      actorName,
      fromStatus: "requested",
      toStatus: "confirmed",
      note: "Terminwunsch freigegeben",
    });
  } else if (existingEntry) {
    await createPlanningHistoryEvent({
      organizationId: organization.id,
      planningEntryId: savedEntry.id,
      projectId: savedEntry.projectId ?? "",
      eventType: "updated",
      actorUserId,
      actorName,
      fromStatus: existingEntry.approvalStatus ?? "",
      toStatus: savedEntry.approvalStatus ?? "",
      note: "Planungstermin geändert",
    });
  }

  await notifyPlanningResponsibles(savedEntry, organization.id);
  await notifyPlanningOverlap(savedEntry, organization.id, actorUserId);

  const history = await prisma.$queryRaw<PlanningEntryHistoryRow[]>`
    SELECT *
    FROM "PlanningEntryHistory"
    WHERE "organizationId" = ${organization.id}
      AND "planningEntryId" = ${savedEntry.id}
    ORDER BY "createdAt" ASC
  `;

  return NextResponse.json(formatEntry(savedEntry, history), { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = cleanString(searchParams.get("id"));
  const actorUserId = cleanString(searchParams.get("actorUserId"));
  const actorName = cleanString(searchParams.get("actorName"));

  if (!id) {
    return NextResponse.json({ error: "Planung fehlt." }, { status: 400 });
  }

  const { organization } = await getDemoContext();
  await ensurePlanningEntryTable();

  const entries = await prisma.$queryRaw<PlanningEntryRow[]>`
    SELECT *
    FROM "PlanningEntry"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const entry = entries[0];

  if (!entry) {
    return NextResponse.json({ ok: true });
  }

  if (!entry.deletedAt) {
    await createPlanningHistoryEvent({
      organizationId: organization.id,
      planningEntryId: entry.id,
      projectId: entry.projectId ?? "",
      eventType: "deleted",
      actorUserId,
      actorName,
      fromStatus: entry.approvalStatus ?? "",
      toStatus: "deleted",
      note: "Planungstermin gelöscht",
    });
  }

  await prisma.$executeRaw`
    UPDATE "PlanningEntry"
    SET "deletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  return NextResponse.json({ ok: true });
}
