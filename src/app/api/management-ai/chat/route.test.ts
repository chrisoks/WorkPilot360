import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  resolveJarvisSalesAnalysisRequest: vi.fn(),
  resolveJarvisGuidedSequenceContinuation: vi.fn(),
  createJarvisAccessProfile: vi.fn(),
  canUseManagementAi: vi.fn(),
  canUseSalesAi: vi.fn(),
  isClearlyOutOfScopeQuestion: vi.fn(),
  isPromptInjectionAttempt: vi.fn(),
  asksForSalesRestrictedData: vi.fn(),
  sanitizeAiContext: vi.fn(),
  normalizeAndLimitAiReply: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: mocks.getDemoContext,
}));

vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));

vi.mock("@/lib/jarvis/sales-analysis", () => ({
  resolveJarvisSalesAnalysisRequest: mocks.resolveJarvisSalesAnalysisRequest,
}));

vi.mock("@/lib/jarvis/intent-clarification", () => ({
  resolveJarvisGuidedSequenceContinuation:
    mocks.resolveJarvisGuidedSequenceContinuation,
}));

vi.mock("@/lib/jarvis/security", () => ({
  createJarvisAccessProfile: mocks.createJarvisAccessProfile,
}));

vi.mock("@/lib/management-ai/security", () => ({
  canUseManagementAi: mocks.canUseManagementAi,
  canUseSalesAi: mocks.canUseSalesAi,
  isClearlyOutOfScopeQuestion: mocks.isClearlyOutOfScopeQuestion,
  isPromptInjectionAttempt: mocks.isPromptInjectionAttempt,
  asksForSalesRestrictedData: mocks.asksForSalesRestrictedData,
  sanitizeAiContext: mocks.sanitizeAiContext,
  normalizeAndLimitAiReply: mocks.normalizeAndLimitAiReply,
}));

import { POST } from "@/app/api/management-ai/chat/route";

describe("POST /api/management-ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const user = {
      id: "gf-1",
      isActive: true,
      role: "GESCHAEFTSFUEHRER",
      salesRoleEnabled: false,
    };
    mocks.getDemoContext.mockResolvedValue({
      organization: { id: "organization-1", name: "Testfirma" },
      users: [user],
    });
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      sessionUserId: user.id,
      actor: user,
    });
    mocks.canUseManagementAi.mockReturnValue(true);
    mocks.canUseSalesAi.mockReturnValue(true);
    mocks.isClearlyOutOfScopeQuestion.mockReturnValue(false);
    mocks.isPromptInjectionAttempt.mockReturnValue(false);
    mocks.asksForSalesRestrictedData.mockReturnValue(false);
    mocks.createJarvisAccessProfile.mockReturnValue({ profile: true });
    mocks.resolveJarvisGuidedSequenceContinuation.mockReturnValue(undefined);
    mocks.resolveJarvisSalesAnalysisRequest.mockResolvedValue(undefined);
  });

  it("returns the deterministic live analysis before any OpenAI request", async () => {
    mocks.resolveJarvisSalesAnalysisRequest.mockResolvedValue({
      type: "answer",
      message: "Ein belegter Nachfasshinweis.",
      topicId: "sales.analysis.dry-run",
      records: [{ id: "record-1" }],
      deterministic: true,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(
      new Request("http://localhost/api/management-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "gf-1",
          mode: "sales",
          message: "Welche Kunden sollte ich nachfassen?",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reply: "Ein belegter Nachfasshinweis.",
      topicId: "sales.analysis.dry-run",
      deterministic: true,
      records: [{ id: "record-1" }],
    });
    expect(mocks.resolveJarvisSalesAnalysisRequest).toHaveBeenCalledWith({
      question: "Welche Kunden sollte ich nachfassen?",
      organizationId: "organization-1",
      accessProfile: { profile: true },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not route BWL questions through the sales dry run", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const response = await POST(
        new Request("http://localhost/api/management-ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorId: "gf-1",
            mode: "management",
            message: "Wie entwickelt sich unsere Liquidität?",
          }),
        })
      );

      expect(response.status).toBe(200);
      expect(mocks.resolveJarvisSalesAnalysisRequest).not.toHaveBeenCalled();
      expect(await response.json()).toMatchObject({ missingConfiguration: true });
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it("returns the next guided topic after a management answer", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    mocks.resolveJarvisGuidedSequenceContinuation.mockReturnValue({
      choices: [
        {
          id: "intent-domain-sales-1",
          label: "Vertrieb & Kundenchancen",
          prompt: "Welche Kunden soll ich nachfassen.",
        },
      ],
      remainingTasks: [
        {
          kind: "domain",
          domain: "sales",
          choice: {
            id: "intent-domain-sales-1",
            label: "Vertrieb & Kundenchancen",
            prompt: "Welche Kunden soll ich nachfassen.",
          },
        },
      ],
    });
    try {
      const response = await POST(
        new Request("http://localhost/api/management-ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorId: "gf-1",
            mode: "management",
            message: "Wie ist unsere Liquidität.",
            dialogState: {
              version: 1,
              domain: "system",
              lastQuestion:
                "Welche Kunden soll ich nachfassen und wie ist unsere Liquidität?",
              lastIntent: {
                goals: ["analyze"],
                entities: ["customer"],
                timeScopes: [],
                recordFilter: "all",
              },
              guidedSequence: {
                remainingTasks: [
                  {
                    kind: "domain",
                    domain: "management",
                    choice: {
                      id: "intent-domain-management-2",
                      label: "BWL & Unternehmenssteuerung",
                      prompt: "Wie ist unsere Liquidität.",
                    },
                  },
                  {
                    kind: "domain",
                    domain: "sales",
                    choice: {
                      id: "intent-domain-sales-1",
                      label: "Vertrieb & Kundenchancen",
                      prompt: "Welche Kunden soll ich nachfassen.",
                    },
                  },
                ],
              },
            },
          }),
        })
      );

      expect(await response.json()).toMatchObject({
        missingConfiguration: true,
        choices: [
          {
            label: "Vertrieb & Kundenchancen",
          },
        ],
        dialogState: {
          domain: "management",
          guidedSequence: {
            remainingTasks: [
              {
                kind: "domain",
                domain: "sales",
              },
            ],
          },
        },
      });
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
