import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type NotificationRow = {
  id: string;
  subject: string;
  body: string;
  channel: string;
  createdAt: Date;
  readAt: Date | null;
  taskId: string | null;
  linkTarget: string | null;
  linkTargetId: string | null;
  linkLabel: string | null;
};

type NotificationEscalationInput = {
  afterBusinessDays: number;
  userIds: string[];
  subjectPrefix: string;
  bodySuffix: string;
};

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

function getRequestUser(
  users: Array<{ id: string; isActive?: boolean | null }>,
  userId: unknown
) {
  if (typeof userId !== "string" || !userId.trim()) {
    return null;
  }

  return users.find((demoUser) => demoUser.id === userId.trim() && demoUser.isActive !== false) ?? null;
}

function unauthorizedUserResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

export async function GET(req: Request) {
  await ensureNotificationLinkColumns();
  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");
  const isHistory = searchParams.get("history") === "true";
  const search = (searchParams.get("search") || "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const { users } = await getDemoContext();
  const activeUser = getRequestUser(users, requestedUserId);

  if (!activeUser) {
    return unauthorizedUserResponse();
  }

  const searchFilter = search
    ? Prisma.sql`AND (
        LOWER("subject") LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER("body") LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER("channel") LIKE ${`%${search.toLowerCase()}%`}
      )`
    : Prisma.empty;

  const notifications = await prisma.$queryRaw<NotificationRow[]>`
    SELECT
      id,
      subject,
      body,
      channel,
      "createdAt",
      "readAt",
      "taskId",
      "linkTarget",
      "linkTargetId",
      "linkLabel"
    FROM "Notification"
    WHERE "userId" = ${activeUser.id}
      ${isHistory ? Prisma.empty : Prisma.sql`AND "readAt" IS NULL`}
      ${searchFilter}
    ORDER BY "createdAt" DESC
    ${isHistory ? Prisma.sql`LIMIT ${limit + 1} OFFSET ${offset}` : Prisma.empty}
  `;
  const hasMore = isHistory && notifications.length > limit;
  const visibleNotifications = isHistory ? notifications.slice(0, limit) : notifications;

  const items = visibleNotifications.map((notification) => ({
      id: notification.id,
      subject: notification.subject,
      body: notification.body,
      channel: notification.channel,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
      taskId: notification.taskId,
      linkTarget: notification.linkTarget ?? "",
      linkTargetId: notification.linkTargetId ?? "",
      linkLabel: notification.linkLabel ?? "",
    }));

  if (isHistory) {
    return NextResponse.json({
      items,
      hasMore,
      nextOffset: offset + items.length,
    });
  }

  return NextResponse.json(items);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { users } = await getDemoContext();
  const activeUser = getRequestUser(users, body.userId);

  if (!activeUser) {
    return unauthorizedUserResponse();
  }

  await prisma.$executeRaw`
    UPDATE "Notification"
    SET "readAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${activeUser.id}
      AND "readAt" IS NULL
  `;

  return NextResponse.json({ success: true });
}

function getBusinessDaysElapsed(fromDate: Date, toDate = new Date()) {
  if (toDate.getTime() <= fromDate.getTime()) return 0;

  let cursor = new Date(fromDate);
  let businessMs = 0;
  while (cursor.getTime() < toDate.getTime()) {
    const nextDay = new Date(cursor);
    nextDay.setHours(24, 0, 0, 0);
    const chunkEnd = nextDay.getTime() < toDate.getTime() ? nextDay : toDate;
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      businessMs += chunkEnd.getTime() - cursor.getTime();
    }
    cursor = chunkEnd;
  }

  return businessMs / (24 * 60 * 60 * 1000);
}

function cleanEscalations(value: unknown): NotificationEscalationInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const current = item as Record<string, unknown>;
      const userIds = Array.isArray(current.userIds)
        ? current.userIds.map((userId) => String(userId || "").trim()).filter(Boolean)
        : [];
      const afterBusinessDays = Math.max(0, Number(current.afterBusinessDays) || 0);
      const subjectPrefix = String(current.subjectPrefix || "").trim();
      const bodySuffix = String(current.bodySuffix || "").trim();
      if (userIds.length === 0 || afterBusinessDays <= 0 || !subjectPrefix) return null;
      return { afterBusinessDays, userIds, subjectPrefix, bodySuffix };
    })
    .filter((item): item is NotificationEscalationInput => Boolean(item));
}

