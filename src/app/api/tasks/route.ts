import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import {
  CustomerClassification,
  Prisma,
  Role,
  TaskPriority,
  TaskStatus,
  type Task,
  type TaskComment,
  type TimeEntry,
  type User,
} from "@prisma/client";

function canAssignOther(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER || role === Role.FUEHRUNGSKRAFT;
}

function canDeleteTask(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
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

type TaskWithRelations = Task & {
  owner: User;
  category: { id: string; name: string } | null;
  comments: Array<TaskComment & { author: User }>;
  timeEntries: Array<TimeEntry & { user: User }>;
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

function formatTask(task: TaskWithRelations, feedback?: TaskFeedbackSettings) {
  const totalTrackedMinutes = task.timeEntries.reduce(
    (total, entry) => total + entry.durationMinutes,
    0
  );

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
    createdById: feedback?.createdById ?? task.ownerId,
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
    kommentare: task.comments.map((comment) => ({
      id: comment.id,
      text: comment.body,
      erstelltAm: comment.createdAt.toISOString(),
      autor: `${comment.author.firstName} ${comment.author.lastName}`,
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

  await prisma.notification.create({
    data: {
      organizationId: task.organizationId,
      taskId: task.id,
      userId: recipient.id,
      channel: "email",
      subject: "Aufgabe erledigt",
      body: `Die Aufgabe "${task.title}" wurde erledigt. Rückmeldung an: ${recipient.email}`,
      sentAt: null,
    },
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
}

async function updateCompletionArchiveTimer(
  taskId: string,
  previousStatus: TaskStatus | null,
  nextStatus: TaskStatus
) {
  if (previousStatus !== TaskStatus.ERLEDIGT && nextStatus === TaskStatus.ERLEDIGT) {
    await prisma.$executeRaw`
      UPDATE "Task"
      SET
        "completedAt" = CURRENT_TIMESTAMP,
        "archiveDueAt" = CURRENT_TIMESTAMP + INTERVAL '120 hours',
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

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureTaskProjectColumn();
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
    },
  });

  const feedbackByTaskId = await getTaskFeedbackSettings(tasks.map((task) => task.id));
  const projectIdByTaskId = await getTaskProjectIds(tasks.map((task) => task.id));

  return NextResponse.json(
    tasks.map((task) => ({
      ...formatTask(task, feedbackByTaskId.get(task.id)),
      projectId: projectIdByTaskId.get(task.id) ?? "",
    }))
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  await ensureTaskProjectColumn();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const requestedOwner = users.find((demoUser) => demoUser.id === body.ownerId);
  const owner = requestedOwner && (canAssignOther(actor.role) || body.absenceHandoverTask) ? requestedOwner : actor;
  const acceptanceStatus = body.absenceHandoverTask
    ? "pending"
    : owner.id === actor.id
      ? "accepted"
      : "pending";
  const nextStatus = TaskStatus.OFFEN;
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
      title: body.title,
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
    },
  });
  await updateCompletionArchiveTimer(task.id, null, nextStatus);
  await updateTaskPlanningAllocations(task.id, planningAllocations);
  await updateTaskProjectId(task.id, nextProjectId);

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
  await createDoneFeedbackNotification(task, null, users, feedback);
  await createNextRecurringTask(task, null, feedback);

  return NextResponse.json({
    ...formatTask(task, feedback),
    projectId: nextProjectId ?? "",
  });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { user, users } = await getDemoContext();
  await ensureTaskProjectColumn();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const requestedOwner = users.find((demoUser) => demoUser.id === body.ownerId);
  const nextStatus = mapStatus(body.status);
  const nextEstimate = parseEstimate(body.estimateMinutes);
  const nextProjectId = normalizeProjectId(body.projectId);
  const planningAllocations = parsePlanningAllocations(body.planningAllocations, nextEstimate);

  if ("error" in planningAllocations) {
    return NextResponse.json({ error: planningAllocations.error }, { status: 400 });
  }

  if (body.restore) {
    const task = await prisma.task.findUnique({
      where: {
        id: body.id,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Aufgabe wurde nicht gefunden." }, { status: 404 });
    }

    if (!canDeleteTask(actor.role)) {
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

    return NextResponse.json({ success: true });
  }

  if (requestedOwner && requestedOwner.id !== actor.id && !canAssignOther(actor.role)) {
    return NextResponse.json(
      { error: "Du darfst Aufgaben nicht anderen Personen zuweisen." },
      { status: 403 }
    );
  }

  const owner = requestedOwner ?? actor;
  const existingTask = await prisma.task.findUnique({
    where: {
      id: body.id,
    },
  });
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
      title: body.title,
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
    },
  });
  await updateCompletionArchiveTimer(task.id, existingTask?.status ?? null, nextStatus);
  await updateTaskPlanningAllocations(task.id, planningAllocations);
  await updateTaskProjectId(task.id, nextProjectId);

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
  await createDoneFeedbackNotification(task, existingTask?.status ?? null, users, feedback);
  await createNextRecurringTask(task, existingTask?.status ?? null, feedback);

  return NextResponse.json({
    ...formatTask(task, feedback),
    projectId: nextProjectId ?? "",
  });
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!body.id) {
    return NextResponse.json(
      { error: "Keine Aufgaben-ID \u00fcbergeben" },
      { status: 400 }
    );
  }

  if (!canDeleteTask(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Gesch\u00e4ftsf\u00fchrung d\u00fcrfen Aufgaben l\u00f6schen." },
      { status: 403 }
    );
  }

  const task = await prisma.task.findUnique({
    where: {
      id: body.id,
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

  return NextResponse.json({ success: true });
}
