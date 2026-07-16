import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canManagePlanningEntries } from "@/lib/permissions";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import { sendPushToUserSafely } from "@/lib/push/web-push";

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
  objectAddressId: string | null;
  objectAddressLabel: string | null;
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
      "objectAddressId" TEXT,
      "objectAddressLabel" TEXT,
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
    ADD COLUMN IF NOT EXISTS "objectAddressId" TEXT,
    ADD COLUMN IF NOT EXISTS "objectAddressLabel" TEXT,
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

async function getManagementNotificationRecipients(organizationId: string) {
  return prisma.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id, email
    FROM "User"
    WHERE "organizationId" = ${organizationId}
      AND "isActive" = true
      AND "role" IN ('ADMIN', 'GESCHAEFTSFUEHRER')
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

function formatPlanningRequestBody(entry: PlanningEntryRow) {
  return `Für ${entry.groupName} ist ein Terminwunsch am ${formatDateKeyDisplay(entry.date)} von ${entry.startTime} bis ${entry.endTime} freizugeben: ${entry.title}.`;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
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
    objectAddressId: entry.objectAddressId ?? "",
    objectAddressLabel: entry.objectAddressLabel ?? "",
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

    const title = "Terminwunsch freigeben";
    const body = formatPlanningRequestBody(entry);
    const notificationId = randomUUID();
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
        ${notificationId},
        ${organizationId},
        ${recipient.id},
        NULL,
        'app',
        ${title},
        ${body},
        'planning-entry',
        ${entry.id},
        'Termin öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;

    await sendNotificationMailSafely({
      notificationId,
      userId: recipient.id,
      subject: title,
      body,
    });

    await sendPushToUserSafely({
      organizationId,
      userId: recipient.id,
      payload: {
        title,
        body,
        notificationId,
        linkTarget: "planning-entry",
        linkTargetId: entry.id,
        url: `/?target=planning-entry&targetId=${encodeURIComponent(entry.id)}`,
      },
    });
  }
}

async function notifyPlanningOverlap(entry: PlanningEntryRow, organizationId: string, actorUserId = "") {
  if (!entry.userId || entry.approvalStatus !== "confirmed") return;

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
      AND COALESCE("approvalStatus", 'confirmed') = 'confirmed'
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

  const recipientMap = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  for (const recipient of await getManagementNotificationRecipients(organizationId)) {
    recipientMap.set(recipient.id, recipient);
  }
  recipients = Array.from(recipientMap.values());

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

    const subject = "Achtung ein Mitarbeiter ist doppelt verplant - bitte pruefen";
    const body = `${entry.employeeName ?? "Ein Mitarbeiter"} ist am ${formatDateKeyDisplay(entry.date)} von ${
      entry.startTime
    } bis ${entry.endTime} parallel verplant. Bitte pruefen.`;
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
        'app',
        'Achtung ein Mitarbeiter ist doppelt verplant - bitte prüfen',
        ${`${entry.employeeName ?? "Ein Mitarbeiter"} ist am ${formatDateKeyDisplay(entry.date)} von ${entry.startTime} bis ${entry.endTime} parallel verplant. Bitte prüfen.`},
        'planning-entry-overlap',
        ${entry.id},
        'Konflikt öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
    const notificationRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Notification"
      WHERE "organizationId" = ${organizationId}
        AND "userId" = ${recipient.id}
        AND "linkTarget" = 'planning-entry-overlap'
        AND "linkTargetId" = ${entry.id}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    const notificationId = notificationRows[0]?.id ?? "";
    if (notificationId) {
      await sendNotificationMailSafely({
        notificationId,
        userId: recipient.id,
        subject,
        body,
      });
    }
  }
}

