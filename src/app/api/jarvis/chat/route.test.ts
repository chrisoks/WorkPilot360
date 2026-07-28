import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  sanitizeJarvisSurfaceContext: vi.fn(),
  resolveJarvisProjectHealthRequest: vi.fn(),
  resolveJarvisPersonDiagnosticRequest: vi.fn(),
  resolveJarvisPersonSummaryRequest: vi.fn(),
  resolveJarvisSalesAnalysisIntent: vi.fn(),
  resolveJarvisSalesAnalysisRequest: vi.fn(),
  resolveJarvisReadRequest: vi.fn(),
  resolveJarvisSystemHelp: vi.fn(),
  createJarvisAccessProfile: vi.fn(),
  resolveJarvisIntentDecision: vi.fn(),
  buildJarvisIntentClarification: vi.fn(),
  resolveJarvisIntentSequenceContinuation: vi.fn(),
  buildJarvisProjectScopeSequenceClarification: vi.fn(),
  buildJarvisProjectSequenceClarification: vi.fn(),
  buildJarvisProjectSequenceContinuation: vi.fn(),
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

vi.mock("@/lib/jarvis/project-health", () => ({
  resolveJarvisProjectHealthRequest: mocks.resolveJarvisProjectHealthRequest,
}));

vi.mock("@/lib/jarvis/sales-analysis", () => ({
  resolveJarvisSalesAnalysisIntent: mocks.resolveJarvisSalesAnalysisIntent,
  resolveJarvisSalesAnalysisRequest: mocks.resolveJarvisSalesAnalysisRequest,
}));

vi.mock("@/lib/jarvis/security", () => ({
  createJarvisAccessProfile: mocks.createJarvisAccessProfile,
}));

vi.mock("@/lib/jarvis/intent-decision", () => ({
  resolveJarvisIntentDecision: mocks.resolveJarvisIntentDecision,
}));

