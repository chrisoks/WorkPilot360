import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canManagePlanningEntries } from "@/lib/permissions";

type DemoUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
};

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
  planningTrade: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  billingGroupId: string | null;
  offerId: string | null;
  offerLineId: string | null;
  offerLabel: string | null;
  offerTotalMinutes: number | null;
  offerPlannedMinutes: number | null;
  marketingContentItemId: string | null;
  marketingContentScheduleId: string | null;
  recurrenceId: string | null;
  recurrenceRule: string | null;
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

function formatDateKeyDisplay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value || "-";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

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
      "planningTrade" TEXT NOT NULL DEFAULT '',
      "billingCatalogItemId" TEXT,
      "billingCatalogItemLabel" TEXT,
      "billingGroupId" TEXT,
      "offerId" TEXT,
      "offerLineId" TEXT,
      "offerLabel" TEXT,
      "offerTotalMinutes" INTEGER,
      "offerPlannedMinutes" INTEGER,
      "recurrenceId" TEXT,
      "recurrenceRule" TEXT,
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
    ADD COLUMN IF NOT EXISTS "planningTrade" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "billingCatalogItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "billingGroupId" TEXT,
    ADD COLUMN IF NOT EXISTS "recurrenceId" TEXT,
    ADD COLUMN IF NOT EXISTS "recurrenceRule" TEXT,
    ADD COLUMN IF NOT EXISTS "requestedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "requestedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentScheduleId" TEXT,
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

