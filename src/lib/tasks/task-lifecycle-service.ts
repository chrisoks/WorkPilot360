import { createHash, randomUUID } from "node:crypto";
import { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type TaskLifecycleDb = Prisma.TransactionClient | typeof prisma;
export type TaskLifecycleAction = "archive" | "restore";

const PREVIOUS_STATUS_MARKER = "Vorheriger Status: ";
const RESTORABLE_STATUSES = new Set<TaskStatus>([
  TaskStatus.OFFEN,
  TaskStatus.IN_BEARBEITUNG,
  TaskStatus.WARTET_AUF_RUECKMELDUNG,
  TaskStatus.ERLEDIGT,
  TaskStatus.ABGELEHNT,
  TaskStatus.UEBERFAELLIG,
]);

export class TaskLifecycleServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "blocked" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "TaskLifecycleServiceError";
  }
}

export type TaskLifecycleEvaluation = {
  action: TaskLifecycleAction;
  reason: string;
  previousStatus: TaskStatus | "";
  task: {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: string;
    deadline: string;
    customer: string;
    projectId: string;
    projectLabel: string;
    ownerId: string;
    ownerName: string;
    updatedAt: string;
  };
  comments: number;
  participants: number;
  links: number;
  timeEntries: number;
  runningTimeEntries: number;
  childTasks: number;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

function normalizeText(value: string | undefined, maxLength: number) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function previousStatusFromArchiveReason(value: string | null | undefined) {
  const markerIndex = value?.lastIndexOf(PREVIOUS_STATUS_MARKER) ?? -1;
  if (markerIndex < 0) return "";
  const candidate = value!.slice(markerIndex + PREVIOUS_STATUS_MARKER.length).split(/[.·\n]/)[0]?.trim() as TaskStatus;
  return RESTORABLE_STATUSES.has(candidate) ? candidate : "";
}

function previousStatusFromTimeline(value: string | null | undefined) {
  const normalized = normalizeText(value || "", 80).toLowerCase();
  const mapping: Record<string, TaskStatus> = {
    offen: TaskStatus.OFFEN,
    "in bearbeitung": TaskStatus.IN_BEARBEITUNG,
    "wartet auf rückmeldung": TaskStatus.WARTET_AUF_RUECKMELDUNG,
    erledigt: TaskStatus.ERLEDIGT,
    abgelehnt: TaskStatus.ABGELEHNT,
    überfällig: TaskStatus.UEBERFAELLIG,
  };
  return mapping[normalized] || "";
}

function taskStatusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    [TaskStatus.OFFEN]: "offen",
    [TaskStatus.IN_BEARBEITUNG]: "in bearbeitung",
    [TaskStatus.WARTET_AUF_RUECKMELDUNG]: "wartet auf rückmeldung",
    [TaskStatus.ERLEDIGT]: "erledigt",
    [TaskStatus.ABGELEHNT]: "abgelehnt",
    [TaskStatus.UEBERFAELLIG]: "überfällig",
    [TaskStatus.ARCHIVIERT]: "archiviert",
  };
  return labels[status];
}

export function getTaskLifecycleConfirmationText(title: string, action: TaskLifecycleAction) {
  return `AUFGABE ${action === "archive" ? "ARCHIVIEREN" : "WIEDERHERSTELLEN"} ${normalizeText(title, 180)}`;
}

export function matchesTaskLifecycleConfirmation(title: string, action: TaskLifecycleAction, confirmationText: string) {
  return confirmationText.trim() === getTaskLifecycleConfirmationText(title, action);
}

