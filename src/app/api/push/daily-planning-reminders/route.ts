import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { sendPushToUserSafely } from "@/lib/push/web-push";

export const dynamic = "force-dynamic";

type ReminderUserRow = {
  id: string;
};

function getCronSecret() {
  return process.env.PUSH_REMINDER_CRON_SECRET || process.env.WORKPILOT_CRON_SECRET || process.env.CRON_SECRET || "";
}

function isAuthorizedCronRequest(req: Request) {
  const secret = getCronSecret();
  if (!secret) return false;

  const authorization = req.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const headerToken = req.headers.get("x-cron-secret") || "";
  return bearerToken === secret || headerToken === secret;
}

function getBerlinDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return year && month && day ? `${year}-${month}-${day}` : "";
}

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

async function getReminderUsers(organizationId: string, dateKey: string) {
  return prisma.$queryRaw<ReminderUserRow[]>`
    SELECT DISTINCT users.id
    FROM "User" users
    INNER JOIN "PlanningEntry" planningEntries
      ON planningEntries."userId" = users.id
      AND planningEntries."organizationId" = users."organizationId"
      AND planningEntries.date = ${dateKey}
      AND planningEntries."deletedAt" IS NULL
      AND COALESCE(planningEntries."approvalStatus", 'confirmed') <> 'requested'
    WHERE users."organizationId" = ${organizationId}
      AND users."isActive" = true
      AND NOT EXISTS (
        SELECT 1
        FROM "Absence" absences
        WHERE absences."organizationId" = users."organizationId"
          AND absences."userId" = users.id
          AND absences.date = ${dateKey}::date
          AND absences."deletedAt" IS NULL
          AND absences.type IN ('urlaub', 'krank', 'ueberstundenabbau')
          AND absences.status = 'genehmigt'
          AND (
            COALESCE(absences."dayPart", 'full') = 'full'
            OR (absences."dayPart" = 'first-half' AND planningEntries."startTime" < '12:00')
            OR (absences."dayPart" = 'second-half' AND planningEntries."endTime" > '12:00')
          )
      )
  `;
}

async function sendDailyReminder(input: {
  organizationId: string;
  userId: string;
  dateKey: string;
}) {
  const linkTarget = "daily-planning-reminder";
  const linkTargetId = `${input.userId}:${input.dateKey}`;
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Notification"
    WHERE "organizationId" = ${input.organizationId}
      AND "userId" = ${input.userId}
      AND "linkTarget" = ${linkTarget}
      AND "linkTargetId" = ${linkTargetId}
    LIMIT 1
  `;

  if (existing.length > 0) return false;

  const title = "Deine heutigen Termine";
  const body = "Sieh dir deine heutigen Termine an";
  const notification = await prisma.notification.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      userId: input.userId,
      taskId: null,
      channel: "push",
      subject: title,
      body,
      linkTarget,
      linkTargetId,
      linkLabel: "Start öffnen",
      sentAt: null,
    },
  });

  await sendPushToUserSafely({
    organizationId: input.organizationId,
    userId: input.userId,
    payload: {
      title,
      body,
      notificationId: notification.id,
      linkTarget,
      linkTargetId,
      url: "/",
    },
  });

  return true;
}

export async function POST(req: Request) {
  if (!getCronSecret()) {
    return NextResponse.json({ error: "Cron-Geheimnis ist nicht konfiguriert." }, { status: 503 });
  }

  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const { organization } = await getDemoContext();
  const dateKey = getBerlinDateKey();
  if (!dateKey) {
    return NextResponse.json({ error: "Heutiges Datum konnte nicht bestimmt werden." }, { status: 500 });
  }

  await ensureNotificationLinkColumns();
  const users = await getReminderUsers(organization.id, dateKey);
  let sent = 0;

  for (const user of users) {
    const wasSent = await sendDailyReminder({
      organizationId: organization.id,
      userId: user.id,
      dateKey,
    });
    if (wasSent) sent += 1;
  }

  return NextResponse.json({
    success: true,
    date: dateKey,
    checkedUsers: users.length,
    sent,
  });
}
