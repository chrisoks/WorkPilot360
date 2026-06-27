import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type ProjectRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  projectKind: string | null;
  responsibleName: string | null;
};

type StampRow = {
  id: string;
  projectId: string;
  projectLabel: string | null;
  userId: string | null;
  employee: string | null;
  date: string;
  durationMs: bigint | number;
  createdAt: Date;
};

type AlertRow = {
  id: string;
  alertKey: string;
  projectId: string;
  periodKey: string;
  stage: string;
  notificationId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
};

type UnbilledTimeGroup = {
  alertKey: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  customerName: string;
  projectKind: "single" | "recurring";
  projectKindLabel: string;
  responsibleName: string;
  periodKey: string;
  periodLabel: string;
  oldestDate: string;
  openEntryCount: number;
  openHours: number;
  warningThresholdDate: string;
  escalationThresholdDate: string;
  status: "ok" | "warning" | "escalation";
  notifiedAt: string;
  escalatedAt: string;
};

const SINGLE_PROJECT_WARNING_DAYS = 3;
const RECURRING_PROJECT_AFTER_MONTH_END_DAYS = 3;
const ESCALATION_AFTER_WARNING_DAYS = 2;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanString(actorId);
  if (!requestedActorId) {
    return null;
  }

  return users.find((demoUser) => demoUser.id === requestedActorId && demoUser.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

function canRunUnbilledTimeAlerts(actor: Pick<User, "role">) {
  return (
    actor.role === Role.ADMIN ||
    actor.role === Role.GESCHAEFTSFUEHRER ||
    actor.role === Role.FUEHRUNGSKRAFT ||
    actor.role === Role.BUCHHALTUNG
  );
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfMonthFromKey(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]), 0, 12);
}

function formatMonthLabel(monthKey: string) {
  const month = endOfMonthFromKey(monthKey);
  if (!month) return monthKey;
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(month);
}

function isRecurringProject(project: ProjectRow | undefined) {
  return cleanString(project?.projectKind).toLowerCase().startsWith("dauer");
}

async function ensureUnbilledTimeAlertTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "UnbilledTimeAlert" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "alertKey" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "periodKey" TEXT NOT NULL,
      "stage" TEXT NOT NULL,
      "notificationId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" TIMESTAMP(3)
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "UnbilledTimeAlert"
    ADD COLUMN IF NOT EXISTS "alertKey" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "projectId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "periodKey" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "stage" TEXT NOT NULL DEFAULT 'warning',
    ADD COLUMN IF NOT EXISTS "notificationId" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3)
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "UnbilledTimeAlert_org_alert_stage_key"
    ON "UnbilledTimeAlert" ("organizationId", "alertKey", "stage")
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

async function getGroups(organizationId: string) {
  await ensureUnbilledTimeAlertTable();

  const [projectRows, stampRows, alertRows] = await Promise.all([
    prisma.$queryRaw<ProjectRow[]>`
      SELECT "id", "projectNumber", "title", "customer", "projectKind", "responsibleName"
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${organizationId}
    `,
    prisma.$queryRaw<StampRow[]>`
      SELECT "id", "projectId", "projectLabel", "userId", "employee", "date", "durationMs", "createdAt"
      FROM "ProjectTimeEntry"
      WHERE "organizationId" = ${organizationId}
        AND "mode" = 'project'
        AND "deletedAt" IS NULL
        AND COALESCE("invoiceId", '') = ''
        AND COALESCE("invoiceNumber", '') = ''
    `,
    prisma.$queryRaw<AlertRow[]>`
      SELECT "id", "alertKey", "projectId", "periodKey", "stage", "notificationId", "createdAt", "resolvedAt"
      FROM "UnbilledTimeAlert"
      WHERE "organizationId" = ${organizationId}
        AND "resolvedAt" IS NULL
    `,
  ]);

  const projectsById = new Map(projectRows.map((project) => [project.id, project]));
  const alertsByKey = new Map(alertRows.map((alert) => [`${alert.alertKey}:${alert.stage}`, alert]));
  const grouped = new Map<string, { project: ProjectRow | undefined; periodKey: string; entries: StampRow[] }>();

  for (const entry of stampRows) {
    const project = projectsById.get(entry.projectId);
    const monthKey = cleanString(entry.date).slice(0, 7);
    if (!monthKey) continue;
    const periodKey = isRecurringProject(project) ? monthKey : monthKey;
    const key = `${entry.projectId}|${periodKey}`;
    const current = grouped.get(key) ?? { project, periodKey, entries: [] };
    current.entries.push(entry);
    grouped.set(key, current);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from(grouped.entries())
    .map(([groupKey, group]): UnbilledTimeGroup | null => {
      const project = group.project;
      const oldestDate = group.entries
        .map((entry) => cleanString(entry.date))
        .filter(Boolean)
        .sort()[0];
      const oldest = parseDateKey(oldestDate);
      if (!oldest) return null;

      const recurring = isRecurringProject(project);
      const warningBase = recurring ? endOfMonthFromKey(group.periodKey) : oldest;
      if (!warningBase) return null;

      const warningThreshold = addDays(
        warningBase,
        recurring ? RECURRING_PROJECT_AFTER_MONTH_END_DAYS : SINGLE_PROJECT_WARNING_DAYS
      );
      const escalationThreshold = addDays(warningThreshold, ESCALATION_AFTER_WARNING_DAYS);
      const warningAlert = alertsByKey.get(`${groupKey}:warning`);
      const escalationAlert = alertsByKey.get(`${groupKey}:escalation`);
      const status =
        today >= escalationThreshold
          ? "escalation"
          : today >= warningThreshold
            ? "warning"
            : "ok";
      const openHours =
        group.entries.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0) / 3_600_000;

      return {
        alertKey: groupKey,
        projectId: project?.id || group.entries[0]?.projectId || "",
        projectNumber: project?.projectNumber || "-",
        projectTitle: project?.title || group.entries[0]?.projectLabel || "Projekt",
        customerName: project?.customer || "",
        projectKind: recurring ? "recurring" : "single",
        projectKindLabel: recurring ? "Dauerläufer" : "Einmalig",
        responsibleName: project?.responsibleName || "",
        periodKey: group.periodKey,
        periodLabel: recurring ? formatMonthLabel(group.periodKey) : formatMonthLabel(group.periodKey),
        oldestDate,
        openEntryCount: group.entries.length,
        openHours: Number(openHours.toFixed(2)),
        warningThresholdDate: toDateKey(warningThreshold),
        escalationThresholdDate: toDateKey(escalationThreshold),
        status,
        notifiedAt: warningAlert?.createdAt.toISOString() ?? "",
        escalatedAt: escalationAlert?.createdAt.toISOString() ?? "",
      };
    })
    .filter((group): group is UnbilledTimeGroup => Boolean(group))
    .sort((first, second) => {
      const statusWeight = { escalation: 0, warning: 1, ok: 2 };
      return statusWeight[first.status] - statusWeight[second.status] || first.oldestDate.localeCompare(second.oldestDate);
    });
}

