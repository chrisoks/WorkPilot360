import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";

export const dynamic = "force-dynamic";

type PotentialRow = {
  id: string;
  number: string | null;
  customerName: string | null;
  projectId: string;
  projectLabel: string | null;
  description: string;
  ownerUserId: string | null;
  ownerName: string | null;
  createdAt: Date;
};

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
};

type ReminderLevel = "reminder" | "escalation";

function getCronSecret() {
  return (
    process.env.POTENTIAL_DECISION_CRON_SECRET ||
    process.env.PUSH_REMINDER_CRON_SECRET ||
    process.env.WORKPILOT_CRON_SECRET ||
    process.env.CRON_SECRET ||
    ""
  );
}

function isAuthorizedCronRequest(req: Request) {
  const secret = getCronSecret();
  if (!secret) return false;

  const authorization = req.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const headerToken = req.headers.get("x-cron-secret") || "";
  return bearerToken === secret || headerToken === secret;
}

function getBerlinDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 0);
  const day = Number(parts.find((part) => part.type === "day")?.value || 0);
  return new Date(year, month - 1, day, 12);
}

function toBerlinDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 0);
  const day = Number(parts.find((part) => part.type === "day")?.value || 0);
  return new Date(year, month - 1, day, 12);
}

function countBusinessDaysAfter(from: Date, to: Date) {
  const cursor = toBerlinDay(from);
  const end = toBerlinDay(to);
  let days = 0;

  cursor.setDate(cursor.getDate() + 1);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getUserName(user: UserRow) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}

function getPotentialLabel(potential: PotentialRow) {
  return [potential.number, potential.description].filter(Boolean).join(" | ");
}

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

async function ensurePotentialDecisionReminderTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectPotentialDecisionReminder" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "potentialId" TEXT NOT NULL,
      "level" TEXT NOT NULL,
      "notificationId" TEXT,
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "ProjectPotentialDecisionReminder_org_potential_level"
    ON "ProjectPotentialDecisionReminder" ("organizationId", "potentialId", "level")
  `;
}

async function getOpenPotentials(organizationId: string) {
  return prisma.$queryRaw<PotentialRow[]>`
    SELECT
      "id",
      "number",
      "customerName",
      "projectId",
      "projectLabel",
      "description",
      "ownerUserId",
      "ownerName",
      "createdAt"
    FROM "ProjectPotential"
    WHERE "organizationId" = ${organizationId}
      AND "status" = 'open'
      AND ("taskId" IS NULL OR "taskId" = '')
      AND "offeredAt" IS NULL
      AND "closedAt" IS NULL
    ORDER BY "createdAt" ASC
  `;
}

async function wasReminderSent(organizationId: string, potentialId: string, level: ReminderLevel) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "ProjectPotentialDecisionReminder"
    WHERE "organizationId" = ${organizationId}
      AND "potentialId" = ${potentialId}
      AND "level" = ${level}
    LIMIT 1
  `;

  return existing.length > 0;
}

function getRecipientIds(potential: PotentialRow, users: UserRow[], level: ReminderLevel) {
  const activeUsers = users.filter((user) => user.isActive);
  const recipients = new Set<string>();

  if (potential.ownerUserId && activeUsers.some((user) => user.id === potential.ownerUserId)) {
    recipients.add(potential.ownerUserId);
  }

  const ownerName = normalizeName(potential.ownerName || "");
  if (ownerName) {
    activeUsers
      .filter((user) => normalizeName(getUserName(user)) === ownerName)
      .forEach((user) => recipients.add(user.id));
  }

  if (level === "escalation" || recipients.size === 0) {
    activeUsers
      .filter((user) => user.role === Role.FUEHRUNGSKRAFT || user.role === Role.GESCHAEFTSFUEHRER || user.role === Role.ADMIN)
      .forEach((user) => recipients.add(user.id));
  }

  return Array.from(recipients);
}