export async function POST(req: Request) {
  await ensureNotificationLinkColumns();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const recipientUserIds = Array.isArray(body.userIds)
    ? body.userIds.map((value: unknown) => String(value || "").trim()).filter(Boolean)
    : [];
  const subject = String(body.subject || "").trim();
  const message = String(body.body || "").trim();
  const linkTarget = String(body.linkTarget || "").trim();
  const linkTargetId = String(body.linkTargetId || "").trim();
  const linkLabel = String(body.linkLabel || "").trim();
  const reminderAfterDays = Math.max(0, Number(body.reminderAfterDays) || 0);
  const escalations = cleanEscalations(body.escalations);

  if (recipientUserIds.length === 0 || !subject || !message) {
    return NextResponse.json({ error: "Empfänger, Betreff und Text sind erforderlich." }, { status: 400 });
  }

  const activeRecipientIds = Array.from(
    new Set(
      recipientUserIds.filter((userId: string) =>
        users.some((user) => user.id === userId && user.isActive)
      )
    )
  );

  let created = 0;
  for (const userId of activeRecipientIds) {
    const existing = await prisma.$queryRaw<Array<{ id: string; createdAt: Date }>>`
      SELECT id, "createdAt"
      FROM "Notification"
      WHERE "organizationId" = ${organization.id}
        AND "userId" = ${userId}
        AND "subject" = ${subject}
        AND COALESCE("linkTarget", '') = ${linkTarget}
        AND COALESCE("linkTargetId", '') = ${linkTargetId}
      LIMIT 1
    `;
    const existingNotification = existing[0] ?? null;
    let notificationSubject = subject;
    let notificationBody = message;
    if (existingNotification) {
      if (reminderAfterDays <= 0) continue;
      const ageMs = Date.now() - new Date(existingNotification.createdAt).getTime();
      if (ageMs < reminderAfterDays * 24 * 60 * 60 * 1000) continue;

      notificationSubject = `Erinnerung: ${subject}`;
      notificationBody = `${message} Der Hinweis ist seit mindestens ${reminderAfterDays} Tagen offen.`;
      const existingReminder = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "Notification"
        WHERE "organizationId" = ${organization.id}
          AND "userId" = ${userId}
          AND "subject" = ${notificationSubject}
          AND COALESCE("linkTarget", '') = ${linkTarget}
          AND COALESCE("linkTargetId", '') = ${linkTargetId}
        LIMIT 1
      `;
      if (existingReminder.length > 0) continue;
    }

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
        ${organization.id},
        ${userId},
        NULL,
        'app',
        ${notificationSubject},
        ${notificationBody},
        ${linkTarget || null},
        ${linkTargetId || null},
        ${linkLabel || null},
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
    created += 1;
  }

  if (escalations.length > 0 && activeRecipientIds.length > 0) {
    const baseNotifications = await prisma.$queryRaw<Array<{ id: string; createdAt: Date }>>`
      SELECT id, "createdAt"
      FROM "Notification"
      WHERE "organizationId" = ${organization.id}
        AND "subject" = ${subject}
        AND COALESCE("linkTarget", '') = ${linkTarget}
        AND COALESCE("linkTargetId", '') = ${linkTargetId}
        AND "userId" IN (${Prisma.join(activeRecipientIds)})
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
    const baseNotification = baseNotifications[0] ?? null;

    if (baseNotification) {
      const businessDaysElapsed = getBusinessDaysElapsed(new Date(baseNotification.createdAt));

      for (const escalation of escalations) {
        if (businessDaysElapsed < escalation.afterBusinessDays) continue;
        const escalationRecipientIds = Array.from(
          new Set(
            escalation.userIds.filter((userId) =>
              users.some((user) => user.id === userId && user.isActive)
            )
          )
        );
        const escalationSubject = `${escalation.subjectPrefix}: ${subject}`;
        const escalationBody = [message, escalation.bodySuffix].filter(Boolean).join(" ");

        for (const userId of escalationRecipientIds) {
          const existingEscalation = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM "Notification"
            WHERE "organizationId" = ${organization.id}
              AND "userId" = ${userId}
              AND "subject" = ${escalationSubject}
              AND COALESCE("linkTarget", '') = ${linkTarget}
              AND COALESCE("linkTargetId", '') = ${linkTargetId}
            LIMIT 1
          `;
          if (existingEscalation.length > 0) continue;

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
              ${organization.id},
              ${userId},
              NULL,
              'app',
              ${escalationSubject},
              ${escalationBody},
              ${linkTarget || null},
              ${linkTargetId || null},
              ${linkLabel || null},
              NULL,
              CURRENT_TIMESTAMP
            )
          `;
          created += 1;
        }
      }
    }
  }

  return NextResponse.json({ success: true, created });
}
