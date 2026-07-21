import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { recordStatusTransition, seedCurrentStatusTimeline } from "@/lib/status-tracking";
import { canAssignTasksToOthers, canDeleteTasks, canEditTask, canReadTask } from "@/lib/permissions";
import { sendTaskNotificationMailSafely } from "@/lib/mail/task-notifications";
import { getLeadershipRecipientIds } from "@/lib/users/leadership";
import {
  CustomerClassification,
  Prisma,
  Role,
  TaskPriority,
  TaskStatus,
  type Task,
  type TaskComment,
  type TaskLink,
  type TimeEntry,
  type User,
} from "@prisma/client";

function getUserName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

async function createTaskNotificationPair(input: {
  organizationId: string;
  taskId: string;
  userId: string;
  subject: string;
  body: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      taskId: input.taskId,
      userId: input.userId,
      channel: "app",
      subject: input.subject,
      body: input.body,
      sentAt: null,
      linkTarget: "task",
      linkTargetId: input.taskId,
      linkLabel: "Aufgabe \u00f6ffnen",
    },
  });

  await sendTaskNotificationMailSafely({
    notificationId: notification.id,
    userId: input.userId,
    subject: input.subject,
    body: input.body,
  });
}

async function notifyCriticalTaskLeadership(input: {
  task: Pick<Task, "id" | "organizationId" | "title" | "priority" | "deadline" | "ownerId">;
  users: User[];
  actor: User;
  reason: "created" | "escalated";
}) {
  if (input.task.priority !== TaskPriority.KRITISCH) return;

  const owner = input.users.find((demoUser) => demoUser.id === input.task.ownerId);
  const deadline = input.task.deadline.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const subject =
    input.reason === "created"
      ? "Kritische Aufgabe angelegt"
      : "Aufgabe auf kritisch gesetzt";
  const body =
    input.reason === "created"
      ? `${getUserName(input.actor)} hat die kritische Aufgabe "${input.task.title}" angelegt. Zuständig: ${
          owner ? getUserName(owner) : "nicht eindeutig"
        }. Deadline: ${deadline}.`
      : `${getUserName(input.actor)} hat die Aufgabe "${input.task.title}" auf kritisch gesetzt. Zuständig: ${
          owner ? getUserName(owner) : "nicht eindeutig"
        }. Deadline: ${deadline}.`;

  const leadershipRecipientIds = new Set(
    getLeadershipRecipientIds([input.task.ownerId], input.users)
  );
  input.users
    .filter(
    (demoUser) =>
      demoUser.isActive &&
      demoUser.organizationId === input.task.organizationId &&
      demoUser.role === Role.GESCHAEFTSFUEHRER
    )
    .forEach((demoUser) => leadershipRecipientIds.add(demoUser.id));

  for (const userId of leadershipRecipientIds) {
    await createTaskNotificationPair({
      organizationId: input.task.organizationId,
      taskId: input.task.id,
      userId,
      subject,
      body,
    });
  }
}

async function notifyTaskCompletedForCollaborators(
  task: TaskWithRelations,
  feedback: TaskFeedbackSettings,
  users: User[],
  actor: User
) {
  if (task.status !== TaskStatus.ERLEDIGT) return;

  const participants = await getTaskParticipants([task.id]);
  const recipientIds = new Set<string>();
  recipientIds.add(task.ownerId);
  if (feedback.createdById) recipientIds.add(feedback.createdById);
  for (const participant of participants.get(task.id) ?? []) {
    recipientIds.add(participant.userId);
  }
  recipientIds.delete(actor.id);

  const actorName = getUserName(actor);
  for (const recipientId of recipientIds) {
    const recipient = users.find((demoUser) => demoUser.id === recipientId);
    if (!recipient) continue;

    await createTaskNotificationPair({
      organizationId: task.organizationId,
      taskId: task.id,
      userId: recipient.id,
      subject: "Aufgabe erledigt",
      body: `${actorName} hat die Aufgabe "${task.title}" erledigt. Die Aufgabe ist damit f\u00fcr alle Beteiligten abgeschlossen.`,
    });
  }
}

function mapStatus(status: string): TaskStatus {
  if (status === "in Bearbeitung") return TaskStatus.IN_BEARBEITUNG;
  if (status === "wartet auf R\u00fcckmeldung") return TaskStatus.WARTET_AUF_RUECKMELDUNG;
  if (status === "erledigt") return TaskStatus.ERLEDIGT;
  if (status === "abgelehnt") return TaskStatus.ABGELEHNT;
  if (status === "\u00fcberf\u00e4llig") return TaskStatus.UEBERFAELLIG;
  if (status === "archiviert") return TaskStatus.ARCHIVIERT;
  return TaskStatus.OFFEN;
}

function mapPriority(priority: string): TaskPriority {
  if (priority === "kritisch") return TaskPriority.KRITISCH;
  if (priority === "hoch") return TaskPriority.HOCH;
  if (priority === "niedrig") return TaskPriority.NIEDRIG;
  return TaskPriority.NORMAL;
}

function mapCustomerClass(customerClass?: string | null): CustomerClassification | null {
  if (customerClass === "A") return CustomerClassification.A;
  if (customerClass === "B") return CustomerClassification.B;
  if (customerClass === "C") return CustomerClassification.C;
  return null;
}

function toUiStatus(status: TaskStatus) {
  if (status === TaskStatus.IN_BEARBEITUNG) return "in Bearbeitung";
  if (status === TaskStatus.WARTET_AUF_RUECKMELDUNG) return "wartet auf R\u00fcckmeldung";
  if (status === TaskStatus.ERLEDIGT) return "erledigt";
  if (status === TaskStatus.ABGELEHNT) return "abgelehnt";
  if (status === TaskStatus.UEBERFAELLIG) return "\u00fcberf\u00e4llig";
  if (status === TaskStatus.ARCHIVIERT) return "archiviert";
  return "offen";
}

