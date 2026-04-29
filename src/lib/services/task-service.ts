import { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { canReadTask } from '@/lib/permissions';
import { assertSameTenant, withTenantFilter } from '@/lib/tenant';
import { SessionUser } from '@/types/auth';

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