function findResponsibleUserId(users: UserRow[], responsibleName: string) {
  const normalized = responsibleName.trim().toLowerCase();
  if (!normalized) return "";
  return (
    users.find((user) => `${user.firstName} ${user.lastName}`.trim().toLowerCase() === normalized)?.id ?? ""
  );
}

export async function GET() {
  const { organization } = await getDemoContext();
  const groups = await getGroups(organization.id);
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  if (!canRunUnbilledTimeAlerts(actor)) {
    return NextResponse.json(
      { error: "Du darfst Warnungen zu offenen Abrechnungszeiten nicht ausl\u00f6sen." },
      { status: 403 }
    );
  }

  await ensureNotificationLinkColumns();
  const groups = await getGroups(organization.id);
  const userRows = users as UserRow[];
  const managementUserIds = userRows
    .filter((user) => user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER)
    .map((user) => user.id);

  let created = 0;

  for (const group of groups.filter((item) => item.status !== "ok")) {
    const stage = group.status;
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "UnbilledTimeAlert"
      WHERE "organizationId" = ${organization.id}
        AND "alertKey" = ${group.alertKey}
        AND "stage" = ${stage}
      LIMIT 1
    `;
    if (existing[0]) continue;

    const recipients = new Set<string>();
    const responsibleUserId = findResponsibleUserId(userRows, group.responsibleName);
    if (responsibleUserId) recipients.add(responsibleUserId);
    if (stage === "escalation") managementUserIds.forEach((id) => recipients.add(id));
    if (recipients.size === 0) managementUserIds.forEach((id) => recipients.add(id));

    const subject =
      stage === "escalation"
        ? `Eskalation: offene Arbeitszeiten ${group.projectNumber}`
        : `Offene Arbeitszeiten ${group.projectNumber}`;
    const body = `${group.projectNumber} | ${group.projectTitle}: ${group.openHours.toFixed(
      2
    )} Std. aus ${group.openEntryCount} Zeiteintrag${
      group.openEntryCount === 1 ? "" : "en"
    } sind im Zeitraum ${group.periodLabel} noch nicht abgerechnet. Ältester Eintrag: ${group.oldestDate}.`;

    let firstNotificationId = "";
    for (const userId of recipients) {
      const notificationId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "Notification" (
          "id", "organizationId", "userId", "taskId", "channel", "subject", "body",
          "linkTarget", "linkTargetId", "linkLabel"
        )
        VALUES (
          ${notificationId}, ${organization.id}, ${userId}, NULL, 'app', ${subject}, ${body},
          'project-unbilled-time', ${group.projectId}, 'Projekt öffnen'
        )
      `;
      firstNotificationId ||= notificationId;
    }

    await prisma.$executeRaw`
      INSERT INTO "UnbilledTimeAlert" (
        "id", "organizationId", "alertKey", "projectId", "periodKey", "stage", "notificationId"
      )
      VALUES (
        ${randomUUID()}, ${organization.id}, ${group.alertKey}, ${group.projectId},
        ${group.periodKey}, ${stage}, ${firstNotificationId || null}
      )
      ON CONFLICT ("organizationId", "alertKey", "stage") DO NOTHING
    `;
    created += 1;
  }

  return NextResponse.json({ success: true, created, groups: await getGroups(organization.id) });
}