function getUserName(user: Pick<DemoUser, "firstName" | "lastName" | "email">) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
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
    source: entry.source === "offer" ? "offer" : entry.source === "marketingContent" ? "marketingContent" : "manual",
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
    planningTrade: entry.planningTrade ?? "",
    billingCatalogItemId: entry.billingCatalogItemId ?? "",
    billingCatalogItemLabel: entry.billingCatalogItemLabel ?? "",
    billingGroupId: entry.billingGroupId ?? "",
    offerId: entry.offerId ?? "",
    offerLineId: entry.offerLineId ?? "",
    offerLabel: entry.offerLabel ?? "",
    offerTotalMinutes: entry.offerTotalMinutes ?? 0,
    offerPlannedMinutes: entry.offerPlannedMinutes ?? 0,
    marketingContentItemId: entry.marketingContentItemId ?? "",
    marketingContentScheduleId: entry.marketingContentScheduleId ?? "",
    recurrenceId: entry.recurrenceId ?? "",
    recurrenceRule: entry.recurrenceRule ?? "",
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
      WHERE "organizationId" = ${organizationId}
        AND "userId" = ${recipient.id}
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
        ${`Für ${entry.groupName} ist ein Terminwunsch am ${formatDateKeyDisplay(entry.date)} von ${entry.startTime} bis ${entry.endTime} freizugeben: ${entry.title}. E-Mail an ${recipient.email} wurde vorgemerkt.`},
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
      WHERE "organizationId" = ${organizationId}
        AND "userId" = ${recipient.id}
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
        ${`${entry.employeeName ?? "Ein Mitarbeiter"} ist am ${formatDateKeyDisplay(entry.date)} von ${entry.startTime} bis ${entry.endTime} parallel verplant. Bitte prüfen.`},
        'planning-entry-overlap',
        ${entry.id},
        'Konflikt öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensurePlanningEntryTable();
  const { searchParams } = new URL(req.url);
  const requestedActorId = searchParams.get("actorUserId") ?? searchParams.get("actorId");
  const projectIdFilter = cleanString(searchParams.get("projectId"));
  const includeDeleted = searchParams.get("includeDeleted") === "1";
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const entries = projectIdFilter
    ? includeDeleted
      ? await prisma.$queryRaw<PlanningEntryRow[]>`
          SELECT *
          FROM "PlanningEntry"
          WHERE "organizationId" = ${organization.id}
            AND "projectId" = ${projectIdFilter}
          ORDER BY "date" ASC, "startTime" ASC
        `
      : await prisma.$queryRaw<PlanningEntryRow[]>`
          SELECT *
          FROM "PlanningEntry"
          WHERE "organizationId" = ${organization.id}
            AND "projectId" = ${projectIdFilter}
            AND "deletedAt" IS NULL
          ORDER BY "date" ASC, "startTime" ASC
        `
    : await prisma.$queryRaw<PlanningEntryRow[]>`
        SELECT *
        FROM "PlanningEntry"
        WHERE "organizationId" = ${organization.id}
          AND "deletedAt" IS NULL
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
  const { organization, users } = await getDemoContext();
  await ensurePlanningEntryTable();

  const actorResult = await getSessionBoundActor(req, users, body.actorUserId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const actorUserId = actor.id;
  const actorName = getUserName(actor);
  const actorCanManagePlanning = canManagePlanningEntries(actor);
  const id = cleanString(body.id) || randomUUID();
  const rawSource = cleanString(body.source);
  const source = rawSource === "offer" || rawSource === "marketingContent" ? rawSource : "manual";
  const board = cleanString(body.board);
  const groupName = cleanString(body.groupName);
  const userId = cleanString(body.userId);
  const date = cleanString(body.date);
  const startTime = cleanString(body.startTime);
  const endTime = cleanString(body.endTime);
  const durationMinutes = cleanMinutes(body.durationMinutes) || getMinutesBetween(startTime, endTime);
  const title = cleanString(body.title);
  const description = cleanString(body.description);
  const customer = cleanString(body.customer);
  const projectId = cleanString(body.projectId);
  const projectLabel = cleanString(body.projectLabel);
  const planningTrade = cleanString(body.planningTrade);
  const billingCatalogItemId = cleanString(body.billingCatalogItemId);
  const billingCatalogItemLabel = cleanString(body.billingCatalogItemLabel);
  const billingGroupId = cleanString(body.billingGroupId);
  const offerId = cleanString(body.offerId);
  const offerLineId = cleanString(body.offerLineId);
  const offerLabel = cleanString(body.offerLabel);
  const offerTotalMinutes = cleanMinutes(body.offerTotalMinutes);
  const offerPlannedMinutes = cleanMinutes(body.offerPlannedMinutes);
  const marketingContentItemId = cleanString(body.marketingContentItemId);
  const marketingContentScheduleId = cleanString(body.marketingContentScheduleId);
  const recurrenceId = cleanString(body.recurrenceId);
  const recurrenceRule = cleanString(body.recurrenceRule);
  const approvalStatus = cleanApprovalStatus(body.approvalStatus);

  if (!board || !groupName || !date || !isValidTime(startTime) || !isValidTime(endTime)) {
    return NextResponse.json({ error: "Planungsboard, Gruppe, Datum und Uhrzeit sind Pflicht." }, { status: 400 });
  }

  if (!durationMinutes) {
    return NextResponse.json({ error: "Bitte eine gültige Dauer planen." }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Bitte einen Titel angeben." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Bitte einen Mitarbeiter zuweisen, bevor der Termin gespeichert wird." }, { status: 400 });
  }

  const plannedUser = users.find((user) => user.id === userId && user.isActive);
  if (!plannedUser) {
    return NextResponse.json({ error: "Der gewaehlte Mitarbeiter ist nicht aktiv oder gehoert nicht zur Organisation." }, { status: 400 });
  }

  const employeeName = getUserName(plannedUser);

  const existingRows = await prisma.$queryRaw<PlanningEntryRow[]>`
    SELECT *
    FROM "PlanningEntry"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const existingEntry = existingRows[0] ?? null;

  if (!actorCanManagePlanning) {
    const ownsExistingEntry =
      existingEntry && (existingEntry.userId === actor.id || existingEntry.requestedByUserId === actor.id);

    if (approvalStatus !== "requested" || userId !== actor.id) {
      return NextResponse.json(
        { error: "Du darfst nur eigene Terminwuensche anlegen oder bearbeiten." },
        { status: 403 }
      );
    }

    if (existingEntry && (!ownsExistingEntry || existingEntry.approvalStatus !== "requested")) {
      return NextResponse.json(
        { error: "Du darfst diesen Planungstermin nicht bearbeiten." },
        { status: 403 }
      );
    }
  }

  const requestUser = cleanString(body.requestedByUserId)
    ? users.find((user) => user.id === cleanString(body.requestedByUserId) && user.isActive) ?? null
    : null;
  const existingRequestUser = existingEntry?.requestedByUserId
    ? users.find((user) => user.id === existingEntry.requestedByUserId && user.isActive) ?? null
    : null;
  const requestedByUser = approvalStatus === "requested" ? actor : existingRequestUser ?? requestUser ?? actor;
  const requestedByUserId = requestedByUser.id;
  const requestedByName = getUserName(requestedByUser);
  const approvedByUserId = approvalStatus === "confirmed" ? actor.id : "";

  if (projectId && !marketingContentScheduleId) {
    const duplicateRows = await prisma.$queryRaw<PlanningEntryRow[]>`
      SELECT *
      FROM "PlanningEntry"
      WHERE "organizationId" = ${organization.id}
        AND "id" <> ${id}
        AND "projectId" = ${projectId}
        AND "userId" = ${userId}
        AND "date" = ${date}
        AND "deletedAt" IS NULL
      LIMIT 1
    `;

    if (duplicateRows.length > 0) {
      return NextResponse.json(
        { error: "Dieser Mitarbeiter ist an diesem Tag bereits auf dieses Projekt geplant. Bitte den bestehenden Termin bearbeiten statt einen zweiten Termin anzulegen." },
        { status: 409 }
      );
    }
  }

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
      "planningTrade",
      "billingCatalogItemId",
      "billingCatalogItemLabel",
      "billingGroupId",
      "offerId",
      "offerLineId",
      "offerLabel",
      "offerTotalMinutes",
      "offerPlannedMinutes",
      "marketingContentItemId",
      "marketingContentScheduleId",
      "recurrenceId",
      "recurrenceRule",
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
      ${planningTrade},
      ${billingCatalogItemId || null},
      ${billingCatalogItemLabel || null},
      ${billingGroupId || null},
      ${offerId || null},
      ${offerLineId || null},
      ${offerLabel || null},
      ${offerTotalMinutes || null},
      ${offerPlannedMinutes || null},
      ${marketingContentItemId || null},
      ${marketingContentScheduleId || null},
      ${recurrenceId || null},
      ${recurrenceRule || null},
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
      "planningTrade" = EXCLUDED."planningTrade",
      "billingCatalogItemId" = EXCLUDED."billingCatalogItemId",
      "billingCatalogItemLabel" = EXCLUDED."billingCatalogItemLabel",
      "billingGroupId" = EXCLUDED."billingGroupId",
      "offerId" = EXCLUDED."offerId",
      "offerLineId" = EXCLUDED."offerLineId",
      "offerLabel" = EXCLUDED."offerLabel",
      "offerTotalMinutes" = EXCLUDED."offerTotalMinutes",
      "offerPlannedMinutes" = EXCLUDED."offerPlannedMinutes",
      "marketingContentItemId" = EXCLUDED."marketingContentItemId",
      "marketingContentScheduleId" = EXCLUDED."marketingContentScheduleId",
      "recurrenceId" = EXCLUDED."recurrenceId",
      "recurrenceRule" = EXCLUDED."recurrenceRule",
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
      actorUserId,
      actorName,
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
      actorUserId,
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
  const historyId = cleanString(searchParams.get("historyId"));

  if (!id && !historyId) {
    return NextResponse.json({ error: "Planung fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensurePlanningEntryTable();

  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorUserId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const actorUserId = actor.id;
  const actorName = getUserName(actor);
  const actorCanManagePlanning = canManagePlanningEntries(actor);

  if (historyId) {
    if (actor.role !== Role.GESCHAEFTSFUEHRER) {
      return NextResponse.json(
        { error: "Nur Gesch\u00e4ftsf\u00fchrer d\u00fcrfen Historieneintr\u00e4ge l\u00f6schen." },
        { status: 403 }
      );
    }

    await prisma.$executeRaw`
      DELETE FROM "PlanningEntryHistory"
      WHERE "id" = ${historyId}
        AND "organizationId" = ${organization.id}
    `;

    return NextResponse.json({ ok: true });
  }

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

  if (
    !actorCanManagePlanning &&
    (entry.approvalStatus !== "requested" || (entry.userId !== actor.id && entry.requestedByUserId !== actor.id))
  ) {
    return NextResponse.json(
      { error: "Du darfst diesen Planungstermin nicht loeschen." },
      { status: 403 }
    );
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
