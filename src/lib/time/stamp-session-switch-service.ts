import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import {
  evaluateStampSessionStart,
  executeStampSessionStart,
  type StampSessionStartInput,
} from "@/lib/time/stamp-session-start-service";
import {
  evaluateStampSessionStop,
  executeStampSessionStop,
  toStampSessionStopEntry,
  type StampSessionStopInput,
} from "@/lib/time/stamp-session-stop-service";
import {
  StampSessionServiceError,
  toStampSessionSnapshot,
} from "@/lib/time/stamp-session-service";

export type StampSessionSwitchInput = {
  stop: StampSessionStopInput;
  start: StampSessionStartInput;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function targetLabel(evaluation: Awaited<ReturnType<typeof evaluateStampSessionStart>>) {
  return evaluation.effective.mode === "project"
    ? evaluation.project?.projectNumber || "PROJEKT"
    : evaluation.effective.projectLabel.toLocaleUpperCase("de-DE");
}

export async function evaluateStampSessionSwitch(input: {
  db?: typeof prisma | Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  change: StampSessionSwitchInput;
  now?: Date;
}) {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const stop = await evaluateStampSessionStop({
    db,
    organizationId: input.organizationId,
    userId: input.userId,
    stop: input.change.stop,
    now,
  });
  const start = await evaluateStampSessionStart({
    db,
    organizationId: input.organizationId,
    userId: input.userId,
    start: input.change.start,
    replaceActiveSessionId: stop.session?.id,
    now,
  });
  const blockingIssues = [...new Set([...stop.blockingIssues, ...start.blockingIssues])];
  if (
    stop.effective.completionStatus === "interrupted" &&
    stop.session?.mode === "project" &&
    start.effective.mode === "project" &&
    stop.session.projectId === start.effective.projectId
  ) {
    blockingIssues.push("Eine unterbrochene Projektarbeit kann nicht unmittelbar als Folgetätigkeit auf demselben Projekt neu gestartet werden. Bitte fortsetzen oder einen anderen Arbeitsbezug wählen.");
  }
  const warnings = [...new Set([...stop.warnings, ...start.warnings])];
  const fingerprint = digest({ version: 1, userId: input.userId, stop: stop.fingerprint, start: start.fingerprint });
  return { action: "switch" as const, stop, start, fingerprint, blockingIssues, warnings };
}

export function getStampSessionSwitchConfirmationText(
  evaluation: Awaited<ReturnType<typeof evaluateStampSessionSwitch>>,
) {
  return `STEMPELUNG WECHSELN ZU ${targetLabel(evaluation.start)}`;
}

export function matchesStampSessionSwitchConfirmation(
  evaluation: Awaited<ReturnType<typeof evaluateStampSessionSwitch>>,
  value: string,
) {
  return value.trim() === getStampSessionSwitchConfirmationText(evaluation);
}

export async function executeStampSessionSwitch(input: {
  organizationId: string;
  userId: string;
  actorName: string;
  change: StampSessionSwitchInput;
  expectedFingerprint?: string;
  requestId: string;
  source: "ui" | "jarvis";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const stopRequestId = `${input.requestId}:stop`;
  const startSessionId = `${input.requestId}:start`;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`stamp-session:${input.organizationId}:${input.userId}`}, 0))`;
    const [previousEntry, existingNextSession] = await Promise.all([
      tx.projectTimeEntry.findFirst({ where: { id: stopRequestId, organizationId: input.organizationId, userId: input.userId, deletedAt: null } }),
      tx.activeStampSession.findFirst({ where: { id: startSessionId, organizationId: input.organizationId, userId: input.userId } }),
    ]);
    if (previousEntry && existingNextSession) {
      return {
        replayed: true,
        stopped: toStampSessionStopEntry(previousEntry),
        started: toStampSessionSnapshot(existingNextSession, now.getTime()),
        evaluation: null,
      };
    }
    if (previousEntry || existingNextSession) {
      throw new StampSessionServiceError("conflict", "Der Wechsel ist nur teilweise vorhanden und muss geprüft werden.", 409);
    }
    const evaluation = await evaluateStampSessionSwitch({ db: tx, organizationId: input.organizationId, userId: input.userId, change: input.change, now });
    if (input.expectedFingerprint && evaluation.fingerprint !== input.expectedFingerprint) {
      throw new StampSessionServiceError("stale_context", "Ausgangsstempelung oder Folgetätigkeit haben sich seit der Vorschau geändert.", 409);
    }
    if (evaluation.blockingIssues.length) {
      throw new StampSessionServiceError("conflict", evaluation.blockingIssues.join(" · "), 409);
    }
    const stopped = await executeStampSessionStop({ db: tx, organizationId: input.organizationId, userId: input.userId, actorName: input.actorName, stop: input.change.stop, expectedFingerprint: evaluation.stop.fingerprint, requestId: stopRequestId, source: input.source, now });
    const started = await executeStampSessionStart({ db: tx, organizationId: input.organizationId, userId: input.userId, actorName: input.actorName, start: input.change.start, expectedFingerprint: evaluation.start.fingerprint, requestId: `${input.requestId}:start-request`, sessionId: startSessionId, source: input.source, now });
    return { replayed: false, stopped: stopped.entry, started: started.session, evaluation };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
