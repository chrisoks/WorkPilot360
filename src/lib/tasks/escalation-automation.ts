import { prisma } from "@/lib/db/client";
import type { TaskEscalationPreviewUser } from "./escalation-preview";
import { synchronizeTaskEscalationEpisodes } from "./escalation-sync";

type TaskEscalationAutomationOrganization = {
  id: string;
  users: readonly TaskEscalationPreviewUser[];
};

type TaskEscalationAutomationSyncResult = {
  summary: { active: number; created: number; updated: number; resolved: number };
  notificationsSent: number;
  emailsSent: number;
  delivery: { plannedNotifications: number; blockedLeadershipEpisodes: number };
};

type TaskEscalationSynchronizer = (input: {
  organizationId: string;
  users: readonly TaskEscalationPreviewUser[];
  now?: Date;
  deliveryEnabled?: boolean;
}) => Promise<TaskEscalationAutomationSyncResult>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

export async function processTaskEscalationOrganizations(input: {
  organizations: readonly TaskEscalationAutomationOrganization[];
  deliveryEnabled: boolean;
  now?: Date;
  synchronize?: TaskEscalationSynchronizer;
}) {
  const synchronize = input.synchronize ?? synchronizeTaskEscalationEpisodes;
  const summary = {
    organizations: input.organizations.length,
    successfulOrganizations: 0,
    failedOrganizations: 0,
    activeEpisodes: 0,
    createdEpisodes: 0,
    updatedEpisodes: 0,
    resolvedEpisodes: 0,
    plannedNotifications: 0,
    blockedLeadershipEpisodes: 0,
    notificationsSent: 0,
    emailsSent: 0,
  };
  const errors: Array<{ organizationId: string; message: string }> = [];

  for (const organization of input.organizations) {
    try {
      const result = await synchronize({
        organizationId: organization.id,
        users: organization.users,
        now: input.now,
        deliveryEnabled: input.deliveryEnabled,
      });
      summary.successfulOrganizations += 1;
      summary.activeEpisodes += result.summary.active;
      summary.createdEpisodes += result.summary.created;
      summary.updatedEpisodes += result.summary.updated;
      summary.resolvedEpisodes += result.summary.resolved;
      summary.plannedNotifications += result.delivery.plannedNotifications;
      summary.blockedLeadershipEpisodes += result.delivery.blockedLeadershipEpisodes;
      summary.notificationsSent += result.notificationsSent;
      summary.emailsSent += result.emailsSent;
    } catch (error) {
      summary.failedOrganizations += 1;
      errors.push({ organizationId: organization.id, message: getErrorMessage(error) });
      console.error(`Aufgaben-Eskalation für Mandant ${organization.id} fehlgeschlagen.`, error);
    }
  }

  return {
    processedAt: (input.now ?? new Date()).toISOString(),
    deliveryEnabled: input.deliveryEnabled,
    summary,
    errors,
  };
}

export async function runTaskEscalationAutomation(input?: {
  now?: Date;
  deliveryEnabled?: boolean;
}) {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      users: {
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          leadershipManagerId: true,
          leadershipDeputyId: true,
        },
      },
    },
  });

  return processTaskEscalationOrganizations({
    organizations,
    now: input?.now,
    deliveryEnabled: Boolean(input?.deliveryEnabled),
  });
}
