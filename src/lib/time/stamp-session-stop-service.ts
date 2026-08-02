import { createHash } from "node:crypto";
import { Prisma, type ProjectTimeEntry } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  executeProjectStatusChange,
  ProjectStatusServiceError,
} from "@/lib/projects/project-status-service";
import { shouldApplyStampInterruptionTransition } from "@/lib/projects/stamp-status-automation";
import { getEmployeeHourlyCostRateSnapshot } from "@/lib/time/project-time-entry-service";
import {
  StampSessionServiceError,
  toStampSessionSnapshot,
  type StampSessionSnapshot,
} from "@/lib/time/stamp-session-service";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export type StampSessionStopInput = {
  completionStatus?: "finished" | "interrupted" | "";
  comment?: string;
  interruptionReason?: string;
};

export type StampSessionStopEvaluation = {
  action: "stop";
  requested: StampSessionStopInput;
  effective: {
    completionStatus: "finished" | "interrupted" | "";
    comment: string;
    interruptionReason: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMs: number;
    pauseMs: number;
  };
  session: StampSessionSnapshot | null;
  project: null | {
    id: string;
    projectNumber: string;
    title: string;
    customer: string;
    status: string;
    projectKind: string;
    recurringBillingMode: string;
    branch: string;
    projectType: string;
    responsibleName: string;
    updatedAt: string;
  };
  isHourlyRecurring: boolean;
  requiresFinalInspection: boolean;
  willAttachHourlyInvoiceDraft: boolean;
  willCreateInterruptionTask: boolean;
  willTransitionProjectToInterrupted: boolean;
  fingerprint: string;
  warnings: string[];
  blockingIssues: string[];
};

export type StampSessionStopEntry = {
  id: string;
  organizationId: string;
  mode: string;
  projectId: string;
  projectLabel: string;
  trade: string;
  planningEntryId: string;
  planningBillingGroupId: string;
  billingCatalogItemId: string;
  billingCatalogItemLabel: string;
  userId: string;
  employee: string;
  entrySource: "stamped";
  date: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  pauseMs: number;
  laborCostRateSnapshot: number;
  laborCostSnapshot: number;
  costSnapshotAt: string;
  comment: string;
  marketingContentItemId: string;
  marketingContentType: string;
  completionStatus: "finished" | "interrupted" | "";
  invoiceId: string;
  invoiceNumber: string;
  invoicedAt: string;
  overtimeApprovalStatus: "not_required";
  overtimeApprovedByUserId: string;
  overtimeApprovedByName: string;
  overtimeApprovedAt: string;
  editHistory: unknown[];
  createdAt: string;
};

