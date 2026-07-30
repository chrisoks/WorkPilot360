import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  createJarvisAccessProfile: vi.fn(),
  getJarvisActionDraft: vi.fn(),
  completeJarvisTaskDraft: vi.fn(),
  cancelJarvisTaskDraft: vi.fn(),
  confirmJarvisTaskDraft: vi.fn(),
  completeJarvisPlanningDraft: vi.fn(),
  cancelJarvisPlanningDraft: vi.fn(),
  confirmJarvisPlanningDraft: vi.fn(),
  savePlanningEntry: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: mocks.getDemoContext,
}));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));
vi.mock("@/lib/jarvis/security", () => ({
  createJarvisAccessProfile: mocks.createJarvisAccessProfile,
}));
vi.mock("@/lib/jarvis/action-draft-store", () => ({
  getJarvisActionDraft: mocks.getJarvisActionDraft,
  completeJarvisTaskDraft: mocks.completeJarvisTaskDraft,
  cancelJarvisTaskDraft: mocks.cancelJarvisTaskDraft,
  confirmJarvisTaskDraft: mocks.confirmJarvisTaskDraft,
  completeJarvisPlanningDraft: mocks.completeJarvisPlanningDraft,
  cancelJarvisPlanningDraft: mocks.cancelJarvisPlanningDraft,
  confirmJarvisPlanningDraft: mocks.confirmJarvisPlanningDraft,
  JarvisActionDraftError: class JarvisActionDraftError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: number
    ) {
      super(message);
    }
  },
}));
vi.mock("@/app/api/planning-entries/route", () => ({
  POST: mocks.savePlanningEntry,
}));

import {
  GET,
  PATCH,
  POST,
} from "@/app/api/jarvis/action-drafts/[previewId]/route";

const context = { params: Promise.resolve({ previewId: "preview-1" }) };
const actor = { id: "user-1", role: "GESCHAEFTSFUEHRER", isActive: true };
const draft = {
  version: 2,
  previewId: "preview-1",
  state: "awaiting_confirmation",
};

