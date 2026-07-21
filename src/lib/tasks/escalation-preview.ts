import type { DeadlineSettings } from "@/lib/company-settings/deadlines";

const ACTIVE_STATUSES = new Set([
  "OFFEN",
  "IN_BEARBEITUNG",
  "WARTET_AUF_RUECKMELDUNG",
  "UEBERFAELLIG",
]);

export type TaskEscalationPreviewTask = {
  id: string;
  title: string;
  status: string;
  ownerId: string;
  deadline: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskEscalationPreviewUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  isActive: boolean;
  leadershipManagerId: string | null;
  leadershipDeputyId: string | null;
};

export type TaskEscalationStage = "none" | "employee" | "leadership" | "management";

export type TaskEscalationPreviewItem = {
  userId: string;
  userName: string;
  stage: TaskEscalationStage;
  activeCount: number;
  overdueCount: number;
  staleCount: number;
  waitingFeedbackCount: number;
  warningSince: string | null;
  leadershipDueAt: string | null;
  managementDueAt: string | null;
  leadershipRecipientId: string | null;
  leadershipRecipientName: string | null;
  leadershipRequired: boolean;
  reasons: string[];
  taskIds: string[];
};

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function addBusinessDays(date: Date, days: number) {
  const result = new Date(date);
  let remaining = Math.max(0, Math.round(days));
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) remaining -= 1;
  }
  return result;
}

function thresholdReachedAt(dates: Date[], threshold: number) {
  if (dates.length < threshold) return null;
  return [...dates].sort((left, right) => left.getTime() - right.getTime())[threshold - 1] ?? null;
}

function earliestDate(dates: Array<Date | null>) {
  const available = dates.filter((date): date is Date => Boolean(date));
  if (available.length === 0) return null;
  return available.reduce((earliest, date) => (date < earliest ? date : earliest));
}

function getUserName(user: TaskEscalationPreviewUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function getLeadershipRecipient(
  user: TaskEscalationPreviewUser,
  users: readonly TaskEscalationPreviewUser[]
) {
  const manager = user.leadershipManagerId
    ? users.find(
        (candidate) =>
          candidate.id === user.leadershipManagerId &&
          candidate.isActive &&
          (candidate.role === "FUEHRUNGSKRAFT" || candidate.role === "GESCHAEFTSFUEHRER")
      )
    : null;
  if (manager && manager.id !== user.id) return manager;

  const deputy = user.leadershipDeputyId
    ? users.find(
        (candidate) =>
          candidate.id === user.leadershipDeputyId && candidate.isActive && candidate.id !== user.id
      )
    : null;
  return deputy ?? null;
}

export function evaluateTaskEscalationPreview(input: {
  tasks: readonly TaskEscalationPreviewTask[];
  users: readonly TaskEscalationPreviewUser[];
  settings: DeadlineSettings;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const items: TaskEscalationPreviewItem[] = [];

  for (const user of input.users.filter((candidate) => candidate.isActive)) {
    const tasks = input.tasks.filter(
      (task) => task.ownerId === user.id && ACTIVE_STATUSES.has(task.status)
    );
    if (tasks.length === 0) continue;

    const overdueTasks = tasks.filter((task) => task.deadline.getTime() < now.getTime());
    const staleTasks = tasks.filter(
      (task) =>
        task.status !== "WARTET_AUF_RUECKMELDUNG" &&
        addBusinessDays(task.updatedAt, input.settings.taskEmployeeStaleWorkdays).getTime() <=
          now.getTime()
    );
    const waitingFeedbackTasks = tasks.filter(
      (task) =>
        task.status === "WARTET_AUF_RUECKMELDUNG" &&
        addBusinessDays(task.updatedAt, input.settings.taskWaitingFeedbackWorkdays).getTime() <=
          now.getTime()
    );

    const activeReachedAt = thresholdReachedAt(
      tasks.map((task) => task.createdAt),
      input.settings.taskEmployeeActiveLimit
    );
    const overdueReachedAt = thresholdReachedAt(
      overdueTasks.map((task) => task.deadline),
      input.settings.taskEmployeeOverdueLimit
    );
    const staleReachedAt = earliestDate(
      staleTasks.map((task) => addBusinessDays(task.updatedAt, input.settings.taskEmployeeStaleWorkdays))
    );
    const feedbackReachedAt = earliestDate(
      waitingFeedbackTasks.map((task) =>
        addBusinessDays(task.updatedAt, input.settings.taskWaitingFeedbackWorkdays)
      )
    );
    const warningSince = earliestDate([
      activeReachedAt,
      overdueReachedAt,
      staleReachedAt,
      feedbackReachedAt,
    ]);
    if (!warningSince) continue;

    const leadershipDueAt = addBusinessDays(
      warningSince,
      input.settings.taskLeadershipEscalationWorkdays
    );
    const managementDueAt = addBusinessDays(
      leadershipDueAt,
      input.settings.taskManagementEscalationWorkdays
    );
    const managementImmediate =
      tasks.length >= input.settings.taskManagementImmediateActiveLimit ||
      overdueTasks.length >= input.settings.taskManagementImmediateOverdueLimit;
    const leadershipImmediate =
      tasks.length >= input.settings.taskLeadershipImmediateActiveLimit ||
      overdueTasks.length >= input.settings.taskLeadershipImmediateOverdueLimit;

    let stage: TaskEscalationStage = "employee";
    if (managementImmediate || managementDueAt.getTime() <= now.getTime()) stage = "management";
    else if (leadershipImmediate || leadershipDueAt.getTime() <= now.getTime()) stage = "leadership";

    const reasons: string[] = [];
    if (activeReachedAt) reasons.push(`${tasks.length} aktive Aufgaben`);
    if (overdueReachedAt) reasons.push(`${overdueTasks.length} überfällige Aufgaben`);
    if (staleTasks.length > 0) reasons.push(`${staleTasks.length} unveränderte Aufgaben`);
    if (waitingFeedbackTasks.length > 0) {
      reasons.push(`${waitingFeedbackTasks.length} Aufgaben warten lange auf Rückmeldung`);
    }

    const leadershipRecipient = getLeadershipRecipient(user, input.users);
    const leadershipRequired = user.role !== "GESCHAEFTSFUEHRER";
    items.push({
      userId: user.id,
      userName: getUserName(user),
      stage,
      activeCount: tasks.length,
      overdueCount: overdueTasks.length,
      staleCount: staleTasks.length,
      waitingFeedbackCount: waitingFeedbackTasks.length,
      warningSince: warningSince.toISOString(),
      leadershipDueAt: leadershipDueAt.toISOString(),
      managementDueAt: managementDueAt.toISOString(),
      leadershipRecipientId: leadershipRecipient?.id ?? null,
      leadershipRecipientName: leadershipRecipient ? getUserName(leadershipRecipient) : null,
      leadershipRequired,
      reasons,
      taskIds: tasks.map((task) => task.id),
    });
  }

  const stageRank: Record<TaskEscalationStage, number> = {
    none: 0,
    employee: 1,
    leadership: 2,
    management: 3,
  };
  items.sort(
    (left, right) =>
      stageRank[right.stage] - stageRank[left.stage] ||
      right.overdueCount - left.overdueCount ||
      left.userName.localeCompare(right.userName, "de")
  );

  return items;
}
