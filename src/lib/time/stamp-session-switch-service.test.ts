import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  evaluateStart: vi.fn(), executeStart: vi.fn(), evaluateStop: vi.fn(), executeStop: vi.fn(), transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/time/stamp-session-start-service", () => ({
  evaluateStampSessionStart: mocks.evaluateStart,
  executeStampSessionStart: mocks.executeStart,
}));
vi.mock("@/lib/time/stamp-session-stop-service", () => ({
  evaluateStampSessionStop: mocks.evaluateStop,
  executeStampSessionStop: mocks.executeStop,
  toStampSessionStopEntry: (entry: unknown) => entry,
}));
vi.mock("@/lib/time/stamp-session-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/time/stamp-session-service")>()),
  toStampSessionSnapshot: (session: unknown) => session,
}));

import {
  evaluateStampSessionSwitch,
  executeStampSessionSwitch,
  getStampSessionSwitchConfirmationText,
  matchesStampSessionSwitchConfirmation,
} from "@/lib/time/stamp-session-switch-service";

const NOW = new Date("2026-08-02T12:00:00.000Z");
const stopEvaluation = {
  session: { id: "old-session", mode: "project" }, project: { projectNumber: "HAS-1" },
  effective: { completionStatus: "finished" }, fingerprint: "stop-fingerprint", warnings: [], blockingIssues: [],
};
const startEvaluation = {
  project: { projectNumber: "GLR-449" }, effective: { mode: "project", projectLabel: "GLR-449 | Glasreinigung" },
  fingerprint: "start-fingerprint", warnings: [], blockingIssues: [],
};
const change = {
  stop: { completionStatus: "finished" as const, comment: "Fertig", interruptionReason: "" },
  start: { mode: "project" as const, projectId: "next-project", comment: "Fenster reinigen" },
};

describe("stamp-session-switch-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evaluateStop.mockResolvedValue(stopEvaluation);
    mocks.evaluateStart.mockResolvedValue(startEvaluation);
    mocks.executeStop.mockResolvedValue({ entry: { id: "switch-1:stop" } });
    mocks.executeStart.mockResolvedValue({ session: { id: "switch-1:start" } });
  });

  it("binds both evaluations and requires an exact target phrase", async () => {
    const evaluation = await evaluateStampSessionSwitch({ organizationId: "org-1", userId: "user-1", change, now: NOW });
    expect(mocks.evaluateStart).toHaveBeenCalledWith(expect.objectContaining({ replaceActiveSessionId: "old-session" }));
    expect(evaluation.blockingIssues).toEqual([]);
    expect(getStampSessionSwitchConfirmationText(evaluation)).toBe("STEMPELUNG WECHSELN ZU GLR-449");
    expect(matchesStampSessionSwitchConfirmation(evaluation, "STEMPELUNG WECHSELN ZU GLR-449")).toBe(true);
    expect(matchesStampSessionSwitchConfirmation(evaluation, "Stempelung wechseln zu GLR-449")).toBe(false);
  });

  it("blocks an interrupted switch straight back onto the same project", async () => {
    mocks.evaluateStop.mockResolvedValueOnce({
      ...stopEvaluation,
      session: { id: "old-session", mode: "project", projectId: "same-project" },
      effective: { completionStatus: "interrupted" },
    });
    mocks.evaluateStart.mockResolvedValueOnce({
      ...startEvaluation,
      effective: { ...startEvaluation.effective, projectId: "same-project" },
    });
    const evaluation = await evaluateStampSessionSwitch({ organizationId: "org-1", userId: "user-1", change, now: NOW });
    expect(evaluation.blockingIssues).toContainEqual(expect.stringContaining("demselben Projekt"));
  });

  it("stops and starts inside one transaction with deterministic ids", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      projectTimeEntry: { findFirst: vi.fn().mockResolvedValue(null) },
      activeStampSession: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    mocks.transaction.mockImplementation(async (callback: (value: unknown) => unknown) => callback(tx));
    const preview = await evaluateStampSessionSwitch({ organizationId: "org-1", userId: "user-1", change, now: NOW });
    const result = await executeStampSessionSwitch({ organizationId: "org-1", userId: "user-1", actorName: "Erika Muster", change, expectedFingerprint: preview.fingerprint, requestId: "switch-1", source: "jarvis", now: NOW });
    expect(result.replayed).toBe(false);
    expect(mocks.executeStop).toHaveBeenCalledWith(expect.objectContaining({ db: tx, requestId: "switch-1:stop", expectedFingerprint: "stop-fingerprint" }));
    expect(mocks.executeStart).toHaveBeenCalledWith(expect.objectContaining({ db: tx, sessionId: "switch-1:start", expectedFingerprint: "start-fingerprint" }));
  });

  it("returns the exact prior pair on replay and rejects a partial pair", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      projectTimeEntry: { findFirst: vi.fn().mockResolvedValue({ id: "switch-1:stop" }) },
      activeStampSession: { findFirst: vi.fn().mockResolvedValue({ id: "switch-1:start" }) },
    };
    mocks.transaction.mockImplementation(async (callback: (value: unknown) => unknown) => callback(tx));
    const replay = await executeStampSessionSwitch({ organizationId: "org-1", userId: "user-1", actorName: "Erika", change, requestId: "switch-1", source: "ui", now: NOW });
    expect(replay.replayed).toBe(true);
    expect(mocks.executeStop).not.toHaveBeenCalled();
    tx.activeStampSession.findFirst.mockResolvedValueOnce(null);
    await expect(executeStampSessionSwitch({ organizationId: "org-1", userId: "user-1", actorName: "Erika", change, requestId: "switch-1", source: "ui", now: NOW })).rejects.toMatchObject({ code: "conflict" });
  });
});
