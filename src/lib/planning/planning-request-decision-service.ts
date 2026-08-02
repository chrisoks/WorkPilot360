import { createHash, randomUUID } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import { canManagePlanningEntries } from "@/lib/permissions";
import { sendPushToUserSafely } from "@/lib/push/web-push";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export type PlanningRequestDecision = "approve" | "reject" | "cancel" | "withdraw" | "approve_series" | "reject_series" | "cancel_series" | "withdraw_series";
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
    approvalStatus: string;
  };
  warnings: Array<{ code: string; message: string }>;
  series: { recurrenceId: string; count: number; fromDate: string; toDate: string; entryIds: string[] } | null;
  fingerprint: string;
};

export type PlanningRequestDecisionResult = {
  entryId: string;
  decision: PlanningRequestDecision;
  approvalStatus: "confirmed" | "rejected" | "cancelled" | "withdrawn";
  deleted: boolean;
  replayed: boolean;
  affectedEntryIds?: string[];
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
    : decision === "reject"
      ? `TERMINWUNSCH ABLEHNEN ${entryId.trim()}`
      : decision === "cancel"
        ? `TERMIN ABSAGEN ${entryId.trim()}`
      : decision === "withdraw"
        ? `TERMINWUNSCH ZURÜCKZIEHEN ${entryId.trim()}`
        : decision === "approve_series"
          ? `TERMINWUNSCH-SERIE FREIGEBEN ${entryId.trim()}`
          : decision === "reject_series"
            ? `TERMINWUNSCH-SERIE ABLEHNEN ${entryId.trim()}`
        : decision === "cancel_series"
          ? `TERMIN-SERIE ABSAGEN ${entryId.trim()}`
          : `TERMINWUNSCH-SERIE ZURÜCKZIEHEN ${entryId.trim()}`;
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
  const decision = input.decision;
  if (!["approve", "reject", "cancel", "withdraw", "approve_series", "reject_series", "cancel_series", "withdraw_series"].includes(decision)) {
    throw new PlanningRequestDecisionError("invalid_decision", "Bitte Terminwunsch freigeben, ablehnen, zurückziehen oder einen bestätigten Termin absagen.", 400);
  }
  const reason = clean(input.reason);
  if (decision !== "approve" && decision !== "approve_series" && (reason.length < 3 || reason.length > 500)) {
    throw new PlanningRequestDecisionError("reason_required", `${decision === "cancel" ? "Eine Terminabsage" : decision === "cancel_series" ? "Die Absage einer Terminserie" : decision === "withdraw" ? "Das Zurückziehen eines Terminwunsches" : decision === "withdraw_series" ? "Das Zurückziehen einer Terminwunschserie" : "Eine Ablehnung"} benötigt einen nachvollziehbaren Grund mit 3 bis 500 Zeichen.`, 400);
  }

  const entry = await loadEntry(input.db, input.organizationId, clean(input.entryId), input.lock);
  const actorCanManage = canManagePlanningEntries(input.actor);
  const actorOwnsRequest = entry.userId === input.actor.id || entry.requestedByUserId === input.actor.id;
  const withdrawal = decision === "withdraw" || decision === "withdraw_series";
  if (withdrawal ? !actorCanManage && !actorOwnsRequest : !actorCanManage) {
    throw new PlanningRequestDecisionError("forbidden", withdrawal ? "Nur die eigene anfragende Person oder die Planungsverantwortung darf diesen Terminwunsch zurückziehen." : "Nur die Planungsverantwortung darf diesen Planungseintrag entscheiden.", 403);
  }
  if (entry.deletedAt) {
    throw new PlanningRequestDecisionError("deleted", "Der Terminwunsch ist bereits gelöscht oder abgelehnt.", 409);
  }
  const cancellation = decision === "cancel" || decision === "cancel_series";
  if (cancellation ? entry.approvalStatus !== "confirmed" : entry.approvalStatus !== "requested") {
    throw new PlanningRequestDecisionError(
      cancellation ? "not_confirmed" : "not_requested",
      cancellation ? "Nur ein bestätigter Planungstermin kann abgesagt werden." : "Dieser Planungseintrag ist kein offener Terminwunsch mehr.",
      409,
    );
  }
  if (!entry.userId) {
    throw new PlanningRequestDecisionError("assignee_missing", "Der Terminwunsch hat keine eindeutig zugeordnete Person.", 409);
  }

  const seriesDecision = decision.endsWith("_series");
  if (seriesDecision && !entry.recurrenceId) {
    throw new PlanningRequestDecisionError("series_missing", "Dieser Planungseintrag gehört keiner eindeutig gespeicherten Terminserie an.", 409);
  }
  const seriesEntries = seriesDecision
    ? await input.db.$queryRaw<EntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "recurrenceId"=${entry.recurrenceId} AND "deletedAt" IS NULL ORDER BY "date","startTime","id" ${input.lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`
    : [entry];
  if (seriesDecision && (!seriesEntries.length || seriesEntries.some((item) => item.approvalStatus !== entry.approvalStatus))) {
    throw new PlanningRequestDecisionError("mixed_series_status", "Die Serie enthält unterschiedliche Freigabestatus und darf nicht pauschal verändert werden.", 409);
  }
  if (seriesDecision && seriesEntries.some((item) => !item.userId)) {
    throw new PlanningRequestDecisionError("assignee_missing", "Mindestens ein Serieneintrag hat keine eindeutig zugeordnete Person.", 409);
  }
  if (decision === "withdraw_series" && !actorCanManage && seriesEntries.some((item) => item.userId !== input.actor.id && item.requestedByUserId !== input.actor.id)) {
    throw new PlanningRequestDecisionError("forbidden", "Die Serie enthält mindestens einen Terminwunsch einer anderen Person.", 403);
  }

  const assignees = await input.db.$queryRaw<AssigneeRow[]>`SELECT "id","firstName","lastName","email","isActive" FROM "User" WHERE "organizationId"=${input.organizationId} AND "id"=${entry.userId} LIMIT 1`;
  const assignee = assignees[0];
  if (decision === "approve" && !assignee?.isActive) {
    throw new PlanningRequestDecisionError("assignee_inactive", "Die vorgesehene Person ist nicht mehr aktiv.", 409);
  }
  if (decision === "approve_series") {
    const assigneeIds = [...new Set(seriesEntries.map((item) => item.userId!).filter(Boolean))];
    const activeAssignees = await input.db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(assigneeIds)}) AND "isActive"=true`;
    if (activeAssignees.length !== assigneeIds.length) {
      throw new PlanningRequestDecisionError("assignee_inactive", "Mindestens eine für die Serie vorgesehene Person ist nicht mehr aktiv.", 409);
    }
  }

  const projects = entry.projectId
    ? await input.db.$queryRaw<ProjectRow[]>`SELECT "id","projectNumber","title","status","updatedAt" FROM "WorkPilotProject" WHERE "organizationId"=${input.organizationId} AND "id"=${entry.projectId} LIMIT 1`
    : [];
  const project = projects[0] ?? null;
  if (!cancellation && !withdrawal && entry.projectId && !project) {
    throw new PlanningRequestDecisionError("project_missing", "Das verknüpfte Projekt wurde nicht gefunden.", 409);
  }
  if (!cancellation && !withdrawal && project?.status.toLocaleLowerCase("de-DE").includes("archiviert")) {
    throw new PlanningRequestDecisionError("project_archived", "Ein Terminwunsch in einem archivierten Projekt darf nicht entschieden werden.", 409);
  }
  if ((decision === "approve_series" || decision === "reject_series")) {
    const projectIds = [...new Set(seriesEntries.map((item) => item.projectId).filter((item): item is string => Boolean(item)))];
    const seriesProjects = projectIds.length
      ? await input.db.$queryRaw<Array<{ id: string; status: string }>>`SELECT "id","status" FROM "WorkPilotProject" WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(projectIds)})`
      : [];
    if (seriesProjects.length !== projectIds.length) throw new PlanningRequestDecisionError("project_missing", "Mindestens ein mit der Serie verknüpftes Projekt wurde nicht gefunden.", 409);
    if (seriesProjects.some((item) => item.status.toLocaleLowerCase("de-DE").includes("archiviert"))) throw new PlanningRequestDecisionError("project_archived", "Mindestens ein Terminwunsch der Serie gehört zu einem archivierten Projekt.", 409);
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
  const seriesConflicts: Array<{ entryId: string; absenceIds: string[]; overlaps: Array<{ id: string; title: string; startTime: string; endTime: string }> }> = [];
  if (decision === "approve_series") {
    for (const seriesEntry of seriesEntries) {
      const entryAbsences = await input.db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Absence" WHERE "organizationId"=${input.organizationId} AND "userId"=${seriesEntry.userId} AND "date"=${seriesEntry.date}::date AND "deletedAt" IS NULL AND "status"='genehmigt' AND "type" IN ('urlaub','krank','ueberstundenabbau') AND (COALESCE("dayPart",'full')='full' OR ("dayPart"='first-half' AND ${seriesEntry.startTime}<'12:00') OR ("dayPart"='second-half' AND ${seriesEntry.endTime}>'12:00'))`;
      if (entryAbsences.length) throw new PlanningRequestDecisionError("absence_conflict", `${seriesEntry.employeeName || "Eine vorgesehene Person"} ist am ${seriesEntry.date} im Terminzeitraum genehmigt abwesend.`, 409);
      const entryOverlaps = await input.db.$queryRaw<Array<{ id: string; title: string; startTime: string; endTime: string }>>`SELECT "id","title","startTime","endTime" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"<>${seriesEntry.id} AND "userId"=${seriesEntry.userId} AND "date"=${seriesEntry.date} AND "deletedAt" IS NULL AND COALESCE("approvalStatus",'confirmed')='confirmed' AND "startTime"<${seriesEntry.endTime} AND "endTime">${seriesEntry.startTime} ORDER BY "startTime"`;
      if (entryOverlaps.length) throw new PlanningRequestDecisionError("overlap_conflict", `Der Serienwunsch am ${seriesEntry.date} überschneidet sich mit ${entryOverlaps.map((item) => `„${item.title}“ ${item.startTime}-${item.endTime}`).join(", ")}.`, 409, entryOverlaps);
      seriesConflicts.push({ entryId: seriesEntry.id, absenceIds: entryAbsences.map((item) => item.id), overlaps: entryOverlaps });
    }
  }

  const requester = entry.requestedByName || "Nicht angegeben";
  const series = seriesDecision ? {
    recurrenceId: entry.recurrenceId!,
    count: seriesEntries.length,
    fromDate: seriesEntries[0].date,
    toDate: seriesEntries[seriesEntries.length - 1].date,
    entryIds: seriesEntries.map((item) => item.id),
  } : null;
  const evidence = { entry, decision, reason, assignee, project, seriesEntries, seriesConflicts, absenceIds: absences.map((item) => item.id), overlaps };
  return {
    decision,
    reason,
    entry: {
      id: entry.id,
      title: entry.title,
      projectId: entry.projectId ?? "",
      projectLabel: entry.projectLabel ?? "",
      employee: entry.employeeName || (assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() || assignee.email : "Nicht angegeben"),
      requester,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      durationMinutes: entry.durationMinutes,
      recurrenceRule: entry.recurrenceRule ?? "",
      approvalStatus: entry.approvalStatus,
    },
    warnings: [
      ...(!seriesDecision && (entry.recurrenceId || entry.recurrenceRule)
        ? [{ code: "single_occurrence", message: decision === "cancel" ? "Die Absage gilt nur für diesen einzelnen Termin; weitere Serieneinträge bleiben unverändert." : decision === "withdraw" ? "Es wird nur dieser einzelne Terminwunsch zurückgezogen; weitere Serieneinträge bleiben unverändert." : "Die Entscheidung gilt nur für diesen Terminwunsch; weitere Serieneinträge bleiben unverändert." }]
        : []),
    ],
    series,
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
  const seriesDecision = input.decision.endsWith("_series");
  if (seriesDecision) {
    const seed = await loadEntry(input.tx, input.organizationId, input.entryId);
    if (!seed.recurrenceId) throw new PlanningRequestDecisionError("series_missing", "Dieser Planungseintrag gehört keiner eindeutig gespeicherten Terminserie an.", 409);
    await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}),hashtext(${`planning-series-decision:${seed.recurrenceId}`}))`;
    const replayMarkerId = deterministicId("planning-request-decision-history", input.organizationId, input.requestId);
    const replayMarker = await input.tx.$queryRaw<Array<{ planningEntryId: string; toStatus: string | null; createdAt: Date }>>`SELECT "planningEntryId","toStatus","createdAt" FROM "PlanningEntryHistory" WHERE "organizationId"=${input.organizationId} AND "id"=${replayMarkerId} LIMIT 1`;
    if (replayMarker.length) {
      const expectedStatus = input.decision === "approve_series" ? "confirmed" : input.decision === "reject_series" ? "rejected" : input.decision === "cancel_series" ? "cancelled" : "withdrawn";
      if (replayMarker[0].planningEntryId !== input.entryId || replayMarker[0].toStatus !== expectedStatus) {
        throw new PlanningRequestDecisionError("replay_conflict", "Diese Ausführungs-ID wurde bereits für eine andere Terminserienentscheidung verwendet.", 409);
      }
      const expectedEvent = input.decision === "approve_series" ? "series_approved" : input.decision === "reject_series" ? "series_rejected" : input.decision === "cancel_series" ? "series_cancelled" : "series_withdrawn";
      const affected = await input.tx.$queryRaw<Array<{ id: string }>>`SELECT p."id" FROM "PlanningEntry" p INNER JOIN "PlanningEntryHistory" h ON h."planningEntryId"=p."id" AND h."organizationId"=p."organizationId" WHERE p."organizationId"=${input.organizationId} AND p."recurrenceId"=${seed.recurrenceId} AND h."eventType"=${expectedEvent} AND h."createdAt"=${replayMarker[0].createdAt} ORDER BY p."date",p."startTime",p."id"`;
      return { entryId: input.entryId, decision: input.decision, approvalStatus: expectedStatus, deleted: true, replayed: true, affectedEntryIds: affected.map((item) => item.id) } satisfies PlanningRequestDecisionResult;
    }
    const evaluation = await evaluateInternal({ ...input, db: input.tx, lock: true });
    if (evaluation.fingerprint !== input.expectedFingerprint || !evaluation.series) {
      throw new PlanningRequestDecisionError("stale_context", "Die Terminserie wurde zwischenzeitlich verändert. Bitte neu prüfen.", 409);
    }
    const historyIds = evaluation.series.entryIds.map((entryId) => entryId === input.entryId ? replayMarkerId : deterministicId("planning-request-decision-history", input.organizationId, input.requestId, entryId));
    const prior = await input.tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "PlanningEntryHistory" WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(historyIds)})`;
    if (prior.length) throw new PlanningRequestDecisionError("replay_conflict", "Die Serienausführung ist nur teilweise protokolliert und wird sicherheitshalber nicht fortgesetzt.", 409);
    const now = new Date();
    const approved = input.decision === "approve_series";
    const savedRows = approved
      ? await input.tx.$queryRaw<EntryRow[]>`UPDATE "PlanningEntry" SET "approvalStatus"='confirmed',"approvedByUserId"=${input.actor.id},"approvedAt"=${now},"updatedAt"=${now} WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(evaluation.series.entryIds)}) AND "approvalStatus"='requested' AND "deletedAt" IS NULL RETURNING *`
      : await input.tx.$queryRaw<EntryRow[]>`UPDATE "PlanningEntry" SET "deletedAt"=${now},"updatedAt"=${now} WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(evaluation.series.entryIds)}) AND "approvalStatus"=${input.decision === "cancel_series" ? "confirmed" : "requested"} AND "deletedAt" IS NULL RETURNING *`;
    if (savedRows.length !== evaluation.series.entryIds.length) throw new PlanningRequestDecisionError("stale_context", "Mindestens ein Serieneintrag wurde parallel verändert. Bitte neu prüfen.", 409);
    const cancelled = input.decision === "cancel_series";
    const rejected = input.decision === "reject_series";
    for (const saved of savedRows) {
      const perEntryRequestId = `${input.requestId}:${saved.id}`;
      const note = approved ? "Terminwunsch-Serie freigegeben" : rejected ? `Terminwunsch-Serie abgelehnt. Grund: ${evaluation.reason}` : cancelled ? `Terminserie abgesagt. Grund: ${evaluation.reason}` : `Terminwunsch-Serie zurückgezogen. Grund: ${evaluation.reason}`;
      const eventType = approved ? "series_approved" : rejected ? "series_rejected" : cancelled ? "series_cancelled" : "series_withdrawn";
      const toStatus = approved ? "confirmed" : rejected ? "rejected" : cancelled ? "cancelled" : "withdrawn";
      await input.tx.$executeRaw`INSERT INTO "PlanningEntryHistory" ("id","organizationId","planningEntryId","projectId","eventType","actorUserId","actorName","fromStatus","toStatus","note","createdAt") VALUES (${saved.id === input.entryId ? replayMarkerId : deterministicId("planning-request-decision-history", input.organizationId, input.requestId, saved.id)},${input.organizationId},${saved.id},${saved.projectId},${eventType},${input.actor.id},${actorName(input.actor)},${cancelled ? "confirmed" : "requested"},${toStatus},${note},${now})`;
      if (saved.projectId) await input.tx.projectLogbookEntry.upsert({
        where: { organizationId_source_callReference_projectId: { organizationId: input.organizationId, source: "planning-request-decision", callReference: perEntryRequestId, projectId: saved.projectId } },
        update: {},
        create: { id: randomUUID(), organizationId: input.organizationId, projectId: saved.projectId, title: approved ? "Terminwunsch-Serie freigegeben" : rejected ? "Terminwunsch-Serie abgelehnt" : cancelled ? "Terminserie abgesagt" : "Terminwunsch-Serie zurückgezogen", body: `${saved.title}: ${note}`, author: actorName(input.actor), authorUserId: input.actor.id, source: "planning-request-decision", callReference: perEntryRequestId },
      });
      await input.tx.notification.updateMany({ where: { organizationId: input.organizationId, linkTarget: "planning-entry", linkTargetId: saved.id, subject: "Terminwunsch freigeben", resolvedAt: null }, data: { resolvedAt: now, readAt: now } });
      const responsibleIds = input.decision === "withdraw_series" ? await input.tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "organizationId"=${input.organizationId} AND "isActive"=true AND COALESCE("planningResponsibleFor", '[]'::jsonb) ? ${`${saved.board}:${saved.groupName}`}` : [];
      const subject = approved ? "Terminwunsch-Serie bestätigt" : rejected ? "Terminwunsch-Serie abgelehnt" : cancelled ? "Terminserie abgesagt" : "Terminwunsch-Serie zurückgezogen";
      const actionText = approved ? "bestätigt" : rejected ? "abgelehnt" : cancelled ? "abgesagt" : "zurückgezogen";
      const body = `Der ${approved || rejected ? "Terminwunsch" : cancelled ? "Termin" : "Terminwunsch"} „${saved.title}“ am ${saved.date} von ${saved.startTime} bis ${saved.endTime} wurde als Teil der Serie ${actionText}.${evaluation.reason ? ` Grund: ${evaluation.reason}` : ""}`;
      for (const userId of new Set([clean(saved.userId), clean(saved.requestedByUserId), ...responsibleIds.map((item) => clean(item.id))].filter(Boolean))) {
        if (userId === input.actor.id) continue;
        const id = notificationId(input.organizationId, perEntryRequestId, userId);
        await input.tx.notification.upsert({ where: { id }, update: {}, create: { id, organizationId: input.organizationId, userId, taskId: null, channel: "app", subject, body, linkTarget: "planning-entry", linkTargetId: saved.id, linkLabel: "Planung öffnen", sentAt: null } });
      }
    }
    return { entryId: input.entryId, decision: input.decision, approvalStatus: approved ? "confirmed" : rejected ? "rejected" : cancelled ? "cancelled" : "withdrawn", deleted: !approved, replayed: false, affectedEntryIds: evaluation.series.entryIds } satisfies PlanningRequestDecisionResult;
  }
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}),hashtext(${`planning-request-decision:${input.entryId}`}))`;
  const historyId = deterministicId("planning-request-decision-history", input.organizationId, input.requestId);
  const prior = await input.tx.$queryRaw<Array<{ id: string; planningEntryId: string; toStatus: string | null }>>`SELECT "id","planningEntryId","toStatus" FROM "PlanningEntryHistory" WHERE "organizationId"=${input.organizationId} AND "id"=${historyId} LIMIT 1`;
  if (prior.length) {
    const priorDecision = prior[0].toStatus === "confirmed" ? "approve" : prior[0].toStatus === "cancelled" ? "cancel" : prior[0].toStatus === "withdrawn" ? "withdraw" : "reject";
    if (prior[0].planningEntryId !== input.entryId || priorDecision !== input.decision) {
      throw new PlanningRequestDecisionError("replay_conflict", "Diese Ausführungs-ID wurde bereits für eine andere Terminwunschentscheidung verwendet.", 409);
    }
    return {
      entryId: input.entryId,
      decision: priorDecision,
      approvalStatus: prior[0].toStatus === "confirmed" ? "confirmed" : prior[0].toStatus === "cancelled" ? "cancelled" : prior[0].toStatus === "withdrawn" ? "withdrawn" : "rejected",
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
    : evaluation.decision === "reject" || evaluation.decision === "withdraw"
      ? await input.tx.$queryRaw<EntryRow[]>`UPDATE "PlanningEntry" SET "deletedAt"=${now},"updatedAt"=${now} WHERE "organizationId"=${input.organizationId} AND "id"=${input.entryId} AND "approvalStatus"='requested' AND "deletedAt" IS NULL RETURNING *`
      : await input.tx.$queryRaw<EntryRow[]>`UPDATE "PlanningEntry" SET "deletedAt"=${now},"updatedAt"=${now} WHERE "organizationId"=${input.organizationId} AND "id"=${input.entryId} AND "approvalStatus"='confirmed' AND "deletedAt" IS NULL RETURNING *`;
  const saved = savedRows[0];
  if (!saved) {
    throw new PlanningRequestDecisionError("stale_context", "Der Terminwunsch wurde parallel verändert. Bitte neu prüfen.", 409);
  }

  const approved = evaluation.decision === "approve";
  const cancelled = evaluation.decision === "cancel";
  const withdrawn = evaluation.decision === "withdraw";
  const note = approved ? "Terminwunsch freigegeben" : cancelled ? `Planungstermin abgesagt. Grund: ${evaluation.reason}` : withdrawn ? `Terminwunsch zurückgezogen. Grund: ${evaluation.reason}` : `Terminwunsch abgelehnt. Grund: ${evaluation.reason}`;
  await input.tx.$executeRaw`INSERT INTO "PlanningEntryHistory" ("id","organizationId","planningEntryId","projectId","eventType","actorUserId","actorName","fromStatus","toStatus","note","createdAt") VALUES (${historyId},${input.organizationId},${saved.id},${saved.projectId},${approved ? "approved" : cancelled ? "cancelled" : withdrawn ? "withdrawn" : "rejected"},${input.actor.id},${actorName(input.actor)},${cancelled ? "confirmed" : "requested"},${approved ? "confirmed" : cancelled ? "cancelled" : withdrawn ? "withdrawn" : "rejected"},${note},${now})`;
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
        title: approved ? "Terminwunsch freigegeben" : cancelled ? "Planungstermin abgesagt" : withdrawn ? "Terminwunsch zurückgezogen" : "Terminwunsch abgelehnt",
        body: `${saved.title}: ${note}`,
        author: actorName(input.actor),
        authorUserId: input.actor.id,
        source: "planning-request-decision",
        callReference: input.requestId,
      },
    });
  }

  const subject = approved ? "Terminwunsch bestätigt" : cancelled ? "Planungstermin abgesagt" : withdrawn ? "Terminwunsch zurückgezogen" : "Terminwunsch abgelehnt";
  const body = approved
    ? `Der Terminwunsch „${saved.title}“ am ${saved.date} von ${saved.startTime} bis ${saved.endTime} wurde bestätigt.`
    : cancelled
      ? `Der Planungstermin „${saved.title}“ am ${saved.date} von ${saved.startTime} bis ${saved.endTime} wurde abgesagt. Grund: ${evaluation.reason}`
      : withdrawn
        ? `Der Terminwunsch „${saved.title}“ am ${saved.date} von ${saved.startTime} bis ${saved.endTime} wurde zurückgezogen. Grund: ${evaluation.reason}`
        : `Der Terminwunsch „${saved.title}“ am ${saved.date} von ${saved.startTime} bis ${saved.endTime} wurde abgelehnt. Grund: ${evaluation.reason}`;
  await input.tx.notification.updateMany({
    where: {
      organizationId: input.organizationId,
      linkTarget: "planning-entry",
      linkTargetId: saved.id,
      subject: "Terminwunsch freigeben",
      resolvedAt: null,
    },
    data: { resolvedAt: now, readAt: now },
  });
  const planningResponsibleIds = withdrawn
    ? await input.tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "organizationId"=${input.organizationId} AND "isActive"=true AND COALESCE("planningResponsibleFor", '[]'::jsonb) ? ${`${saved.board}:${saved.groupName}`}`
    : [];
  for (const userId of new Set([
    clean(saved.userId),
    clean(saved.requestedByUserId),
    ...planningResponsibleIds.map((item) => clean(item.id)),
  ].filter(Boolean))) {
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
    approvalStatus: approved ? "confirmed" : cancelled ? "cancelled" : withdrawn ? "withdrawn" : "rejected",
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
  decision?: PlanningRequestDecision;
}) {
  const entries = await prisma.$queryRaw<Array<{ id: string; userId: string | null; requestedByUserId: string | null; board: string; groupName: string; recurrenceId: string | null }>>`SELECT "id","userId","requestedByUserId","board","groupName","recurrenceId" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"=${input.entryId} LIMIT 1`;
  const entry = entries[0];
  if (!entry) return;
  const targetEntries = input.decision?.endsWith("_series") && entry.recurrenceId
    ? await prisma.$queryRaw<typeof entries>`SELECT "id","userId","requestedByUserId","board","groupName","recurrenceId" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "recurrenceId"=${entry.recurrenceId}`
    : [entry];
  for (const target of targetEntries) {
    const planningResponsibleIds = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "organizationId"=${input.organizationId} AND "isActive"=true AND COALESCE("planningResponsibleFor", '[]'::jsonb) ? ${`${target.board}:${target.groupName}`}`;
    for (const userId of new Set([clean(target.userId), clean(target.requestedByUserId), ...planningResponsibleIds.map((item) => clean(item.id))].filter(Boolean))) {
      if (userId === input.actorUserId) continue;
      const candidateIds = [
        notificationId(input.organizationId, input.requestId, userId),
        notificationId(input.organizationId, `${input.requestId}:${target.id}`, userId),
      ];
      const notification = await prisma.notification.findFirst({ where: { id: { in: candidateIds } } });
      if (!notification) continue;
      await sendNotificationMailSafely({ notificationId: notification.id, userId, subject: notification.subject, body: notification.body });
      await sendPushToUserSafely({ organizationId: input.organizationId, userId, payload: { title: notification.subject, body: notification.body, notificationId: notification.id, linkTarget: "planning-entry", linkTargetId: target.id, url: `/?target=planning-entry&targetId=${encodeURIComponent(target.id)}` } });
    }
  }
}
