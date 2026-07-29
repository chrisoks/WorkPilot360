import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisConfirmedTask } from "@/lib/services/task-service";

function buildTransaction(input?: {
  actorRole?: Role;
  ownerId?: string;
  ownerOrganizationId?: string;
  projectFound?: boolean;
}) {
  const actor = {
    id: "actor-1",
    organizationId: "org-1",
    isActive: true,
    role: input?.actorRole ?? Role.GESCHAEFTSFUEHRER,
    firstName: "Jarvis",
    lastName: "Tester",
    email: "jarvis@example.test",
    teamId: "team-1",
  };
  const owner = {
    id: input?.ownerId ?? "owner-1",
    organizationId: input?.ownerOrganizationId ?? "org-1",
    isActive: true,
    role: Role.MITARBEITER,
    firstName: "Aufgaben",
    lastName: "Empfänger",
    email: "owner@example.test",
    teamId: "team-2",
  };
  const task = {
    id: "task-1",
    title: "Kunden anrufen",
    deadline: new Date(Date.now() + 86_400_000),
    projectId: "project-1",
  };
  const tx = {
    user: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const candidate = where.id === actor.id ? actor : where.id === owner.id ? owner : null;
        return candidate &&
          candidate.organizationId === where.organizationId &&
          candidate.isActive === where.isActive
          ? candidate
          : null;
      }),
    },
    workPilotProject: {
      findFirst: vi.fn(async () =>
        input?.projectFound === false ? null : { id: "project-1" }
      ),
    },
    task: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => ({
        ...task,
        ...data,
        id: task.id,
      })),
    },
    statusTimelineEntry: { create: vi.fn(async () => ({})) },
    auditLog: { create: vi.fn(async () => ({})) },
    notification: { create: vi.fn(async () => ({})) },
  };
  return { tx, actor, owner };
}

function command(role: Role = Role.GESCHAEFTSFUEHRER) {
  return {
    organizationId: "org-1",
    previewId: "preview-1",
    payloadHash: "payload-hash",
    actor: { id: "actor-1", role },
    title: "  Kunden anrufen  ",
    description: "  Angebot abstimmen  ",
    ownerId: "owner-1",
    deadline: new Date(Date.now() + 86_400_000),
    projectId: "project-1",
  };
}

describe("createJarvisConfirmedTask", () => {
  it("rechecks tenant, role, owner, assignment and project before writing", async () => {
    const wrongRole = buildTransaction({ actorRole: Role.ADMIN });
    await expect(
      createJarvisConfirmedTask(wrongRole.tx as never, command())
    ).rejects.toThrow("JARVIS_ACTOR_STALE");

    const foreignOwner = buildTransaction({ ownerOrganizationId: "org-2" });
    await expect(
      createJarvisConfirmedTask(foreignOwner.tx as never, command())
    ).rejects.toThrow("JARVIS_OWNER_INVALID");

    const missingProject = buildTransaction({ projectFound: false });
    await expect(
      createJarvisConfirmedTask(missingProject.tx as never, command())
    ).rejects.toThrow("JARVIS_PROJECT_STALE");

    const employee = buildTransaction({ actorRole: Role.MITARBEITER });
    await expect(
      createJarvisConfirmedTask(
        employee.tx as never,
        command(Role.MITARBEITER)
      )
    ).rejects.toThrow("JARVIS_OWNER_FORBIDDEN");

    expect(wrongRole.tx.task.create).not.toHaveBeenCalled();
    expect(foreignOwner.tx.task.create).not.toHaveBeenCalled();
    expect(missingProject.tx.task.create).not.toHaveBeenCalled();
    expect(employee.tx.task.create).not.toHaveBeenCalled();
  });

  it("writes task, timeline, audit and assignment notification together", async () => {
    const { tx } = buildTransaction();
    const result = await createJarvisConfirmedTask(
      tx as never,
      command()
    );

    expect(result).toMatchObject({
      id: "task-1",
      title: "Kunden anrufen",
      ownerId: "owner-1",
      projectId: "project-1",
    });
    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        ownerId: "owner-1",
        title: "Kunden anrufen",
        description: "Angebot abstimmen",
        acceptanceStatus: "pending",
      }),
    });
    expect(tx.statusTimelineEntry.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "JARVIS_TASK_CREATED",
        payload: expect.objectContaining({
          previewId: "preview-1",
          payloadHash: "payload-hash",
        }),
      }),
    });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });

  it("accepts self-assignment for employees without creating a notification", async () => {
    const { tx } = buildTransaction({
      actorRole: Role.MITARBEITER,
      ownerId: "actor-1",
    });
    const input = {
      ...command(Role.MITARBEITER),
      ownerId: "actor-1",
    };
    const result = await createJarvisConfirmedTask(tx as never, input);

    expect(result.ownerId).toBe("actor-1");
    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ acceptanceStatus: "accepted" }),
    });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
