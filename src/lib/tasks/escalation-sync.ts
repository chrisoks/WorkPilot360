import { randomUUID } from "node:crypto";
import { Prisma, TaskStatus } from "@prisma/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import { sendTaskNotificationMailSafely } from "@/lib/mail/task-notifications";
import {
  planTaskEscalationDeliveries,
  type TaskEscalationDelivery,
} from "./escalation-delivery";
import {
  evaluateTaskEscalationPreview,
  type TaskEscalationPreviewUser,
} from "./escalation-preview";
import { planTaskEscalationState } from "./escalation-state";

const ACTIVE_STATUSES = [
  TaskStatus.OFFEN,
  TaskStatus.IN_BEARBEITUNG,
  TaskStatus.WARTET_AUF_RUECKMELDUNG,
  TaskStatus.UEBERFAELLIG,
];

export async function evaluateOrganizationTaskEscalations(input: {
  organizationId: string;
  users: readonly TaskEscalationPreviewUser[];
  now?: Date;
}) {
  const [settings, tasks] = await Promise.all([
    getDeadlineSettings(input.organizationId),
    prisma.task.findMany({
      where: { organizationId: input.organizationId, status: { in: ACTIVE_STATUSES } },
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return evaluateTaskEscalationPreview({
    tasks,
    users: input.users,
    settings,
    now: input.now,
  });
}

export async function synchronizeTaskEscalationEpisodes(input: {
  organizationId: string;
  users: readonly TaskEscalationPreviewUser[];
  now?: Date;
  deliveryEnabled?: boolean;
}) {
  const now = input.now ?? new Date();
  const items = await evaluateOrganizationTaskEscalations({ ...input, now });

  const synchronization = await prisma.$transaction(async (transaction) => {
    const episodes = await transaction.taskEscalationEpisode.findMany({
      where: { organizationId: input.organizationId },
      select: {
        id: true,
        userId: true,
        episode: true,
        highestStage: true,
        observedStage: true,
        notifiedStage: true,
        warningSince: true,
        leadershipDueAt: true,
        managementDueAt: true,
        leadershipRecipientId: true,
        leadershipRequired: true,
        resolvedAt: true,
      },
    });
    const operations = planTaskEscalationState({ items, episodes });

    let created = 0;
    let updated = 0;
    let resolved = 0;

    for (const operation of operations) {
      if (operation.type === "resolve") {
        await transaction.taskEscalationEpisode.update({
          where: { id: operation.id },
          data: {
            activeKey: null,
            observedStage: "none",
            lastEvaluatedAt: now,
            resolvedAt: now,
          },
        });
        resolved += 1;
        continue;
      }

      const item = operation.item;
      const commonData = {
        observedStage: item.stage,
        warningSince: new Date(item.warningSince!),
        leadershipDueAt: item.leadershipDueAt ? new Date(item.leadershipDueAt) : null,
        managementDueAt: item.managementDueAt ? new Date(item.managementDueAt) : null,
        leadershipRecipientId: item.leadershipRecipientId,
        leadershipRequired: item.leadershipRequired,
        activeCount: item.activeCount,
        overdueCount: item.overdueCount,
        staleCount: item.staleCount,
        waitingFeedbackCount: item.waitingFeedbackCount,
        reasons: item.reasons as Prisma.InputJsonValue,
        taskIds: item.taskIds as Prisma.InputJsonValue,
        lastEvaluatedAt: now,
        resolvedAt: null,
      };

      if (operation.type === "update") {
        await transaction.taskEscalationEpisode.update({
          where: { id: operation.id },
          data: { ...commonData, highestStage: operation.highestStage },
        });
        updated += 1;
        continue;
      }

      const activeKey = `${input.organizationId}:${operation.userId}`;
      await transaction.taskEscalationEpisode.upsert({
        where: { activeKey },
        create: {
          organizationId: input.organizationId,
          userId: operation.userId,
          episode: operation.episode,
          activeKey,
          highestStage: item.stage,
          notifiedStage: "none",
          ...commonData,
        },
        update: {
          ...commonData,
          highestStage: item.stage,
        },
      });
      created += 1;
    }

    return {
      synchronizedAt: now.toISOString(),
      summary: {
        active: items.length,
        created,
        updated,
        resolved,
      },
      items,
    };
  });

  const activeEpisodes = await prisma.taskEscalationEpisode.findMany({
    where: { organizationId: input.organizationId, resolvedAt: null },
    select: {
      id: true,
      userId: true,
      episode: true,
      observedStage: true,
      notifiedStage: true,
      leadershipRecipientId: true,
      leadershipRequired: true,
      activeCount: true,
      overdueCount: true,
      staleCount: true,
      waitingFeedbackCount: true,
      reasons: true,
      taskIds: true,
    },
  });
  const deliveryPlan = planTaskEscalationDeliveries({
    episodes: activeEpisodes.map((episode) => ({
      ...episode,
      reasons: Array.isArray(episode.reasons)
        ? episode.reasons.map((reason) => String(reason))
        : [],
      taskIds: Array.isArray(episode.taskIds)
        ? episode.taskIds.map((taskId) => String(taskId))
        : [],
    })),
    users: input.users,
  });

  const deliveryResult = input.deliveryEnabled
    ? await deliverTaskEscalationPlan(input.organizationId, deliveryPlan.deliveries)
    : { notificationsSent: 0, emailsSent: 0 };

  return {
    ...synchronization,
    ...deliveryResult,
    delivery: {
      enabled: Boolean(input.deliveryEnabled),
      plannedNotifications: deliveryPlan.deliveries.length,
      blockedLeadershipEpisodes: deliveryPlan.blockedLeadershipEpisodeIds.length,
    },
  };
}

const DELIVERY_STAGE_RANK: Record<string, number> = {
  none: 0,
  employee: 1,
  leadership: 2,
  management: 3,
};

async function deliverTaskEscalationPlan(
  organizationId: string,
  deliveries: readonly TaskEscalationDelivery[]
) {
  let notificationsSent = 0;
  let emailsSent = 0;
  const byEpisode = new Map<string, TaskEscalationDelivery[]>();
  for (const delivery of deliveries) {
    const episodeDeliveries = byEpisode.get(delivery.episodeId) ?? [];
    episodeDeliveries.push(delivery);
    byEpisode.set(delivery.episodeId, episodeDeliveries);
  }

  for (const [episodeId, episodeDeliveries] of byEpisode) {
    const stage = episodeDeliveries[0]?.stage;
    if (!stage) continue;

    await prisma.$transaction(async (transaction) => {
      const episode = await transaction.taskEscalationEpisode.findFirst({
        where: { id: episodeId, organizationId, resolvedAt: null },
        select: { notifiedStage: true, observedStage: true },
      });
      if (
        !episode ||
        DELIVERY_STAGE_RANK[episode.observedStage] < DELIVERY_STAGE_RANK[stage] ||
        DELIVERY_STAGE_RANK[episode.notifiedStage] >= DELIVERY_STAGE_RANK[stage]
      ) {
        return [];
      }

      const createdOrPending = [];
      for (const delivery of episodeDeliveries) {
        const channel = `task-escalation:${delivery.episodeId}:${delivery.stage}`;
        const existing = await transaction.notification.findFirst({
          where: {
            organizationId,
            userId: delivery.recipientId,
            channel,
          },
          select: { id: true, userId: true, subject: true, body: true, sentAt: true },
        });
        if (existing) {
          if (!existing.sentAt) createdOrPending.push(existing);
          continue;
        }

        const notification = await transaction.notification.create({
          data: {
            id: randomUUID(),
            organizationId,
            userId: delivery.recipientId,
            taskId: delivery.taskId,
            channel,
            subject: delivery.subject,
            body: delivery.body,
            linkTarget: delivery.taskId ? "task" : null,
            linkTargetId: delivery.taskId,
            linkLabel: "Aufgaben öffnen",
            sentAt: null,
          },
          select: { id: true, userId: true, subject: true, body: true, sentAt: true },
        });
        createdOrPending.push(notification);
        notificationsSent += 1;
      }

      await transaction.taskEscalationEpisode.update({
        where: { id: episodeId },
        data: { notifiedStage: stage },
      });
      return createdOrPending;
    });

  }

  // In-App-Benachrichtigungen werden pro Eskalationsstufe nur einmal angelegt.
  // Noch nicht versendete Systemmails bleiben dagegen wiederholbar, damit ein
  // vorübergehender SMTP-Fehler die Eskalation nicht dauerhaft verschluckt.
  // Bereits erledigte Episoden werden bewusst nicht nachträglich versendet.
  const [activeEpisodeRows, pendingMailNotifications] = await Promise.all([
    prisma.taskEscalationEpisode.findMany({
      where: { organizationId, resolvedAt: null },
      select: { id: true },
    }),
    prisma.notification.findMany({
      where: {
        organizationId,
        sentAt: null,
        channel: { startsWith: "task-escalation:" },
      },
      select: { id: true, userId: true, subject: true, body: true, channel: true },
    }),
  ]);
  const activeEpisodeIds = new Set(activeEpisodeRows.map((episode) => episode.id));
  for (const notification of pendingMailNotifications) {
    const episodeId = notification.channel.split(":")[1];
    if (!episodeId || !activeEpisodeIds.has(episodeId)) continue;
    const sent = await sendTaskNotificationMailSafely({
      notificationId: notification.id,
      userId: notification.userId,
      subject: notification.subject,
      body: notification.body,
    });
    if (sent) emailsSent += 1;
  }

  return { notificationsSent, emailsSent };
}
