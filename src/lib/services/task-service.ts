import {
  Prisma,
  Role,
  TaskPriority,
  TaskStatus,
  type User,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/client';
import { canAssignTasksToOthers, canReadTask } from '@/lib/permissions';
import { recordStatusTransition } from '@/lib/status-tracking';
import { assertSameTenant, withTenantFilter } from '@/lib/tenant';
import { SessionUser } from '@/types/auth';

function toUiStatus(status: TaskStatus) {
  if (status === TaskStatus.IN_BEARBEITUNG) return 'in Bearbeitung';
  if (status === TaskStatus.WARTET_AUF_RUECKMELDUNG) return 'wartet auf Rückmeldung';
  if (status === TaskStatus.ERLEDIGT) return 'erledigt';
  if (status === TaskStatus.ABGELEHNT) return 'abgelehnt';
  if (status === TaskStatus.UEBERFAELLIG) return 'überfällig';
  if (status === TaskStatus.ARCHIVIERT) return 'archiviert';
  return 'offen';
}

export async function listVisibleTasks(user: SessionUser) {
  const baseTasks = await prisma.task.findMany({
    where: withTenantFilter(user, { status: { not: TaskStatus.ARCHIVIERT } }),
    orderBy: { deadline: 'asc' }
  });

  return baseTasks.filter((task) => canReadTask(user, task));
}

export async function updateTaskStatus(user: SessionUser, taskId: string, status: TaskStatus) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  assertSameTenant(user, task.organizationId);

  if (!canReadTask(user, task)) throw new Error('Forbidden');

  const updated = await prisma.task.update({ where: { id: task.id }, data: { status } });
  await recordStatusTransition({
    organizationId: task.organizationId,
    entityType: 'task',
    entityId: task.id,
    entityLabel: task.title,
    fromStatus: toUiStatus(task.status),
    toStatus: toUiStatus(status),
    actorUserId: user.id,
    note: 'Aufgabenstatus geändert.'
  });
  await prisma.auditLog.create({
    data: {
      organizationId: task.organizationId,
      taskId: task.id,
      actorId: user.id,
      action: 'TASK_STATUS_UPDATED',
      entityType: 'Task',
      entityId: task.id,
      payload: { from: task.status, to: status }
    }
  });

  return updated;
}

type TaskTransaction = Prisma.TransactionClient;

export type CreateJarvisConfirmedTaskInput = {
  organizationId: string;
  previewId: string;
  payloadHash: string;
  actor: {
    id: string;
    role: Role;
  };
  title: string;
  description?: string;
  ownerId: string;
  deadline: Date;
  projectId?: string;
};

export type JarvisCreatedTaskResult = {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  deadline: string;
  projectId?: string;
};

function taskActorName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

/**
 * Creates exactly one already-confirmed JARVIS task inside the caller's
 * database transaction. All authority-relevant records are reloaded in the
 * same tenant immediately before the write. The Action Center owns the
 * idempotency gate; this service owns the ordinary task invariants.
 */
export async function createJarvisConfirmedTask(
  tx: TaskTransaction,
  input: CreateJarvisConfirmedTaskInput
): Promise<JarvisCreatedTaskResult> {
  const [actor, owner, project] = await Promise.all([
    tx.user.findFirst({
      where: {
        id: input.actor.id,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    tx.user.findFirst({
      where: {
        id: input.ownerId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    input.projectId
      ? tx.workPilotProject.findFirst({
          where: {
            id: input.projectId,
            organizationId: input.organizationId,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!actor || actor.role !== input.actor.role) {
    throw new Error("JARVIS_ACTOR_STALE");
  }
  if (!owner) {
    throw new Error("JARVIS_OWNER_INVALID");
  }
  if (owner.id !== actor.id && !canAssignTasksToOthers(actor)) {
    throw new Error("JARVIS_OWNER_FORBIDDEN");
  }
  if (input.projectId && !project) {
    throw new Error("JARVIS_PROJECT_STALE");
  }
  if (
    !Number.isFinite(input.deadline.getTime()) ||
    input.deadline.getTime() <= Date.now()
  ) {
    throw new Error("JARVIS_DEADLINE_INVALID");
  }

  const title = input.title.trim().slice(0, 180);
  const description = (input.description ?? "").trim().slice(0, 4000);
  if (!title) {
    throw new Error("JARVIS_TITLE_INVALID");
  }

  const createdAt = new Date();
  const ownerIsActor = owner.id === actor.id;
  const task = await tx.task.create({
    data: {
      organizationId: input.organizationId,
      ownerId: owner.id,
      teamId: owner.teamId,
      title,
      description,
      status: TaskStatus.OFFEN,
      priority: TaskPriority.NORMAL,
      deadline: input.deadline,
      projectId: input.projectId ?? null,
      createdById: actor.id,
      acceptanceStatus: ownerIsActor ? "accepted" : "pending",
      history: [
        {
          id: randomUUID(),
          event: "Aufgabe über JARVIS angelegt",
          actorName: taskActorName(actor),
          note: "Nach sichtbarer Action-Center-Bestätigung.",
          createdAt: createdAt.toISOString(),
        },
      ],
    },
  });

  await tx.statusTimelineEntry.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      fromStatus: null,
      toStatus: "offen",
      startedAt: createdAt,
      actorUserId: actor.id,
      actorName: taskActorName(actor),
      note: "Aufgabe nach bestätigter JARVIS-Vorschau angelegt.",
    },
  });

  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      taskId: task.id,
      actorId: actor.id,
      action: "JARVIS_TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      payload: {
        previewId: input.previewId,
        payloadHash: input.payloadHash,
        ownerId: owner.id,
        deadline: input.deadline.toISOString(),
        projectId: input.projectId ?? null,
      },
    },
  });

  if (!ownerIsActor) {
    await tx.notification.create({
      data: {
        organizationId: input.organizationId,
        taskId: task.id,
        userId: owner.id,
        channel: "app",
        subject: "Neue Aufgabe über JARVIS",
        body: `${taskActorName(actor)} hat dir nach ausdrücklicher Bestätigung die Aufgabe "${task.title}" zugewiesen.`,
        sentAt: null,
        linkTarget: "task",
        linkTargetId: task.id,
        linkLabel: "Aufgabe öffnen",
      },
    });
  }

  return {
    id: task.id,
    title: task.title,
    ownerId: owner.id,
    ownerName: taskActorName(owner),
    deadline: task.deadline.toISOString(),
    ...(task.projectId ? { projectId: task.projectId } : {}),
  };
}
