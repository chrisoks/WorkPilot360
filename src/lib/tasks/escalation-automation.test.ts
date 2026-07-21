import { describe, expect, it, vi } from "vitest";
import { processTaskEscalationOrganizations } from "./escalation-automation";

const user = {
  id: "user-1",
  firstName: "Lena",
  lastName: "Muster",
  email: "lena@example.test",
  role: "MITARBEITER",
  isActive: true,
  leadershipManagerId: "manager-1",
  leadershipDeputyId: null,
};

describe("processTaskEscalationOrganizations", () => {
  it("isoliert Mandantenfehler und summiert erfolgreiche Läufe", async () => {
    const synchronize = vi.fn(async ({ organizationId }: { organizationId: string }) => {
      if (organizationId === "org-failed") throw new Error("Datenbank vorübergehend nicht erreichbar");
      return {
        summary: { active: 2, created: 1, updated: 1, resolved: 0 },
        notificationsSent: 2,
        emailsSent: 1,
        delivery: { plannedNotifications: 2, blockedLeadershipEpisodes: 0 },
      };
    });
    const now = new Date("2026-07-21T08:00:00.000Z");

    const result = await processTaskEscalationOrganizations({
      organizations: [
        { id: "org-ok", users: [user] },
        { id: "org-failed", users: [user] },
      ],
      deliveryEnabled: false,
      now,
      synchronize,
    });

    expect(synchronize).toHaveBeenCalledTimes(2);
    expect(result.processedAt).toBe(now.toISOString());
    expect(result.summary).toMatchObject({
      organizations: 2,
      successfulOrganizations: 1,
      failedOrganizations: 1,
      activeEpisodes: 2,
      createdEpisodes: 1,
      updatedEpisodes: 1,
      plannedNotifications: 2,
      notificationsSent: 2,
      emailsSent: 1,
    });
    expect(result.errors).toEqual([
      { organizationId: "org-failed", message: "Datenbank vorübergehend nicht erreichbar" },
    ]);
  });
});
