import { describe, expect, it, vi } from "vitest";
import { evaluateProjectLifecycle, executeProjectLifecycle, getProjectLifecycleConfirmationText, matchesProjectLifecycleConfirmation, ProjectLifecycleServiceError } from "@/lib/projects/project-lifecycle-service";

function project(overrides: Record<string, unknown> = {}) {
  return { id: "project-1", projectNumber: "GLR-449", title: "Glasreinigung", customer: "OKW", status: "Abgeschlossen", updatedAt: new Date("2026-08-02T08:00:00.000Z"), ...overrides };
}

function db(options: { project?: ReturnType<typeof project>; planning?: number[]; running?: number; tasks?: number; timeline?: Record<string, unknown> | null; replay?: boolean } = {}) {
  const current = options.project ?? project();
  const planningPattern = options.planning ?? [2, 0];
  let planningIndex = 0;
  return {
    workPilotProject: { findFirst: vi.fn().mockResolvedValue(current), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findFirstOrThrow: vi.fn().mockResolvedValue(current) },
    offer: { findMany: vi.fn().mockResolvedValue([{ id: "offer-1", status: "Angenommen", updatedAt: new Date("2026-08-01T08:00:00.000Z") }]) },
    invoice: { findMany: vi.fn().mockResolvedValue([{ id: "invoice-1", status: "Fakturiert", isPaid: false, updatedAt: new Date("2026-08-01T09:00:00.000Z") }]) },
    planningEntry: { count: vi.fn().mockImplementation(() => Promise.resolve(planningPattern[planningIndex++ % planningPattern.length] ?? 0)) },
    projectTimeEntry: { count: vi.fn().mockResolvedValue(3) },
    activeStampSession: { count: vi.fn().mockResolvedValue(options.running ?? 0) },
    task: { count: vi.fn().mockResolvedValue(options.tasks ?? 0) },
    storedFile: { count: vi.fn().mockResolvedValue(4) },
    onlineRequest: { count: vi.fn().mockResolvedValue(1) },
    statusTimelineEntry: { findFirst: vi.fn().mockResolvedValue(options.timeline === undefined ? { id: "timeline-1", fromStatus: "Zur Abrechnung bereit", toStatus: current.status, startedAt: new Date("2026-08-02T07:00:00.000Z") } : options.timeline), create: vi.fn().mockResolvedValue({ id: "timeline-2" }) },
    projectLogbookEntry: { findFirst: vi.fn().mockResolvedValue(options.replay ? { id: "log-1" } : null), create: vi.fn().mockResolvedValue({ id: "log-2" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    statusEscalationEvent: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("project lifecycle service", () => {
  it("requires exact action-specific confirmation phrases", () => {
    expect(getProjectLifecycleConfirmationText("GLR-449", "archive")).toBe("PROJEKT ARCHIVIEREN GLR-449");
    expect(getProjectLifecycleConfirmationText("GLR-449", "restore")).toBe("PROJEKT WIEDERHERSTELLEN GLR-449");
    expect(matchesProjectLifecycleConfirmation("GLR-449", "archive", "PROJEKT ARCHIVIEREN GLR-449")).toBe(true);
    expect(matchesProjectLifecycleConfirmation("GLR-449", "archive", "projekt archivieren glr-449")).toBe(false);
  });

  it("shows all critical relations without mutating them", async () => {
    const evaluation = await evaluateProjectLifecycle({ organizationId: "org-1", projectId: "project-1", lifecycleAction: "archive", reason: "Aufbewahrung", db: db() as never });
    expect(evaluation.blockingIssues).toEqual([]);
    expect(evaluation.evidence).toMatchObject({ offers: 1, invoices: 1, planningEntries: 2, projectTimeEntries: 3, storedFiles: 4, onlineRequests: 1 });
    expect(evaluation.warnings.join(" ")).toContain("weder gelöscht noch umgehängt");
    expect(evaluation.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed for running stamps, future planning and open tasks", async () => {
    const evaluation = await evaluateProjectLifecycle({ organizationId: "org-1", projectId: "project-1", lifecycleAction: "archive", reason: "Aufbewahrung", db: db({ planning: [2, 1], running: 1, tasks: 2 }) as never });
    expect(evaluation.blockingIssues.join(" ")).toContain("laufende Stempelung");
    expect(evaluation.blockingIssues.join(" ")).toContain("zukünftige bestätigte Planung");
    expect(evaluation.blockingIssues.join(" ")).toContain("offene Aufgabe");
  });

  it("restores only the previous status proved by the open archive timeline", async () => {
    const database = db({ project: project({ status: "Archiviert" }), timeline: { id: "archive-timeline", fromStatus: "Abgeschlossen", toStatus: "Archiviert", startedAt: new Date("2026-08-02T07:00:00.000Z") } });
    const evaluation = await evaluateProjectLifecycle({ organizationId: "org-1", projectId: "project-1", lifecycleAction: "restore", reason: "Projekt wieder aktiv", db: database as never });
    expect(evaluation.project.restoreStatus).toBe("Abgeschlossen");
    const result = await executeProjectLifecycle({ tx: database as never, organizationId: "org-1", projectId: "project-1", lifecycleAction: "restore", reason: "Projekt wieder aktiv", actorId: "leader-1", actorName: "Lea Leitung", requestId: "request-restore", expectedFingerprint: evaluation.fingerprint, source: "jarvis" });
    expect(result.replayed).toBe(false);
    expect(database.workPilotProject.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "Abgeschlossen" }) }));
    expect(database.projectLogbookEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: "project-restore", callReference: "request-restore" }) }));
    expect(database.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "project.restored" }) }));
  });

  it("blocks legacy archives without reliable restore proof", async () => {
    const evaluation = await evaluateProjectLifecycle({ organizationId: "org-1", projectId: "project-1", lifecycleAction: "restore", reason: "Projekt wieder aktiv", db: db({ project: project({ status: "Archiviert" }), timeline: null }) as never });
    expect(evaluation.blockingIssues.join(" ")).toContain("nicht revisionssicher belegt");
  });

  it("rejects a stale evidence fingerprint before mutation", async () => {
    const database = db();
    await expect(executeProjectLifecycle({ tx: database as never, organizationId: "org-1", projectId: "project-1", lifecycleAction: "archive", reason: "Aufbewahrung", actorId: "leader-1", actorName: "Lea Leitung", requestId: "request-1", expectedFingerprint: "0".repeat(64), source: "ui" })).rejects.toMatchObject({ code: "stale_context" } satisfies Partial<ProjectLifecycleServiceError>);
    expect(database.workPilotProject.updateMany).not.toHaveBeenCalled();
  });
});