function clean(value: unknown, max = 2000) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function normalize(value: unknown) {
  return clean(value, 500)
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toNumber(value: bigint | number) {
  return Number(value || 0);
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function berlinDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function berlinTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function isHourlyProject(project: {
  projectKind: string | null;
  recurringBillingMode: string | null;
}) {
  return (
    project.recurringBillingMode === "hourly" &&
    normalize(project.projectKind).includes("dauerl")
  );
}

function isImmocareProject(project: {
  branch: string | null;
  projectType: string | null;
  projectNumber: string;
}) {
  return (
    normalize(project.branch).includes("immocare") ||
    normalize(project.projectType).includes("immocare") ||
    normalize(project.projectNumber).startsWith("oki")
  );
}

export function toStampSessionStopEntry(entry: ProjectTimeEntry): StampSessionStopEntry {
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    mode: entry.mode,
    projectId: entry.projectId,
    projectLabel: entry.projectLabel ?? "",
    trade: entry.trade ?? "",
    planningEntryId: entry.planningEntryId ?? "",
    planningBillingGroupId: entry.planningBillingGroupId ?? "",
    billingCatalogItemId: entry.billingCatalogItemId ?? "",
    billingCatalogItemLabel: entry.billingCatalogItemLabel ?? "",
    userId: entry.userId ?? "",
    employee: entry.employee ?? "",
    entrySource: "stamped",
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMs: toNumber(entry.durationMs),
    pauseMs: toNumber(entry.pauseMs),
    laborCostRateSnapshot: Number(entry.laborCostRateSnapshot || 0),
    laborCostSnapshot: Number(entry.laborCostSnapshot || 0),
    costSnapshotAt: entry.costSnapshotAt?.toISOString() ?? "",
    comment: entry.comment ?? "",
    marketingContentItemId: entry.marketingContentItemId ?? "",
    marketingContentType: entry.marketingContentType ?? "",
    completionStatus:
      entry.completionStatus === "finished" ||
      entry.completionStatus === "interrupted"
        ? entry.completionStatus
        : "",
    invoiceId: entry.invoiceId ?? "",
    invoiceNumber: entry.invoiceNumber ?? "",
    invoicedAt: entry.invoicedAt?.toISOString() ?? "",
    overtimeApprovalStatus: "not_required",
    overtimeApprovedByUserId: entry.overtimeApprovedByUserId ?? "",
    overtimeApprovedByName: entry.overtimeApprovedByName ?? "",
    overtimeApprovedAt: entry.overtimeApprovedAt?.toISOString() ?? "",
    editHistory: Array.isArray(entry.editHistory) ? entry.editHistory : [],
    createdAt: entry.createdAt.toISOString(),
  };
}

export function getStampSessionStopConfirmationText(
  evaluation: Pick<StampSessionStopEvaluation, "effective" | "project" | "session">,
) {
  if (evaluation.session?.mode !== "project") return "STEMPELUNG STOPPEN";
  const projectNumber = evaluation.project?.projectNumber || "PROJEKT";
  return evaluation.effective.completionStatus === "interrupted"
    ? `STEMPELUNG BEENDEN UNTERBROCHEN ${projectNumber}`
    : `STEMPELUNG BEENDEN FERTIG ${projectNumber}`;
}

export function matchesStampSessionStopConfirmation(
  evaluation: Pick<StampSessionStopEvaluation, "effective" | "project" | "session">,
  value: string,
) {
  return value.trim() === getStampSessionStopConfirmationText(evaluation);
}

export async function evaluateStampSessionStop(input: {
  db?: DatabaseClient;
  organizationId: string;
  userId: string;
  stop: StampSessionStopInput;
  now?: Date;
}): Promise<StampSessionStopEvaluation> {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const requested: StampSessionStopInput = {
    completionStatus:
      input.stop.completionStatus === "finished" ||
      input.stop.completionStatus === "interrupted"
        ? input.stop.completionStatus
        : "",
    comment: clean(input.stop.comment),
    interruptionReason: clean(input.stop.interruptionReason),
  };
  if (!input.organizationId || !input.userId) {
    throw new StampSessionServiceError(
      "invalid_input",
      "Organisation und persönliche Benutzeridentität müssen eindeutig feststehen.",
      400,
    );
  }

  const active = await db.activeStampSession.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
  });
  const session = active ? toStampSessionSnapshot(active, now.getTime()) : null;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  if (!active || !session) blockingIssues.push("Es läuft keine persönliche Stempelung.");

  const project =
    active?.mode === "project" && active.projectId
      ? await db.workPilotProject.findFirst({
          where: {
            organizationId: input.organizationId,
            id: active.projectId,
          },
        })
      : null;
  if (active?.mode === "project" && !project) {
    blockingIssues.push("Das gestempelte Projekt wurde in dieser Organisation nicht gefunden.");
  }
  if (active?.mode === "project" && !requested.completionStatus) {
    blockingIssues.push("Bitte auswählen, ob die Arbeit fertig oder unterbrochen ist.");
  }
  if (
    active?.mode === "project" &&
    requested.completionStatus === "interrupted" &&
    !requested.interruptionReason
  ) {
    blockingIssues.push("Bitte kurz begründen, warum die Arbeit unterbrochen wurde.");
  }

  const durationMs = session
    ? session.accumulatedMs +
      (session.pauseStartedAt
        ? 0
        : Math.max(0, now.getTime() - new Date(session.startedAt).getTime()))
    : 0;
  const pauseMs = session
    ? session.pauseMs +
      (session.pauseStartedAt
        ? Math.max(
            0,
            now.getTime() - new Date(session.pauseStartedAt).getTime(),
          )
        : 0)
    : 0;
  if (session && durationMs <= 0) {
    blockingIssues.push("Die Laufzeit muss größer als 0 sein.");
  }
  const finalComment = requested.comment || session?.comment || "";
  const commentAlreadyContainsReason =
    requested.interruptionReason &&
    normalize(finalComment).includes(normalize(requested.interruptionReason));
  const effectiveComment =
    requested.completionStatus === "interrupted" &&
    requested.interruptionReason &&
    !commentAlreadyContainsReason
      ? [finalComment, `Unterbrechungsgrund: ${requested.interruptionReason}`]
          .filter(Boolean)
          .join("\n")
      : finalComment;
  const hourly = Boolean(project && isHourlyProject(project));
  if (
    hourly &&
    (!active?.trade ||
      !active.billingCatalogItemId ||
      !active.billingCatalogItemLabel)
  ) {
    blockingIssues.push(
      "Für den Stunden-Dauerläufer fehlen Gewerk oder Abrechnungsleistung in der laufenden Stempelung.",
    );
  }
  const requiresFinalInspection = Boolean(
    project &&
      requested.completionStatus === "finished" &&
      isImmocareProject(project),
  );
  if (requiresFinalInspection) {
    warnings.push(
      "Für dieses OK-immocare-Projekt muss beim fertigen Abschluss eine Endkontrolle dokumentiert werden.",
    );
  }

  const projectSnapshot = project
    ? {
        id: project.id,
        projectNumber: project.projectNumber,
        title: project.title,
        customer: project.customer ?? "",
        status: project.status,
        projectKind: project.projectKind ?? "",
        recurringBillingMode: project.recurringBillingMode ?? "",
        branch: project.branch ?? "",
        projectType: project.projectType ?? "",
        responsibleName: project.responsibleName ?? "",
        updatedAt: project.updatedAt.toISOString(),
      }
    : null;
  const effective = {
    completionStatus:
      active?.mode === "project" ? requested.completionStatus || "" : "",
    comment: effectiveComment,
    interruptionReason: requested.interruptionReason || "",
    date: active ? berlinDateKey(active.startedAt) : "",
    startTime: active ? berlinTime(active.startedAt) : "",
    endTime: active ? berlinTime(now) : "",
    durationMs,
    pauseMs,
  } as StampSessionStopEvaluation["effective"];
  const willTransitionProjectToInterrupted = Boolean(
    project &&
      effective.completionStatus === "interrupted" &&
      shouldApplyStampInterruptionTransition(project.status) &&
      !normalize(project.status).includes("unterbrochen"),
  );
  const fingerprint = hash({
    version: 1,
    userId: input.userId,
    requested,
    session: active
      ? {
          id: active.id,
          mode: active.mode,
          projectId: active.projectId,
          projectLabel: active.projectLabel,
          trade: active.trade,
          planningEntryId: active.planningEntryId,
          planningBillingGroupId: active.planningBillingGroupId,
          billingCatalogItemId: active.billingCatalogItemId,
          billingCatalogItemLabel: active.billingCatalogItemLabel,
          marketingContentItemId: active.marketingContentItemId,
          marketingContentType: active.marketingContentType,
          comment: active.comment,
          startedAt: active.startedAt.toISOString(),
          accumulatedMs: active.accumulatedMs.toString(),
          pauseStartedAt: active.pauseStartedAt?.toISOString() ?? null,
          pauseMs: active.pauseMs.toString(),
          updatedAt: active.updatedAt.toISOString(),
        }
      : null,
    project: projectSnapshot,
  });
  return {
    action: "stop",
    requested,
    effective,
    session,
    project: projectSnapshot,
    isHourlyRecurring: hourly,
    requiresFinalInspection,
    willAttachHourlyInvoiceDraft: Boolean(hourly),
    willCreateInterruptionTask: Boolean(
      project && effective.completionStatus === "interrupted",
    ),
    willTransitionProjectToInterrupted,
    fingerprint,
    warnings: [...new Set(warnings)],
    blockingIssues: [...new Set(blockingIssues)],
  };
}

