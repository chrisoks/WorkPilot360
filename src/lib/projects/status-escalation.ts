import { randomUUID } from "crypto";
import { Role, type User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import type { ProjectStatusEscalationRuleSetting } from "@/lib/company-settings/deadlines";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import { ensureStatusTrackingTables } from "@/lib/status-tracking";

export type ProjectStatusEscalationStage = "responsible" | "management";

export type ProjectStatusEscalationPreviewItem = {
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  customer: string;
  status: string;
  startedAt: string;
  elapsedDays: number;
  stage: ProjectStatusEscalationStage;
  responsibleName: string;
  responsibleUserId: string | null;
  responsibleAfterDays: number;
  managementAfterDays: number;
};

type ProjectStatusRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  status: string;
  responsibleName: string | null;
  createdAt: Date;
  statusStartedAt: Date | null;
};

function userName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, " ");
}

function elapsedCalendarDays(startedAt: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 86_400_000));
}

export async function evaluateProjectStatusEscalations(input: {
  organizationId: string;
  users: readonly User[];
  now?: Date;
  rules?: readonly ProjectStatusEscalationRuleSetting[];
  enabled?: boolean;
}) {
  await ensureStatusTrackingTables();
  const settings = await getDeadlineSettings(input.organizationId);
  const now = input.now ?? new Date();
  const effectiveRules = input.rules ?? settings.projectStatusRules;
  const enabledRules = new Map(
    effectiveRules.filter((rule) => rule.enabled).map((rule) => [rule.status, rule])
  );

  const projects = await prisma.$queryRaw<ProjectStatusRow[]>`
    SELECT
      project.id,
      project."projectNumber",
      project.title,
      project.customer,
      project.status,
      project."responsibleName",
      project."createdAt",
      timeline."startedAt" AS "statusStartedAt"
    FROM "WorkPilotProject" project
    LEFT JOIN LATERAL (
      SELECT "startedAt"
      FROM "StatusTimelineEntry"
      WHERE "organizationId" = project."organizationId"
        AND "entityType" = 'project'
        AND "entityId" = project.id
        AND "toStatus" = project.status
        AND "endedAt" IS NULL
      ORDER BY "startedAt" DESC
      LIMIT 1
    ) timeline ON true
    WHERE project."organizationId" = ${input.organizationId}
    ORDER BY project."projectNumber" ASC
  `;

  const activeUsers = input.users.filter((user) => user.isActive);
  const items: ProjectStatusEscalationPreviewItem[] = [];
  const statusCounts: Record<string, number> = {};

  for (const project of projects) {
    const rule = enabledRules.get(project.status);
    if (!rule) continue;
    statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
    const startedAt = project.statusStartedAt ?? project.createdAt;
    const elapsedDays = elapsedCalendarDays(startedAt, now);
    if (elapsedDays < rule.responsibleAfterDays) continue;

    const responsibleName = String(project.responsibleName || "").trim();
    const responsible =
      activeUsers.find((user) => normalizeName(userName(user)) === normalizeName(responsibleName)) ?? null;
    const stage: ProjectStatusEscalationStage =
      elapsedDays >= rule.managementAfterDays ? "management" : "responsible";

    items.push({
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectTitle: project.title,
      customer: project.customer || "",
      status: project.status,
      startedAt: startedAt.toISOString(),
      elapsedDays,
      stage,
      responsibleName,
      responsibleUserId: responsible?.id ?? null,
      responsibleAfterDays: rule.responsibleAfterDays,
      managementAfterDays: rule.managementAfterDays,
    });
  }

  return {
    enabled: input.enabled ?? settings.projectStatusEscalationEnabled,
    monitoredProjects: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
    statusCounts,
    items: items.sort(
      (left, right) =>
        Number(right.stage === "management") - Number(left.stage === "management") ||
        right.elapsedDays - left.elapsedDays
    ),
  };
}

export async function synchronizeProjectStatusEscalations(input: {
  organizationId: string;
  users: readonly User[];
  now?: Date;
  deliveryEnabled?: boolean;
}) {
  const now = input.now ?? new Date();
  const evaluation = await evaluateProjectStatusEscalations(input);
  const deliveryEnabled = Boolean(input.deliveryEnabled) && evaluation.enabled;
  const managementIds = input.users
    .filter(
      (user) =>
        user.isActive && (user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER)
    )
    .map((user) => user.id);
  let plannedNotifications = 0;
  let notificationsSent = 0;
  let missingResponsible = 0;

  for (const item of evaluation.items) {
    const recipientIds = new Set<string>();
    if (item.responsibleUserId) {
      recipientIds.add(item.responsibleUserId);
    } else {
      missingResponsible += 1;
    }
    if (item.stage === "management") {
      managementIds.forEach((userId) => recipientIds.add(userId));
    }

    const ruleId = `project-status-v1:${item.status}:${item.stage}`;
    const thresholdDays =
      item.stage === "management" ? item.managementAfterDays : item.responsibleAfterDays;
    const thresholdHours = thresholdDays * 24;

    for (const userId of recipientIds) {
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "StatusEscalationEvent"
        WHERE "organizationId" = ${input.organizationId}
          AND "ruleId" = ${ruleId}
          AND "entityType" = 'project'
          AND "entityId" = ${item.projectId}
          AND "status" = ${item.status}
          AND "recipientUserId" = ${userId}
          AND "resolvedAt" IS NULL
        LIMIT 1
      `;
      if (existing[0]) continue;
      plannedNotifications += 1;
      if (!deliveryEnabled) continue;

      const subject =
        item.stage === "management"
          ? `Projektstatus prüfen: ${item.projectNumber} eskaliert`
          : `Projektstatus prüfen: ${item.projectNumber}`;
      const body = `${item.projectNumber} · ${item.projectTitle} ist seit ${item.elapsedDays} Tagen im Status „${item.status}“. Bitte prüfen, ob der Status noch stimmt oder der nächste Schritt angestoßen werden muss.`;
      const notification = await prisma.notification.create({
        data: {
          organizationId: input.organizationId,
          userId,
          channel: `project-status-escalation:${item.stage}`,
          subject,
          body,
          linkTarget: "project",
          linkTargetId: item.projectId,
          linkLabel: "Projekt öffnen",
        },
      });
      await prisma.$executeRaw`
        INSERT INTO "StatusEscalationEvent" (
          "id", "organizationId", "ruleId", "entityType", "entityId", "entityLabel",
          "status", "thresholdHours", "actualHours", "recipientUserId", "notificationId", "createdAt"
        )
        VALUES (
          ${randomUUID()}, ${input.organizationId}, ${ruleId}, 'project', ${item.projectId},
          ${`${item.projectNumber} · ${item.projectTitle}`}, ${item.status}, ${thresholdHours},
          ${item.elapsedDays * 24}, ${userId}, ${notification.id}, ${now}
        )
      `;
      notificationsSent += 1;
      await sendNotificationMailSafely({
        notificationId: notification.id,
        userId,
        subject,
        body,
      });
    }
  }

  return {
    ...evaluation,
    delivery: {
      enabled: deliveryEnabled,
      plannedNotifications,
      notificationsSent,
      missingResponsible,
    },
  };
}
