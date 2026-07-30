import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  evaluatePlanningBatch: vi.fn(),
  executePlanningBatch: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: mocks.getDemoContext,
}));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));
vi.mock("@/lib/planning/planning-batch-service", () => ({
  evaluatePlanningBatch: mocks.evaluatePlanningBatch,
  executePlanningBatch: mocks.executePlanningBatch,
  isPlanningBatchError: () => false,
}));

import { POST } from "@/app/api/planning-batches/route";

const actor = {
  id: "actor-1",
  organizationId: "org-1",
  role: "GESCHAEFTSFUEHRER",
  isActive: true,
};
const planning = {
  requestId: "request-1",
  projectId: "project-1",
  expectedProjectUpdatedAt: "2026-07-30T12:00:00.000Z",
  approvalStatus: "confirmed",
  assigneeIds: ["user-1", "user-2"],
  title: "Gemeinsamer Kundentermin",
  description: "Ausführung mit zwei Mitarbeitenden",
  startAt: "2026-08-03T08:00:00.000Z",
  endAt: "2026-08-03T10:00:00.000Z",
  recurrence: {
    type: "weekly",
    until: "2026-08-31",
    weekdays: [1],
  },
};

function request(body: unknown) {
  return new Request("https://workpilot.example/api/planning-batches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("planning batch API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({
      organization: {
        id: "org-1",
        timezone: "Europe/Berlin",
      },
      users: [actor],
    });
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor,
      sessionUserId: actor.id,
      sessionId: "session-1",
      isImpersonating: false,
    });
    mocks.evaluatePlanningBatch.mockResolvedValue({
      entryCount: 10,
      overbooking: { required: false, fingerprint: null, details: [] },
    });
    mocks.executePlanningBatch.mockResolvedValue({
      batchId: "batch-1",
      requestId: planning.requestId,
      entryCount: 10,
    });
  });

  it("binds preflight to the authenticated organization and actor", async () => {
    const response = await POST(
      request({
        command: "preflight",
        source: "manual",
        actorUserId: actor.id,
        planning,
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.evaluatePlanningBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        timezone: "Europe/Berlin",
        actor,
        request: expect.objectContaining({
          assigneeIds: ["user-1", "user-2"],
        }),
      })
    );
  });

  it("executes only the validated payload and keeps the declared source", async () => {
    const response = await POST(
      request({
        command: "execute",
        source: "jarvis",
        actorUserId: actor.id,
        planning,
      })
    );
    expect(response.status).toBe(201);
    expect(mocks.executePlanningBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actor,
        source: "jarvis",
        request: expect.objectContaining({ requestId: "request-1" }),
      })
    );
  });

  it("rejects duplicate assignees before any planning write", async () => {
    const response = await POST(
      request({
        command: "execute",
        source: "manual",
        planning: {
          ...planning,
          assigneeIds: ["user-1", "user-1"],
        },
      })
    );
    expect(response.status).toBe(400);
    expect(mocks.executePlanningBatch).not.toHaveBeenCalled();
  });

  it("propagates a failed session binding without evaluating the request", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Du darfst nicht als dieser Benutzer handeln.",
    });
    mocks.sessionBoundActorResponse.mockReturnValue(
      Response.json({ error: "forbidden" }, { status: 403 })
    );
    const response = await POST(
      request({
        command: "preflight",
        actorUserId: "forged-actor",
        planning,
      })
    );
    expect(response.status).toBe(403);
    expect(mocks.evaluatePlanningBatch).not.toHaveBeenCalled();
  });
});
