import { describe, expect, it, vi } from "vitest";
import {
  evaluateProjectStatusChange,
  executeProjectStatusChange,
  getProjectStatusConfirmationText,
  matchesProjectStatusConfirmation,
  normalizeProjectOperationalStatus,
  ProjectStatusServiceError,
} from "@/lib/projects/project-status-service";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    projectNumber: "GLR-449",
    title: "Glasreinigung",
    customer: "Musterkunde",
    status: "Zur Planung bereit",
    projectKind: "einmaliges Projekt",
    projectType: "OK solutions",
    projectRuntimeUntil: "2026-08",
    responsibleName: "Christian Eid",
    timeBudgetEnabled: false,
    autoBillingEnabled: false,
    updatedAt: new Date("2026-08-01T08:00:00.000Z"),
    ...overrides,
  };
}

function db(options: {
  project?: ReturnType<typeof project> | null;
  planning?: number;
  times?: number;
  running?: number;
  inspections?: number;
  invoices?: number;
  tasks?: number;
  offers?: Array<{ id: string; status: string; updatedAt: Date }>;
} = {}) {
  const currentProject = options.project === undefined ? project() : options.project;
  return {
    workPilotProject: {
      findFirst: vi.fn().mockResolvedValue(currentProject),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: vi.fn().mockResolvedValue({ ...currentProject, status: "Geplant" }),
    },
    offer: { findMany: vi.fn().mockResolvedValue(options.offers ?? [{ id: "offer-1", status: "Erstellt", updatedAt: new Date("2026-08-01T07:00:00.000Z") }]) },
    planningEntry: { count: vi.fn().mockResolvedValue(options.planning ?? 1) },
    projectTimeEntry: { count: vi.fn().mockResolvedValue(options.times ?? 0) },
    activeStampSession: { count: vi.fn().mockResolvedValue(options.running ?? 0) },
    projectLogbookEntry: {
      count: vi.fn().mockResolvedValue(options.inspections ?? 0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
    invoice: { count: vi.fn().mockResolvedValue(options.invoices ?? 0) },
    task: { count: vi.fn().mockResolvedValue(options.tasks ?? 2) },
    statusTimelineEntry: {
      findFirst: vi.fn().mockResolvedValue({ id: "timeline-open", toStatus: "Zur Planung bereit", startedAt: new Date("2026-08-01T06:00:00.000Z") }),
      create: vi.fn().mockResolvedValue({ id: "timeline-new" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    statusEscalationEvent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("project status service", () => {
  it("normalizes only the approved operational statuses", () => {
    expect(normalizeProjectOperationalStatus("in Umsetzung")).toBe("Umsetzung");
    expect(normalizeProjectOperationalStatus("Endkontrolle")).toBe("Abrechnungsprüfung");
    expect(normalizeProjectOperationalStatus("Archiviert")).toBe("");
  });

  it("requires exact case-sensitive confirmation text", () => {
    const required = getProjectStatusConfirmationText("GLR-449", "Geplant");
    expect(required).toBe("PROJEKTSTATUS GLR-449 AUF Geplant");
    expect(matchesProjectStatusConfirmation("GLR-449", "Geplant", required)).toBe(true);
    expect(matchesProjectStatusConfirmation("GLR-449", "Geplant", required.toLowerCase())).toBe(false);
  });

  it("builds a ready evidence-bound transition", async () => {
    const evaluation = await evaluateProjectStatusChange({
      organizationId: "org-1",
      projectId: "project-1",
      targetStatus: "Geplant",
      reason: "Termin mit dem Kunden bestätigt",
      db: db() as never,
    });
    expect(evaluation.blockingIssues).toEqual([]);
    expect(evaluation.evidence).toMatchObject({ confirmedPlanningEntries: 1, activeOffers: 1, openTasks: 2 });
    expect(evaluation.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks unsupported evidence-free terminal transitions", async () => {
    const database = db({ planning: 0, times: 0, inspections: 0, invoices: 0 });
    const planned = await evaluateProjectStatusChange({ organizationId: "org-1", projectId: "project-1", targetStatus: "Geplant", reason: "Planung", db: database as never });
    const billing = await evaluateProjectStatusChange({ organizationId: "org-1", projectId: "project-1", targetStatus: "Zur Abrechnung bereit", reason: "Fertig", db: database as never });
    const closed = await evaluateProjectStatusChange({ organizationId: "org-1", projectId: "project-1", targetStatus: "Abgeschlossen", reason: "Fertig", db: database as never });
    expect(planned.blockingIssues.join(" ")).toContain("Planungstermin");
    expect(billing.blockingIssues.join(" ")).toContain("Endkontrolle");
    expect(closed.blockingIssues.join(" ")).toContain("Abschlussrechnung");
  });

  it("changes only status and writes timeline, logbook and audit atomically", async () => {
    const transaction = db();
    const evaluation = await evaluateProjectStatusChange({ organizationId: "org-1", projectId: "project-1", targetStatus: "Geplant", reason: "Termin bestätigt", db: transaction as never });
    const result = await executeProjectStatusChange({
      tx: transaction as never,
      organizationId: "org-1",
      projectId: "project-1",
      targetStatus: "Geplant",
      reason: "Termin bestätigt",
      actorId: "user-1",
      actorName: "Christian Eid",
      requestId: "request-1",
      expectedFingerprint: evaluation.fingerprint,
      source: "jarvis",
    });
    expect(result.replayed).toBe(false);
    expect(transaction.workPilotProject.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "Geplant" }) }));
    expect(transaction.statusTimelineEntry.create).toHaveBeenCalledTimes(1);
    expect(transaction.projectLogbookEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: "project-status", callReference: "request-1" }) }));
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "project.status.changed" }) }));
  });

  it("fails closed when the evidence fingerprint became stale", async () => {
    const transaction = db();
    await expect(executeProjectStatusChange({
      tx: transaction as never,
      organizationId: "org-1",
      projectId: "project-1",
      targetStatus: "Geplant",
      reason: "Termin bestätigt",
      actorId: "user-1",
      actorName: "Christian Eid",
      requestId: "request-1",
      expectedFingerprint: "0".repeat(64),
      source: "jarvis",
    })).rejects.toMatchObject({ code: "stale_context" } satisfies Partial<ProjectStatusServiceError>);
    expect(transaction.workPilotProject.updateMany).not.toHaveBeenCalled();
  });
});
