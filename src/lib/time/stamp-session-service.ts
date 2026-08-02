import { createHash } from "node:crypto";
import { Prisma, type ActiveStampSession } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export type StampSessionTransition = "pause" | "resume";

export type StampSessionSnapshot = {
  id: string;
  organizationId: string;
  userId: string;
  employee: string;
  mode: "project" | "unproductive";
  projectId: string;
  projectLabel: string;
  trade: string;
  planningEntryId: string;
  planningBillingGroupId: string;
  billingCatalogItemId: string;
  billingCatalogItemLabel: string;
  marketingContentItemId: string;
  marketingContentTitle: string;
  marketingContentType: string;
  comment: string;
  startedAt: string;
  accumulatedMs: number;
  pauseStartedAt: string | null;
  pauseMs: number;
  createdAt: string;
  updatedAt: string;
};

export type StampSessionTransitionEvaluation = {
  action: StampSessionTransition;
  session: StampSessionSnapshot | null;
  currentState: "running" | "paused" | "missing";
  targetState: "running" | "paused";
  displayElapsedMs: number;
  displayPauseMs: number;
  fingerprint: string;
  warnings: string[];
  blockingIssues: string[];
};

export class StampSessionServiceError extends Error {
  constructor(
    public readonly code:
      | "invalid_input"
      | "not_found"
      | "stale_context"
      | "conflict",
    message: string,
    public readonly status: 400 | 404 | 409
  ) {
    super(message);
    this.name = "StampSessionServiceError";
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function hashJson(value: unknown) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function getBerlinOffsetMs(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const berlinTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return berlinTimeAsUtc - Math.floor(timestampMs / 1000) * 1000;
}

function normalizeStoredStampDate(date: Date | null, nowMs = Date.now()) {
  if (!date) return null;
  const timestampMs = date.getTime();
  if (!Number.isFinite(timestampMs) || timestampMs <= nowMs + 60_000) return date;
  const correctedTimestampMs = timestampMs - getBerlinOffsetMs(timestampMs);
  return correctedTimestampMs <= nowMs + 60_000
    ? new Date(correctedTimestampMs)
    : date;
}

export function toStampSessionSnapshot(
  row: ActiveStampSession,
  nowMs = Date.now()
): StampSessionSnapshot {
  const startedAt = normalizeStoredStampDate(row.startedAt, nowMs) ?? row.startedAt;
  const pauseStartedAt = normalizeStoredStampDate(row.pauseStartedAt, nowMs);
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    employee: row.employee ?? "",
    mode: row.mode === "unproductive" ? "unproductive" : "project",
    projectId: row.projectId,
    projectLabel: row.projectLabel ?? "",
    trade: row.trade ?? "",
    planningEntryId: row.planningEntryId ?? "",
    planningBillingGroupId: row.planningBillingGroupId ?? "",
    billingCatalogItemId: row.billingCatalogItemId ?? "",
    billingCatalogItemLabel: row.billingCatalogItemLabel ?? "",
    marketingContentItemId: row.marketingContentItemId ?? "",
    marketingContentTitle: row.marketingContentTitle ?? "",
    marketingContentType: row.marketingContentType ?? "",
    comment: row.comment ?? "",
    startedAt: startedAt.toISOString(),
    accumulatedMs: Number(row.accumulatedMs),
    pauseStartedAt: pauseStartedAt?.toISOString() ?? null,
    pauseMs: Number(row.pauseMs),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function transitionFingerprint(
  action: StampSessionTransition,
  session: StampSessionSnapshot | null
) {
  return hashJson({
    version: 1,
    action,
    session: session
      ? {
          id: session.id,
          organizationId: session.organizationId,
          userId: session.userId,
          mode: session.mode,
          projectId: session.projectId,
          projectLabel: session.projectLabel,
          trade: session.trade,
          planningEntryId: session.planningEntryId,
          planningBillingGroupId: session.planningBillingGroupId,
          billingCatalogItemId: session.billingCatalogItemId,
          billingCatalogItemLabel: session.billingCatalogItemLabel,
          comment: session.comment,
          startedAt: session.startedAt,
          accumulatedMs: session.accumulatedMs,
          pauseStartedAt: session.pauseStartedAt,
          pauseMs: session.pauseMs,
          updatedAt: session.updatedAt,
        }
      : null,
  });
}

async function loadSession(
  db: DatabaseClient,
  organizationId: string,
  userId: string
) {
  return db.activeStampSession.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

function evaluateLoadedSession(
  action: StampSessionTransition,
  row: ActiveStampSession | null,
  now: Date
): StampSessionTransitionEvaluation {
  const session = row ? toStampSessionSnapshot(row, now.getTime()) : null;
  const currentState = !session
    ? "missing"
    : session.pauseStartedAt
      ? "paused"
      : "running";
  const blockingIssues: string[] = [];
  if (!session) {
    blockingIssues.push("Es gibt keine aktive persönliche Stempelung.");
  } else if (action === "pause" && currentState !== "running") {
    blockingIssues.push("Die persönliche Stempelung ist bereits pausiert.");
  } else if (action === "resume" && currentState !== "paused") {
    blockingIssues.push("Die persönliche Stempelung läuft bereits.");
  }
  return {
    action,
    session,
    currentState,
    targetState: action === "pause" ? "paused" : "running",
    displayElapsedMs: session
      ? session.accumulatedMs +
        (session.pauseStartedAt
          ? 0
          : Math.max(0, now.getTime() - new Date(session.startedAt).getTime()))
      : 0,
    displayPauseMs: session
      ? session.pauseMs +
        (session.pauseStartedAt
          ? Math.max(0, now.getTime() - new Date(session.pauseStartedAt).getTime())
          : 0)
      : 0,
    fingerprint: transitionFingerprint(action, session),
    warnings: [],
    blockingIssues,
  };
}

export function getStampSessionTransitionConfirmationText(
  action: StampSessionTransition
) {
  return action === "pause" ? "STEMPELUNG PAUSIEREN" : "STEMPELUNG FORTSETZEN";
}

export function matchesStampSessionTransitionConfirmation(
  action: StampSessionTransition,
  value: string
) {
  return value.trim() === getStampSessionTransitionConfirmationText(action);
}

export async function evaluateStampSessionTransition(input: {
  db?: DatabaseClient;
  organizationId: string;
  userId: string;
  action: StampSessionTransition;
  now?: Date;
}) {
  if (!input.organizationId.trim() || !input.userId.trim()) {
    throw new StampSessionServiceError(
      "invalid_input",
      "Organisation und persönliche Benutzeridentität müssen eindeutig feststehen.",
      400
    );
  }
  const now = input.now ?? new Date();
  const row = await loadSession(
    input.db ?? prisma,
    input.organizationId,
    input.userId
  );
  return evaluateLoadedSession(input.action, row, now);
}

async function executeInTransaction(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  action: StampSessionTransition;
  expectedFingerprint?: string;
  allowAlreadyInTargetState?: boolean;
  now: Date;
}) {
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`stamp-session:${input.organizationId}:${input.userId}`}, 0)
    )
  `;
  const rows = await input.tx.$queryRaw<ActiveStampSession[]>`
    SELECT *
    FROM "ActiveStampSession"
    WHERE "organizationId" = ${input.organizationId}
      AND "userId" = ${input.userId}
    LIMIT 1
    FOR UPDATE
  `;
  const evaluation = evaluateLoadedSession(input.action, rows[0] ?? null, input.now);
  if (input.expectedFingerprint && evaluation.fingerprint !== input.expectedFingerprint) {
    throw new StampSessionServiceError(
      "stale_context",
      "Die laufende Stempelung hat sich seit der Vorschau geändert. Bitte neu prüfen.",
      409
    );
  }
  if (!evaluation.session) {
    throw new StampSessionServiceError(
      "not_found",
      "Keine aktive persönliche Stempelung gefunden.",
      404
    );
  }
  if (
    input.allowAlreadyInTargetState &&
    ((input.action === "pause" && evaluation.currentState === "paused") ||
      (input.action === "resume" && evaluation.currentState === "running"))
  ) {
    return evaluation.session;
  }
  if (evaluation.blockingIssues.length) {
    throw new StampSessionServiceError(
      "conflict",
      evaluation.blockingIssues[0],
      409
    );
  }

  const current = rows[0];
  let updated: ActiveStampSession;
  if (input.action === "pause") {
    const startedAt =
      normalizeStoredStampDate(current.startedAt, input.now.getTime()) ??
      current.startedAt;
    const accumulatedMs =
      Number(current.accumulatedMs) +
      Math.max(0, input.now.getTime() - startedAt.getTime());
    updated = await input.tx.activeStampSession.update({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
      data: {
        accumulatedMs: BigInt(accumulatedMs),
        pauseStartedAt: input.now,
        updatedAt: input.now,
      },
    });
  } else {
    const pauseStartedAt =
      normalizeStoredStampDate(current.pauseStartedAt, input.now.getTime()) ??
      current.pauseStartedAt;
    const pauseMs =
      Number(current.pauseMs) +
      (pauseStartedAt
        ? Math.max(0, input.now.getTime() - pauseStartedAt.getTime())
        : 0);
    updated = await input.tx.activeStampSession.update({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
      data: {
        pauseMs: BigInt(pauseMs),
        startedAt: input.now,
        pauseStartedAt: null,
        updatedAt: input.now,
      },
    });
  }
  return toStampSessionSnapshot(updated, input.now.getTime());
}

export async function executeStampSessionTransition(input: {
  db?: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  action: StampSessionTransition;
  expectedFingerprint?: string;
  allowAlreadyInTargetState?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.db) {
    return executeInTransaction({ ...input, tx: input.db, now });
  }
  return prisma.$transaction(
    (tx) => executeInTransaction({ ...input, tx, now }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