async function syncPlanningCapacityAlert(entry: PlanningEntryRow, organizationId: string, actorUserId = "") {
  if (!entry.userId || entry.approvalStatus !== "confirmed") return;

  await ensureNotificationLinkColumns();
  const alertTargetId = `${entry.userId}:${entry.date}`;
  const userRows = await prisma.$queryRaw<
    Array<{ dailyWorkHours: number; weeklyCapacity: Prisma.JsonValue }>
  >`
    SELECT "dailyWorkHours", "weeklyCapacity"
    FROM "User"
    WHERE id = ${entry.userId}
      AND "organizationId" = ${organizationId}
      AND "isActive" = true
    LIMIT 1
  `;
  const user = userRows[0];
  if (!user) return;

  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIndex = new Date(`${entry.date}T12:00:00Z`).getUTCDay();
  const dayKey = dayKeys[dayIndex] ?? "monday";
  const weeklyCapacity = user.weeklyCapacity;
  const configuredHours =
    weeklyCapacity && typeof weeklyCapacity === "object" && !Array.isArray(weeklyCapacity)
      ? Number(weeklyCapacity[dayKey])
      : Number.NaN;
  let capacityHours = Number.isFinite(configuredHours) && configuredHours >= 0
    ? configuredHours
    : Math.max(0, Number(user.dailyWorkHours) || 0);

  const absenceRows = await prisma.$queryRaw<Array<{ dayPart: string }>>`
    SELECT "dayPart"
    FROM "Absence"
    WHERE "organizationId" = ${organizationId}
      AND "userId" = ${entry.userId}
      AND date = ${entry.date}::date
      AND "deletedAt" IS NULL
      AND status = 'genehmigt'
      AND type IN ('urlaub', 'krank', 'ueberstundenabbau')
    LIMIT 1
  `;
  const absence = absenceRows[0];
  if (absence?.dayPart === "full") capacityHours = 0;
  if (absence?.dayPart === "first-half" || absence?.dayPart === "second-half") capacityHours /= 2;

  const totalRows = await prisma.$queryRaw<Array<{ totalMinutes: number }>>`
    SELECT COALESCE(SUM("durationMinutes"), 0)::int AS "totalMinutes"
    FROM "PlanningEntry"
    WHERE "organizationId" = ${organizationId}
      AND "userId" = ${entry.userId}
      AND date = ${entry.date}
      AND "deletedAt" IS NULL
      AND COALESCE("approvalStatus", 'confirmed') = 'confirmed'
  `;
  const plannedHours = Math.max(0, Number(totalRows[0]?.totalMinutes ?? 0)) / 60;
  const isOverCapacity = plannedHours > capacityHours + 0.01;

  if (!isOverCapacity) {
    await prisma.$executeRaw`
      DELETE FROM "Notification"
      WHERE "organizationId" = ${organizationId}
        AND "linkTarget" = 'planning-entry-overcapacity'
        AND "linkTargetId" = ${alertTargetId}
    `;
    return;
  }

  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "planningResponsibleFor" JSONB DEFAULT '[]'::jsonb
  `;
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
  const recipientMap = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  for (const recipient of await getManagementNotificationRecipients(organizationId)) {
    recipientMap.set(recipient.id, recipient);
  }

  const subject = "Kapazität überschritten - Planung prüfen";
  const body = `${entry.employeeName ?? "Ein Mitarbeiter"} ist am ${formatDateKeyDisplay(entry.date)} mit ${plannedHours.toFixed(2).replace(".", ",")} Std. bei ${capacityHours.toFixed(2).replace(".", ",")} Std. verfügbarer Kapazität überplant.`;
  for (const recipient of recipientMap.values()) {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Notification"
      WHERE "organizationId" = ${organizationId}
        AND "userId" = ${recipient.id}
        AND "linkTarget" = 'planning-entry-overcapacity'
        AND "linkTargetId" = ${alertTargetId}
      LIMIT 1
    `;
    if (existing.length > 0) continue;

    const notification = await prisma.notification.create({
      data: {
        id: randomUUID(),
        organizationId,
        userId: recipient.id,
        taskId: null,
        channel: "app",
        subject,
        body,
        linkTarget: "planning-entry-overcapacity",
        linkTargetId: alertTargetId,
        linkLabel: "Planung öffnen",
        sentAt: null,
      },
    });
    await sendNotificationMailSafely({
      notificationId: notification.id,
      userId: recipient.id,
      subject,
      body,
    });
  }
}

