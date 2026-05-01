import { NextResponse } from "next/server";
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
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");
  const { user, users } = await getDemoContext();
  const activeUser = users.find((demoUser) => demoUser.id === requestedUserId) ?? user;

  const notifications = await prisma.$queryRaw<NotificationRow[]>`
    SELECT
      id,
      subject,
      body,
      channel,
      "createdAt",
      "readAt",
      "taskId"
    FROM "Notification"
    WHERE "userId" = ${activeUser.id}
    ORDER BY "createdAt" DESC
    LIMIT 20
  `;

  return NextResponse.json(
    notifications.map((notification) => ({
      id: notification.id,
      subject: notification.subject,
      body: notification.body,
      channel: notification.channel,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
      taskId: notification.taskId,
    }))
  );
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
