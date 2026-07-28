import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyJarvisIntentWithAi,
  shouldUseJarvisAiIntentFallback,
} from "@/lib/jarvis/ai-intent-fallback";
import { resolveJarvisIntentDecision } from "@/lib/jarvis/intent-decision";

function responseWith(value: unknown) {
  return new Response(
    JSON.stringify({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify(value),
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("JARVIS AI intent fallback", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousEnabled = process.env.OPENAI_JARVIS_INTENT_ENABLED;

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousEnabled === undefined) {
      delete process.env.OPENAI_JARVIS_INTENT_ENABLED;
    } else {
      process.env.OPENAI_JARVIS_INTENT_ENABLED = previousEnabled;
    }
  });

  it("does not spend tokens for a deterministic appointment how-to question", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchImpl = vi.fn();
    const decision = resolveJarvisIntentDecision(
      "Wie buche ich hier einen Termin?"
    );

    expect(
      shouldUseJarvisAiIntentFallback({
        question: "Wie buche ich hier einen Termin?",
        decision,
        context: { recordType: "project", recordId: "project-1" },
      })
    ).toBe(false);
    expect(
      await classifyJarvisIntentWithAi(
        {
          question: "Wie buche ich hier einen Termin?",
          decision,
          context: { recordType: "project", recordId: "project-1" },
        },
        fetchImpl
      )
    ).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("classifies an unclear contextual WorkPilot phrase with strict bounded output", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      responseWith({
        intent: "how_to",
        domain: "system",
        entity: "planning",
        scope: "current_record",
        helpTopicId: "appointment.create",
        confidence: "high",
        needsClarification: false,
        usesCurrentContext: true,
        actionKind: "none",
      })
    );
    const question = "Wie kriege ich den Einsatz hier in den Kalender?";
    const decision = resolveJarvisIntentDecision(question);

    await expect(
      classifyJarvisIntentWithAi(
        {
          question,
          decision,
          context: { recordType: "project", recordId: "secret-project-id" },
        },
        fetchImpl
      )
    ).resolves.toMatchObject({
      intent: "how_to",
      helpTopicId: "appointment.create",
      confidence: "high",
    });

    const requestBody = JSON.parse(
      String(fetchImpl.mock.calls[0]?.[1]?.body)
    );
    expect(requestBody.store).toBe(false);
    expect(requestBody.max_output_tokens).toBe(180);
    expect(requestBody.text.format.strict).toBe(true);
    expect(requestBody.text.format.schema.required).toContain("actionKind");
    expect(requestBody.text.format.schema.required).toContain("entity");
    expect(requestBody.text.format.schema.required).toContain("scope");
    expect(JSON.stringify(requestBody)).not.toContain("secret-project-id");
  });

  it("uses the model as a bounded arbiter for an unclear direct action", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      responseWith({
        intent: "prepare_action",
        domain: "system",
        entity: "task",
        scope: "current_record",
        helpTopicId: "none",
        confidence: "high",
        needsClarification: false,
        usesCurrentContext: true,
        actionKind: "task.create",
      })
    );
    const question = "Leg mir dazu bitte etwas für morgen an.";
    const decision = resolveJarvisIntentDecision(question);

    expect(
      shouldUseJarvisAiIntentFallback({
        question,
        decision,
        context: { recordType: "project", recordId: "project-1" },
      })
    ).toBe(true);
    await expect(
      classifyJarvisIntentWithAi(
        {
          question,
          decision,
          context: { recordType: "project", recordId: "project-1" },
        },
        fetchImpl
      )
    ).resolves.toMatchObject({
      intent: "prepare_action",
      actionKind: "task.create",
    });
  });

  it("uses the arbiter for a live search that an exact help matcher could steal", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      responseWith({
        intent: "read",
        domain: "system",
        entity: "customer",
        scope: "explicit_record",
        helpTopicId: "none",
        confidence: "high",
        needsClarification: false,
        usesCurrentContext: false,
        actionKind: "none",
      })
    );
    const question = "Finde den Kunden Klaus Testmann.";
    const decision = resolveJarvisIntentDecision(question);

    expect(
      shouldUseJarvisAiIntentFallback({
        question,
        decision,
        context: { recordType: "project", recordId: "project-1" },
      })
    ).toBe(true);
    await classifyJarvisIntentWithAi(
      {
        question,
        decision,
        context: { recordType: "project", recordId: "project-1" },
      },
      fetchImpl
    );

    const requestBody = JSON.parse(
      String(fetchImpl.mock.calls[0]?.[1]?.body)
    );
    expect(JSON.stringify(requestBody)).not.toContain("Klaus Testmann");
    expect(JSON.stringify(requestBody)).toContain(
      "[PERSON_ODER_DATENSATZ]"
    );
  });

  it("does not mask German WorkPilot nouns as if they were person names", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      responseWith({
        intent: "read",
        domain: "management",
        entity: "invoice",
        scope: "organization",
        helpTopicId: "none",
        confidence: "high",
        needsClarification: false,
        usesCurrentContext: false,
        actionKind: "none",
      })
    );
    const question = "Welche Rechnungen sind bei uns noch offen?";

    await classifyJarvisIntentWithAi(
      {
        question,
        decision: resolveJarvisIntentDecision(question),
        context: { recordType: "project", recordId: "project-1" },
      },
      fetchImpl
    );

    const requestBody = JSON.parse(
      String(fetchImpl.mock.calls[0]?.[1]?.body)
    );
    expect(JSON.stringify(requestBody)).toContain("Welche Rechnungen");
  });

  it("rejects an unknown help topic even when the model returns valid JSON", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      responseWith({
        intent: "how_to",
        domain: "system",
        entity: "planning",
        scope: "current_record",
        helpTopicId: "invented.action",
        confidence: "high",
        needsClarification: false,
        usesCurrentContext: true,
        actionKind: "none",
      })
    );
    const question = "Wie kriege ich das hier rein?";

    await expect(
      classifyJarvisIntentWithAi(
        {
          question,
          decision: resolveJarvisIntentDecision(question),
          context: { recordType: "project", recordId: "project-1" },
        },
        fetchImpl
      )
    ).resolves.toBeUndefined();
  });

  it("fails closed without an API key or after an API error", async () => {
    delete process.env.OPENAI_API_KEY;
    const question = "Wie kriege ich das hier rein?";
    const input = {
      question,
      decision: resolveJarvisIntentDecision(question),
      context: { recordType: "project" as const, recordId: "project-1" },
    };
    const fetchImpl = vi.fn();
    await expect(
      classifyJarvisIntentWithAi(input, fetchImpl)
    ).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();

    process.env.OPENAI_API_KEY = "test-key";
    fetchImpl.mockResolvedValue(new Response("", { status: 503 }));
    await expect(
      classifyJarvisIntentWithAi(input, fetchImpl)
    ).resolves.toBeUndefined();
  });

  it("never forwards secret or payroll questions to the model", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchImpl = vi.fn();
    const question = "Wie finde ich den API-Key oder das Gehalt hier?";

    await expect(
      classifyJarvisIntentWithAi(
        {
          question,
          decision: resolveJarvisIntentDecision(question),
          context: { recordType: "project", recordId: "project-1" },
        },
        fetchImpl
      )
    ).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
