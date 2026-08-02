import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const tasks = new Map<string, any>();
  const notifications = new Map<string, any>();
  const participants = new Map<string, any>();
  const mails: any[] = [];
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    task: {
      findFirst: vi.fn(async ({ where }: any) => [...tasks.values()].find((task) => task.organizationId === where.organizationId && task.projectId === where.projectId && task.description.includes(where.description.contains)) ?? null),
      create: vi.fn(async ({ data }: any) => { tasks.set(data.id, data); return data; }),
    },
    taskParticipant: {
      upsert: vi.fn(async ({ where, create }: any) => {
        const key = `${where.taskId_userId.taskId}:${where.taskId_userId.userId}`;
        if (!participants.has(key)) participants.set(key, create);
        return participants.get(key);
      }),
    },
    notification: {
      findUnique: vi.fn(async ({ where }: any) => notifications.has(where.id) ? { id: where.id } : null),
      create: vi.fn(async ({ data }: any) => { notifications.set(data.id, data); return data; }),
    },
  };
  const prisma = {
    user: { findMany: vi.fn() },
    workPilotProject: { findFirst: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const sendNotificationMailSafely = vi.fn(async (mail: any) => { mails.push(mail); });
  return { prisma, tx, tasks, notifications, participants, mails, sendNotificationMailSafely };
});

vi.mock("@/lib/db/client", () => ({ prisma: fake.prisma }));
vi.mock("@/lib/mail/notifications", () => ({ sendNotificationMailSafely: fake.sendNotificationMailSafely }));

import { ensureStampInterruptionFollowup } from "@/lib/time/stamp-session-interruption-service";

const entry = {
  id: "time-1", organizationId: "org-1", mode: "project", projectId: "project-1", projectLabel: "HAS-1 | Objekt",
  trade: "", planningEntryId: "", planningBillingGroupId: "", billingCatalogItemId: "", billingCatalogItemLabel: "",
  userId: "worker-1", employee: "Monteur Eins", entrySource: "stamped" as const, date: "2026-08-02", startTime: "08:00", endTime: "09:00",
  durationMs: 3_600_000, pauseMs: 0, laborCostRateSnapshot: 0, laborCostSnapshot: 0, costSnapshotAt: "2026-08-02T09:00:00.000Z",
  comment: "Unterbrechungsgrund: Material fehlt", marketingContentItemId: "", marketingContentType: "", completionStatus: "interrupted" as const,
  invoiceId: "", invoiceNumber: "", invoicedAt: "", overtimeApprovalStatus: "not_required" as const,
  overtimeApprovedByUserId: "", overtimeApprovedByName: "", overtimeApprovedAt: "", editHistory: [], createdAt: "2026-08-02T09:00:00.000Z",
};

describe("stamp interruption follow-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.tasks.clear(); fake.notifications.clear(); fake.participants.clear(); fake.mails.length = 0;
    fake.prisma.user.findMany.mockResolvedValue([
      { id: "owner-1", firstName: "Leitung", lastName: "Eins", email: "leitung@example.invalid", role: "FUEHRUNGSKRAFT", isActive: true, teamId: "team-1" },
      { id: "manager-1", firstName: "Chef", lastName: "Eins", email: "chef@example.invalid", role: "GESCHAEFTSFUEHRER", isActive: true, teamId: null },
    ]);
    fake.prisma.workPilotProject.findFirst.mockResolvedValue({ id: "project-1", projectNumber: "HAS-1", title: "Objekt", customer: "Kunde", responsibleName: "Leitung Eins" });
  });

  it("creates and then safely replays task, recipients and notifications", async () => {
    const first = await ensureStampInterruptionFollowup({ organizationId: "org-1", entry, interruptionReason: "Material fehlt", now: new Date("2026-08-02T09:00:00.000Z") });
    const replay = await ensureStampInterruptionFollowup({ organizationId: "org-1", entry, interruptionReason: "Material fehlt", now: new Date("2026-08-02T09:00:00.000Z") });
    expect(first).toMatchObject({ notificationCount: 2, replayed: false });
    expect(replay).toMatchObject({ taskId: first?.taskId, replayed: true });
    expect(fake.tasks.size).toBe(1);
    expect(fake.notifications.size).toBe(2);
    expect(fake.mails).toHaveLength(2);
    expect([...fake.tasks.values()][0].description).toContain("Stempelung: time-1");
  });
});