function didPlanningTimeChange(existingEntry: PlanningEntryRow | null, savedEntry: PlanningEntryRow) {
  if (!existingEntry) return false;
  return (
    cleanString(existingEntry.date) !== cleanString(savedEntry.date) ||
    cleanString(existingEntry.startTime) !== cleanString(savedEntry.startTime) ||
    cleanString(existingEntry.endTime) !== cleanString(savedEntry.endTime)
  );
}

function formatPlanningTimeChangeBody(existingEntry: PlanningEntryRow | null, savedEntry: PlanningEntryRow) {
  const title = savedEntry.title;
  const oldDate = cleanString(existingEntry?.date);
  const oldStartTime = cleanString(existingEntry?.startTime);
  const oldEndTime = cleanString(existingEntry?.endTime);
  const newDate = cleanString(savedEntry.date);
  const newStartTime = cleanString(savedEntry.startTime);
  const newEndTime = cleanString(savedEntry.endTime);

  if (oldDate && oldStartTime && oldEndTime && newDate && newStartTime && newEndTime) {
    return `Dein Termin „${title}“ wurde von ${formatDateKeyDisplay(oldDate)}, ${oldStartTime}-${oldEndTime} auf ${formatDateKeyDisplay(newDate)}, ${newStartTime}-${newEndTime} geändert.`;
  }

  return `Dein Termin „${title}“ wurde auf ${formatDateKeyDisplay(savedEntry.date)}, ${savedEntry.startTime}-${savedEntry.endTime} geändert.`;
}

async function createPlanningLifecycleNotification(input: {
  organizationId: string;
  userId: string;
  actorUserId: string;
  entryId: string;
  title: string;
  body: string;
}) {
  if (!input.userId || input.userId === input.actorUserId) return;

  await ensureNotificationLinkColumns();
  const notification = await prisma.notification.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      userId: input.userId,
      taskId: null,
      channel: "app",
      subject: input.title,
      body: input.body,
      linkTarget: "planning-entry",
      linkTargetId: input.entryId,
      linkLabel: "Termin öffnen",
      sentAt: null,
    },
  });

  await sendNotificationMailSafely({
    notificationId: notification.id,
    userId: input.userId,
    subject: input.title,
    body: input.body,
  });
  await sendPushToUserSafely({
    organizationId: input.organizationId,
    userId: input.userId,
    payload: {
      title: input.title,
      body: input.body,
      notificationId: notification.id,
      linkTarget: "planning-entry",
      linkTargetId: input.entryId,
      url: `/?target=planning-entry&targetId=${encodeURIComponent(input.entryId)}`,
    },
  });
}

async function notifyPlanningEntryConfirmed(input: {
  organizationId: string;
  entry: PlanningEntryRow;
  actorUserId: string;
  wasRequested: boolean;
}) {
  const recipientIds = new Set(
    [cleanString(input.entry.userId), cleanString(input.entry.requestedByUserId)].filter(Boolean)
  );
  const title = input.wasRequested ? "Terminwunsch bestätigt" : "Neuer Planungstermin";
  const body = input.wasRequested
    ? `Der Terminwunsch „${input.entry.title}“ am ${formatDateKeyDisplay(input.entry.date)} von ${input.entry.startTime} bis ${input.entry.endTime} wurde bestätigt.`
    : `Für dich wurde der Termin „${input.entry.title}“ am ${formatDateKeyDisplay(input.entry.date)} von ${input.entry.startTime} bis ${input.entry.endTime} eingeplant.`;

  for (const userId of recipientIds) {
    await createPlanningLifecycleNotification({
      organizationId: input.organizationId,
      userId,
      actorUserId: input.actorUserId,
      entryId: input.entry.id,
      title,
      body,
    });
  }
}