function toUiPriority(priority: TaskPriority) {
  if (priority === TaskPriority.KRITISCH) return "kritisch";
  if (priority === TaskPriority.HOCH) return "hoch";
  if (priority === TaskPriority.NIEDRIG) return "niedrig";
  return "normal";
}

function roleLabel(role: Role) {
  if (role === Role.GESCHAEFTSFUEHRER) return "Gesch\u00e4ftsf\u00fchrung";
  if (role === Role.FUEHRUNGSKRAFT) return "F\u00fchrungskraft";
  if (String(role) === "VERTRIEB") return "Vertrieb";
  if (String(role) === "BUCHHALTUNG") return "Buchhaltung";
  if (role === Role.MITARBEITER) return "Mitarbeiter";
  if (role === Role.GAST) return "Gast";
  return "Admin";
}

function parseDeadline(deadline?: string | null) {
  if (!deadline) {
    const defaultDeadline = new Date();
    defaultDeadline.setHours(12, 0, 0, 0);
    return defaultDeadline;
  }

  const trimmedDeadline = deadline.trim();
  const dateOnlyMatch = trimmedDeadline.match(/^(\d{4}-\d{2}-\d{2})(?:T)?$/);
  if (dateOnlyMatch) return new Date(`${dateOnlyMatch[1]}T12:00`);

  const parsedDeadline = new Date(trimmedDeadline);
  if (Number.isNaN(parsedDeadline.getTime())) {
    const fallbackDeadline = new Date();
    fallbackDeadline.setHours(12, 0, 0, 0);
    return fallbackDeadline;
  }

  return parsedDeadline;
}

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseEstimate(estimateMinutes?: unknown) {
  if (estimateMinutes === null || estimateMinutes === undefined || estimateMinutes === "") {
    return null;
  }

  const value = Number(estimateMinutes);
  return Number.isFinite(value) ? value : null;
}

function normalizeProjectId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanTaskTitle(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTaskParticipantUserIds(participants: TaskParticipantView[] | undefined) {
  return (participants ?? []).map((participant) => participant.userId);
}

function canActorReadTask(
  actor: User,
  task: Pick<Task, "ownerId" | "teamId" | "createdById">,
  participants?: TaskParticipantView[]
) {
  return canReadTask(actor, {
    ownerId: task.ownerId,
    teamId: task.teamId,
    createdById: task.createdById,
    participantUserIds: getTaskParticipantUserIds(participants),
  });
}

function parseTaskLinks(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as { label?: unknown; url?: unknown };
      const label = typeof item.label === "string" ? item.label.trim() : "";
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((entry): entry is { label: string; url: string } => Boolean(entry));
}

async function syncTaskLinks(organizationId: string, taskId: string, rawLinks: unknown) {
  const links = parseTaskLinks(rawLinks);
  if (!links) return;
  const offerLinks = links.filter((link) => link.url.startsWith("offer:"));

  await prisma.taskLink.deleteMany({
    where: {
      organizationId,
      taskId,
      url: {
        startsWith: "offer:",
      },
    },
  });

  if (offerLinks.length === 0) return;

  await prisma.taskLink.createMany({
    data: offerLinks.map((link) => ({
      organizationId,
      taskId,
      label: link.label,
      url: link.url,
    })),
  });
}

type TaskWithRelations = Task & {
  owner: User;
  category: { id: string; name: string } | null;
  comments: Array<TaskComment & { author: User }>;
  links: TaskLink[];
  timeEntries: Array<TimeEntry & { user: User }>;
};

type TaskParticipantView = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  role: string;
  acceptanceStatus: "pending" | "accepted" | "rejected";
  acceptanceRespondedAt: string | null;
  rejectionReason: string;
  createdAt: string;
};

type TaskHistoryItem = {
  id: string;
  event: string;
  actorName: string;
  note: string;
  createdAt: string;
};

type TaskParticipantRow = {
  id: string;
  taskId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  acceptanceStatus: string | null;
  acceptanceRespondedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
};

type TaskHistoryRow = {
  id: string;
  history: unknown;
};

type TaskCommentRecipientRow = {
  id: string;
  recipientUserId: string | null;
  recipientFirstName: string | null;
  recipientLastName: string | null;
};

type TaskFeedbackSettings = {
  taskId: string;
  autoFeedbackEnabled: boolean;
  autoFeedbackRecipientId: string | null;
  recurrenceEnabled: boolean;
  recurrenceInterval: string | null;
  recurrenceParentTaskId: string | null;
  createdById: string | null;
  acceptanceStatus: string;
  acceptanceRespondedAt: Date | null;
  rejectionReason: string | null;
  completedAt: Date | null;
  archiveDueAt: Date | null;
  archivedAt: Date | null;
  archiveReason: string | null;
  planningAllocations: unknown;
};

type TaskPlanningAllocation = {
  date: string;
  minutes: number;
};

function normalizeStoredPlanningAllocations(value: unknown): TaskPlanningAllocation[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((allocation) => {
      if (!allocation || typeof allocation !== "object") return null;
      const current = allocation as { date?: unknown; minutes?: unknown };
      const date = typeof current.date === "string" ? current.date : "";
      const minutes = Number(current.minutes);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(minutes) || minutes <= 0) {
        return null;
      }

      return {
        date,
        minutes: Math.round(minutes),
      };
    })
    .filter((allocation): allocation is TaskPlanningAllocation => Boolean(allocation));
}

function parsePlanningAllocations(
  value: unknown,
  estimateMinutes: number | null
): TaskPlanningAllocation[] | { error: string } {
  const allocations = normalizeStoredPlanningAllocations(value);
  if (allocations.length === 0) return [];

  if (!estimateMinutes || estimateMinutes <= 0) {
    return { error: "Bitte eine Vorgabezeit angeben, bevor sie auf mehrere Tage verteilt wird." };
  }

  const totalMinutes = allocations.reduce((total, allocation) => total + allocation.minutes, 0);
  if (totalMinutes !== estimateMinutes) {
    return {
      error: `Die verteilte Vorgabezeit muss exakt ${estimateMinutes} Minuten ergeben.`,
    };
  }

  return allocations;
}

