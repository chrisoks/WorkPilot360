import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { ensureDefaultStatusEscalationRules } from "@/lib/status-tracking";
import { canRunStatusEscalations } from "@/lib/permissions";

type OpenStatusRow = {
  entityType: string;
  entityId: string;
  entityLabel: string;
  toStatus: string;
  startedAt: Date;
  durationHours: number;
};

type RuleRow = {
  id: string;
  entityType: string;
  status: string;
  name: string;
  thresholdHours: number;
  notifyResponsible: boolean;
  notifyProjectOwner: boolean;
  notifyManagement: boolean;
  notificationEnabled: boolean;
  dailyReportEnabled: boolean;
};

type UserRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: Role;
};

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(entityType: string) {
  if (entityType === "project") return "Projekt";
  if (entityType === "task") return "Aufgabe";
  if (entityType === "potential") return "Potenzial";
  if (entityType === "sales_target") return "Sales-Ziel";
  return entityType;
}

async function getResponsibleUserIds(organizationId: string, item: OpenStatusRow, users: UserRow[]) {
  const recipients = new Set<string>();

  if (item.entityType === "task") {
    const rows = await prisma.$queryRaw<Array<{ ownerId: string }>>`
      SELECT "ownerId"
      FROM "Task"
      WHERE "organizationId" = ${organizationId} AND id = ${item.entityId}
      LIMIT 1
    `;
    if (rows[0]?.ownerId) recipients.add(rows[0].ownerId);
  }

  if (item.entityType === "sales_target") {
    const rows = await prisma.$queryRaw<Array<{ ownerUserId: string | null }>>`
      SELECT "ownerUserId"
      FROM "SalesTarget"
      WHERE "organizationId" = ${organizationId} AND id = ${item.entityId}
      LIMIT 1
    `;
    if (rows[0]?.ownerUserId) recipients.add(rows[0].ownerUserId);
  }

  if (item.entityType === "potential") {
    const rows = await prisma.$queryRaw<Array<{ taskId: string | null }>>`
      SELECT "taskId"
      FROM "ProjectPotential"
      WHERE "organizationId" = ${organizationId} AND id = ${item.entityId}
      LIMIT 1
    `;
    if (rows[0]?.taskId) {
      const tasks = await prisma.$queryRaw<Array<{ ownerId: string }>>`
        SELECT "ownerId"
        FROM "Task"
        WHERE "organizationId" = ${organizationId} AND id = ${rows[0].taskId}
        LIMIT 1
      `;
      if (tasks[0]?.ownerId) recipients.add(tasks[0].ownerId);
    }
  }

  if (item.entityType === "project") {
    const rows = await prisma.$queryRaw<Array<{ responsibleName: string | null }>>`
      SELECT "responsibleName"
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${organizationId} AND id = ${item.entityId}
      LIMIT 1
    `;
    const responsibleName = rows[0]?.responsibleName?.trim().toLowerCase();
    const user = users.find((candidate) => getUserName(candidate).trim().toLowerCase() === responsibleName);
    if (user) recipients.add(user.id);
  }

  return recipients;
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureDefaultStatusEscalationRules(organization.id);

  const events = await prisma.$queryRaw<
    Array<{
      id: string;
      entityType: string;
      entityId: string;
      entityLabel: string;
      status: string;
      thresholdHours: number;
      actualHours: number;
      dailyReportDate: string | null;
      resolvedAt: Date | null;
      createdAt: Date;
    }>
  >`
    SELECT id, "entityType", "entityId", "entityLabel", status, "thresholdHours", "actualHours",
      "dailyReportDate", "resolvedAt", "createdAt"
    FROM "StatusEscalationEvent"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;

  return NextResponse.json(
    events.map((event) => ({
      ...event,
      dailyReportDate: event.dailyReportDate ?? "",
      resolvedAt: event.resolvedAt?.toISOString() ?? "",
      createdAt: event.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canRunStatusEscalations(actor)) {
    return NextResponse.json(
      { error: "Du darfst Status-Eskalationen nicht ausl\u00f6sen." },
      { status: 403 }
    );
  }

  await ensureDefaultStatusEscalationRules(organization.id);
  const today = todayKey();

  const rules = await prisma.$queryRaw<RuleRow[]>`
    SELECT id, "entityType", status, name, "thresholdHours", "notifyResponsible", "notifyProjectOwner",
      "notifyManagement", "notificationEnabled", "dailyReportEnabled"
    FROM "StatusEscalationRule"
    WHERE "organizationId" = ${organization.id}
      AND "isActive" = true
  `;

  const openStatuses = await prisma.$queryRaw<OpenStatusRow[]>`
    SELECT
      "entityType",
      "entityId",
      "entityLabel",
      "toStatus",
      "startedAt",
      FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "startedAt")) / 3600)::INTEGER AS "durationHours"
    FROM "StatusTimelineEntry"
    WHERE "organizationId" = ${organization.id}
      AND "endedAt" IS NULL
  `;

  let created = 0;
  const userRows = users as UserRow[];
  const managementUserIds = userRows
    .filter((user) => user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER)
    .map((user) => user.id);

  for (const item of openStatuses) {
    const matchingRules = rules.filter(
      (rule) =>
        rule.entityType === item.entityType &&
        rule.status === item.toStatus &&
        item.durationHours >= rule.thresholdHours
    );

    for (const rule of matchingRules) {
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "StatusEscalationEvent"
        WHERE "organizationId" = ${organization.id}
          AND "ruleId" = ${rule.id}
          AND "entityType" = ${item.entityType}
          AND "entityId" = ${item.entityId}
          AND "status" = ${item.toStatus}
          AND "resolvedAt" IS NULL
        LIMIT 1
      `;
      if (existing[0]) continue;

      const recipients = new Set<string>();
      if (rule.notifyResponsible) {
        const responsible = await getResponsibleUserIds(organization.id, item, userRows);
        responsible.forEach((id) => recipients.add(id));
      }
      if (rule.notifyProjectOwner) {
        const responsible = await getResponsibleUserIds(organization.id, item, userRows);
        responsible.forEach((id) => recipients.add(id));
      }
      if (rule.notifyManagement) {
        managementUserIds.forEach((id) => recipients.add(id));
      }

      const subject = `Status-Toleranz überschritten: ${item.entityLabel || statusLabel(item.entityType)}`;
      const body = `${statusLabel(item.entityType)} "${item.entityLabel || item.entityId}" ist seit ${item.durationHours} Std. im Status "${item.toStatus}". Grenze: ${rule.thresholdHours} Std.`;
      let firstNotificationId: string | null = null;

      for (const userId of recipients) {
        if (!rule.notificationEnabled && !rule.dailyReportEnabled) continue;
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
            "linkLabel"
          )
          VALUES (
            ${notificationId},
            ${organization.id},
            ${userId},
            NULL,
            ${rule.dailyReportEnabled ? "app_daily_report" : "app"},
            ${subject},
            ${body},
            ${item.entityType},
            ${item.entityId},
            'Öffnen'
          )
        `;
        firstNotificationId ??= notificationId;

        if (rule.dailyReportEnabled) {
          const emailNotificationId = randomUUID();
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
              "linkLabel"
            )
            VALUES (
              ${emailNotificationId},
              ${organization.id},
              ${userId},
              NULL,
              'email',
              ${subject},
              ${body},
              ${item.entityType},
              ${item.entityId},
              'Öffnen'
            )
          `;
        }
      }

      await prisma.$executeRaw`
        INSERT INTO "StatusEscalationEvent" (
          "id",
          "organizationId",
          "ruleId",
          "entityType",
          "entityId",
          "entityLabel",
          "status",
          "thresholdHours",
          "actualHours",
          "notificationId",
          "dailyReportDate"
        )
        VALUES (
          ${randomUUID()},
          ${organization.id},
          ${rule.id},
          ${item.entityType},
          ${item.entityId},
          ${item.entityLabel},
          ${item.toStatus},
          ${rule.thresholdHours},
          ${item.durationHours},
          ${firstNotificationId},
          ${rule.dailyReportEnabled ? today : null}
        )
      `;
      created += 1;
    }
  }

  return NextResponse.json({ success: true, created });
}
