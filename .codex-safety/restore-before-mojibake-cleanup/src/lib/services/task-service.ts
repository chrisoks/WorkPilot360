import { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { canReadTask } from '@/lib/permissions';
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
