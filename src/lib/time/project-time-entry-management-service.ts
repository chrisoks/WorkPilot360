import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  canManageProjectTimeEntries,
  canViewInternalCostData,
} from "@/lib/permissions";
import {
  ProjectTimeEntryServiceError,
  type ProjectTimeEntryActor,
  type ProjectTimeEntryUser,
  type ProjectTimeEntryWriteInput,
  formatProjectTimeEntry,
  saveProjectTimeEntry,
} from "@/lib/time/project-time-entry-service";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

type ProjectTimeEntryRow = {
  id: string;
  organizationId: string;
  mode: string | null;
  projectId: string;
  projectLabel: string | null;
  trade: string | null;
  planningEntryId: string | null;
  planningBillingGroupId: string | null;
  offerId: string | null;
  offerLabel: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  userId: string | null;
  employee: string | null;
  entrySource: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMs: bigint | number;
  pauseMs: bigint | number;
  laborCostRateSnapshot: number;
  laborCostSnapshot: number;
  costSnapshotAt: Date | null;
  comment: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  marketingContentItemId: string | null;
  marketingContentType: string | null;
  completionStatus: string | null;
  overtimeApprovalStatus: string | null;
  overtimeApprovedByUserId: string | null;
  overtimeApprovedByName: string | null;
  overtimeApprovedAt: Date | null;
  editHistory: unknown;
  deletedAt: Date | null;
  createdAt: Date;
};

export type ProjectTimeEntryManagementAction = "update" | "delete";

export type ProjectTimeEntryManagementEvaluation = {
  action: ProjectTimeEntryManagementAction;
  entry: ReturnType<typeof formatProjectTimeEntry>;
  reason: string;
  fingerprint: string;
};

export function getProjectTimeEntryManagementConfirmationText(
  entryId: string,
  action: ProjectTimeEntryManagementAction
) {
  return `ZEITEINTRAG ${action === "delete" ? "LÖSCHEN" : "KORRIGIEREN"} ${entryId.trim()}`;
}

