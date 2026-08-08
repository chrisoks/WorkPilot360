import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/project-time-entry-service", () => ({
  getEmployeeHourlyCostRateSnapshot: vi.fn(async () => 42),
}));

vi.mock("@/lib/projects/project-status-service", () => ({
  executeProjectStatusChange: vi.fn(async () => ({
    project: { id: "project-1", status: "Arbeit unterbrochen" },
    replayed: false,
  })),
  ProjectStatusServiceError: class ProjectStatusServiceError extends Error {},
}));

import {
  evaluateStampSessionStop,
  executeStampSessionStop,
  getStampSessionStopConfirmationText,
  matchesStampSessionStopConfirmation,
} from "@/lib/time/stamp-session-stop-service";

const STARTED = new Date("2026-08-02T08:00:00.000Z");
const NOW = new Date("2026-08-02T10:00:00.000Z");

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "stamp-1",
    organizationId: "org-1",
    userId: "user-1",
    employee: "Erika Muster",
    mode: "project",
    projectId: "project-1",
    projectLabel: "HAS-1 | Hausmeisterservice",
    trade: "Hausmeisterservice",
    planningEntryId: "planning-1",
    planningBillingGroupId: "group-1",
    billingCatalogItemId: "service-1",
    billingCatalogItemLabel: "LR-10 | Facharbeiterstunde",
    marketingContentItemId: null,
    marketingContentTitle: null,
    marketingContentType: null,
    comment: "Treppenhaus reinigen",
    startedAt: STARTED,
    accumulatedMs: BigInt(0),
    pauseStartedAt: null,
    pauseMs: BigInt(0),
    createdAt: STARTED,
    updatedAt: STARTED,
    ...overrides,
  };
}

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    organizationId: "org-1",
    projectNumber: "HAS-1",
    title: "Hausmeisterservice",
    customer: "Kunde",
    status: "Umsetzung",
    projectKind: "Dauerläufer",
    recurringBillingMode: "hourly",
    branch: "OK solutions",
    projectType: "Projekt OK solutions",
    responsibleName: "Führungskraft",
    updatedAt: STARTED,
    ...overrides,
  };
}

function database(options: {
  active?: ReturnType<typeof activeSession> | null;
  existingEntry?: Record<string, unknown> | null;
  planningBreakWindows?: Record<string, { start: string; end: string }>;
} = {}) {
  const active = options.active === undefined ? activeSession() : options.active;
  const existingEntry = options.existingEntry ?? null;
  const createdEntry = {
    id: "stop-request-1",
    organizationId: "org-1",
    mode: active?.mode ?? "project",
    projectId: active?.projectId ?? "project-1",
    projectLabel: active?.projectLabel ?? null,
    trade: active?.trade ?? null,
    planningEntryId: active?.planningEntryId ?? null,
    planningBillingGroupId: active?.planningBillingGroupId ?? null,
    offerId: null,
    offerLabel: null,
    billingCatalogItemId: active?.billingCatalogItemId ?? null,
    billingCatalogItemLabel: active?.billingCatalogItemLabel ?? null,
    userId: "user-1",
    employee: "Erika Muster",
    entrySource: "stamped",
    date: "2026-08-02",
    startTime: "10:00",
    endTime: "12:00",
    durationMs: BigInt(7_200_000),
    pauseMs: BigInt(0),
    laborCostRateSnapshot: 42,
    laborCostSnapshot: 84,
    costSnapshotAt: NOW,
    comment: "Treppenhaus reinigen",
    invoiceId: null,
    invoiceNumber: null,
    invoicedAt: null,
    marketingContentItemId: null,
    marketingContentType: null,
    completionStatus: "finished",
    overtimeApprovalStatus: "not_required",
    overtimeApprovedByUserId: null,
    overtimeApprovedByName: null,
    overtimeApprovedAt: null,
    editHistory: [],
    createdAt: NOW,
    deletedAt: null,
  };
  const db = {
    $executeRaw: vi.fn(async () => 1),
    activeStampSession: {
      findUnique: vi.fn(async () => active),
      deleteMany: vi.fn(async () => ({ count: active ? 1 : 0 })),
    },
    workPilotProject: {
      findFirst: vi.fn(async () => (active?.mode === "project" ? project() : null)),
    },
    user: {
      findFirst: vi.fn(async () => active ? ({
        planningBreakWindows: options.planningBreakWindows ?? {},
        updatedAt: STARTED,
      }) : null),
    },
    projectTimeEntry: {
      findFirst: vi.fn(async () => existingEntry),
      create: vi.fn(async () => createdEntry),
    },
  };
  return { db, createdEntry };
}

