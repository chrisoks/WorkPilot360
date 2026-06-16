import { NextResponse } from "next/server";
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

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

export async function GET(req: Request) {
  await ensureNotificationLinkColumns();
  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");
  const isHistory = searchParams.get("history") === "true";
  const search = (searchParams.get("search") || "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const { user, users } = await getDemoContext();
  const activeUser = users.find((demoUser) => demoUser.id === requestedUserId) ?? user;
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
  const { user, users } = await getDemoContext();
  const activeUser = users.find((demoUser) => demoUser.id === body.userId) ?? user;

  await prisma.$executeRaw`
    UPDATE "Notification"
    SET "readAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${activeUser.id}
      AND "readAt" IS NULL
  `;

  return NextResponse.json({ success: true });
}
