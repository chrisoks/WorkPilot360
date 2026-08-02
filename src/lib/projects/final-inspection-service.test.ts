import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const executeProjectStatusChange = vi.fn(async () => ({ replayed: false }));
  const sendNotificationMailSafely = vi.fn(async () => undefined);
  const prisma = {
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    workPilotProject: { findFirst: vi.fn() },
    projectLogbookEntry: { findFirst: vi.fn(), count: vi.fn() },
    notification: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({})),
  };
  return { prisma, executeProjectStatusChange, sendNotificationMailSafely };
});

vi.mock("@/lib/db/client", () => ({ prisma: fake.prisma }));
vi.mock("@/lib/projects/project-status-service", () => ({ executeProjectStatusChange: fake.executeProjectStatusChange }));
vi.mock("@/lib/mail/notifications", () => ({ sendNotificationMailSafely: fake.sendNotificationMailSafely }));
vi.mock("@/lib/storage/document-file", () => ({
  prepareStorageBackedPayload: vi.fn(), persistStorageBackedPayload: vi.fn(), cleanupStorageBackedPayload: vi.fn(),
}));

import {
  applyFinalInspectionBillingStatus,
  createFinalInspection,
  FinalInspectionServiceError,
} from "@/lib/projects/final-inspection-service";

describe("shared final inspection service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    fake.prisma.workPilotProject.findFirst.mockResolvedValue({
      id: "project-1", projectNumber: "OKI-1", title: "Objekt", branch: "OK immocare",
      projectType: "Projekt OK immocare", projectKind: "Einmalprojekt", status: "Umsetzung", responsibleName: "Leitung Eins",
    });
    fake.prisma.projectLogbookEntry.findFirst.mockResolvedValue({ id: "inspection-1", projectMonth: "2026-08" });
    fake.prisma.user.findMany.mockResolvedValue([]);
    fake.prisma.notification.findUnique.mockResolvedValue(null);
    fake.prisma.notification.create.mockResolvedValue({ id: "notification-1" });
  });

  it("requires all six checks for a self inspection before touching persistence", async () => {
    await expect(createFinalInspection({
      organizationId: "org-1", actorUserId: "user-1", actorName: "Tester", requestId: "stop-1", source: "jarvis",
      inspection: { projectId: "project-1", mode: "self", allChecksDone: false },
    })).rejects.toBeInstanceOf(FinalInspectionServiceError);
    expect(fake.prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("replays an already persisted inspection without generating another file", async () => {
    await expect(createFinalInspection({
      organizationId: "org-1", actorUserId: "user-1", actorName: "Tester", requestId: "stop-1", source: "jarvis",
      inspection: { projectId: "project-1", mode: "colleague" },
    })).resolves.toEqual({ id: "inspection-1", replayed: true, projectMonth: "2026-08" });
  });

  it("moves a fully evidenced Immocare project to billing ready through the shared status service", async () => {
    fake.prisma.projectLogbookEntry.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const result = await applyFinalInspectionBillingStatus({
      organizationId: "org-1", projectId: "project-1", projectMonth: "2026-08",
      actorUserId: "user-1", actorName: "Tester", requestId: "stop-1:status", source: "jarvis",
    });
    expect(result).toMatchObject({ changed: true, nextStatus: "Zur Abrechnung bereit" });
    expect(fake.executeProjectStatusChange).toHaveBeenCalledWith(expect.objectContaining({
      targetStatus: "Zur Abrechnung bereit", requestId: "stop-1:status", source: "jarvis",
    }));
  });
});