export function matchesProjectTimeEntryManagementConfirmation(
  entryId: string,
  action: ProjectTimeEntryManagementAction,
  confirmationText: string
) {
  return confirmationText.trim() ===
    getProjectTimeEntryManagementConfirmationText(entryId, action);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function actorName(actor: ProjectTimeEntryActor) {
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

function stableEntryFingerprint(entry: ProjectTimeEntryRow) {
  const value = {
    id: entry.id,
    organizationId: entry.organizationId,
    mode: entry.mode ?? "project",
    projectId: entry.projectId,
    projectLabel: entry.projectLabel ?? "",
    trade: entry.trade ?? "",
    planningEntryId: entry.planningEntryId ?? "",
    planningBillingGroupId: entry.planningBillingGroupId ?? "",
    offerId: entry.offerId ?? "",
    offerLabel: entry.offerLabel ?? "",
    billingCatalogItemId: entry.billingCatalogItemId ?? "",
    billingCatalogItemLabel: entry.billingCatalogItemLabel ?? "",
    userId: entry.userId ?? "",
    employee: entry.employee ?? "",
    entrySource: entry.entrySource ?? "stamped",
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMs: Number(entry.durationMs),
    pauseMs: Number(entry.pauseMs),
    laborCostRateSnapshot: Number(entry.laborCostRateSnapshot),
    laborCostSnapshot: Number(entry.laborCostSnapshot),
    costSnapshotAt: entry.costSnapshotAt?.toISOString() ?? "",
    comment: entry.comment ?? "",
    invoiceId: entry.invoiceId ?? "",
    invoiceNumber: entry.invoiceNumber ?? "",
    invoicedAt: entry.invoicedAt?.toISOString() ?? "",
    marketingContentItemId: entry.marketingContentItemId ?? "",
    marketingContentType: entry.marketingContentType ?? "",
    completionStatus: entry.completionStatus ?? "",
    overtimeApprovalStatus: entry.overtimeApprovalStatus ?? "not_required",
    overtimeApprovedByUserId: entry.overtimeApprovedByUserId ?? "",
    overtimeApprovedByName: entry.overtimeApprovedByName ?? "",
    overtimeApprovedAt: entry.overtimeApprovedAt?.toISOString() ?? "",
    deletedAt: entry.deletedAt?.toISOString() ?? "",
    editHistory: Array.isArray(entry.editHistory) ? entry.editHistory : [],
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function loadEntry(
  db: DatabaseClient,
  organizationId: string,
  entryId: string,
  lock = false
) {
  const rows = lock
    ? await db.$queryRaw<ProjectTimeEntryRow[]>`
        SELECT * FROM "ProjectTimeEntry"
        WHERE "id" = ${entryId} AND "organizationId" = ${organizationId}
        LIMIT 1 FOR UPDATE
      `
    : await db.$queryRaw<ProjectTimeEntryRow[]>`
        SELECT * FROM "ProjectTimeEntry"
        WHERE "id" = ${entryId} AND "organizationId" = ${organizationId}
        LIMIT 1
      `;
  const entry = rows[0];
  if (!entry) {
    throw new ProjectTimeEntryServiceError(
      "not_found",
      "Der Zeiteintrag wurde in dieser Organisation nicht gefunden.",
      404
    );
  }
  return entry;
}

function assertManageable(input: {
  actor: ProjectTimeEntryActor;
  entry: ProjectTimeEntryRow;
  reason: string;
}) {
  if (
    !canManageProjectTimeEntries(input.actor) &&
    !(
      input.entry.userId === input.actor.id &&
      input.entry.entrySource === "manual"
    )
  ) {
    throw new ProjectTimeEntryServiceError(
      "forbidden",
      "Du darfst nur eigene manuelle Zeiteinträge korrigieren oder löschen.",
      403
    );
  }
  if (input.entry.deletedAt) {
    throw new ProjectTimeEntryServiceError(
      "conflict",
      "Der Zeiteintrag ist bereits gelöscht.",
      409
    );
  }
  if (input.entry.invoiceId || input.entry.invoiceNumber || input.entry.invoicedAt) {
    throw new ProjectTimeEntryServiceError(
      "conflict",
      `Der Zeiteintrag ist bereits${input.entry.invoiceNumber ? ` mit ${input.entry.invoiceNumber}` : ""} abgerechnet und darf nicht nachträglich geändert oder gelöscht werden.`,
      409
    );
  }
  if (input.reason.length < 3 || input.reason.length > 500) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Bitte einen nachvollziehbaren Korrektur- oder Löschgrund mit 3 bis 500 Zeichen angeben.",
      400
    );
  }
}

export async function evaluateProjectTimeEntryManagement(input: {
  db?: DatabaseClient;
  organizationId: string;
  actor: ProjectTimeEntryActor;
  entryId: string;
  action: ProjectTimeEntryManagementAction;
  reason: string;
}) {
  const db = input.db ?? prisma;
  const entryId = cleanString(input.entryId);
  const reason = cleanString(input.reason);
  if (!entryId) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Bitte einen Zeiteintrag auswählen.",
      400
    );
  }
  const entry = await loadEntry(db, input.organizationId, entryId);
  assertManageable({ actor: input.actor, entry, reason });
  return {
    action: input.action,
    entry: formatProjectTimeEntry(entry, {
      includeInternalCosts: canViewInternalCostData(input.actor),
    }),
    reason,
    fingerprint: stableEntryFingerprint(entry),
  } satisfies ProjectTimeEntryManagementEvaluation;
}

