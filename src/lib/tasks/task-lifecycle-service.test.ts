import { TaskStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  evaluateTaskLifecycle,
  executeTaskLifecycle,
  getTaskLifecycleConfirmationText,
  matchesTaskLifecycleConfirmation,
} from "@/lib/tasks/task-lifecycle-service";

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    title: "Fenster prüfen",
    description: "Prüfung im Objekt",
    status: TaskStatus.OFFEN,
    priority: "NORMAL",
    deadline: new Date("2026-08-12T10:00:00.000Z"),
    customer: "Musterkunde",
    projectId: "project-1",
    ownerId: "owner-1",
    updatedAt: new Date("2026-08-01T08:00:00.000Z"),
    archiveReason: null,
    completedAt: null,
    owner: { firstName: "Erika", lastName: "Muster" },
    ...overrides,
  };
}

function dbFor(source = task(), options: {
  comments?: number;
  participants?: number;
  links?: number;
  timeEntries?: number;
  runningTimeEntries?: number;
  childTasks?: number;
  timeline?: unknown;
} = {}) {
  return {
    task: {
      findFirst: vi.fn().mockResolvedValue(source),
      count: vi.fn().mockResolvedValue(options.childTasks || 0),
    },
    taskComment: { count: vi.fn().mockResolvedValue(options.comments || 0) },
    taskParticipant: { count: vi.fn().mockResolvedValue(options.participants || 0) },
    taskLink: { count: vi.fn().mockResolvedValue(options.links || 0) },
    timeEntry: {
      count: vi.fn().mockImplementation(({ where }: { where: { stoppedAt?: null } }) =>
        Promise.resolve(Object.prototype.hasOwnProperty.call(where, "stoppedAt") ? options.runningTimeEntries || 0 : options.timeEntries || 0)
      ),
    },
    statusTimelineEntry: { findFirst: vi.fn().mockResolvedValue(options.timeline || null) },
    workPilotProject: {
      findFirst: vi.fn().mockResolvedValue({ projectNumber: "GLR-449", title: "Glasreinigung" }),
    },
  } as never;
}

describe("task lifecycle service", () => {
  it("requires exact action-specific confirmation phrases", () => {
    expect(getTaskLifecycleConfirmationText("Fenster prüfen", "archive")).toBe("AUFGABE ARCHIVIEREN Fenster prüfen");
    expect(getTaskLifecycleConfirmationText("Fenster prüfen", "restore")).toBe("AUFGABE WIEDERHERSTELLEN Fenster prüfen");
    expect(matchesTaskLifecycleConfirmation("Fenster prüfen", "archive", "AUFGABE ARCHIVIEREN Fenster prüfen")).toBe(true);
    expect(matchesTaskLifecycleConfirmation("Fenster prüfen", "archive", "Aufgabe archivieren Fenster prüfen")).toBe(false);
  });

  it("previews a reversible archive while preserving all linked evidence", async () => {
    const result = await evaluateTaskLifecycle({
      organizationId: "org-1",
      taskId: "task-1",
      action: "archive",
      reason: "Doppelt angelegt",
      db: dbFor(task(), { comments: 2, participants: 3, links: 1, timeEntries: 4, childTasks: 1 }),
    });
    expect(result.blockingIssues).toEqual([]);
    expect(result.warnings.join(" ")).toContain("niemals physisch gelöscht");
    expect(result.warnings.join(" ")).toContain("2 Kommentar(e), 3 Beteiligte, 1 Link(s) und 4 Zeiteintrag");
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks lifecycle changes while a time entry is running", async () => {
    const result = await evaluateTaskLifecycle({
      organizationId: "org-1",
      taskId: "task-1",
      action: "archive",
      reason: "Nicht mehr benötigt",
      db: dbFor(task(), { timeEntries: 1, runningTimeEntries: 1 }),
    });
    expect(result.blockingIssues.join(" ")).toContain("laufende Zeiterfassung");
  });

  it("restores the exact status documented by the archive marker", async () => {
    const result = await evaluateTaskLifecycle({
      organizationId: "org-1",
      taskId: "task-1",
      action: "restore",
      reason: "Irrtümlich archiviert",
      db: dbFor(task({ status: TaskStatus.ARCHIVIERT, archiveReason: "Doppelt · Vorheriger Status: IN_BEARBEITUNG" })),
    });
    expect(result.previousStatus).toBe(TaskStatus.IN_BEARBEITUNG);
    expect(result.blockingIssues).toEqual([]);
  });

  it("supports documented legacy archives through the status timeline", async () => {
    const result = await evaluateTaskLifecycle({
      organizationId: "org-1",
      taskId: "task-1",
      action: "restore",
      reason: "Wieder aktiv",
      db: dbFor(task({ status: TaskStatus.ARCHIVIERT }), {
        timeline: { id: "timeline-1", fromStatus: "wartet auf rückmeldung", startedAt: new Date("2026-08-01T09:00:00.000Z") },
      }),
    });
    expect(result.previousStatus).toBe(TaskStatus.WARTET_AUF_RUECKMELDUNG);
    expect(result.blockingIssues).toEqual([]);
  });

  it("fails closed for an undocumented legacy archive", async () => {
    const result = await evaluateTaskLifecycle({
      organizationId: "org-1",
      taskId: "task-1",
      action: "restore",
      reason: "Wieder aktiv",
      db: dbFor(task({ status: TaskStatus.ARCHIVIERT })),
    });
    expect(result.blockingIssues.join(" ")).toContain("nicht zuverlässig dokumentiert");
  });

  it("executes once and writes history plus timeline without deleting related data", async () => {
    const source = task();
    const baseDb = dbFor(source) as any;
    const tx = {
      ...baseDb,
      $executeRaw: vi.fn().mockResolvedValue(1),
      task: {
        findFirst: vi.fn().mockResolvedValue(source),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue({ ...source, status: TaskStatus.ARCHIVIERT }),
      },
      statusTimelineEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "timeline-1" }),
      },
      statusEscalationEvent: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as any;
    const preview = await evaluateTaskLifecycle({
      organizationId: "org-1", taskId: "task-1", action: "archive", reason: "Doppelt", db: tx,
    });
    await executeTaskLifecycle({
      tx,
      organizationId: "org-1",
      taskId: "task-1",
      action: "archive",
      reason: "Doppelt",
      actorId: "user-1",
      actorName: "GF Test",
      expectedFingerprint: preview.fingerprint,
      source: "jarvis",
    });
    expect(tx.task.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.statusTimelineEntry.create).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect((tx as Record<string, unknown>).taskComment).not.toHaveProperty("deleteMany");
  });

  it("fails closed when the preview fingerprint is stale", async () => {
    const source = task();
    const baseDb = dbFor(source) as any;
    const tx = { ...baseDb, $executeRaw: vi.fn().mockResolvedValue(1) } as any;
    await expect(executeTaskLifecycle({
      tx,
      organizationId: "org-1",
      taskId: "task-1",
      action: "archive",
      reason: "Doppelt",
      actorId: "user-1",
      actorName: "GF Test",
      expectedFingerprint: "0".repeat(64),
      source: "jarvis",
    })).rejects.toMatchObject({ code: "stale_context" });
  });
});
