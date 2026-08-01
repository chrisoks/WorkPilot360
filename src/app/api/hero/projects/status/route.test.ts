import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  canManageProjects: vi.fn(),
  evaluateProjectStatusChange: vi.fn(),
  executeProjectStatusChange: vi.fn(),
  getProjectStatusConfirmationText: vi.fn(),
  matchesProjectStatusConfirmation: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({ getDemoContext: mocks.getDemoContext }));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));
vi.mock("@/lib/permissions", () => ({ canManageProjects: mocks.canManageProjects }));
vi.mock("@/lib/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/projects/project-status-service", () => ({
  ProjectStatusServiceError: class ProjectStatusServiceError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  },
  evaluateProjectStatusChange: mocks.evaluateProjectStatusChange,
  executeProjectStatusChange: mocks.executeProjectStatusChange,
  getProjectStatusConfirmationText: mocks.getProjectStatusConfirmationText,
  matchesProjectStatusConfirmation: mocks.matchesProjectStatusConfirmation,
}));

import { PATCH, POST } from "@/app/api/hero/projects/status/route";

const actor = {
  id: "leader-1",
  role: "FUEHRUNGSKRAFT",
  firstName: "Lea",
  lastName: "Leitung",
  email: "lea@example.test",
};
const evaluation = {
  reason: "Angebotsphase wurde eröffnet",
  targetStatus: "Angebot",
  project: {
    id: "project-1",
    projectNumber: "GLR-449",
    title: "Glasreinigung",
    customer: "OKW",
    currentStatus: "Lead / Klärung",
    projectKind: "Einmalprojekt",
    projectType: "Glasreinigung",
    runtimeUntil: "",
    responsibleName: "Lea Leitung",
    updatedAt: "2026-08-01T20:00:00.000Z",
  },
  evidence: {
    activeOffers: 0,
    confirmedPlanningEntries: 0,
    projectTimeEntries: 0,
    runningStampSessions: 0,
    finalInspections: 0,
    activeFinalInvoices: 0,
    openTasks: 0,
  },
  checks: [],
  warnings: [],
  blockingIssues: [],
  fingerprint: "a".repeat(64),
};

function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
  return new Request("http://localhost/api/hero/projects/status", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("controlled project-status API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({ organization: { id: "org-1" }, users: [actor] });
    mocks.getSessionBoundActor.mockResolvedValue({ ok: true, sessionId: "session-1", actor });
    mocks.canManageProjects.mockReturnValue(true);
    mocks.evaluateProjectStatusChange.mockResolvedValue(evaluation);
    mocks.getProjectStatusConfirmationText.mockReturnValue("PROJEKTSTATUS GLR-449 AUF Angebot");
    mocks.matchesProjectStatusConfirmation.mockReturnValue(true);
    mocks.executeProjectStatusChange.mockResolvedValue({
      project: { id: "project-1", projectNumber: "GLR-449", status: "Angebot" },
      replayed: false,
    });
    mocks.transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({ tx: true }));
  });

  it("returns a side-effect-free preview and exact confirmation text", async () => {
    const response = await POST(request("POST", {
      actorId: "leader-1",
      projectId: "project-1",
      targetStatus: "Angebot",
      reason: "Angebotsphase wurde eröffnet",
    }));
    const body = await response!.json();

    expect(response!.status).toBe(200);
    expect(body).toMatchObject({ evaluation: { fingerprint: "a".repeat(64) }, requiredText: "PROJEKTSTATUS GLR-449 AUF Angebot" });
    expect(mocks.executeProjectStatusChange).not.toHaveBeenCalled();
  });

  it("fails closed on a wrong critical confirmation", async () => {
    mocks.matchesProjectStatusConfirmation.mockReturnValue(false);
    const response = await PATCH(request("PATCH", {
      actorId: "leader-1",
      projectId: "project-1",
      targetStatus: "Angebot",
      reason: "Angebotsphase wurde eröffnet",
      fingerprint: "a".repeat(64),
      confirmationText: "ja",
      requestId: "request-1",
    }));
    const body = await response!.json();

    expect(response!.status).toBe(400);
    expect(body.code).toBe("invalid_input");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("executes the verified transition transactionally with the session actor", async () => {
    const response = await PATCH(request("PATCH", {
      actorId: "leader-1",
      projectId: "project-1",
      targetStatus: "Angebot",
      reason: "Angebotsphase wurde eröffnet",
      fingerprint: "a".repeat(64),
      confirmationText: "PROJEKTSTATUS GLR-449 AUF Angebot",
      requestId: "request-1",
    }));
    const body = await response!.json();

    expect(response!.status).toBe(200);
    expect(body).toMatchObject({ project: { id: "project-1", status: "Angebot" }, replayed: false });
    expect(mocks.executeProjectStatusChange).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      projectId: "project-1",
      targetStatus: "Angebot",
      actorId: "leader-1",
      actorName: "Lea Leitung",
      requestId: "request-1",
      expectedFingerprint: "a".repeat(64),
      source: "ui",
    }));
  });

  it("rejects actors without project-management permission", async () => {
    mocks.canManageProjects.mockReturnValue(false);
    const response = await POST(request("POST", { actorId: "leader-1" }));
    expect(response!.status).toBe(403);
    expect(mocks.evaluateProjectStatusChange).not.toHaveBeenCalled();
  });
});