export async function executeProjectTimeEntryManagementInTransaction(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  actor: ProjectTimeEntryActor;
  users: ProjectTimeEntryUser[];
  entryId: string;
  action: ProjectTimeEntryManagementAction;
  reason: string;
  expectedFingerprint: string;
  changes?: ProjectTimeEntryWriteInput;
}) {
  const tx = input.tx;
  await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${input.organizationId}),
          hashtext(${`project-time-entry:${input.entryId}`})
        )
      `;
  const entry = await loadEntry(tx, input.organizationId, input.entryId, true);
  assertManageable({ actor: input.actor, entry, reason: cleanString(input.reason) });
  if (stableEntryFingerprint(entry) !== input.expectedFingerprint) {
    throw new ProjectTimeEntryServiceError(
      "conflict",
      "Der Zeiteintrag wurde zwischenzeitlich verändert. Bitte den aktuellen Stand neu prüfen.",
      409
    );
  }

  const allowedChangeKeys = [
    "date",
    "startTime",
    "endTime",
    "pauseMs",
    "comment",
    "offerId",
    "trade",
    "billingCatalogItemId",
    "completionStatus",
    "overtimeApprovalStatus",
  ] as const;
  const rawChanges = input.changes ?? {};
  const changes = Object.fromEntries(
    allowedChangeKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(rawChanges, key))
      .map((key) => [key, rawChanges[key]])
  ) as ProjectTimeEntryWriteInput;
  if (input.action === "update" && Object.keys(changes).length === 0) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Bitte mindestens ein zulässiges Feld des Zeiteintrags zur Korrektur angeben.",
      400
    );
  }
  const currentHistory = Array.isArray(entry.editHistory) ? entry.editHistory : [];
  const nextDate = cleanString(changes.date) || entry.date;
  const nextStart = cleanString(changes.startTime) || entry.startTime;
  const nextEnd = cleanString(changes.endTime) || entry.endTime;
  const nextPause = Number.isSafeInteger(changes.pauseMs)
    ? Number(changes.pauseMs)
    : Number(entry.pauseMs);
  const changedFields = Object.keys(changes).filter(
    (key) => !["id", "durationMs", "editHistory"].includes(key)
  );
  const history = {
    id: randomUUID(),
    actorUserId: input.actor.id,
    actorName: actorName(input.actor),
    event: input.action === "delete" ? "Zeiteintrag gelöscht" : "Zeiteintrag bearbeitet",
    note: cleanString(input.reason),
    previousValue: `${entry.date} ${entry.startTime}-${entry.endTime}, Pause ${Number(entry.pauseMs)} ms, Dauer ${Number(entry.durationMs)} ms`,
    nextValue:
      input.action === "delete"
        ? "Gelöscht"
        : `${nextDate} ${nextStart}-${nextEnd}, Pause ${nextPause} ms; geändert: ${changedFields.join(", ")}`,
    createdAt: new Date().toISOString(),
  };

  if (input.action === "delete") {
    const rows = await tx.$queryRaw<ProjectTimeEntryRow[]>`
          UPDATE "ProjectTimeEntry"
          SET "deletedAt" = CURRENT_TIMESTAMP,
              "editHistory" = CAST(${JSON.stringify([history, ...currentHistory])} AS jsonb)
          WHERE "id" = ${entry.id}
            AND "organizationId" = ${input.organizationId}
            AND "deletedAt" IS NULL
          RETURNING *
        `;
    if (!rows[0]) {
      throw new ProjectTimeEntryServiceError(
        "conflict",
        "Der Zeiteintrag konnte nicht eindeutig gelöscht werden.",
        409
      );
    }
    return formatProjectTimeEntry(rows[0], {
      includeInternalCosts: canViewInternalCostData(input.actor),
    });
  }

  return saveProjectTimeEntry({
        db: tx,
        organizationId: input.organizationId,
        actor: input.actor,
        users: input.users,
        payload: {
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          pauseMs: Number(entry.pauseMs),
          comment: entry.comment ?? "",
          trade: entry.trade ?? "",
          offerId: entry.offerId ?? "",
          offerLabel: entry.offerLabel ?? "",
          billingCatalogItemId: entry.billingCatalogItemId ?? "",
          billingCatalogItemLabel: entry.billingCatalogItemLabel ?? "",
          completionStatus:
            entry.completionStatus === "finished" ||
            entry.completionStatus === "interrupted"
              ? entry.completionStatus
              : "",
          overtimeApprovalStatus:
            entry.overtimeApprovalStatus === "pending" ||
            entry.overtimeApprovalStatus === "approved"
              ? entry.overtimeApprovalStatus
              : "not_required",
          ...changes,
          id: entry.id,
          mode: entry.mode === "unproductive" ? "unproductive" : "project",
          projectId: entry.projectId,
          projectLabel: entry.projectLabel ?? "",
          unproductiveLabel:
            entry.mode === "unproductive" ? entry.projectLabel ?? "" : undefined,
          userId: entry.userId ?? "",
          entrySource: entry.entrySource === "manual" ? "manual" : "stamped",
          planningEntryId: entry.planningEntryId ?? "",
          planningBillingGroupId: entry.planningBillingGroupId ?? "",
          marketingContentItemId: entry.marketingContentItemId ?? "",
          marketingContentType: entry.marketingContentType ?? "",
          editHistory: [history, ...currentHistory],
        },
        allowManagedUpdate: true,
  });
}

export async function executeProjectTimeEntryManagement(input: {
  db?: typeof prisma;
  organizationId: string;
  actor: ProjectTimeEntryActor;
  users: ProjectTimeEntryUser[];
  entryId: string;
  action: ProjectTimeEntryManagementAction;
  reason: string;
  expectedFingerprint: string;
  changes?: ProjectTimeEntryWriteInput;
}) {
  const rootDb = input.db ?? prisma;
  return rootDb.$transaction(
    (tx) => executeProjectTimeEntryManagementInTransaction({ ...input, tx }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
