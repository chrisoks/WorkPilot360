import { describe, expect, it, vi } from "vitest";
import {
  evaluateProjectMasterDataChange,
  executeProjectMasterDataChange,
  getProjectMasterDataConfirmationText,
  matchesProjectMasterDataConfirmation,
} from "@/lib/projects/project-master-data-service";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    projectNumber: "GLR-449",
    title: "Glasreinigung",
    customer: "Musterkunde",
    status: "Zur Planung bereit",
    reviewStatus: "approved",
    description: "Alt",
    projectRuntimeFrom: "2026-08",
    projectRuntimeUntil: "2026-10",
    trade: "Glasreinigung",
    address: "Altstraße 1",
    participants: "",
    responsibleName: "Christian Eid",
    deputyName: "",
    deputyFrom: "",
    deputyUntil: "",
    updatedAt: new Date("2026-08-02T06:00:00.000Z"),
    ...overrides,
  };
}

function db(current = project()) {
  return {
    workPilotProject: {
      findFirst: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: vi.fn().mockResolvedValue({ ...current, title: "Neu" }),
    },
    workPilotProjectReviewHistory: { create: vi.fn().mockResolvedValue({ id: "history-1" }) },
    projectLogbookEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("project master data service", () => {
  it("requires an exact case-sensitive confirmation phrase", () => {
    const required = getProjectMasterDataConfirmationText("GLR-449");
    expect(required).toBe("PROJEKT ÄNDERN GLR-449");
    expect(matchesProjectMasterDataConfirmation("GLR-449", required)).toBe(true);
    expect(matchesProjectMasterDataConfirmation("GLR-449", required.toLowerCase())).toBe(false);
  });

  it("shows only actual changes and invalidates an approved review", async () => {
    const evaluation = await evaluateProjectMasterDataChange({
      organizationId: "org-1",
      projectId: "project-1",
      changes: { title: "Glasreinigung West", description: "Alt" },
      db: db() as never,
    });
    expect(evaluation.changes).toEqual([
      { field: "title", label: "Projekttitel", before: "Glasreinigung", after: "Glasreinigung West" },
    ]);
    expect(evaluation.reviewWillBeInvalidated).toBe(true);
    expect(evaluation.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks invalid month ranges and archived projects", async () => {
    const invalidRange = await evaluateProjectMasterDataChange({
      organizationId: "org-1",
      projectId: "project-1",
      changes: { projectRuntimeFrom: "2026-12" },
      db: db() as never,
    });
    expect(invalidRange.blockingIssues.join(" ")).toContain("nach dem Laufzeitende");
    await expect(
      evaluateProjectMasterDataChange({
        organizationId: "org-1",
        projectId: "project-1",
        changes: { title: "Neu" },
        db: db(project({ status: "Archiviert" })) as never,
      })
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("updates only the requested fields and writes logbook, audit and review history", async () => {
    const transaction = db();
    const evaluation = await evaluateProjectMasterDataChange({
      organizationId: "org-1",
      projectId: "project-1",
      changes: { title: "Neu" },
      db: transaction as never,
    });
    const result = await executeProjectMasterDataChange({
      tx: transaction as never,
      organizationId: "org-1",
      projectId: "project-1",
      changes: { title: "Neu" },
      actorId: "user-1",
      actorName: "Christian Eid",
      requestId: "request-1",
      expectedFingerprint: evaluation.fingerprint,
      source: "jarvis",
    });
    expect(result.replayed).toBe(false);
    expect(transaction.workPilotProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "Neu", reviewStatus: "needs_review" }) })
    );
    expect(transaction.workPilotProjectReviewHistory.create).toHaveBeenCalledTimes(1);
    expect(transaction.projectLogbookEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: "project-master-data", callReference: "request-1" }) })
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "project.master-data.changed" }) })
    );
  });

  it("replays exactly once through the project logbook idempotency key", async () => {
    const transaction = db();
    transaction.projectLogbookEntry.findFirst.mockResolvedValueOnce({ id: "existing" });
    const result = await executeProjectMasterDataChange({
      tx: transaction as never,
      organizationId: "org-1",
      projectId: "project-1",
      changes: { title: "Neu" },
      actorId: "user-1",
      actorName: "Christian Eid",
      requestId: "request-1",
      source: "jarvis",
    });
    expect(result.replayed).toBe(true);
    expect(transaction.workPilotProject.updateMany).not.toHaveBeenCalled();
  });
});
