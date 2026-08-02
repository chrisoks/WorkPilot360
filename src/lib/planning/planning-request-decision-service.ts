import { createHash, randomUUID } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import { canManagePlanningEntries } from "@/lib/permissions";
import { sendPushToUserSafely } from "@/lib/push/web-push";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export type PlanningRequestDecision = "approve" | "reject";
export type PlanningRequestDecisionActor = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId: string;
};

type EntryRow = {
  id: string;
  organizationId: string;
  board: string;
  groupName: string;
  userId: string | null;
  employeeName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  title: string;
  description: string | null;
  projectId: string | null;
  projectLabel: string | null;
  approvalStatus: string;
  requestedByUserId: string | null;
  requestedByName: string | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  recurrenceId: string | null;
  recurrenceRule: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AssigneeRow = { id: string; firstName: string; lastName: string; email: string; isActive: boolean };
type ProjectRow = { id: string; projectNumber: string; title: string; status: string; updatedAt: Date };

export type PlanningRequestDecisionEvaluation = {
  decision: PlanningRequestDecision;
  reason: string;
  entry: {
    id: string;
    title: string;
    projectId: string;
    projectLabel: string;
    employee: string;
    requester: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    recurrenceRule: string;
  };
  warnings: Array<{ code: string; message: string }>;
  fingerprint: string;
};

export type PlanningRequestDecisionResult = {
  entryId: string;
  decision: PlanningRequestDecision;
  approvalStatus: "confirmed" | "rejected";
  deleted: boolean;
  replayed: boolean;
};

export class PlanningRequestDecisionError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400, readonly details?: unknown) {
    super(message);
    this.name = "PlanningRequestDecisionError";
  }
}

