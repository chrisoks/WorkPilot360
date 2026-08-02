import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDemoContext: vi.fn(), getSessionBoundActor: vi.fn(), sessionBoundActorResponse: vi.fn(), canArchiveProjects: vi.fn(), evaluate: vi.fn(), execute: vi.fn(), required: vi.fn(), matches: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/demo/context", () => ({ getDemoContext: mocks.getDemoContext }));
vi.mock("@/lib/auth/actor", () => ({ getSessionBoundActor: mocks.getSessionBoundActor, sessionBoundActorResponse: mocks.sessionBoundActorResponse }));
vi.mock("@/lib/permissions", () => ({ canArchiveProjects: mocks.canArchiveProjects }));
vi.mock("@/lib/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/projects/project-lifecycle-service", () => ({
  ProjectLifecycleServiceError: class ProjectLifecycleServiceError extends Error { constructor(public readonly code: string, message: string) { super(message); } },
  evaluateProjectLifecycle: mocks.evaluate, executeProjectLifecycle: mocks.execute, getProjectLifecycleConfirmationText: mocks.required, matchesProjectLifecycleConfirmation: mocks.matches,
}));
import { PATCH, POST } from "@/app/api/hero/projects/lifecycle/route";

const actor = { id: "leader-1", role: "FUEHRUNGSKRAFT", firstName: "Lea", lastName: "Leitung", email: "lea@example.test" };
const evaluation = { lifecycleAction: "archive", reason: "Aufbewahrung", project: { id: "project-1", projectNumber: "GLR-449" }, blockingIssues: [], fingerprint: "a".repeat(64) };
function request(method: string, body: Record<string, unknown>) { return new Request("http://localhost/api/hero/projects/lifecycle", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

describe("controlled project lifecycle API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({ organization: { id: "org-1" }, users: [actor] });
    mocks.getSessionBoundActor.mockResolvedValue({ ok: true, actor });
    mocks.canArchiveProjects.mockReturnValue(true);
    mocks.evaluate.mockResolvedValue(evaluation);
    mocks.required.mockReturnValue("PROJEKT ARCHIVIEREN GLR-449");
    mocks.matches.mockReturnValue(true);
    mocks.execute.mockResolvedValue({ project: { id: "project-1", status: "Archiviert" }, replayed: false });
    mocks.transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({}));
  });
  it("returns a side-effect-free preview", async () => {
    const response = await POST(request("POST", { actorId: actor.id, projectId: "project-1", lifecycleAction: "archive", reason: "Aufbewahrung" }));
    expect(response!.status).toBe(200);
    expect(await response!.json()).toMatchObject({ requiredText: "PROJEKT ARCHIVIEREN GLR-449" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects a wrong exact confirmation", async () => {
    mocks.matches.mockReturnValue(false);
    const response = await PATCH(request("PATCH", { actorId: actor.id, projectId: "project-1", lifecycleAction: "archive", reason: "Aufbewahrung", fingerprint: "a".repeat(64), confirmationText: "ja", requestId: "request-1" }));
    expect(response!.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("executes only through the serializable shared service", async () => {
    const response = await PATCH(request("PATCH", { actorId: actor.id, projectId: "project-1", lifecycleAction: "archive", reason: "Aufbewahrung", fingerprint: "a".repeat(64), confirmationText: "PROJEKT ARCHIVIEREN GLR-449", requestId: "request-1" }));
    expect(response!.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ source: "ui", actorId: actor.id, expectedFingerprint: "a".repeat(64) }));
  });
  it("enforces archive permission", async () => {
    mocks.canArchiveProjects.mockReturnValue(false);
    const response = await POST(request("POST", { actorId: actor.id }));
    expect(response!.status).toBe(403);
    expect(mocks.evaluate).not.toHaveBeenCalled();
  });
});