export async function evaluateTaskLifecycle(input: {
  organizationId: string;
  taskId: string;
  action: TaskLifecycleAction;
  reason?: string;
  db?: TaskLifecycleDb;
}): Promise<TaskLifecycleEvaluation> {
  const db = input.db ?? prisma;
  const reason = normalizeText(input.reason, 500);
  const task = await db.task.findFirst({
    where: { id: input.taskId, organizationId: input.organizationId },
    select: {
      id: true, title: true, description: true, status: true, priority: true, deadline: true,
      customer: true, projectId: true, ownerId: true, updatedAt: true, archiveReason: true,
      completedAt: true,
      owner: { select: { firstName: true, lastName: true } },
    },
  });
  if (!task) throw new TaskLifecycleServiceError("not_found", "Die Aufgabe wurde in der aktuellen Organisation nicht gefunden.");

  const latestArchiveTimeline = input.action === "restore"
    ? await db.statusTimelineEntry.findFirst({
        where: { organizationId: input.organizationId, entityType: "task", entityId: task.id, toStatus: "archiviert" },
        orderBy: { startedAt: "desc" },
        select: { id: true, fromStatus: true, startedAt: true },
      })
    : null;
  const previousStatus = input.action === "archive"
    ? task.status
    : previousStatusFromArchiveReason(task.archiveReason) || previousStatusFromTimeline(latestArchiveTimeline?.fromStatus);
  const [comments, participants, links, timeEntries, runningTimeEntries, childTasks, project] = await Promise.all([
    db.taskComment.count({ where: { organizationId: input.organizationId, taskId: task.id } }),
    db.taskParticipant.count({ where: { organizationId: input.organizationId, taskId: task.id } }),
    db.taskLink.count({ where: { organizationId: input.organizationId, taskId: task.id } }),
    db.timeEntry.count({ where: { organizationId: input.organizationId, taskId: task.id } }),
    db.timeEntry.count({ where: { organizationId: input.organizationId, taskId: task.id, stoppedAt: null } }),
    db.task.count({ where: { organizationId: input.organizationId, recurrenceParentTaskId: task.id, status: { not: TaskStatus.ARCHIVIERT } } }),
    task.projectId
      ? db.workPilotProject.findFirst({ where: { id: task.projectId, organizationId: input.organizationId }, select: { projectNumber: true, title: true } })
      : null,
  ]);

  const blockingIssues: string[] = [];
  if (reason.length < 3) blockingIssues.push("Bitte dokumentiere einen nachvollziehbaren Grund mit mindestens 3 Zeichen.");
  if (input.action === "archive" && task.status === TaskStatus.ARCHIVIERT) blockingIssues.push("Die Aufgabe ist bereits archiviert.");
  if (input.action === "restore" && task.status !== TaskStatus.ARCHIVIERT) blockingIssues.push("Die Aufgabe ist nicht archiviert und kann deshalb nicht wiederhergestellt werden.");
  if (input.action === "restore" && !previousStatus) blockingIssues.push("Der Status vor der Archivierung ist nicht zuverlässig dokumentiert. Die Aufgabe muss manuell geprüft werden.");
  if (runningTimeEntries) blockingIssues.push(`${runningTimeEntries} laufende Zeiterfassung(en) sind mit der Aufgabe verbunden. Beende sie vor der Archivierung.`);

  const warnings = [
    "Die Aufgabe wird archiviert beziehungsweise wieder sichtbar gemacht, aber niemals physisch gelöscht.",
    `${comments} Kommentar(e), ${participants} Beteiligte, ${links} Link(s) und ${timeEntries} Zeiteintrag/-einträge bleiben vollständig erhalten.`,
    childTasks ? `${childTasks} aktive Folgeaufgabe(n) bleiben eigenständig und unverändert bestehen.` : "Es gibt keine aktive Folgeaufgabe.",
    "Projekt, Verantwortlichkeit, Fälligkeit, Benachrichtigungen und bestehende Nachweise werden nicht umgedeutet.",
  ];
  const checks: TaskLifecycleEvaluation["checks"] = [
    {
      key: "task-state", label: "Aufgabenstatus", status: blockingIssues.length ? "blocked" : "ok",
      detail: blockingIssues.length ? blockingIssues.join(" · ") : input.action === "archive"
        ? `Die Aufgabe kann kontrolliert aus dem Status „${task.status}“ archiviert werden.`
        : `Die Aufgabe kann kontrolliert in den Status „${previousStatus}“ wiederhergestellt werden.`,
    },
    { key: "documentation", label: "Begründung", status: reason.length >= 3 ? "ok" : "blocked", detail: reason || "Grund fehlt." },
    { key: "running-time", label: "Laufende Zeiterfassung", status: runningTimeEntries ? "blocked" : "ok", detail: runningTimeEntries ? `${runningTimeEntries} laufende Erfassung(en).` : "Keine laufende Erfassung." },
    { key: "preserved-evidence", label: "Erhaltene Nachweise", status: "warning", detail: warnings.join(" ") },
  ];
  const fingerprint = stableHash({
    action: input.action, reason, previousStatus,
    task: { id: task.id, title: task.title, status: task.status, updatedAt: task.updatedAt.toISOString(), archiveReason: task.archiveReason, completedAt: task.completedAt?.toISOString() || "" },
    latestArchiveTimeline: latestArchiveTimeline ? { id: latestArchiveTimeline.id, fromStatus: latestArchiveTimeline.fromStatus, startedAt: latestArchiveTimeline.startedAt.toISOString() } : null,
    comments, participants, links, timeEntries, runningTimeEntries, childTasks,
  });
  return {
    action: input.action, reason, previousStatus,
    task: {
      id: task.id, title: task.title, description: task.description, status: task.status, priority: task.priority,
      deadline: task.deadline.toISOString(), customer: task.customer || "", projectId: task.projectId || "",
      projectLabel: project ? [project.projectNumber, project.title].filter(Boolean).join(" · ") : "Keine Projektzuordnung",
      ownerId: task.ownerId, ownerName: [task.owner.firstName, task.owner.lastName].filter(Boolean).join(" "), updatedAt: task.updatedAt.toISOString(),
    },
    comments, participants, links, timeEntries, runningTimeEntries, childTasks, checks, warnings,
    blockingIssues: [...new Set(blockingIssues)], fingerprint,
  };
}