function createTaskHistoryItem(event: string, actorName: string, note = ""): TaskHistoryItem {
  return {
    id: randomUUID(),
    event,
    actorName,
    note,
    createdAt: new Date().toISOString(),
  };
}

function normalizeTaskHistory(value: unknown): TaskHistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Partial<TaskHistoryItem>;
      if (!item.event || !item.createdAt) return null;

      return {
        id: item.id || randomUUID(),
        event: String(item.event),
        actorName: String(item.actorName || "System"),
        note: String(item.note || ""),
        createdAt: String(item.createdAt),
      };
    })
    .filter((entry): entry is TaskHistoryItem => Boolean(entry));
}

async function ensureTaskCommentRecipientColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TaskComment"
    ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT
  `);
}

async function getTaskCommentRecipients(commentIds: string[]) {
  if (commentIds.length === 0) return new Map<string, { id: string; name: string } | null>();
  await ensureTaskCommentRecipientColumn();

  const rows = await prisma.$queryRaw<TaskCommentRecipientRow[]>`
    SELECT
      c.id,
      c."recipientUserId",
      u."firstName" as "recipientFirstName",
      u."lastName" as "recipientLastName"
    FROM "TaskComment" c
    LEFT JOIN "User" u ON u.id = c."recipientUserId"
    WHERE c.id IN (${Prisma.join(commentIds)})
  `;

  return new Map(
    rows.map((row) => [
      row.id,
      row.recipientUserId
        ? {
            id: row.recipientUserId,
            name: `${row.recipientFirstName ?? ""} ${row.recipientLastName ?? ""}`.trim(),
          }
        : null,
    ])
  );
}

function formatTask(
  task: TaskWithRelations,
  feedback?: TaskFeedbackSettings,
  participants: TaskParticipantView[] = [],
  history: TaskHistoryItem[] = [],
  users: User[] = [],
  commentRecipients = new Map<string, { id: string; name: string } | null>()
) {
  const totalTrackedMinutes = task.timeEntries.reduce(
    (total, entry) => total + entry.durationMinutes,
    0
  );

  const createdById = feedback?.createdById ?? task.ownerId;
  const creator = users.find((demoUser) => demoUser.id === createdById);

  return {
    id: task.id,
    createdAt: task.createdAt.toISOString(),
    titel: task.title,
    beschreibung: task.description,
    status: toUiStatus(task.status),
    prioritaet: toUiPriority(task.priority),
    gewerkId: task.categoryId ?? "",
    gewerk: task.category?.name ?? "",
    zustaendigId: task.ownerId,
    zustaendig: `${task.owner.firstName} ${task.owner.lastName}`,
    rolle: roleLabel(task.owner.role),
    faelligkeit: toLocalDateTimeInputValue(task.deadline),
    kunde: task.customer ?? "",
    kundenklasse: task.customerClass ?? "",
    projectId: (task as Task & { projectId?: string | null }).projectId ?? "",
    autoFeedbackEnabled: feedback?.autoFeedbackEnabled ?? false,
    autoFeedbackRecipientId: feedback?.autoFeedbackRecipientId ?? "",
    recurrenceEnabled: feedback?.recurrenceEnabled ?? false,
    recurrenceInterval: feedback?.recurrenceInterval ?? "",
    createdById,
    createdByName: creator ? `${creator.firstName} ${creator.lastName}` : "",
    acceptanceStatus: feedback?.acceptanceStatus ?? "accepted",
    acceptanceRespondedAt: feedback?.acceptanceRespondedAt?.toISOString() ?? null,
    rejectionReason: feedback?.rejectionReason ?? "",
    completedAt: feedback?.completedAt?.toISOString() ?? null,
    archiveDueAt: feedback?.archiveDueAt?.toISOString() ?? null,
    archivedAt: feedback?.archivedAt?.toISOString() ?? null,
    archiveReason: feedback?.archiveReason ?? "",
    vorgabeMinuten: task.estimateMinutes,
    gesamtzeitMinuten: totalTrackedMinutes,
    planningAllocations: normalizeStoredPlanningAllocations(feedback?.planningAllocations),
    participants,
    history,
    kommentare: task.comments.map((comment) => ({
      id: comment.id,
      text: comment.body,
      erstelltAm: comment.createdAt.toISOString(),
      autor: `${comment.author.firstName} ${comment.author.lastName}`,
      recipientUserId: commentRecipients.get(comment.id)?.id ?? "",
      recipientName: commentRecipients.get(comment.id)?.name ?? "",
    })),
    links: task.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
    })),
    zeiteintraege: task.timeEntries.map((entry) => ({
      id: entry.id,
      gestartetAm: toLocalDateTimeInputValue(entry.startedAt),
      dauerMinuten: entry.durationMinutes,
      notiz: entry.note ?? "",
      nutzer: `${entry.user.firstName} ${entry.user.lastName}`,
    })),
  };
}

function parseRecurrenceInterval(interval: unknown, enabled: boolean) {
  if (!enabled || typeof interval !== "string") return null;

  return ["daily", "weekly", "monthly", "yearly"].includes(interval) ? interval : "weekly";
}

function getNextRecurringDeadline(openedAt: Date, interval: string) {
  const nextDeadline = new Date(openedAt);

  if (interval === "daily") nextDeadline.setDate(nextDeadline.getDate() + 1);
  if (interval === "weekly") nextDeadline.setDate(nextDeadline.getDate() + 7);
  if (interval === "monthly") nextDeadline.setMonth(nextDeadline.getMonth() + 1);
  if (interval === "yearly") nextDeadline.setFullYear(nextDeadline.getFullYear() + 1);

  return nextDeadline;
}

function parseAutoFeedbackRecipient(
  recipientId: unknown,
  enabled: boolean,
  users: User[]
) {
  if (!enabled || typeof recipientId !== "string") return null;

  return users.find((demoUser) => demoUser.id === recipientId)?.id ?? null;
}

async function createDoneFeedbackNotification(
  task: TaskWithRelations,
  previousStatus: TaskStatus | null,
  users: User[],
  feedback: TaskFeedbackSettings
) {
  if (previousStatus === TaskStatus.ERLEDIGT || task.status !== TaskStatus.ERLEDIGT) return;
  if (!feedback.autoFeedbackEnabled || !feedback.autoFeedbackRecipientId) return;

  const recipient = users.find((demoUser) => demoUser.id === feedback.autoFeedbackRecipientId);
  if (!recipient) return;

  const existingNotification = await prisma.notification.findFirst({
    where: {
      taskId: task.id,
      userId: recipient.id,
      channel: "email",
      subject: "Aufgabe erledigt",
    },
  });

  if (existingNotification) return;

  const bodyText = `Die Aufgabe "${task.title}" wurde erledigt. Rückmeldung an: ${recipient.email}`;
  const notification = await prisma.notification.create({
    data: {
      organizationId: task.organizationId,
      taskId: task.id,
      userId: recipient.id,
      channel: "email",
      subject: "Aufgabe erledigt",
      body: bodyText,
      sentAt: null,
    },
  });

  await sendTaskNotificationMailSafely({
    notificationId: notification.id,
    userId: recipient.id,
    subject: "Aufgabe erledigt",
    body: bodyText,
  });
}

async function getTaskFeedbackSettings(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, TaskFeedbackSettings>();

  await ensureTaskPlanningColumn();

  const feedbackRows = await prisma.$queryRaw<TaskFeedbackSettings[]>`
    SELECT
      id as "taskId",
      "autoFeedbackEnabled",
      "autoFeedbackRecipientId",
      "recurrenceEnabled",
      "recurrenceInterval",
      "recurrenceParentTaskId",
      "createdById",
      "acceptanceStatus",
      "acceptanceRespondedAt",
      "rejectionReason",
      "completedAt",
      "archiveDueAt",
      "archivedAt",
      "archiveReason",
      "planningAllocations"
    FROM "Task"
    WHERE id IN (${Prisma.join(taskIds)})
  `;

  return new Map(feedbackRows.map((row) => [row.taskId, row]));
}

async function ensureTaskPlanningColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "planningAllocations" JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
}

async function ensureTaskCollaborationColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TaskParticipant"
    ADD COLUMN IF NOT EXISTS "acceptanceStatus" TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "acceptanceRespondedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT
  `);
}

