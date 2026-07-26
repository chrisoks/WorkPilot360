import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  sanitizeJarvisSurfaceContext: vi.fn(),
  resolveJarvisPersonDiagnosticRequest: vi.fn(),
  resolveJarvisPersonSummaryRequest: vi.fn(),
  resolveJarvisSalesAnalysisIntent: vi.fn(),
  resolveJarvisReadRequest: vi.fn(),
  resolveJarvisSystemHelp: vi.fn(),
  createJarvisAccessProfile: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: mocks.getDemoContext,
}));

vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));

vi.mock("@/lib/jarvis/knowledge", () => ({
  sanitizeJarvisSurfaceContext: mocks.sanitizeJarvisSurfaceContext,
  resolveJarvisSystemHelp: mocks.resolveJarvisSystemHelp,
}));

vi.mock("@/lib/jarvis/read-model", () => ({
  resolveJarvisReadRequest: mocks.resolveJarvisReadRequest,
}));

vi.mock("@/lib/jarvis/person-summary", () => ({
  resolveJarvisPersonDiagnosticRequest: mocks.resolveJarvisPersonDiagnosticRequest,
  resolveJarvisPersonSummaryRequest: mocks.resolveJarvisPersonSummaryRequest,
}));

vi.mock("@/lib/jarvis/sales-analysis", () => ({
  resolveJarvisSalesAnalysisIntent: mocks.resolveJarvisSalesAnalysisIntent,
}));

vi.mock("@/lib/jarvis/security", () => ({
  createJarvisAccessProfile: mocks.createJarvisAccessProfile,
}));

import { POST } from "@/app/api/jarvis/chat/route";

describe("POST /api/jarvis/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const user = { id: "user-1", isActive: true, role: "GESCHAEFTSFUEHRER" };
    mocks.getDemoContext.mockResolvedValue({
      organization: { id: "organization-1" },
      users: [user],
    });
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      sessionUserId: user.id,
      actor: user,
    });
    mocks.sanitizeJarvisSurfaceContext.mockReturnValue({ module: "Projekte" });
    mocks.createJarvisAccessProfile.mockReturnValue({ profile: true });
    mocks.resolveJarvisPersonDiagnosticRequest.mockResolvedValue(undefined);
    mocks.resolveJarvisPersonSummaryRequest.mockResolvedValue(undefined);
    mocks.resolveJarvisSalesAnalysisIntent.mockReturnValue(false);
    mocks.resolveJarvisSystemHelp.mockReturnValue({
      type: "answer",
      message: "Systemhilfe",
    });
  });

  it("returns the deterministic read response before normal system help", async () => {
    mocks.resolveJarvisReadRequest.mockResolvedValue({
      type: "answer",
      message: "Projekt gefunden",
      topicId: "records.project.search",
      records: [],
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Öffne Projekt Müller",
          context: { module: "Projekte" },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      message: "Projekt gefunden",
      deterministic: true,
    });
    expect(mocks.resolveJarvisReadRequest).toHaveBeenCalledWith({
      question: "Öffne Projekt Müller",
      context: { module: "Projekte" },
      organizationId: "organization-1",
      accessProfile: { profile: true },
    });
    expect(mocks.resolveJarvisSystemHelp).not.toHaveBeenCalled();
  });

  it("returns a person summary before generic record and system help paths", async () => {
    mocks.resolveJarvisPersonSummaryRequest.mockResolvedValue({
      type: "answer",
      topicId: "person.customer.summary",
      message: "Klaus Testmann ist als Privatkunde erfasst.",
      records: [],
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Was weißt du über Klaus Testmann?",
          context: {},
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      topicId: "person.customer.summary",
      deterministic: true,
    });
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisSystemHelp).not.toHaveBeenCalled();
  });

  it("returns a person diagnostic before summary and generic help paths", async () => {
    mocks.resolveJarvisPersonDiagnosticRequest.mockResolvedValue({
      type: "answer",
      topicId: "person.project-diagnostic",
      message: "Eine Kundenzuordnung fehlt.",
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Warum zeigt die Kundenakte vier Projekte und JARVIS nur drei?",
          context: { recordType: "customer", recordId: "customer-1" },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      topicId: "person.project-diagnostic",
      deterministic: true,
    });
    expect(mocks.resolveJarvisPersonSummaryRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisSystemHelp).not.toHaveBeenCalled();
  });

  it("keeps normal questions on the established system-help path", async () => {
    mocks.resolveJarvisReadRequest.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Wie lege ich ein Angebot an?",
          context: {},
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ message: "Systemhilfe" });
    expect(mocks.resolveJarvisSystemHelp).toHaveBeenCalledWith(
      "Wie lege ich ein Angebot an?",
      { module: "Projekte" },
      { profile: true }
    );
  });

  it("redirects analysis questions to the role-aware sales mode", async () => {
    mocks.resolveJarvisSalesAnalysisIntent.mockReturnValue(true);

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Welche Kunden sollte ich nachfassen?",
          context: {},
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      topicId: "sales.analysis.mode-hint",
      deterministic: true,
    });
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisSystemHelp).not.toHaveBeenCalled();
  });
});