export async function executeTaskLifecycle(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  taskId: string;
  action: TaskLifecycleAction;
  reason: string;
  actorId: string;
  actorName: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:task-lifecycle:${input.organizationId}:${input.taskId}`}))`;
  const evaluated = await evaluateTaskLifecycle({ ...input, db: input.tx });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new TaskLifecycleServiceError("stale_context", "Aufgabe oder Verknüpfungen haben sich geändert. Bitte öffne eine neue Vorschau.");
  }
  if (evaluated.blockingIssues.length) throw new TaskLifecycleServiceError("blocked", evaluated.blockingIssues.join(" · "));

  const changedAt = new Date();
  const targetStatus = input.action === "archive" ? TaskStatus.ARCHIVIERT : evaluated.previousStatus as TaskStatus;
  const changed = await input.tx.task.updateMany({
    where: { id: input.taskId, organizationId: input.organizationId, status: input.action === "archive" ? evaluated.task.status : TaskStatus.ARCHIVIERT },
    data: input.action === "archive"
      ? { status: targetStatus, archivedAt: changedAt, archiveDueAt: null, archiveReason: `${evaluated.reason} · ${PREVIOUS_STATUS_MARKER}${evaluated.task.status}` }
      : { status: targetStatus, archivedAt: null, archiveDueAt: null, archiveReason: null, ...(targetStatus !== TaskStatus.ERLEDIGT ? { completedAt: null } : {}) },
  });
  if (changed.count !== 1) throw new TaskLifecycleServiceError("conflict", "Die Aufgabe wurde zwischenzeitlich verändert.");

  const verb = input.action === "archive" ? "archiviert" : "wiederhergestellt";
  const note = `${input.source === "jarvis" ? "Durch JARVIS " : ""}kontrolliert ${verb}. Grund: ${evaluated.reason}. ${input.action === "archive" ? `${PREVIOUS_STATUS_MARKER}${evaluated.task.status}.` : `Wiederhergestellter Status: ${targetStatus}.`}`;
  const historyItem = { id: randomUUID(), event: `Aufgabe ${verb}`, actorName: input.actorName, note, createdAt: changedAt.toISOString() };
  await input.tx.$executeRaw`
    UPDATE "Task"
    SET "history" = COALESCE("history", '[]'::jsonb) || ${JSON.stringify([historyItem])}::jsonb
    WHERE id = ${input.taskId} AND "organizationId" = ${input.organizationId}
  `;
  await input.tx.$executeRaw`
    UPDATE "StatusTimelineEntry"
    SET
      "endedAt" = ${changedAt},
      "durationMinutes" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${changedAt} - "startedAt")) / 60)::INTEGER)
    WHERE "organizationId" = ${input.organizationId}
      AND "entityType" = 'task'
      AND "entityId" = ${input.taskId}
      AND "endedAt" IS NULL
  `;
  await input.tx.statusTimelineEntry.create({ data: {
    id: randomUUID(), organizationId: input.organizationId, entityType: "task", entityId: input.taskId,
    entityLabel: evaluated.task.title, fromStatus: taskStatusLabel(evaluated.task.status),
    toStatus: taskStatusLabel(targetStatus), startedAt: changedAt,
    actorUserId: input.actorId, actorName: input.actorName, note,
  } });
  await input.tx.statusEscalationEvent.updateMany({
    where: { organizationId: input.organizationId, entityType: "task", entityId: input.taskId, resolvedAt: null, status: { not: taskStatusLabel(targetStatus) } },
    data: { resolvedAt: changedAt },
  });
  return input.tx.task.findFirstOrThrow({ where: { id: input.taskId, organizationId: input.organizationId } });
}