async function ensureTaskProjectColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "projectId" TEXT
  `);
}

async function getTaskProjectIds(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, string>();

  await ensureTaskProjectColumn();

  const rows = await prisma.$queryRaw<Array<{ id: string; projectId: string | null }>>`
    SELECT id, "projectId"
    FROM "Task"
    WHERE id IN (${Prisma.join(taskIds)})
  `;

  return new Map(rows.map((row) => [row.id, row.projectId ?? ""]));
}

async function updateTaskProjectId(taskId: string, projectId: string | null) {
  await ensureTaskProjectColumn();
  await prisma.$executeRaw`
    UPDATE "Task"
    SET "projectId" = ${projectId}
    WHERE id = ${taskId}
  `;
}

async function appendTaskHistory(taskId: string, items: TaskHistoryItem[]) {
  if (items.length === 0) return;
  await ensureTaskCollaborationColumns();
  await prisma.$executeRaw`
    UPDATE "Task"
    SET "history" = COALESCE("history", '[]'::jsonb) || ${JSON.stringify(items)}::jsonb
    WHERE id = ${taskId}
  `;
}

async function getTaskParticipants(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, TaskParticipantView[]>();
  await ensureTaskCollaborationColumns();

  const rows = await prisma.$queryRaw<TaskParticipantRow[]>`
    SELECT
      p.id,
      p."taskId",
      p."userId",
      u."firstName",
      u."lastName",
      u.role,
      p."acceptanceStatus",
      p."acceptanceRespondedAt",
      p."rejectionReason",
      p."createdAt"
    FROM "TaskParticipant" p
    JOIN "User" u ON u.id = p."userId"
    WHERE p."taskId" IN (${Prisma.join(taskIds)})
    ORDER BY p."createdAt" ASC
  `;

  const grouped = new Map<string, TaskParticipantView[]>();
  rows.forEach((row) => {
    const participant: TaskParticipantView = {
      id: row.id,
      taskId: row.taskId,
      userId: row.userId,
      userName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
      role: roleLabel(row.role),
      acceptanceStatus:
        row.acceptanceStatus === "accepted" || row.acceptanceStatus === "rejected"
          ? row.acceptanceStatus
          : "pending",
      acceptanceRespondedAt: row.acceptanceRespondedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason ?? "",
      createdAt: row.createdAt.toISOString(),
    };

    grouped.set(row.taskId, [...(grouped.get(row.taskId) ?? []), participant]);
  });

  return grouped;
}

async function getTaskHistories(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, TaskHistoryItem[]>();
  await ensureTaskCollaborationColumns();

  const rows = await prisma.$queryRaw<TaskHistoryRow[]>`
    SELECT id, "history"
    FROM "Task"
    WHERE id IN (${Prisma.join(taskIds)})
  `;

  return new Map(rows.map((row) => [row.id, normalizeTaskHistory(row.history)]));
}

async function getFormattedTask(taskId: string, users: User[], projectId = "") {
  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    include: {
      owner: true,
      category: true,
      comments: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          author: true,
        },
      },
      timeEntries: {
        orderBy: {
          startedAt: "desc",
        },
        include: {
          user: true,
        },
      },
      links: true,
    },
  });

  if (!task) return null;

  const feedback = (await getTaskFeedbackSettings([task.id])).get(task.id);
  const participantMap = await getTaskParticipants([task.id]);
  const historyMap = await getTaskHistories([task.id]);
  const commentRecipientsById = await getTaskCommentRecipients(
    task.comments.map((comment) => comment.id)
  );

  return {
    ...formatTask(
      task,
      feedback,
      participantMap.get(task.id) ?? [],
      historyMap.get(task.id) ?? [],
      users,
      commentRecipientsById
    ),
    projectId,
  };
}

async function updateTaskPlanningAllocations(
  taskId: string,
  allocations: TaskPlanningAllocation[]
) {
  await ensureTaskPlanningColumn();
  await prisma.$executeRaw`
    UPDATE "Task"
    SET "planningAllocations" = ${JSON.stringify(allocations)}::jsonb
    WHERE id = ${taskId}
  `;
}

async function updateTaskFeedbackSettings(
  taskId: string,
  enabled: boolean,
  recipientId: string | null,
  recurrenceEnabled: boolean,
  recurrenceInterval: string | null,
  createdById?: string | null,
  acceptanceStatus?: string
): Promise<TaskFeedbackSettings> {
  await prisma.$executeRaw`
    UPDATE "Task"
    SET
      "autoFeedbackEnabled" = ${enabled},
      "autoFeedbackRecipientId" = ${recipientId},
      "recurrenceEnabled" = ${recurrenceEnabled},
      "recurrenceInterval" = ${recurrenceInterval},
      "createdById" = COALESCE(${createdById ?? null}, "createdById"),
      "acceptanceStatus" = COALESCE(${acceptanceStatus ?? null}, "acceptanceStatus")
    WHERE id = ${taskId}
  `;

  return {
    taskId,
    autoFeedbackEnabled: enabled,
    autoFeedbackRecipientId: recipientId,
    recurrenceEnabled,
    recurrenceInterval,
    recurrenceParentTaskId: null,
    createdById: createdById ?? null,
    acceptanceStatus: acceptanceStatus ?? "accepted",
    acceptanceRespondedAt: null,
    rejectionReason: null,
    completedAt: null,
    archiveDueAt: null,
    archivedAt: null,
    archiveReason: null,
    planningAllocations: [],
  };
}

async function autoArchiveExpiredTasks() {
  const expiredTasks = await prisma.$queryRaw<
    Array<{ id: string; organizationId: string; title: string; status: TaskStatus }>
  >`
    SELECT id, "organizationId", title, status
    FROM "Task"
    WHERE status = 'ERLEDIGT'
      AND "archiveDueAt" IS NOT NULL
      AND "archiveDueAt" <= CURRENT_TIMESTAMP
  `;

  await prisma.$executeRawUnsafe(`
    UPDATE "Task"
    SET
      status = 'ARCHIVIERT',
      "archivedAt" = CURRENT_TIMESTAMP,
      "archiveReason" = 'Automatisch nach 120 Stunden archiviert'
    WHERE status = 'ERLEDIGT'
      AND "archiveDueAt" IS NOT NULL
      AND "archiveDueAt" <= CURRENT_TIMESTAMP
  `);

  for (const task of expiredTasks) {
    await recordStatusTransition({
      organizationId: task.organizationId,
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      fromStatus: toUiStatus(task.status),
      toStatus: toUiStatus(TaskStatus.ARCHIVIERT),
      actorName: "System",
      note: "Aufgabe automatisch archiviert.",
    });
  }
}

async function updateCompletionArchiveTimer(
  organizationId: string,
  taskId: string,
  previousStatus: TaskStatus | null,
  nextStatus: TaskStatus
) {
  if (previousStatus !== TaskStatus.ERLEDIGT && nextStatus === TaskStatus.ERLEDIGT) {
    const deadlineSettings = await getDeadlineSettings(organizationId);
    const completedTaskArchiveDays = deadlineSettings.completedTaskArchiveDays;

    await prisma.$executeRaw`
      UPDATE "Task"
      SET
        "completedAt" = CURRENT_TIMESTAMP,
        "archiveDueAt" = CURRENT_TIMESTAMP + (${completedTaskArchiveDays} * INTERVAL '1 day'),
        "archiveReason" = NULL
      WHERE id = ${taskId}
    `;
    return;
  }

  if (previousStatus === TaskStatus.ERLEDIGT && nextStatus !== TaskStatus.ERLEDIGT) {
    await prisma.$executeRaw`
      UPDATE "Task"
      SET
        "completedAt" = NULL,
        "archiveDueAt" = NULL
      WHERE id = ${taskId}
    `;
  }
}

async function createNextRecurringTask(
  task: TaskWithRelations,
  previousStatus: TaskStatus | null,
  recurrence: TaskFeedbackSettings
) {
  if (previousStatus === TaskStatus.ERLEDIGT || task.status !== TaskStatus.ERLEDIGT) return;
  if (!recurrence.recurrenceEnabled || !recurrence.recurrenceInterval) return;

  const existingNextTask = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Task"
    WHERE "recurrenceParentTaskId" = ${task.id}
    LIMIT 1
  `;

  if (existingNextTask.length > 0) return;

  const nextTask = await prisma.task.create({
    data: {
      organizationId: task.organizationId,
      ownerId: task.ownerId,
      teamId: task.teamId,
      title: task.title,
      description: task.description,
      status: TaskStatus.OFFEN,
      priority: task.priority,
      deadline: getNextRecurringDeadline(task.createdAt, recurrence.recurrenceInterval),
      customer: task.customer,
      customerClass: task.customerClass,
      categoryId: task.categoryId,
      estimateMinutes: task.estimateMinutes,
    },
  });

  await updateTaskProjectId(
    nextTask.id,
    (task as Task & { projectId?: string | null }).projectId ?? null
  );

  await prisma.$executeRaw`
    UPDATE "Task"
    SET
      "recurrenceEnabled" = ${recurrence.recurrenceEnabled},
      "recurrenceInterval" = ${recurrence.recurrenceInterval},
      "recurrenceParentTaskId" = ${task.id},
      "autoFeedbackEnabled" = ${recurrence.autoFeedbackEnabled},
      "autoFeedbackRecipientId" = ${recurrence.autoFeedbackRecipientId},
      "createdById" = ${recurrence.createdById ?? task.ownerId},
      "acceptanceStatus" = ${recurrence.acceptanceStatus}
    WHERE id = ${nextTask.id}
  `;
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);

  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  await ensureTaskProjectColumn();
  await ensureTaskCollaborationColumns();
  await ensureTaskCommentRecipientColumn();
  await autoArchiveExpiredTasks();

  const tasks = await prisma.task.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      owner: true,
      category: true,
      comments: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          author: true,
        },
      },
      timeEntries: {
        orderBy: {
          startedAt: "desc",
        },
        include: {
          user: true,
        },
      },
      links: true,
    },
  });

  const feedbackByTaskId = await getTaskFeedbackSettings(tasks.map((task) => task.id));
  const projectIdByTaskId = await getTaskProjectIds(tasks.map((task) => task.id));
  const participantsByTaskId = await getTaskParticipants(tasks.map((task) => task.id));
  const historyByTaskId = await getTaskHistories(tasks.map((task) => task.id));
  const commentRecipientsById = await getTaskCommentRecipients(
    tasks.flatMap((task) => task.comments.map((comment) => comment.id))
  );

  const visibleTasks = tasks.filter((task) =>
    canActorReadTask(actorResult.actor, task, participantsByTaskId.get(task.id))
  );

  return NextResponse.json(
    visibleTasks.map((task) => ({
      ...formatTask(
        task,
        feedbackByTaskId.get(task.id),
        participantsByTaskId.get(task.id) ?? [],
        historyByTaskId.get(task.id) ?? [],
        users,
        commentRecipientsById
      ),
      projectId: projectIdByTaskId.get(task.id) ?? "",
    }))
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  await ensureTaskProjectColumn();
  await ensureTaskCollaborationColumns();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const taskTitle = cleanTaskTitle(body.title);
  if (!taskTitle) {
    return NextResponse.json({ error: "Bitte einen Aufgabentitel eingeben." }, { status: 400 });
  }

  const requestedOwner = users.find((demoUser) => demoUser.id === body.ownerId && demoUser.isActive);
  const owner = requestedOwner && (canAssignTasksToOthers(actor) || body.absenceHandoverTask) ? requestedOwner : actor;
  const acceptanceStatus = body.absenceHandoverTask
    ? "pending"
    : owner.id === actor.id
      ? "accepted"
      : "pending";
  const nextStatus = body.status ? mapStatus(body.status) : TaskStatus.OFFEN;
  const nextEstimate = parseEstimate(body.estimateMinutes);
  const nextProjectId = normalizeProjectId(body.projectId);
  const planningAllocations = parsePlanningAllocations(body.planningAllocations, nextEstimate);

  if ("error" in planningAllocations) {
    return NextResponse.json({ error: planningAllocations.error }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      organizationId: organization.id,
      ownerId: owner.id,
      teamId: owner.teamId,
      title: taskTitle,
      description: body.description ?? "",
      status: nextStatus,
      priority: mapPriority(body.priority),
      deadline: parseDeadline(body.deadline),
      customer: body.customer || null,
      customerClass: mapCustomerClass(body.customerClass),
      categoryId: body.tradeId || null,
      estimateMinutes: nextEstimate,
    },
    include: {
      owner: true,
      category: true,
      comments: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          author: true,
        },
      },
      timeEntries: {
        orderBy: {
          startedAt: "desc",
        },
        include: {
          user: true,
        },
      },
      links: true,
    },
  });
  await updateCompletionArchiveTimer(organization.id, task.id, null, nextStatus);
  await updateTaskPlanningAllocations(task.id, planningAllocations);
  await updateTaskProjectId(task.id, nextProjectId);
  await syncTaskLinks(organization.id, task.id, body.taskLinks);
  await seedCurrentStatusTimeline({
    organizationId: organization.id,
    entityType: "task",
    entityId: task.id,
    entityLabel: task.title,
    status: toUiStatus(task.status),
    startedAt: task.createdAt,
  });

  const feedback = await updateTaskFeedbackSettings(
    task.id,
    Boolean(body.autoFeedbackEnabled),
    parseAutoFeedbackRecipient(
      body.autoFeedbackRecipientId,
      Boolean(body.autoFeedbackEnabled),
      users
    ),
    Boolean(body.recurrenceEnabled),
    parseRecurrenceInterval(body.recurrenceInterval, Boolean(body.recurrenceEnabled)),
    actor.id,
    acceptanceStatus
  );
  feedback.planningAllocations = planningAllocations;
  const participantUserIds: string[] = Array.isArray(body.participantUserIds)
    ? Array.from(new Set(body.participantUserIds.map((userId: unknown) => String(userId))))
    : [];
  const participants = participantUserIds
    .map((userId: string) => users.find((demoUser) => demoUser.id === userId))
    .filter((participant): participant is (typeof users)[number] => Boolean(participant))
    .filter((participant) => participant.isActive)
    .filter((participant) => participant.id !== owner.id);

  for (const participant of participants) {
    await prisma.$executeRaw`
      INSERT INTO "TaskParticipant" (id, "organizationId", "taskId", "userId", "acceptanceStatus")
      VALUES (${randomUUID()}, ${task.organizationId}, ${task.id}, ${participant.id}, 'pending')
      ON CONFLICT ("taskId", "userId") DO NOTHING
    `;

    await createTaskNotificationPair({
      organizationId: task.organizationId,
      taskId: task.id,
      userId: participant.id,
      subject: "Neue Aufgabenbeteiligung",
      body: `${actor.firstName} ${actor.lastName} hat dich zur Aufgabe "${task.title}" hinzugef\u00fcgt. Bitte pr\u00fcfe die Aufgabe und nimm sie an oder lehne sie begr\u00fcndet ab.`,
    });
  }

  if (owner.id !== actor.id) {
    await createTaskNotificationPair({
      organizationId: task.organizationId,
      taskId: task.id,
      userId: owner.id,
      subject: "Neue Aufgabe zugewiesen",
      body: `${actor.firstName} ${actor.lastName} hat dir die Aufgabe "${task.title}" zugewiesen. Bitte pr\u00fcfe die Aufgabe und nimm sie an oder lehne sie begr\u00fcndet ab.`,
    });
  }

  await notifyCriticalTaskLeadership({
    task,
    users,
    actor,
    reason: "created",
  });

  await appendTaskHistory(task.id, [
    createTaskHistoryItem("Aufgabe angelegt", getUserName(actor)),
    ...participants.map((participant) =>
      createTaskHistoryItem(
        "Aufgabenbeteiligten hinzugef\u00fcgt",
        getUserName(actor),
        `${participant.firstName} ${participant.lastName}`
      )
    ),
  ]);
  await createDoneFeedbackNotification(task, null, users, feedback);
  await createNextRecurringTask(task, null, feedback);

  const formattedTask = await getFormattedTask(task.id, users, nextProjectId ?? "");
  return NextResponse.json(formattedTask ?? { ...formatTask(task, feedback), projectId: nextProjectId ?? "" });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  await ensureTaskProjectColumn();
  await ensureTaskCollaborationColumns();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const taskTitle = cleanTaskTitle(body.title);
  if (!body.restore && !body.addParticipantUserId && !taskTitle) {
    return NextResponse.json({ error: "Bitte einen Aufgabentitel eingeben." }, { status: 400 });
  }

  const requestedOwner = users.find((demoUser) => demoUser.id === body.ownerId && demoUser.isActive);
  const nextStatus = mapStatus(body.status);
  const nextEstimate = parseEstimate(body.estimateMinutes);
  const nextProjectId = normalizeProjectId(body.projectId);
  const planningAllocations = parsePlanningAllocations(body.planningAllocations, nextEstimate);

  if ("error" in planningAllocations) {
    return NextResponse.json({ error: planningAllocations.error }, { status: 400 });
  }

  if (body.restore) {
    const task = await prisma.task.findFirst({
      where: {
        id: body.id,
        organizationId: organization.id,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Aufgabe wurde nicht gefunden." }, { status: 404 });
    }

    if (!canDeleteTasks(actor)) {
      return NextResponse.json(
        { error: "Nur Admins und Geschäftsführung dürfen Aufgaben wiederherstellen." },
        { status: 403 }
      );
    }

    await prisma.$executeRaw`
      UPDATE "Task"
      SET
        status = 'OFFEN'::"TaskStatus",
        "archivedAt" = NULL,
        "archiveDueAt" = NULL,
        "archiveReason" = NULL,
        "completedAt" = NULL
      WHERE id = ${body.id}
    `;

    await recordStatusTransition({
      organizationId: task.organizationId,
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      fromStatus: toUiStatus(task.status),
      toStatus: toUiStatus(TaskStatus.OFFEN),
      actorUserId: actor.id,
      actorName: getUserName(actor),
      note: "Aufgabe wiederhergestellt.",
    });

    return NextResponse.json({ success: true });
  }

  if (body.addParticipantUserId) {
    const existingTask = await prisma.task.findFirst({
      where: {
        id: body.id,
        organizationId: organization.id,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Aufgabe wurde nicht gefunden." }, { status: 404 });
    }

    const existingParticipants =
      (await getTaskParticipants([existingTask.id])).get(existingTask.id) ?? [];
    const canAddParticipant = canEditTask(actor, {
      ownerId: existingTask.ownerId,
      teamId: existingTask.teamId,
      createdById: existingTask.createdById,
      participantUserIds: getTaskParticipantUserIds(existingParticipants),
    });

    if (!canAddParticipant) {
      return NextResponse.json(
        { error: "Du darfst keine Beteiligten zu dieser Aufgabe hinzufügen." },
        { status: 403 }
      );
    }

    const participant = users.find((demoUser) => demoUser.id === body.addParticipantUserId && demoUser.isActive);
    if (!participant) {
      return NextResponse.json({ error: "Mitarbeiter wurde nicht gefunden." }, { status: 404 });
    }

    if (participant.id === existingTask.ownerId) {
      return NextResponse.json(
        { error: "Die zuständige Person ist bereits Teil der Aufgabe." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "TaskParticipant" (id, "organizationId", "taskId", "userId", "acceptanceStatus")
      VALUES (${randomUUID()}, ${existingTask.organizationId}, ${existingTask.id}, ${participant.id}, 'pending')
      ON CONFLICT ("taskId", "userId") DO NOTHING
    `;

    await appendTaskHistory(existingTask.id, [
      createTaskHistoryItem(
        "Aufgabenbeteiligten hinzugefügt",
        getUserName(actor),
        `${participant.firstName} ${participant.lastName}`
      ),
    ]);

    await createTaskNotificationPair({
      organizationId: existingTask.organizationId,
      taskId: existingTask.id,
      userId: participant.id,
      subject: "Neue Aufgabenbeteiligung",
      body: `${actor.firstName} ${actor.lastName} hat dich zur Aufgabe "${existingTask.title}" hinzugef\u00fcgt. Bitte pr\u00fcfe die Aufgabe und nimm sie an oder lehne sie begr\u00fcndet ab.`,
    });

    const projectId = (await getTaskProjectIds([existingTask.id])).get(existingTask.id) ?? "";
    const formattedTask = await getFormattedTask(existingTask.id, users, projectId);
    return NextResponse.json(formattedTask);
  }

  if (requestedOwner && requestedOwner.id !== actor.id && !canAssignTasksToOthers(actor)) {
    return NextResponse.json(
      { error: "Du darfst Aufgaben nicht anderen Personen zuweisen." },
      { status: 403 }
    );
  }

  const owner = requestedOwner ?? actor;
  const existingTask = await prisma.task.findFirst({
    where: {
      id: body.id,
      organizationId: organization.id,
    },
  });

  if (!existingTask) {
    return NextResponse.json({ error: "Aufgabe wurde nicht gefunden." }, { status: 404 });
  }
  const existingParticipants = (await getTaskParticipants([existingTask.id])).get(existingTask.id) ?? [];
  if (
    !canEditTask(actor, {
      ownerId: existingTask.ownerId,
      teamId: existingTask.teamId,
      createdById: existingTask.createdById,
      participantUserIds: getTaskParticipantUserIds(existingParticipants),
    })
  ) {
    return NextResponse.json(
      { error: "Du darfst diese Aufgabe nicht bearbeiten." },
      { status: 403 }
    );
  }
  const existingFeedback = body.id
    ? (await getTaskFeedbackSettings([body.id])).get(body.id)
    : undefined;
  const nextAcceptanceStatus =
    existingTask && owner.id !== existingTask.ownerId && owner.id !== actor.id
      ? "pending"
      : existingFeedback?.acceptanceStatus;

  const task = await prisma.task.update({
    where: {
      id: body.id,
    },
    data: {
      ownerId: owner.id,
      teamId: owner.teamId,
      title: taskTitle,
      description: body.description ?? "",
      status: nextStatus,
      priority: mapPriority(body.priority),
      deadline: parseDeadline(body.deadline),
      customer: body.customer || null,
      customerClass: mapCustomerClass(body.customerClass),
      categoryId: body.tradeId || null,
      estimateMinutes: nextEstimate,
    },
    include: {
      owner: true,
      category: true,
      comments: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          author: true,
        },
      },
      timeEntries: {
        orderBy: {
          startedAt: "desc",
        },
        include: {
          user: true,
        },
      },
      links: true,
    },
  });
  await updateCompletionArchiveTimer(organization.id, task.id, existingTask?.status ?? null, nextStatus);
  await updateTaskPlanningAllocations(task.id, planningAllocations);
  await updateTaskProjectId(task.id, nextProjectId);
  await syncTaskLinks(organization.id, task.id, body.taskLinks);
  await recordStatusTransition({
    organizationId: task.organizationId,
    entityType: "task",
    entityId: task.id,
    entityLabel: task.title,
    fromStatus: existingTask ? toUiStatus(existingTask.status) : null,
    toStatus: toUiStatus(nextStatus),
    actorUserId: actor.id,
    actorName: getUserName(actor),
    note: "Aufgabenstatus geändert.",
  });

  const feedback = await updateTaskFeedbackSettings(
    task.id,
    Boolean(body.autoFeedbackEnabled),
    parseAutoFeedbackRecipient(
      body.autoFeedbackRecipientId,
      Boolean(body.autoFeedbackEnabled),
      users
    ),
    Boolean(body.recurrenceEnabled),
    parseRecurrenceInterval(body.recurrenceInterval, Boolean(body.recurrenceEnabled)),
    existingFeedback?.createdById ?? actor.id,
    nextAcceptanceStatus
  );
  feedback.planningAllocations = planningAllocations;
  const historyItems: TaskHistoryItem[] = [];
  if (existingTask && existingTask.status !== nextStatus) {
    historyItems.push(
      createTaskHistoryItem(
        "Status geändert",
        getUserName(actor),
        `${toUiStatus(existingTask.status)} -> ${toUiStatus(nextStatus)}`
      )
    );
  }
  if (existingTask && existingTask.ownerId !== owner.id) {
    historyItems.push(
      createTaskHistoryItem(
        "Zuständigkeit geändert",
        getUserName(actor),
        `${owner.firstName} ${owner.lastName}`
      )
    );
  }
  await appendTaskHistory(task.id, historyItems);
  if (existingTask && existingTask.ownerId !== owner.id && owner.id !== actor.id) {
    await createTaskNotificationPair({
      organizationId: task.organizationId,
      taskId: task.id,
      userId: owner.id,
      subject: "Aufgabe neu zugewiesen",
      body: `${actor.firstName} ${actor.lastName} hat dir die Aufgabe "${task.title}" zugewiesen. Bitte pr\u00fcfe die Aufgabe und nimm sie an oder lehne sie begr\u00fcndet ab.`,
    });
  }
  if (existingTask?.priority !== TaskPriority.KRITISCH && task.priority === TaskPriority.KRITISCH) {
    await notifyCriticalTaskLeadership({
      task,
      users,
      actor,
      reason: "escalated",
    });
  }
  if (existingTask?.status !== TaskStatus.ERLEDIGT && task.status === TaskStatus.ERLEDIGT) {
    await notifyTaskCompletedForCollaborators(task, feedback, users, actor);
  }
  await createDoneFeedbackNotification(task, existingTask?.status ?? null, users, feedback);
  await createNextRecurringTask(task, existingTask?.status ?? null, feedback);

  const formattedTask = await getFormattedTask(task.id, users, nextProjectId ?? "");
  return NextResponse.json(formattedTask ?? { ...formatTask(task, feedback), projectId: nextProjectId ?? "" });
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!body.id) {
    return NextResponse.json(
      { error: "Keine Aufgaben-ID \u00fcbergeben" },
      { status: 400 }
    );
  }

  if (!canDeleteTasks(actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Gesch\u00e4ftsf\u00fchrung d\u00fcrfen Aufgaben l\u00f6schen." },
      { status: 403 }
    );
  }

  const task = await prisma.task.findFirst({
    where: {
      id: body.id,
      organizationId: organization.id,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Aufgabe wurde nicht gefunden." }, { status: 404 });
  }

  if (body.permanent) {
    if (task.status !== TaskStatus.ARCHIVIERT) {
      return NextResponse.json(
        { error: "Aufgaben k\u00f6nnen endg\u00fcltig nur aus dem Archiv gel\u00f6scht werden." },
        { status: 400 }
      );
    }

    await prisma.task.delete({
      where: {
        id: body.id,
      },
    });

    return NextResponse.json({ success: true });
  }

  await prisma.$executeRaw`
    UPDATE "Task"
    SET
      status = 'ARCHIVIERT'::"TaskStatus",
      "archivedAt" = CURRENT_TIMESTAMP,
      "archiveReason" = 'Manuell archiviert'
    WHERE id = ${body.id}
  `;

  await recordStatusTransition({
    organizationId: task.organizationId,
    entityType: "task",
    entityId: task.id,
    entityLabel: task.title,
    fromStatus: toUiStatus(task.status),
    toStatus: toUiStatus(TaskStatus.ARCHIVIERT),
    actorUserId: actor.id,
    actorName: getUserName(actor),
    note: "Aufgabe manuell archiviert.",
  });

  return NextResponse.json({ success: true });
}