async function executeInTransaction(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  actorName: string;
  stop: StampSessionStopInput;
  expectedFingerprint?: string;
  requestId: string;
  source: "ui" | "jarvis";
  now: Date;
}) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`stamp-session:${input.organizationId}:${input.userId}`}, 0))`;
  const previous = await input.tx.projectTimeEntry.findFirst({
    where: {
      id: input.requestId,
      organizationId: input.organizationId,
      userId: input.userId,
      entrySource: "stamped",
      deletedAt: null,
    },
  });
  if (previous) {
    return {
      entry: toStampSessionStopEntry(previous),
      evaluation: null,
      replayed: true,
      projectStatusTransition: null,
    };
  }

  const evaluation = await evaluateStampSessionStop({
    db: input.tx,
    organizationId: input.organizationId,
    userId: input.userId,
    stop: input.stop,
    now: input.now,
  });
  if (
    input.expectedFingerprint &&
    evaluation.fingerprint !== input.expectedFingerprint
  ) {
    throw new StampSessionServiceError(
      "stale_context",
      "Stempelung, Projekt oder Abschlussangaben haben sich seit der Vorschau geändert.",
      409,
    );
  }
  if (evaluation.blockingIssues.length) {
    throw new StampSessionServiceError(
      "conflict",
      evaluation.blockingIssues.join(" · "),
      409,
    );
  }
  const active = await input.tx.activeStampSession.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
  });
  if (!active) {
    throw new StampSessionServiceError(
      "stale_context",
      "Die laufende Stempelung ist nicht mehr vorhanden.",
      409,
    );
  }
  const laborCostRateSnapshot = await getEmployeeHourlyCostRateSnapshot(
    input.tx,
    input.organizationId,
    input.userId,
  );
  const laborCostSnapshot = roundMoney(
    (evaluation.effective.durationMs / 3_600_000) * laborCostRateSnapshot,
  );
  const entry = await input.tx.projectTimeEntry.create({
    data: {
      id: input.requestId,
      organizationId: input.organizationId,
      mode: active.mode === "unproductive" ? "unproductive" : "project",
      projectId:
        active.mode === "unproductive" ? "__unproductive__" : active.projectId,
      projectLabel:
        active.projectLabel ??
        (active.mode === "unproductive" ? "Unproduktiv" : null),
      trade: active.trade,
      planningEntryId: active.planningEntryId,
      planningBillingGroupId: active.planningBillingGroupId,
      billingCatalogItemId: active.billingCatalogItemId,
      billingCatalogItemLabel: active.billingCatalogItemLabel,
      userId: active.userId,
      employee: active.employee,
      entrySource: "stamped",
      date: evaluation.effective.date,
      startTime: evaluation.effective.startTime,
      endTime: evaluation.effective.endTime,
      durationMs: BigInt(evaluation.effective.durationMs),
      pauseMs: BigInt(evaluation.effective.pauseMs),
      laborCostRateSnapshot,
      laborCostSnapshot,
      costSnapshotAt: input.now,
      comment: evaluation.effective.comment || null,
      marketingContentItemId: active.marketingContentItemId,
      marketingContentType: active.marketingContentType,
      completionStatus: evaluation.effective.completionStatus || null,
      overtimeApprovalStatus: "not_required",
      editHistory: [],
    },
  });
  const removed = await input.tx.activeStampSession.deleteMany({
    where: {
      id: active.id,
      organizationId: input.organizationId,
      userId: input.userId,
      updatedAt: active.updatedAt,
    },
  });
  if (removed.count !== 1) {
    throw new StampSessionServiceError(
      "stale_context",
      "Die laufende Stempelung wurde zwischenzeitlich verändert.",
      409,
    );
  }

  let projectStatusTransition: null | {
    projectId: string;
    previousStatus: string;
    nextStatus: string;
  } = null;
  if (
    evaluation.project &&
    evaluation.willTransitionProjectToInterrupted
  ) {
    try {
      const changed = await executeProjectStatusChange({
        tx: input.tx,
        organizationId: input.organizationId,
        projectId: evaluation.project.id,
        targetStatus: "Arbeit unterbrochen",
        reason: "Persönliche Stempelung als Arbeit unterbrochen beendet.",
        actorId: input.userId,
        actorName: input.actorName,
        requestId: `${input.requestId}:project-status`,
        source: input.source,
      });
      if (!changed.replayed) {
        projectStatusTransition = {
          projectId: evaluation.project.id,
          previousStatus: evaluation.project.status,
          nextStatus: "Arbeit unterbrochen",
        };
      }
    } catch (error) {
      if (!(error instanceof ProjectStatusServiceError)) throw error;
      throw new StampSessionServiceError(
        "conflict",
        `Die Unterbrechung konnte nicht vollständig in den Projektstatus übernommen werden: ${error.message}`,
        409,
      );
    }
  }
  return {
    entry: toStampSessionStopEntry(entry),
    evaluation,
    replayed: false,
    projectStatusTransition,
  };
}

export async function executeStampSessionStop(input: {
  db?: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  actorName: string;
  stop: StampSessionStopInput;
  expectedFingerprint?: string;
  requestId: string;
  source: "ui" | "jarvis";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!clean(input.requestId, 120)) {
    throw new StampSessionServiceError(
      "invalid_input",
      "Eine eindeutige Ausführungs-ID fehlt.",
      400,
    );
  }
  if (input.db) return executeInTransaction({ ...input, tx: input.db, now });
  return prisma.$transaction(
    (tx) => executeInTransaction({ ...input, tx, now }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
