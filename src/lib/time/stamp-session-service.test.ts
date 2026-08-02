import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluateStampSessionTransition,
  executeStampSessionTransition,
  getStampSessionTransitionConfirmationText,
  matchesStampSessionTransitionConfirmation,
} from "@/lib/time/stamp-session-service";

const NOW = new Date("2026-08-02T10:00:00.000Z");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "stamp-1",
    organizationId: "org-1",
    userId: "user-1",
    employee: "Erika Muster",
    mode: "project",
    projectId: "project-1",
    projectLabel: "HAS-1 | Hausmeisterservice",
    trade: "Hausmeisterservice",
    planningEntryId: null,
    planningBillingGroupId: null,
    billingCatalogItemId: null,
    billingCatalogItemLabel: null,
    marketingContentItemId: null,
    marketingContentTitle: null,
    marketingContentType: null,
    comment: "Kontrolle am Objekt",
    startedAt: new Date("2026-08-02T09:30:00.000Z"),
    accumulatedMs: BigInt(0),
    pauseStartedAt: null,
    pauseMs: BigInt(0),
    createdAt: new Date("2026-08-02T09:30:00.000Z"),
    updatedAt: new Date("2026-08-02T09:30:00.000Z"),
    ...overrides,
  };
}

describe("stamp-session-service", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("evaluates a personal running session for pausing", async () => {
    const db = {
      activeStampSession: {
        findUnique: vi.fn().mockResolvedValue(session()),
      },
    } as never;
    const evaluation = await evaluateStampSessionTransition({
      db,
      organizationId: "org-1",
      userId: "user-1",
      action: "pause",
      now: NOW,
    });
    expect(evaluation.currentState).toBe("running");
    expect(evaluation.targetState).toBe("paused");
    expect(evaluation.blockingIssues).toEqual([]);
    expect(evaluation.displayElapsedMs).toBe(1_800_000);
    expect(evaluation.displayPauseMs).toBe(0);
    expect(evaluation.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(evaluation.session?.projectLabel).toBe("HAS-1 | Hausmeisterservice");
  });

  it("fails closed if the requested state is already active", async () => {
    const db = {
      activeStampSession: {
        findUnique: vi.fn().mockResolvedValue(
          session({ pauseStartedAt: new Date("2026-08-02T09:50:00.000Z") })
        ),
      },
    } as never;
    const evaluation = await evaluateStampSessionTransition({
      db,
      organizationId: "org-1",
      userId: "user-1",
      action: "pause",
      now: NOW,
    });
    expect(evaluation.blockingIssues).toEqual([
      "Die persönliche Stempelung ist bereits pausiert.",
    ]);
    expect(evaluation.displayPauseMs).toBe(600_000);
  });

  it("requires exact confirmation phrases", () => {
    expect(getStampSessionTransitionConfirmationText("pause")).toBe(
      "STEMPELUNG PAUSIEREN"
    );
    expect(getStampSessionTransitionConfirmationText("resume")).toBe(
      "STEMPELUNG FORTSETZEN"
    );
    expect(
      matchesStampSessionTransitionConfirmation("pause", " STEMPELUNG PAUSIEREN ")
    ).toBe(true);
    expect(
      matchesStampSessionTransitionConfirmation("pause", "Stempelung pausieren")
    ).toBe(false);
  });

  it("pauses atomically and accumulates only active time", async () => {
    const current = session();
    const updated = session({
      accumulatedMs: BigInt(1_800_000),
      pauseStartedAt: NOW,
      updatedAt: NOW,
    });
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([current]),
      activeStampSession: {
        update: vi.fn().mockResolvedValue(updated),
      },
    } as never;
    const result = await executeStampSessionTransition({
      db: tx,
      organizationId: "org-1",
      userId: "user-1",
      action: "pause",
      now: NOW,
    });
    expect(result.accumulatedMs).toBe(1_800_000);
    expect(result.pauseStartedAt).toBe(NOW.toISOString());
  });

  it("resumes atomically and accumulates pause time", async () => {
    const current = session({
      accumulatedMs: BigInt(1_200_000),
      pauseStartedAt: new Date("2026-08-02T09:50:00.000Z"),
      pauseMs: BigInt(300_000),
    });
    const updated = session({
      startedAt: NOW,
      accumulatedMs: BigInt(1_200_000),
      pauseStartedAt: null,
      pauseMs: BigInt(900_000),
      updatedAt: NOW,
    });
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([current]),
      activeStampSession: {
        update: vi.fn().mockResolvedValue(updated),
      },
    } as never;
    const result = await executeStampSessionTransition({
      db: tx,
      organizationId: "org-1",
      userId: "user-1",
      action: "resume",
      now: NOW,
    });
    expect(result.pauseMs).toBe(900_000);
    expect(result.pauseStartedAt).toBeNull();
    expect(result.startedAt).toBe(NOW.toISOString());
  });

  it("rejects stale previews before writing", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([session()]),
      activeStampSession: { update: vi.fn() },
    } as never;
    await expect(
      executeStampSessionTransition({
        db: tx,
        organizationId: "org-1",
        userId: "user-1",
        action: "pause",
        expectedFingerprint: "not-current",
        now: NOW,
      })
    ).rejects.toMatchObject({
      code: "stale_context",
      status: 409,
    });
    expect((tx as { activeStampSession: { update: ReturnType<typeof vi.fn> } }).activeStampSession.update).not.toHaveBeenCalled();
  });

  it("preserves idempotent target-state responses for the normal stamp route", async () => {
    const paused = session({ pauseStartedAt: new Date("2026-08-02T09:59:00.000Z") });
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([paused]),
      activeStampSession: { update: vi.fn() },
    } as never;
    const result = await executeStampSessionTransition({
      db: tx,
      organizationId: "org-1",
      userId: "user-1",
      action: "pause",
      allowAlreadyInTargetState: true,
      now: NOW,
    });
    expect(result.pauseStartedAt).toBe("2026-08-02T09:59:00.000Z");
    expect((tx as { activeStampSession: { update: ReturnType<typeof vi.fn> } }).activeStampSession.update).not.toHaveBeenCalled();
  });
});