vi.mock("@/lib/jarvis/intent-clarification", () => ({
  buildJarvisIntentClarification: mocks.buildJarvisIntentClarification,
  resolveJarvisIntentSequenceContinuation:
    mocks.resolveJarvisIntentSequenceContinuation,
  buildJarvisProjectScopeSequenceClarification:
    mocks.buildJarvisProjectScopeSequenceClarification,
  buildJarvisProjectSequenceClarification:
    mocks.buildJarvisProjectSequenceClarification,
  buildJarvisProjectSequenceContinuation:
    mocks.buildJarvisProjectSequenceContinuation,
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
    mocks.resolveJarvisIntentDecision.mockReturnValue({
      state: "resolved",
      domain: "system",
      confidence: "high",
      candidates: [],
      clarificationReasons: [],
      goals: [],
      entities: [],
      timeScopes: [],
      recordFilter: "all",
      segments: [],
    });
    mocks.buildJarvisIntentClarification.mockReturnValue(undefined);
    mocks.resolveJarvisIntentSequenceContinuation.mockReturnValue(undefined);
    mocks.buildJarvisProjectScopeSequenceClarification.mockReturnValue(
      undefined
    );
    mocks.buildJarvisProjectSequenceClarification.mockReturnValue(undefined);
    mocks.buildJarvisProjectSequenceContinuation.mockReturnValue([]);
    mocks.resolveJarvisProjectHealthRequest.mockResolvedValue(undefined);
    mocks.resolveJarvisPersonDiagnosticRequest.mockResolvedValue(undefined);
    mocks.resolveJarvisPersonSummaryRequest.mockResolvedValue(undefined);
    mocks.resolveJarvisSalesAnalysisIntent.mockReturnValue(false);
    mocks.resolveJarvisSalesAnalysisRequest.mockResolvedValue(undefined);
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

  it("does not let an open project override a clear generic invoice search", async () => {
    mocks.resolveJarvisIntentDecision.mockReturnValue({
      state: "resolved",
      domain: "system",
      confidence: "high",
      candidates: [],
      clarificationReasons: [],
      goals: ["read"],
      entities: ["invoice"],
      timeScopes: [],
      recordFilter: "open",
      segments: ["Zeige mir die offenen Rechnungen."],
    });
    mocks.resolveJarvisProjectHealthRequest.mockResolvedValue({
      type: "answer",
      topicId: "project.health",
      message: "Falsche Projektprüfung",
      deterministic: true,
    });
    mocks.resolveJarvisReadRequest.mockResolvedValue({
      type: "answer",
      topicId: "records.invoice.search",
      message: "Offene Rechnungen",
      records: [],
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Zeige mir die offenen Rechnungen.",
          context: { recordType: "project", recordId: "project-mkg-209" },
        }),
      })
    );

    expect(await response.json()).toMatchObject({
      topicId: "records.invoice.search",
      message: "Offene Rechnungen",
    });
    expect(mocks.resolveJarvisProjectHealthRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisReadRequest).toHaveBeenCalled();
  });

  it("clarifies a combined intent before any specialized resolver loads data", async () => {
    const decision = {
      state: "clarification",
      domain: "sales",
      confidence: "medium",
      candidates: [],
      clarificationReasons: ["multiple_domains"],
      goals: ["analyze"],
      entities: ["customer"],
      timeScopes: [],
      recordFilter: "all",
      segments: [
        "Welche Kunden soll ich nachfassen",
        "wie ist unsere Liquidität?",
      ],
    };
    mocks.resolveJarvisIntentDecision.mockReturnValue(decision);
    mocks.buildJarvisIntentClarification.mockReturnValue({
      type: "clarification",
      topicId: "intent.clarification",
      message: "Welchen Teil soll JARVIS zuerst bearbeiten?",
      choices: [
        {
          id: "intent-domain-sales-1",
          label: "Vertrieb & Kundenchancen",
          prompt: "Welche Kunden soll ich nachfassen.",
        },
      ],
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message:
            "Welche Kunden soll ich nachfassen und wie ist unsere Liquidität?",
          context: {},
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      type: "clarification",
      topicId: "intent.clarification",
      deterministic: true,
    });
    expect(mocks.buildJarvisIntentClarification).toHaveBeenCalledWith(
      decision,
      { profile: true }
    );
    expect(mocks.resolveJarvisProjectHealthRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisPersonSummaryRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisSystemHelp).not.toHaveBeenCalled();
  });

  it("keeps same-domain subtasks server-validated without exposing internal metadata", async () => {
    const decision = {
      state: "clarification",
      domain: "system",
      confidence: "high",
      candidates: [],
      clarificationReasons: ["multiple_record_targets"],
      goals: ["read"],
      entities: ["invoice", "offer"],
      timeScopes: [],
      recordFilter: "open",
      segments: ["Zeige offene Rechnungen", "Angebote."],
    };
    mocks.resolveJarvisIntentDecision.mockReturnValue(decision);
    mocks.buildJarvisIntentClarification.mockReturnValue({
      type: "clarification",
      topicId: "intent.clarification",
      message: "Womit soll JARVIS beginnen?",
      choices: [
        {
          id: "intent-entity-invoice",
          label: "Rechnungen",
          prompt: "Zeige mir die offenen Rechnungen.",
        },
        {
          id: "intent-entity-offer",
          label: "Angebote",
          prompt: "Zeige mir die offenen Angebote.",
        },
      ],
      dialogIntentSequence: {
        remainingTasks: [
          { entity: "invoice", recordFilter: "open" },
          { entity: "offer", recordFilter: "open" },
        ],
      },
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Zeige mir die offenen Rechnungen und Angebote.",
          context: {},
        }),
      })
    );
    const payload = await response.json();

    expect(payload.dialogIntentSequence).toBeUndefined();
    expect(payload.dialogState.intentSequence.remainingTasks).toEqual([
      { entity: "invoice", recordFilter: "open" },
      { entity: "offer", recordFilter: "open" },
    ]);
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
  });

  it("appends the next allowed subtask after a completed partial answer", async () => {
    mocks.resolveJarvisIntentDecision.mockReturnValue({
      state: "resolved",
      domain: "system",
      confidence: "high",
      candidates: [],
      clarificationReasons: [],
      goals: ["read"],
      entities: ["invoice"],
      timeScopes: [],
      recordFilter: "open",
      segments: ["Zeige mir die offenen Rechnungen."],
    });
    mocks.resolveJarvisIntentSequenceContinuation.mockReturnValue({
      choices: [
        {
          id: "intent-sequence-offer",
          label: "Angebote",
          prompt: "Zeige mir die offenen Angebote.",
        },
      ],
      remainingTasks: [{ entity: "offer", recordFilter: "open" }],
    });
    mocks.resolveJarvisReadRequest.mockResolvedValue({
      type: "answer",
      topicId: "records.invoice.search",
      message: "Offene Rechnungen",
      records: [],
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Zeige mir die offenen Rechnungen.",
          context: {},
          dialogState: {
            version: 1,
            domain: "system",
            lastQuestion: "Zeige offene Rechnungen und Angebote.",
            lastIntent: {
              goals: ["read"],
              entities: ["invoice", "offer"],
              timeScopes: [],
              recordFilter: "open",
            },
            intentSequence: {
              remainingTasks: [
                { entity: "invoice", recordFilter: "open" },
                { entity: "offer", recordFilter: "open" },
              ],
            },
          },
        }),
      })
    );

    expect(await response.json()).toMatchObject({
      message: "Offene Rechnungen",
      choices: [
        {
          label: "Angebote",
          prompt: "Zeige mir die offenen Angebote.",
        },
      ],
      dialogState: {
        intentSequence: {
          remainingTasks: [{ entity: "offer", recordFilter: "open" }],
        },
      },
    });
  });

  it("clarifies a multi-project request before silently checking only one project", async () => {
    mocks.buildJarvisProjectSequenceClarification.mockReturnValue({
      type: "clarification",
      topicId: "project.sequence.clarification",
      message: "Welches Projekt soll JARVIS zuerst prüfen?",
      choices: [
        {
          id: "project-sequence-1-has-1",
          label: "HAS-1",
          prompt: "Prüfe Projekt HAS-1 vollständig.",
        },
        {
          id: "project-sequence-2-mks-209",
          label: "MKS-209",
          prompt: "Prüfe Projekt MKS-209 vollständig.",
        },
      ],
      dialogSequence: {
        remainingReferences: ["HAS-1", "MKS-209"],
        scope: "full",
      },
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Prüfe HAS-1 und MKS-209 vollständig.",
          context: {},
        }),
      })
    );
    const payload = await response.json();

    expect(payload).toMatchObject({
      type: "clarification",
      topicId: "project.sequence.clarification",
      dialogState: {
        projectSequence: {
          remainingReferences: ["HAS-1", "MKS-209"],
          scope: "full",
        },
      },
    });
    expect(payload.dialogSequence).toBeUndefined();
    expect(mocks.resolveJarvisProjectHealthRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
  });

  it("stops escalating the same clarification loop after two attempts", async () => {
    mocks.buildJarvisIntentClarification.mockReturnValue({
      type: "clarification",
      topicId: "intent.clarification",
      message: "Welchen Bereich meinst du?",
      choices: [
        {
          id: "intent-project",
          label: "Projekte",
          prompt: "Zeige mir die Projekte.",
        },
      ],
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Immer noch unklar",
          context: {},
          dialogState: {
            version: 1,
            domain: "system",
            lastQuestion: "Keine Ahnung",
            lastIntent: {
              goals: [],
              entities: [],
              timeScopes: [],
              recordFilter: "all",
            },
            clarification: {
              topicId: "intent.clarification",
              depth: 2,
            },
          },
        }),
      })
    );

    expect(await response.json()).toMatchObject({
      type: "clarification",
      message:
        "Ich möchte hier nicht raten. Bitte wähle eine der angebotenen Möglichkeiten oder formuliere Ziel und Datensatz einmal vollständig neu.",
      dialogState: {
        clarification: {
          topicId: "intent.clarification",
          depth: 2,
        },
      },
    });
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

  it("returns the project health check before other diagnostic paths", async () => {
    mocks.sanitizeJarvisSurfaceContext.mockReturnValue({
      recordType: "project",
      recordId: "project-1",
    });
    mocks.resolveJarvisProjectHealthRequest.mockResolvedValue({
      type: "answer",
      topicId: "project.health",
      message: "Das Projekt erreicht 84 von 100 Punkten.",
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Prüfe dieses Projekt vollständig.",
          context: { recordType: "project", recordId: "project-1" },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      topicId: "project.health",
      deterministic: true,
    });
    expect(mocks.resolveJarvisProjectHealthRequest).toHaveBeenCalledWith({
      question: "Prüfe dieses Projekt vollständig.",
      organizationId: "organization-1",
      accessProfile: { profile: true },
      context: { recordType: "project", recordId: "project-1" },
    });
    expect(mocks.resolveJarvisPersonDiagnosticRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
  });

  it("forwards the sanitized conversation record separately from the screen context", async () => {
    mocks.sanitizeJarvisSurfaceContext.mockImplementation((value) => value);
    mocks.resolveJarvisProjectHealthRequest.mockResolvedValue({
      type: "answer",
      topicId: "project.health",
      message: "HAS-1 wurde geprüft.",
      deterministic: true,
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Und wie sieht die Planung aus?",
          context: { recordType: "project", recordId: "project-mkg-209" },
          conversationContext: {
            recordType: "project",
            recordId: "project-has-1",
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveJarvisProjectHealthRequest).toHaveBeenCalledWith({
      question: "Und wie sieht die Planung aus?",
      organizationId: "organization-1",
      accessProfile: { profile: true },
      context: { recordType: "project", recordId: "project-mkg-209" },
      conversationContext: {
        recordType: "project",
        recordId: "project-has-1",
      },
    });
  });

  it("uses the typed dialog state for a referential project follow-up", async () => {
    mocks.sanitizeJarvisSurfaceContext.mockImplementation((value) => value);
    mocks.resolveJarvisProjectHealthRequest.mockResolvedValue({
      type: "answer",
      topicId: "project.health",
      message: "Die Planung von HAS-1 wurde geprüft.",
      deterministic: true,
      records: [
        {
          id: "project-has-1",
          kind: "project",
          title: "HAS-1",
          subtitle: "",
          summary: "",
          status: "Umsetzung",
          target: { kind: "project", id: "project-has-1" },
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Und wie sieht die Planung aus?",
          context: { recordType: "project", recordId: "screen-project" },
          dialogState: {
            version: 1,
            domain: "system",
            topicId: "project.logic.explanation",
            activeRecord: { kind: "project", id: "project-has-1" },
            lastQuestion: "Was ist HAS-1 für ein Projekt?",
            lastIntent: {
              goals: ["explain"],
              entities: ["project"],
              timeScopes: [],
              recordFilter: "all",
            },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveJarvisProjectHealthRequest).toHaveBeenCalledWith({
      question: "Und wie sieht die Planung aus?",
      organizationId: "organization-1",
      accessProfile: { profile: true },
      context: { recordType: "project", recordId: "screen-project" },
      conversationContext: {
        recordType: "project",
        recordId: "project-has-1",
      },
    });
    expect(await response.json()).toMatchObject({
      dialogState: {
        version: 1,
        domain: "system",
        activeRecord: {
          kind: "project",
          id: "project-has-1",
        },
      },
    });
  });

  it("adds the next remembered project after a sequence answer", async () => {
    mocks.sanitizeJarvisSurfaceContext.mockImplementation((value) => value);
    mocks.buildJarvisProjectSequenceContinuation.mockReturnValue([
      {
        id: "project-sequence-1-mks-209",
        label: "MKS-209",
        prompt: "Prüfe Projekt MKS-209 vollständig.",
      },
    ]);
    mocks.resolveJarvisProjectHealthRequest.mockResolvedValue({
      type: "answer",
      topicId: "project.health",
      message: "HAS-1 wurde geprüft.",
      deterministic: true,
      records: [
        {
          id: "project-has-1",
          kind: "project",
          title: "HAS-1",
          subtitle: "",
          summary: "",
          status: "Stabil",
          target: { kind: "project", id: "project-has-1" },
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Prüfe Projekt HAS-1 vollständig.",
          context: {},
          dialogState: {
            version: 1,
            domain: "system",
            lastQuestion: "Prüfe HAS-1 und MKS-209.",
            lastIntent: {
              goals: ["diagnose"],
              entities: ["project"],
              timeScopes: [],
              recordFilter: "all",
            },
            projectSequence: {
              remainingReferences: ["HAS-1", "MKS-209"],
              scope: "full",
            },
          },
        }),
      })
    );

    expect(await response.json()).toMatchObject({
      choices: [
        {
          label: "MKS-209",
          prompt: "Prüfe Projekt MKS-209 vollständig.",
        },
      ],
      dialogState: {
        projectSequence: {
          remainingReferences: ["MKS-209"],
          scope: "full",
        },
      },
    });
  });

  it("does not leak an old dialog record into an independent how-to question", async () => {
    mocks.sanitizeJarvisSurfaceContext.mockImplementation((value) => value);
    mocks.resolveJarvisProjectHealthRequest.mockResolvedValue(undefined);
    mocks.resolveJarvisReadRequest.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "user-1",
          message: "Wie lege ich ein Projekt an?",
          context: { module: "Projekte" },
          dialogState: {
            version: 1,
            domain: "system",
            activeRecord: { kind: "project", id: "old-project" },
            lastQuestion: "Prüfe das alte Projekt.",
            lastIntent: {
              goals: ["diagnose"],
              entities: ["project"],
              timeScopes: [],
              recordFilter: "all",
            },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveJarvisProjectHealthRequest).toHaveBeenCalledWith({
      question: "Wie lege ich ein Projekt an?",
      organizationId: "organization-1",
      accessProfile: { profile: true },
      context: { module: "Projekte" },
    });
    expect(await response.json()).toMatchObject({
      dialogState: {
        version: 1,
        domain: "system",
      },
    });
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

  it("answers deterministic sales analysis inside the unified chat", async () => {
    mocks.resolveJarvisSalesAnalysisIntent.mockReturnValue(true);
    mocks.resolveJarvisSalesAnalysisRequest.mockResolvedValue({
      type: "answer",
      topicId: "sales.analysis",
      message: "Drei Kunden sollten nachgefasst werden.",
      deterministic: true,
    });

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
      topicId: "sales.analysis",
      message: "Drei Kunden sollten nachgefasst werden.",
      deterministic: true,
    });
    expect(mocks.resolveJarvisSalesAnalysisRequest).toHaveBeenCalledWith({
      question: "Welche Kunden sollte ich nachfassen?",
      organizationId: "organization-1",
      accessProfile: { profile: true },
    });
    expect(mocks.resolveJarvisReadRequest).not.toHaveBeenCalled();
    expect(mocks.resolveJarvisSystemHelp).not.toHaveBeenCalled();
  });
});