async function sendPotentialDecisionNotice(input: {
  organizationId: string;
  potential: PotentialRow;
  users: UserRow[];
  level: ReminderLevel;
  ageBusinessDays: number;
}) {
  const recipientIds = getRecipientIds(input.potential, input.users, input.level);
  if (recipientIds.length === 0) return 0;

  const isEscalation = input.level === "escalation";
  const subject = isEscalation
    ? `Eskalation Zusatzverkauf ${input.potential.number || ""}`.trim()
    : `Zusatzverkauf entscheiden ${input.potential.number || ""}`.trim();
  const projectLine = input.potential.projectLabel ? `Projekt: ${input.potential.projectLabel}` : "";
  const customerLine = input.potential.customerName ? `Kunde: ${input.potential.customerName}` : "";
  const body = [
    `${getPotentialLabel(input.potential)} wartet seit ${input.ageBusinessDays} Werktag${
      input.ageBusinessDays === 1 ? "" : "en"
    } auf eine Entscheidung.`,
    customerLine,
    projectLine,
    "Bitte Angebot erstellen, Nachfass-Aufgabe anlegen oder mit Grund auf aktuell kein Interesse setzen.",
  ]
    .filter(Boolean)
    .join("\n");

  let created = 0;
  let firstNotificationId = "";

  for (const userId of recipientIds) {
    const notification = await prisma.notification.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        userId,
        taskId: null,
        channel: "app",
        subject,
        body,
        linkTarget: "project-potential",
        linkTargetId: input.potential.id,
        linkLabel: "Zusatzverkauf öffnen",
      },
    });

    if (isEscalation) {
      await sendNotificationMailSafely({
        notificationId: notification.id,
        userId,
        subject,
        body,
      });
    }

    firstNotificationId ||= notification.id;
    created += 1;
  }

  await prisma.$executeRaw`
    INSERT INTO "ProjectPotentialDecisionReminder" ("id", "organizationId", "potentialId", "level", "notificationId", "sentAt")
    VALUES (${randomUUID()}, ${input.organizationId}, ${input.potential.id}, ${input.level}, ${firstNotificationId || null}, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId", "potentialId", "level") DO NOTHING
  `;

  return created;
}

export async function POST(req: Request) {
  if (!getCronSecret()) {
    return NextResponse.json({ error: "Cron-Geheimnis ist nicht konfiguriert." }, { status: 503 });
  }

  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const { organization, users } = await getDemoContext();
  const settings = await getDeadlineSettings(organization.id);
  const reminderWorkdays = Math.max(1, settings.potentialDecisionReminderWorkdays);
  const escalationWorkdays = Math.max(reminderWorkdays, settings.potentialDecisionEscalationWorkdays);
  const today = getBerlinDate();

  await ensureNotificationLinkColumns();
  await ensurePotentialDecisionReminderTable();

  const potentials = await getOpenPotentials(organization.id);
  let sent = 0;
  let skippedRecent = 0;
  let skippedNotDue = 0;

  for (const potential of potentials) {
    const ageBusinessDays = countBusinessDaysAfter(potential.createdAt, today);
    const level: ReminderLevel | null =
      ageBusinessDays >= escalationWorkdays
        ? "escalation"
        : ageBusinessDays >= reminderWorkdays
          ? "reminder"
          : null;

    if (!level) {
      skippedNotDue += 1;
      continue;
    }

    if (await wasReminderSent(organization.id, potential.id, level)) {
      skippedRecent += 1;
      continue;
    }

    sent += await sendPotentialDecisionNotice({
      organizationId: organization.id,
      potential,
      users: users as UserRow[],
      level,
      ageBusinessDays,
    });
  }

  return NextResponse.json({
    success: true,
    checkedPotentials: potentials.length,
    skippedNotDue,
    skippedRecent,
    sent,
    reminderWorkdays,
    escalationWorkdays,
  });
}
