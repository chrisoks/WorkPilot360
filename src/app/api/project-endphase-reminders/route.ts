import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  status: string | null;
  projectRuntimeFrom: string | null;
  projectRuntimeUntil: string | null;
  responsibleName: string | null;
};

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
};

const END_PHASE_DAYS = 56;
const REMINDER_INTERVAL_DAYS = 14;

function getCronSecret() {
  return (
    process.env.PROJECT_ENDPHASE_CRON_SECRET ||
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

function parseDateKey(value: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayDistance(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getProjectLabel(project: ProjectRow) {
  return [project.projectNumber, project.title].filter(Boolean).join(" | ");
}

function isClosedProject(project: ProjectRow) {
  const status = (project.status || "").toLowerCase();
  return status.includes("abgeschlossen") || status.includes("gelöscht") || status.includes("geloescht");
}

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

async function ensureProjectEndPhaseReminderTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectEndPhaseReminder" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "notificationId" TEXT,
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ProjectEndPhaseReminder_org_project_sent_idx"
    ON "ProjectEndPhaseReminder" ("organizationId", "projectId", "sentAt")
  `;
}

function getRecipientIds(project: ProjectRow, users: UserRow[]) {
  const activeUsers = users.filter((user) => user.isActive);
  const recipients = new Set<string>();
  const responsibleName = normalizeName(project.responsibleName || "");

  if (responsibleName) {
    activeUsers
      .filter((user) => normalizeName(`${user.firstName} ${user.lastName}`) === responsibleName)
      .forEach((user) => recipients.add(user.id));
  }

  activeUsers
    .filter((user) => user.role === Role.FUEHRUNGSKRAFT || user.role === Role.GESCHAEFTSFUEHRER || user.role === Role.ADMIN)
    .forEach((user) => recipients.add(user.id));

  return Array.from(recipients);
}

async function getEndPhaseProjects(organizationId: string, today: Date) {
  const projects = await prisma.$queryRaw<ProjectRow[]>`
    SELECT id, "projectNumber", title, customer, status, "projectRuntimeFrom", "projectRuntimeUntil", "responsibleName"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND COALESCE("projectRuntimeUntil", '') <> ''
  `;

  return projects.filter((project) => {
    if (isClosedProject(project)) return false;
    const endDate = parseDateKey(project.projectRuntimeUntil);
    if (!endDate) return false;
    const endPhaseStart = addDays(endDate, -END_PHASE_DAYS);
    return today.getTime() >= endPhaseStart.getTime();
  });
}

async function wasRecentlyReminded(organizationId: string, projectId: string, cutoff: Date) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "ProjectEndPhaseReminder"
    WHERE "organizationId" = ${organizationId}
      AND "projectId" = ${projectId}
      AND "sentAt" >= ${cutoff}
    LIMIT 1
  `;

  return existing.length > 0;
}

async function sendProjectEndPhaseReminder(input: {
  organizationId: string;
  project: ProjectRow;
  users: UserRow[];
  today: Date;
}) {
  const recipientIds = getRecipientIds(input.project, input.users);
  if (recipientIds.length === 0) return 0;

  const endDate = parseDateKey(input.project.projectRuntimeUntil);
  if (!endDate) return 0;

  const remainingDays = Math.max(0, dayDistance(input.today, endDate));
  const subject = `Endphase: Kundenkontakt ${input.project.projectNumber}`;
  const body = [
    `${getProjectLabel(input.project)} befindet sich in der Endphase.`,
    `Projektende: ${formatDate(endDate)} (${remainingDays} Tage Restlaufzeit).`,
    "Bitte aktiv auf den Kunden zugehen, Kundenbindung sichern und Anschluss/Verlängerung klären.",
  ].join("\n");

  let created = 0;
  let firstNotificationId = "";

  for (const userId of recipientIds) {
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
        ${input.organizationId},
        ${userId},
        NULL,
        'app',
        ${subject},
        ${body},
        'project-endphase',
        ${input.project.id},
        'Projekt öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;

    await sendNotificationMailSafely({
      notificationId,
      userId,
      subject,
      body,
    });

    firstNotificationId ||= notificationId;
    created += 1;
  }

  await prisma.$executeRaw`
    INSERT INTO "ProjectEndPhaseReminder" ("id", "organizationId", "projectId", "notificationId", "sentAt")
    VALUES (${randomUUID()}, ${input.organizationId}, ${input.project.id}, ${firstNotificationId || null}, CURRENT_TIMESTAMP)
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

  await ensureNotificationLinkColumns();
  await ensureProjectEndPhaseReminderTable();

  const { organization, users } = await getDemoContext();
  const today = getBerlinDate();
  const cutoff = addDays(today, -REMINDER_INTERVAL_DAYS);
  const projects = await getEndPhaseProjects(organization.id, today);

  let sent = 0;
  let skippedRecent = 0;

  for (const project of projects) {
    if (await wasRecentlyReminded(organization.id, project.id, cutoff)) {
      skippedRecent += 1;
      continue;
    }

    sent += await sendProjectEndPhaseReminder({
      organizationId: organization.id,
      project,
      users: users as UserRow[],
      today,
    });
  }

  return NextResponse.json({
    success: true,
    checkedProjects: projects.length,
    skippedRecent,
    sent,
  });
}