export function isPlanningRequestDecisionError(error: unknown): error is PlanningRequestDecisionError {
  return error instanceof PlanningRequestDecisionError;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function actorName(actor: PlanningRequestDecisionActor) {
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function deterministicId(prefix: string, ...parts: string[]) {
  return `${prefix}-${sha256(parts).slice(0, 32)}`;
}

export function getPlanningRequestDecisionConfirmationText(
  entryId: string,
  decision: PlanningRequestDecision,
) {
  return decision === "approve"
    ? `TERMINWUNSCH FREIGEBEN ${entryId.trim()}`
    : `TERMINWUNSCH ABLEHNEN ${entryId.trim()}`;
}

export function matchesPlanningRequestDecisionConfirmation(
  entryId: string,
  decision: PlanningRequestDecision,
  confirmationText: string,
) {
  return confirmationText.trim() === getPlanningRequestDecisionConfirmationText(entryId, decision);
}

async function loadEntry(db: DatabaseClient, organizationId: string, entryId: string, lock = false) {
  const rows = lock
    ? await db.$queryRaw<EntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${organizationId} AND "id"=${entryId} LIMIT 1 FOR UPDATE`
    : await db.$queryRaw<EntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${organizationId} AND "id"=${entryId} LIMIT 1`;
  if (!rows[0]) {
    throw new PlanningRequestDecisionError("not_found", "Der Terminwunsch wurde in dieser Organisation nicht gefunden.", 404);
  }
  return rows[0];
}

async function evaluateInternal(input: {
  db: DatabaseClient;
  organizationId: string;
  actor: PlanningRequestDecisionActor;
  entryId: string;
  decision: PlanningRequestDecision;
  reason?: string;
  lock?: boolean;
}) {
  if (!canManagePlanningEntries(input.actor)) {
    throw new PlanningRequestDecisionError("forbidden", "Nur die Planungsverantwortung darf Terminwünsche freigeben oder ablehnen.", 403);
  }
  const decision = input.decision;
  if (decision !== "approve" && decision !== "reject") {
    throw new PlanningRequestDecisionError("invalid_decision", "Bitte Terminwunsch freigeben oder ablehnen.", 400);
  }
  const reason = clean(input.reason);
  if (decision === "reject" && (reason.length < 3 || reason.length > 500)) {
    throw new PlanningRequestDecisionError("reason_required", "Eine Ablehnung benötigt einen nachvollziehbaren Grund mit 3 bis 500 Zeichen.", 400);
  }

  const entry = await loadEntry(input.db, input.organizationId, clean(input.entryId), input.lock);
  if (entry.deletedAt) {
    throw new PlanningRequestDecisionError("deleted", "Der Terminwunsch ist bereits gelöscht oder abgelehnt.", 409);
  }
  if (entry.approvalStatus !== "requested") {
    throw new PlanningRequestDecisionError("not_requested", "Dieser Planungseintrag ist kein offener Terminwunsch mehr.", 409);
  }
  if (!entry.userId) {
    throw new PlanningRequestDecisionError("assignee_missing", "Der Terminwunsch hat keine eindeutig zugeordnete Person.", 409);
  }

  const assignees = await input.db.$queryRaw<AssigneeRow[]>`SELECT "id","firstName","lastName","email","isActive" FROM "User" WHERE "organizationId"=${input.organizationId} AND "id"=${entry.userId} LIMIT 1`;
  const assignee = assignees[0];
  if (!assignee?.isActive) {
    throw new PlanningRequestDecisionError("assignee_inactive", "Die vorgesehene Person ist nicht mehr aktiv.", 409);
  }

  const projects = entry.projectId
    ? await input.db.$queryRaw<ProjectRow[]>`SELECT "id","projectNumber","title","status","updatedAt" FROM "WorkPilotProject" WHERE "organizationId"=${input.organizationId} AND "id"=${entry.projectId} LIMIT 1`
    : [];
  const project = projects[0] ?? null;
  if (entry.projectId && !project) {
    throw new PlanningRequestDecisionError("project_missing", "Das verknüpfte Projekt wurde nicht gefunden.", 409);
  }
  if (project?.status.toLocaleLowerCase("de-DE").includes("archiviert")) {
    throw new PlanningRequestDecisionError("project_archived", "Ein Terminwunsch in einem archivierten Projekt darf nicht entschieden werden.", 409);
  }

  const absences = decision === "approve"
    ? await input.db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Absence" WHERE "organizationId"=${input.organizationId} AND "userId"=${entry.userId} AND "date"=${entry.date}::date AND "deletedAt" IS NULL AND "status"='genehmigt' AND "type" IN ('urlaub','krank','ueberstundenabbau') AND (COALESCE("dayPart",'full')='full' OR ("dayPart"='first-half' AND ${entry.startTime}<'12:00') OR ("dayPart"='second-half' AND ${entry.endTime}>'12:00')) LIMIT 1`
    : [];
  if (absences.length) {
    throw new PlanningRequestDecisionError("absence_conflict", `${entry.employeeName || "Die vorgesehene Person"} ist im Terminzeitraum genehmigt abwesend.`, 409);
  }

  const overlaps = decision === "approve"
    ? await input.db.$queryRaw<Array<{ id: string; title: string; startTime: string; endTime: string }>>`SELECT "id","title","startTime","endTime" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"<>${entry.id} AND "userId"=${entry.userId} AND "date"=${entry.date} AND "deletedAt" IS NULL AND COALESCE("approvalStatus",'confirmed')='confirmed' AND "startTime"<${entry.endTime} AND "endTime">${entry.startTime} ORDER BY "startTime"`
    : [];
  if (overlaps.length) {
    throw new PlanningRequestDecisionError("overlap_conflict", `Der Terminwunsch überschneidet sich mit ${overlaps.map((item) => `„${item.title}“ ${item.startTime}-${item.endTime}`).join(", ")}.`, 409, overlaps);
  }

  const requester = entry.requestedByName || "Nicht angegeben";
  const evidence = { entry, decision, reason, assignee, project, absenceIds: absences.map((item) => item.id), overlaps };
  return {
    decision,
    reason,
    entry: {
      id: entry.id,
      title: entry.title,
      projectId: entry.projectId ?? "",
      projectLabel: entry.projectLabel ?? "",
      employee: entry.employeeName || `${assignee.firstName} ${assignee.lastName}`.trim() || assignee.email,
      requester,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      durationMinutes: entry.durationMinutes,
      recurrenceRule: entry.recurrenceRule ?? "",
    },
    warnings: [
      ...(entry.recurrenceId || entry.recurrenceRule
        ? [{ code: "single_occurrence", message: "Die Entscheidung gilt nur für diesen Terminwunsch; weitere Serieneinträge bleiben unverändert." }]
        : []),
    ],
    fingerprint: sha256(evidence),
  } satisfies PlanningRequestDecisionEvaluation;
}

export async function evaluatePlanningRequestDecision(
  input: Omit<Parameters<typeof evaluateInternal>[0], "db" | "lock"> & { db?: DatabaseClient },
) {
  return evaluateInternal({ ...input, db: input.db ?? prisma });
}

function notificationId(organizationId: string, requestId: string, userId: string) {
  return deterministicId("planning-request-decision-notification", organizationId, requestId, userId);
}

export async function executePlanningRequestDecisionInTransaction(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  actor: PlanningRequestDecisionActor;
  entryId: string;
  decision: PlanningRequestDecision;
  reason?: string;
  expectedFingerprint: string;
  requestId: string;
}) {
  if (!clean(input.requestId) || clean(input.requestId).length > 120 || !/^[a-f0-9]{64}$/i.test(clean(input.expectedFingerprint))) {
    throw new PlanningRequestDecisionError("invalid_execution", "Prüfwert oder Ausführungs-ID fehlen. Bitte den Terminwunsch neu prüfen.", 400);
  }
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}),hashtext(${`planning-request-decision:${input.entryId}`}))`;
  const historyId = deterministicId("planning-request-decision-history", input.organizationId, input.requestId);
  const prior = await input.tx.$queryRaw<Array<{ id: string; planningEntryId: string; toStatus: string | null }>>`SELECT "id","planningEntryId","toStatus" FROM "PlanningEntryHistory" WHERE "organizationId"=${input.organizationId} AND "id"=${historyId} LIMIT 1`;
  if (prior.length) {
    const priorDecision = prior[0].toStatus === "confirmed" ? "approve" : "reject";
    if (prior[0].planningEntryId !== input.entryId || priorDecision !== input.decision) {
      throw new PlanningRequestDecisionError("replay_conflict", "Diese Ausführungs-ID wurde bereits für eine andere Terminwunschentscheidung verwendet.", 409);
    }
    return {
      entryId: input.entryId,
      decision: priorDecision,
      approvalStatus: prior[0].toStatus === "confirmed" ? "confirmed" : "rejected",
      deleted: prior[0].toStatus !== "confirmed",
      replayed: true,
    } satisfies PlanningRequestDecisionResult;
  }

  const evaluation = await evaluateInternal({ ...input, db: input.tx, lock: true });
  if (evaluation.fingerprint !== input.expectedFingerprint) {
    throw new PlanningRequestDecisionError("stale_context", "Der Terminwunsch oder seine Planungsgrundlage wurde zwischenzeitlich verändert. Bitte neu prüfen.", 409);
  }
  const now = new Date();
  const savedRows = evaluation.decision === "approve"
    ? await input.tx.$queryRaw<EntryRow[]>`UPDATE "PlanningEntry" SET "approvalStatus"='confirmed',"approvedByUserId"=${input.actor.id},"approvedAt"=${now},"updatedAt"=${now} WHERE "organizationId"=${input.organizationId} AND "id"=${input.entryId} AND "approvalStatus"='requested' AND "deletedAt" IS NULL RETURNING *`
    : await input.tx.$queryRaw<EntryRow[]>`UPDATE "PlanningEntry" SET "deletedAt"=${now},"updatedAt"=${now} WHERE "organizationId"=${input.organizationId} AND "id"=${input.entryId} AND "approvalStatus"='requested' AND "deletedAt" IS NULL RETURNING *`;
  const saved = savedRows[0];
  if (!saved) {
    throw new PlanningRequestDecisionError("stale_context", "Der Terminwunsch wurde parallel verändert. Bitte neu prüfen.", 409);
  }

  const approved = evaluation.decision === "approve";
  const note = approved ? "Terminwunsch freigegeben" : `Terminwunsch abgelehnt. Grund: ${evaluation.reason}`;
  await input.tx.$executeRaw`INSERT INTO "PlanningEntryHistory" ("id","organizationId","planningEntryId","projectId","eventType","actorUserId","actorName","fromStatus","toStatus","note","createdAt") VALUES (${historyId},${input.organizationId},${saved.id},${saved.projectId},${approved ? "approved" : "rejected"},${input.actor.id},${actorName(input.actor)},'requested',${approved ? "confirmed" : "rejected"},${note},${now})`;
  if (saved.projectId) {
    await input.tx.projectLogbookEntry.upsert({
      where: {
        organizationId_source_callReference_projectId: {
          organizationId: input.organizationId,
          source: "planning-request-decision",
          callReference: input.requestId,
          projectId: saved.projectId,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        organizationId: input.organizationId,
        projectId: saved.projectId,
        title: approved ? "Terminwunsch freigegeben" : "Terminwunsch abgelehnt",
        body: `${saved.title}: ${note}`,
        author: actorName(input.actor),
        authorUserId: input.actor.id,
        source: "planning-request-decision",
        callReference: input.requestId,
      },
    });
  }

  const subject = approved ? "Terminwunsch bestätigt" : "Terminwunsch abgelehnt";
  const body = approved
    ? `Der Terminwunsch „${saved.title}“ am ${saved.date} von ${saved.startTime} bis ${saved.endTime} wurde bestätigt.`
    : `Der Terminwunsch „${saved.title}“ am ${saved.date} von ${saved.startTime} bis ${saved.endTime} wurde abgelehnt. Grund: ${evaluation.reason}`;
  for (const userId of new Set([clean(saved.userId), clean(saved.requestedByUserId)].filter(Boolean))) {
    if (userId === input.actor.id) continue;
    const id = notificationId(input.organizationId, input.requestId, userId);
    await input.tx.notification.upsert({
      where: { id },
      update: {},
      create: {
        id,
        organizationId: input.organizationId,
        userId,
        taskId: null,
        channel: "app",
        subject,
        body,
        linkTarget: "planning-entry",
        linkTargetId: saved.id,
        linkLabel: approved ? "Termin öffnen" : "Planung öffnen",
        sentAt: null,
      },
    });
  }

  return {
    entryId: saved.id,
    decision: evaluation.decision,
    approvalStatus: approved ? "confirmed" : "rejected",
    deleted: !approved,
    replayed: false,
  } satisfies PlanningRequestDecisionResult;
}

export async function executePlanningRequestDecision(
  input: Omit<Parameters<typeof executePlanningRequestDecisionInTransaction>[0], "tx"> & { db?: typeof prisma },
) {
  const db = input.db ?? prisma;
  return db.$transaction(
    (tx) => executePlanningRequestDecisionInTransaction({ ...input, tx }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deliverPlanningRequestDecisionNotifications(input: {
  organizationId: string;
  requestId: string;
  entryId: string;
  actorUserId: string;
}) {
  const entries = await prisma.$queryRaw<Array<{ userId: string | null; requestedByUserId: string | null }>>`SELECT "userId","requestedByUserId" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"=${input.entryId} LIMIT 1`;
  const entry = entries[0];
  if (!entry) return;
  for (const userId of new Set([clean(entry.userId), clean(entry.requestedByUserId)].filter(Boolean))) {
    if (userId === input.actorUserId) continue;
    const id = notificationId(input.organizationId, input.requestId, userId);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) continue;
    await sendNotificationMailSafely({ notificationId: id, userId, subject: notification.subject, body: notification.body });
    await sendPushToUserSafely({
      organizationId: input.organizationId,
      userId,
      payload: {
        title: notification.subject,
        body: notification.body,
        notificationId: id,
        linkTarget: "planning-entry",
        linkTargetId: input.entryId,
        url: `/?target=planning-entry&targetId=${encodeURIComponent(input.entryId)}`,
      },
    });
  }
}
