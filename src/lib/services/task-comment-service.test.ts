import { describe, expect, it, vi } from "vitest";
import { Role, TaskStatus } from "@prisma/client";
import {
  createTaskComment,
} from "@/lib/services/task-comment-service";

function transaction(options: {
  status?: TaskStatus;
  includeSessionAsParticipant?: boolean;
} = {}) {
  const task = {
    id: "task-1",
    organizationId: "org-1",
    title: "Fenster prüfen",
    ownerId: "employee",
    createdById: "leader",
    status: options.status ?? TaskStatus.OFFEN,
    history: [],
    participants: [
      { userId: "recipient" },
      ...(options.includeSessionAsParticipant
        ? [{ userId: "session" }]
        : []),
    ],
  };
  const actors = [
    {
      id: "employee",
      role: Role.MITARBEITER,
      firstName: "Mara",
      lastName: "Muster",
      email: "mara@example.test",
    },
    {
      id: "session",
      role: Role.ADMIN,
      firstName: "Ada",
      lastName: "Admin",
      email: "ada@example.test",
    },
  ];
  return {
    user: {
      findMany: vi.fn().mockImplementation(({ where }) =>
        Promise.resolve(
          actors.filter((actor) => where.id.in.includes(actor.id))
        )
      ),
      findFirst: vi.fn().mockResolvedValue({
        id: "recipient",
        firstName: "Rita",
        lastName: "Rückmeldung",
        email: "rita@example.test",
      }),
    },
    task: {
      findFirst: vi.fn().mockResolvedValue(task),
      update: vi.fn().mockResolvedValue(task),
    },
    taskComment: {
      create: vi.fn().mockResolvedValue({
        id: "comment-1",
        body: "Bitte morgen prüfen.",
        createdAt: new Date(),
      }),
    },
    notification: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: `notification-${data.userId}`, ...data })
      ),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

describe("task comment service", () => {
  it("creates comment, history, audit and existing notifications atomically", async () => {
    const tx = transaction();
    const result = await createTaskComment(tx as never, {
      organizationId: "org-1",
      taskId: "task-1",
      authority: [{ id: "employee", role: Role.MITARBEITER }],
      authorUserId: "employee",
      text: "Bitte morgen prüfen.",
      recipientUserId: "recipient",
      source: "jarvis",
      previewId: "preview-1",
      payloadHash: "hash-1",
    });
    expect(result.comment.id).toBe("comment-1");
    expect(tx.task.update).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "JARVIS_TASK_COMMENT_CREATED",
        entityId: "comment-1",
      }),
    });
    expect(result.mailNotifications.length).toBeGreaterThan(0);
  });

  it("lets impersonation restrict access and never expand it", async () => {
    const tx = transaction({ includeSessionAsParticipant: false });
    await expect(
      createTaskComment(tx as never, {
        organizationId: "org-1",
        taskId: "task-1",
        authority: [
          { id: "session", role: Role.ADMIN },
          { id: "employee", role: Role.MITARBEITER },
        ],
        authorUserId: "employee",
        text: "Nicht zulässig.",
        source: "jarvis",
      })
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(tx.taskComment.create).not.toHaveBeenCalled();
  });

  it("blocks comments on archived tasks", async () => {
    const tx = transaction({ status: TaskStatus.ARCHIVIERT });
    await expect(
      createTaskComment(tx as never, {
        organizationId: "org-1",
        taskId: "task-1",
        authority: [{ id: "employee", role: Role.MITARBEITER }],
        authorUserId: "employee",
        text: "Nicht zulässig.",
      })
    ).rejects.toMatchObject({
      code: "task_archived",
    });
  });
});
