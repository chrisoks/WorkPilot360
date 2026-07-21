import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInternalAutomationHeaders } from "@/lib/auth/internal-automation";
import { runTaskEscalationAutomation } from "@/lib/tasks/escalation-automation";
import { POST } from "./route";

vi.mock("@/lib/tasks/escalation-automation", () => ({
  runTaskEscalationAutomation: vi.fn(),
}));

const runAutomationMock = vi.mocked(runTaskEscalationAutomation);

function createResult(input?: { successful?: number; failed?: number }) {
  const successfulOrganizations = input?.successful ?? 1;
  const failedOrganizations = input?.failed ?? 0;
  return {
    processedAt: "2026-07-21T08:00:00.000Z",
    deliveryEnabled: false,
    summary: {
      organizations: successfulOrganizations + failedOrganizations,
      successfulOrganizations,
      failedOrganizations,
      activeEpisodes: 0,
      createdEpisodes: 0,
      updatedEpisodes: 0,
      resolvedEpisodes: 0,
      plannedNotifications: 0,
      blockedLeadershipEpisodes: 0,
      notificationsSent: 0,
      emailsSent: 0,
    },
    errors: [],
  };
}

describe("POST /api/task-escalations/automation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKPILOT_TASK_ESCALATION_DELIVERY_ENABLED = "false";
  });

  it("weist externe Aufrufe ohne internes Automationsmerkmal ab", async () => {
    const response = await POST(
      new Request("http://localhost/api/task-escalations/automation", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(runAutomationMock).not.toHaveBeenCalled();
  });

  it("führt den Lauf intern aus, ohne die Zustellung implizit einzuschalten", async () => {
    runAutomationMock.mockResolvedValue(createResult());
    const response = await POST(
      new Request("http://localhost/api/task-escalations/automation", {
        method: "POST",
        headers: getInternalAutomationHeaders(),
      })
    );

    expect(response.status).toBe(200);
    expect(runAutomationMock).toHaveBeenCalledWith({ deliveryEnabled: false });
  });

  it("kennzeichnet einen teilweisen Mandantenfehler mit HTTP 207", async () => {
    runAutomationMock.mockResolvedValue(createResult({ successful: 1, failed: 1 }));
    const response = await POST(
      new Request("http://localhost/api/task-escalations/automation", {
        method: "POST",
        headers: getInternalAutomationHeaders(),
      })
    );

    expect(response.status).toBe(207);
  });
});