async function notifyPlanningEntryDeleted(input: {
  organizationId: string;
  entry: PlanningEntryRow;
  actorUserId: string;
}) {
  const recipientIds = new Set(
    [cleanString(input.entry.userId), cleanString(input.entry.requestedByUserId)].filter(Boolean)
  );
  const wasRequested = input.entry.approvalStatus === "requested";
  const title = wasRequested ? "Terminwunsch zurückgezogen" : "Planungstermin abgesagt";
  const body = `${wasRequested ? "Der Terminwunsch" : "Der Termin"} „${input.entry.title}“ am ${formatDateKeyDisplay(input.entry.date)} von ${input.entry.startTime} bis ${input.entry.endTime} wurde gelöscht.`;

  for (const userId of recipientIds) {
    await createPlanningLifecycleNotification({
      organizationId: input.organizationId,
      userId,
      actorUserId: input.actorUserId,
      entryId: input.entry.id,
      title,
      body,
    });
  }
}

async function notifyPlannedEmployeeAboutTimeChange(input: {
  organizationId: string;
  existingEntry: PlanningEntryRow | null;
  entry: PlanningEntryRow;
  actorUserId: string;
}) {
  const targetUserId = cleanString(input.entry.userId);
  const title = "Termin geändert";
  const body = formatPlanningTimeChangeBody(input.existingEntry, input.entry);
  await createPlanningLifecycleNotification({
    organizationId: input.organizationId,
    userId: targetUserId,
    actorUserId: input.actorUserId,
    entryId: input.entry.id,
    title,
    body,
  });
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
  let objectAddressId = cleanString(body.objectAddressId);
  let objectAddressLabel = cleanString(body.objectAddressLabel);
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

  if (!isValidDateKey(date)) {
    return NextResponse.json({ error: "Bitte ein gültiges Datum im Format JJJJ-MM-TT angeben." }, { status: 400 });
  }

  if (!durationMinutes) {
    return NextResponse.json({ error: "Bitte eine gültige Dauer planen." }, { status: 400 });
  }

  const elapsedMinutes = getMinutesBetween(startTime, endTime);
  if (!elapsedMinutes) {
    return NextResponse.json(
      { error: "Die Endzeit muss nach der Startzeit liegen." },
      { status: 400 }
    );
  }

  if (durationMinutes > elapsedMinutes) {
    return NextResponse.json(
      { error: "Die geplante Dauer darf den gewählten Zeitraum nicht überschreiten." },
      { status: 400 }
    );
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

  if (board === "OK immocare" && projectId) {
    const projects = await prisma.$queryRaw<Array<{
      contactId: string | null;
      addressContactId: string | null;
      objectAddressId: string | null;
      address: string | null;
    }>>`
      SELECT "contactId", "addressContactId", "objectAddressId", "address"
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${organization.id}
        AND "id" = ${projectId}
      LIMIT 1
    `;
    const project = projects[0];
    if (!project) {
      return NextResponse.json({ error: "Das ausgewählte Projekt ist ungültig." }, { status: 400 });
    }

    if (project.objectAddressId) {
      const addresses = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        street: string;
        postalCode: string;
        city: string;
      }>>`
        SELECT "id", "name", "street", "postalCode", "city"
        FROM "ObjectAddress"
        WHERE "organizationId" = ${organization.id}
          AND "id" = ${project.objectAddressId}
          AND "customerId" = ${project.contactId}
          AND "isActive" = true
        LIMIT 1
      `;
      const selectedAddress = addresses[0];
      if (!selectedAddress) {
        return NextResponse.json(
          { error: "Die im Projekt hinterlegte Objektadresse ist ungültig oder inaktiv." },
          { status: 400 }
        );
      }
      objectAddressId = selectedAddress.id;
      objectAddressLabel = `${selectedAddress.name} | ${selectedAddress.street}, ${selectedAddress.postalCode} ${selectedAddress.city}`;
    } else if (project.address?.trim()) {
      objectAddressId = "";
      objectAddressLabel = project.address.trim();
    } else {
      const addressContactId = project.addressContactId || project.contactId;
      const contacts = addressContactId
        ? await prisma.$queryRaw<Array<{
            street: string | null;
            postalCode: string | null;
            city: string | null;
          }>>`
            SELECT "street", "postalCode", "city"
            FROM "Contact"
            WHERE "organizationId" = ${organization.id}
              AND "id" = ${addressContactId}
            LIMIT 1
          `
        : [];
      const addressContact = contacts[0];
      if (!addressContact?.street?.trim() || !addressContact.postalCode?.trim() || !addressContact.city?.trim()) {
        return NextResponse.json(
          { error: "Für dieses Immocare-Projekt ist noch keine Einsatzadresse hinterlegt." },
          { status: 400 }
        );
      }
      objectAddressId = "";
      objectAddressLabel = `${addressContact.street.trim()}, ${addressContact.postalCode.trim()} ${addressContact.city.trim()}`;
    }
  }

  const plannedUserBoard = cleanString(plannedUser.planningBoard) || "OK solutions";
  const plannedUserGroup = cleanString(plannedUser.planningGroup);
  if (plannedUserBoard !== board || plannedUserGroup !== groupName) {
    return NextResponse.json(
      { error: "Der gewählte Mitarbeiter gehört nicht zu diesem Planungsboard und dieser Planungsgruppe." },
      { status: 400 }
    );
  }

  const blockingAbsences = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Absence"
    WHERE "organizationId" = ${organization.id}
      AND "userId" = ${userId}
      AND date = ${date}::date
      AND "deletedAt" IS NULL
      AND status = 'genehmigt'
      AND type IN ('urlaub', 'krank', 'ueberstundenabbau')
      AND (
        COALESCE("dayPart", 'full') = 'full'
        OR ("dayPart" = 'first-half' AND ${startTime} < '12:00')
        OR ("dayPart" = 'second-half' AND ${endTime} > '12:00')
      )
    LIMIT 1
  `;
  if (blockingAbsences.length > 0) {
    return NextResponse.json(
      { error: "Der gewählte Mitarbeiter ist in diesem Zeitraum genehmigt abwesend. Die Planung wurde blockiert." },
      { status: 409 }
    );
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
        { error: "Du darfst nur eigene Terminwünsche anlegen oder bearbeiten." },
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
      "objectAddressId",
      "objectAddressLabel",
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
      ${objectAddressId || null},
      ${objectAddressLabel || null},
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
      "objectAddressId" = EXCLUDED."objectAddressId",
      "objectAddressLabel" = EXCLUDED."objectAddressLabel",
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
  await syncPlanningCapacityAlert(savedEntry, organization.id, actorUserId);
  if (savedEntry.approvalStatus === "confirmed" && (!existingEntry || existingEntry.approvalStatus === "requested")) {
    await notifyPlanningEntryConfirmed({
      organizationId: organization.id,
      entry: savedEntry,
      actorUserId,
      wasRequested: existingEntry?.approvalStatus === "requested",
    });
  }
  if (actorCanManagePlanning && didPlanningTimeChange(existingEntry, savedEntry)) {
    await notifyPlannedEmployeeAboutTimeChange({
      organizationId: organization.id,
      existingEntry,
      entry: savedEntry,
      actorUserId,
    });
  }

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
      { error: "Du darfst diesen Planungstermin nicht löschen." },
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

  await notifyPlanningEntryDeleted({
    organizationId: organization.id,
    entry,
    actorUserId,
  });
  await syncPlanningCapacityAlert(entry, organization.id, actorUserId);

  return NextResponse.json({ ok: true });
}
