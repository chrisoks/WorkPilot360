import { randomUUID } from "node:crypto";
import { Prisma, Role, TaskStatus } from "@prisma/client";
import { sendTaskNotificationMailSafely } from "@/lib/mail/task-notifications";

type TaskCommentTransaction = Prisma.TransactionClient;

export type TaskCommentAuthority = {
  id: string;
  role: Role;
};

export type CreateTaskCommentInput = {
  organizationId: string;
  taskId: string;
  authority: TaskCommentAuthority[];
  authorUserId: string;
  text: string;
  recipientUserId?: string;
  source?: "manual" | "jarvis";
  previewId?: string;
  payloadHash?: string;
};

export type TaskCommentMailNotification = {
  notificationId: string;
  userId: string;
  subject: string;
  body: string;
};

export class TaskCommentServiceError extends Error {
  constructor(
    public readonly code:
      | "actor_stale"
      | "forbidden"
      | "task_not_found"
      | "task_archived"
      | "recipient_invalid"
      | "invalid_input",
    message: string
  ) {
    super(message);
    this.name = "TaskCommentServiceError";
  }
}

function userName(user: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function canComment(
  actorId: string,
  task: {
    ownerId: string;
    createdById: string | null;
    participantIds: string[];
  }
) {
  return (
    task.ownerId === actorId ||
    task.createdById === actorId ||
    task.participantIds.includes(actorId)
  );
}

export async function createTaskComment(
  tx: TaskCommentTransaction,
  input: CreateTaskCommentInput
) {
  const text = input.text.trim().slice(0, 4000);
  if (!input.organizationId || !input.taskId || !text) {
    throw new TaskCommentServiceError(
      "invalid_input",
      "Aufgabe und Kommentartext müssen vollständig angegeben sein."
    );
  }
  const authorityIds = [...new Set(input.authority.map((actor) => actor.id))];
  if (!authorityIds.length || !authorityIds.includes(input.authorUserId)) {
    throw new TaskCommentServiceError(
      "forbidden",
      "Der schreibende Benutzer ist nicht eindeutig autorisiert."
    );
  }

  const [actors, task] = await Promise.all([
    tx.user.findMany({
      where: {
        id: { in: authorityIds },
        organizationId: input.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
    tx.task.findFirst({
      where: {
        id: input.taskId,
        organizationId: input.organizationId,
      },
      include: {
        participants: {
          select: { userId: true },
        },
      },
    }),
  ]);

  if (
    actors.length !== authorityIds.length ||
    input.authority.some(
      (authority) =>
        actors.find((actor) => actor.id === authority.id)?.role !==
        authority.role
    )
  ) {
    throw new TaskCommentServiceError(
      "actor_stale",
      "Mindestens eine gebundene Identität ist nicht mehr aktiv oder ihre Rolle hat sich geändert."
    );
  }
  if (!task) {
    throw new TaskCommentServiceError(
      "task_not_found",
      "Die Aufgabe wurde nicht gefunden."
    );
  }
  if (task.status === TaskStatus.ARCHIVIERT) {
    throw new TaskCommentServiceError(
      "task_archived",
      "Archivierte Aufgaben dürfen nicht mehr kommentiert werden."
    );
  }
  const participantIds = task.participants.map((participant) => participant.userId);
  const taskAccess = {
    ownerId: task.ownerId,
    createdById: task.createdById,
    participantIds,
  };
  if (actors.some((actor) => !canComment(actor.id, taskAccess))) {
    throw new TaskCommentServiceError(
      "forbidden",
      "Die aktuelle Rollenkombination darf diese Aufgabe nicht kommentieren."
    );
  }
  const author = actors.find((actor) => actor.id === input.authorUserId);
  if (!author) {
    throw new TaskCommentServiceError(
      "actor_stale",
      "Der schreibende Benutzer ist nicht mehr aktiv."
    );
  }

  let recipient:
    | { id: string; firstName: string; lastName: string; email: string }
    | null = null;
  if (input.recipientUserId) {
    if (!participantIds.includes(input.recipientUserId)) {
      throw new TaskCommentServiceError(
        "recipient_invalid",
        "Kommentare können nur an Aufgabenbeteiligte gerichtet werden."
      );
    }
    recipient = await tx.user.findFirst({
      where: {
        id: input.recipientUserId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
    if (!recipient) {
      throw new TaskCommentServiceError(
        "recipient_invalid",
        "Die ausgewählte empfangende Person ist nicht mehr aktiv."
      );
    }
  }

  const comment = await tx.taskComment.create({
    data: {
      organizationId: input.organizationId,
      taskId: task.id,
      authorId: author.id,
      recipientUserId: recipient?.id ?? null,
      body: text,
    },
  });

  const recipientName = recipient ? userName(recipient) : "";
  const notificationRecipientIds = new Set([
    task.ownerId,
    ...(task.createdById ? [task.createdById] : []),
    ...participantIds,
  ]);
  notificationRecipientIds.delete(author.id);
  const mailNotifications: TaskCommentMailNotification[] = [];
  for (const userId of notificationRecipientIds) {
    const body = recipientName
      ? `${userName(author)} hat in der Aufgabe "${task.title}" einen Kommentar an ${recipientName} geschrieben: ${text}`
      : `${userName(author)} hat die Aufgabe "${task.title}" kommentiert: ${text}`;
    const notification = await tx.notification.create({
      data: {
        organizationId: input.organizationId,
        taskId: task.id,
        userId,
        channel: "app",
        subject: "Neuer Kommentar zur Aufgabe",
        body,
        sentAt: null,
        linkTarget: "task",
        linkTargetId: task.id,
        linkLabel: "Aufgabe öffnen",
      },
    });
    mailNotifications.push({
      notificationId: notification.id,
      userId,
      subject: notification.subject,
      body,
    });
  }

  const currentHistory = Array.isArray(task.history) ? task.history : [];
  await tx.task.update({
    where: { id: task.id },
    data: {
      history: [
        ...currentHistory,
        {
          id: randomUUID(),
          event:
            input.source === "jarvis"
              ? "Kommentar über JARVIS hinzugefügt"
              : "Kommentar hinzugefügt",
          actorName: userName(author),
          note: recipientName ? `An ${recipientName}: ${text}` : text,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  });

  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      taskId: task.id,
      actorId: author.id,
      action:
        input.source === "jarvis"
          ? "JARVIS_TASK_COMMENT_CREATED"
          : "TASK_COMMENT_CREATED",
      entityType: "TaskComment",
      entityId: comment.id,
      payload: {
        recipientUserId: recipient?.id ?? null,
        previewId: input.previewId ?? null,
        payloadHash: input.payloadHash ?? null,
      },
    },
  });

  return {
    comment,
    task: { id: task.id, title: task.title },
    authorName: userName(author),
    recipientName,
    mailNotifications,
  };
}

export async function deliverTaskCommentNotificationMails(
  notifications: TaskCommentMailNotification[]
) {
  await Promise.all(
    notifications.map((notification) =>
      sendTaskNotificationMailSafely(notification)
    )
  );
}