function request(
  method: string,
  body?: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return new Request("https://workpilot.example/api/jarvis/action-drafts/preview-1", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("JARVIS action-draft API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({
      organization: { id: "org-1" },
      users: [actor],
    });
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      sessionUserId: "user-1",
      actor,
    });
    mocks.createJarvisAccessProfile.mockReturnValue({
      sessionActor: actor,
      effectiveActor: actor,
      isImpersonating: false,
    });
    mocks.getJarvisActionDraft.mockResolvedValue(draft);
    mocks.completeJarvisTaskDraft.mockResolvedValue(draft);
    mocks.cancelJarvisTaskDraft.mockResolvedValue({
      ...draft,
      state: "cancelled",
    });
    mocks.confirmJarvisTaskDraft.mockResolvedValue({
      ...draft,
      state: "executed",
      result: { entityType: "task", entityId: "task-1", label: "Öffnen" },
    });
    mocks.confirmJarvisPlanningDraft.mockImplementation(
      async (
        _previewId: string,
        _binding: unknown,
        _revision: number,
        execute: (input: Record<string, unknown>) => Promise<{ id: string }>
      ) => {
        await execute({
          id: "planning-preview-1",
          actorUserId: "user-1",
          title: "Vor-Ort-Prüfung",
          description: "",
          userId: "user-1",
          date: "2026-08-03",
          startTime: "10:00",
          endTime: "11:00",
          durationMinutes: 60,
          board: "OK solutions",
          groupName: "Marketing",
          projectId: "project-1",
          projectLabel: "MKG-209 · Marketing",
          approvalStatus: "confirmed",
        });
        return {
          ...draft,
          actionId: "planning.prepare",
          state: "executed",
          result: {
            entityType: "planning",
            entityId: "planning-preview-1",
            label: "Öffnen",
          },
        };
      }
    );
    mocks.savePlanningEntry.mockResolvedValue(
      Response.json({ id: "planning-preview-1" }, { status: 201 })
    );
  });

  it("binds reads to the server session and effective actor", async () => {
    const response = (await GET(
      request("GET") as never,
      context
    ))!;
    expect(response.status).toBe(200);
    expect(mocks.getJarvisActionDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      })
    );
  });

  it.each([
    ["missing marker", {}, 403],
    [
      "foreign origin",
      {
        "x-jarvis-action": "task-draft-v1",
        origin: "https://evil.example",
      },
      403,
    ],
  ])("rejects mutation with %s", async (_label, headers, status) => {
    const response = (await POST(
      request("POST", { actorId: "user-1", command: "confirm" }, headers) as never,
      context
    ))!;
    expect(response.status).toBe(status);
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });

  it("accepts the public HTTPS origin behind the trusted reverse proxy", async () => {
    const response = (await POST(
      new Request(
        "http://127.0.0.1:3000/api/jarvis/action-drafts/preview-1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-jarvis-action": "task-draft-v1",
            origin: "https://workpilot360.oks-cloudservices.com",
            host: "127.0.0.1:3000",
            "x-forwarded-host": "workpilot360.oks-cloudservices.com",
            "x-forwarded-proto": "https",
          },
          body: JSON.stringify({
            actorId: "user-1",
            command: "confirm",
            revision: 2,
          }),
        }
      ),
      context
    ))!;

    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
  });

  it("rejects a foreign origin even when the app is behind a proxy", async () => {
    const response = (await POST(
      new Request(
        "http://127.0.0.1:3000/api/jarvis/action-drafts/preview-1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-jarvis-action": "task-draft-v1",
            origin: "https://evil.example",
            "x-forwarded-host": "workpilot360.oks-cloudservices.com",
            "x-forwarded-proto": "https",
          },
          body: JSON.stringify({
            actorId: "user-1",
            command: "confirm",
            revision: 2,
          }),
        }
      ),
      context
    ))!;

    expect(response.status).toBe(403);
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });

  it("rejects legacy requests without a real session", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      sessionId: null,
      sessionUserId: "user-1",
      actor,
    });
    const response = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "confirm" },
        { "x-jarvis-action": "task-draft-v1" }
      ) as never,
      context
    ))!;
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "session_required" });
  });

  it("passes only the allowed completion fields to the store", async () => {
    await PATCH(
      request(
        "PATCH",
        {
          actorId: "user-1",
          revision: 1,
          description: "Beschreibung",
          assigneeId: "user-1",
          dueAt: "2026-07-31T08:00:00.000Z",
          organizationId: "evil-org",
          title: "Manipulierter Titel",
        },
        {
          "x-jarvis-action": "task-draft-v1",
          origin: "https://workpilot.example",
        }
      ) as never,
      context
    );

    expect(mocks.completeJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      }),
      {
        revision: 1,
        description: "Beschreibung",
        assigneeId: "user-1",
        dueAt: "2026-07-31T08:00:00.000Z",
      }
    );
  });

  it("separates cancel and explicit confirm commands", async () => {
    const headers = { "x-jarvis-action": "task-draft-v1" };
    const cancelled = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "cancel", revision: 2 },
        headers
      ) as never,
      context
    ))!;
    expect(cancelled.status).toBe(200);
    expect(mocks.cancelJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();

    const confirmed = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "confirm", revision: 2 },
        headers
      ) as never,
      context
    ))!;
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({
      actionDraft: { state: "executed" },
    });
    expect(mocks.confirmJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
  });

  it("executes planning confirmation only through the existing planning service", async () => {
    const response = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "planning.prepare",
          command: "confirm",
          revision: 1,
          organizationId: "evil-org",
          board: "Manipulated board",
        },
        {
          "x-jarvis-action": "jarvis-action-draft-v2",
          origin: "https://workpilot.example",
          cookie: "workpilot_session=signed",
        }
      ) as never,
      context
    ))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisPlanningDraft).toHaveBeenCalledTimes(1);
    expect(mocks.savePlanningEntry).toHaveBeenCalledTimes(1);
    const forwarded = mocks.savePlanningEntry.mock.calls[0][0] as Request;
    const body = await forwarded.json();
    expect(body).toMatchObject({
      id: "planning-preview-1",
      board: "OK solutions",
      groupName: "Marketing",
      actorUserId: "user-1",
      source: "manual",
    });
    expect(body.organizationId).toBeUndefined();
  });

  it("rejects unknown commands without touching draft state", async () => {
    const response = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "execute-anything" },
        { "x-jarvis-action": "task-draft-v1" }
      ) as never,
      context
    ))!;
    expect(response.status).toBe(400);
    expect(mocks.cancelJarvisTaskDraft).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });
});
