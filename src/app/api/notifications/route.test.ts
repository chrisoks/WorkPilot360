import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  executeRawMock,
  getDemoContextMock,
  getSessionBoundActorMock,
} = vi.hoisted(() => ({
  executeRawMock: vi.fn(),
  getDemoContextMock: vi.fn(),
  getSessionBoundActorMock: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $executeRaw: executeRawMock,
  },
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: getDemoContextMock,
}));

vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: getSessionBoundActorMock,
  sessionBoundActorResponse: vi.fn(),
}));

vi.mock("@/lib/company-settings/deadlines", () => ({ getDeadlineSettings: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ canCreateNotifications: vi.fn() }));
vi.mock("@/lib/mail/notifications", () => ({ sendNotificationMailSafely: vi.fn() }));
vi.mock("@/lib/mail/task-notifications", () => ({ sendTaskNotificationMailSafely: vi.fn() }));
vi.mock("@/lib/users/leadership", () => ({ getLeadershipRecipientIds: vi.fn() }));

import { PATCH } from "./route";

describe("PATCH /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoContextMock.mockResolvedValue({ users: [] });
    getSessionBoundActorMock.mockResolvedValue({
      ok: true,
      actor: { id: "user-1", organizationId: "org-1" },
    });
  });

  it.each(["read", "resolve"] as const)(
    "updates exactly one owned notification with action %s",
    async (action) => {
      executeRawMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      const response = await PATCH(
        new Request("http://localhost/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "user-1",
            notificationId: "notification-1",
            action,
          }),
        })
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true, action });
      expect(executeRawMock).toHaveBeenCalledTimes(2);
    }
  );

  it("rejects an unknown single-notification action", async () => {
    executeRawMock.mockResolvedValueOnce(0);

    const response = await PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          notificationId: "notification-1",
          action: "delete",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  it("does not expose notifications outside the signed-in user scope", async () => {
    executeRawMock.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const response = await PATCH(
      new Request("http://localhost/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          notificationId: "foreign-notification",
          action: "resolve",
        }),
      })
    );

    expect(response.status).toBe(404);
  });
});