describe("stamp-session-stop-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("warns when a running stamp omits the configured break", async () => {
    const { db } = database({
      planningBreakWindows: {
        sunday: { start: "11:00", end: "11:30" },
      },
    });
    const evaluation = await evaluateStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      stop: { completionStatus: "finished" },
      now: NOW,
    });

    expect(evaluation.scheduledBreakShortfallMinutes).toBe(30);
    expect(evaluation.requiresBreakConfirmation).toBe(true);
    expect(evaluation.warnings).toContainEqual(expect.stringContaining("30 Minuten"));
  });

  it("reconstructs the original wall-clock start after a recorded pause", async () => {
    const resumedAt = new Date("2026-08-02T09:30:00.000Z");
    const stoppedAt = new Date("2026-08-02T10:30:00.000Z");
    const { db } = database({
      active: activeSession({
        startedAt: resumedAt,
        accumulatedMs: BigInt(60 * 60_000),
        pauseMs: BigInt(30 * 60_000),
        updatedAt: resumedAt,
      }),
    });
    const evaluation = await evaluateStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      stop: { completionStatus: "finished" },
      now: stoppedAt,
    });

    expect(evaluation.effective.durationMs).toBe(2 * 3_600_000);
    expect(evaluation.effective.pauseMs).toBe(30 * 60_000);
    expect(evaluation.effective.startTime).toBe("10:00");
    expect(evaluation.effective.endTime).toBe("12:30");
  });

  it("keeps the stop fingerprint stable while elapsed display time grows", async () => {
    const { db } = database();
    const first = await evaluateStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      stop: { completionStatus: "finished" },
      now: NOW,
    });
    const later = await evaluateStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      stop: { completionStatus: "finished" },
      now: new Date(NOW.getTime() + 60_000),
    });
    expect(first.fingerprint).toBe(later.fingerprint);
    expect(later.effective.durationMs).toBe(first.effective.durationMs + 60_000);
    expect(getStampSessionStopConfirmationText(first)).toBe(
      "STEMPELUNG BEENDEN FERTIG HAS-1",
    );
    expect(
      matchesStampSessionStopConfirmation(
        first,
        "STEMPELUNG BEENDEN FERTIG HAS-1",
      ),
    ).toBe(true);
  });

  it("requires a reason for interrupted project work", async () => {
    const { db } = database();
    const evaluation = await evaluateStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      stop: { completionStatus: "interrupted" },
      now: NOW,
    });
    expect(evaluation.blockingIssues).toContain(
      "Bitte kurz begründen, warum die Arbeit unterbrochen wurde.",
    );
    expect(getStampSessionStopConfirmationText(evaluation)).toBe(
      "STEMPELUNG BEENDEN UNTERBROCHEN HAS-1",
    );
  });

  it("writes one stamped entry and removes the matching active session atomically", async () => {
    const { db } = database();
    const preview = await evaluateStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      stop: { completionStatus: "finished" },
      now: NOW,
    });
    const result = await executeStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      actorName: "Erika Muster",
      stop: { completionStatus: "finished" },
      expectedFingerprint: preview.fingerprint,
      requestId: "stop-request-1",
      source: "jarvis",
      now: NOW,
    });
    expect(result.replayed).toBe(false);
    expect(result.entry.id).toBe("stop-request-1");
    expect(db.projectTimeEntry.create).toHaveBeenCalledTimes(1);
    expect(db.activeStampSession.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "stamp-1", userId: "user-1" }),
    });
  });

  it("returns the correlated stamped entry on replay without touching the session", async () => {
    const previous = database().createdEntry;
    const { db } = database({ existingEntry: previous });
    const result = await executeStampSessionStop({
      db: db as never,
      organizationId: "org-1",
      userId: "user-1",
      actorName: "Erika Muster",
      stop: { completionStatus: "finished" },
      requestId: "stop-request-1",
      source: "jarvis",
      now: NOW,
    });
    expect(result.replayed).toBe(true);
    expect(result.entry.id).toBe("stop-request-1");
    expect(db.projectTimeEntry.create).not.toHaveBeenCalled();
    expect(db.activeStampSession.deleteMany).not.toHaveBeenCalled();
  });
});
