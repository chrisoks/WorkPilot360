import { prisma } from "@/lib/db/client";
import { synchronizeProjectStatusEscalations } from "./status-escalation";

export async function runProjectStatusEscalationAutomation(input?: {
  now?: Date;
  deliveryEnabled?: boolean;
}) {
  const organizations = await prisma.organization.findMany({
    select: { id: true, users: { where: { isActive: true } } },
  });
  const summary = {
    organizations: organizations.length,
    successfulOrganizations: 0,
    failedOrganizations: 0,
    dueProjects: 0,
    plannedNotifications: 0,
    notificationsSent: 0,
  };
  const errors: Array<{ organizationId: string; message: string }> = [];

  for (const organization of organizations) {
    try {
      const result = await synchronizeProjectStatusEscalations({
        organizationId: organization.id,
        users: organization.users,
        now: input?.now,
        deliveryEnabled: Boolean(input?.deliveryEnabled),
      });
      summary.successfulOrganizations += 1;
      summary.dueProjects += result.items.length;
      summary.plannedNotifications += result.delivery.plannedNotifications;
      summary.notificationsSent += result.delivery.notificationsSent;
    } catch (error) {
      summary.failedOrganizations += 1;
      errors.push({
        organizationId: organization.id,
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  }

  return {
    processedAt: (input?.now ?? new Date()).toISOString(),
    deliveryEnabled: Boolean(input?.deliveryEnabled),
    summary,
    errors,
  };
}
