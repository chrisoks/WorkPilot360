import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readJarvisModelUsage,
  recordJarvisModelTelemetry,
  resolveJarvisModelPolicy,
} from "@/lib/jarvis/model-policy";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("JARVIS model policy", () => {
  it("routes high-volume intent work to Luna with tight safe defaults", () => {
    delete process.env.OPENAI_JARVIS_INTENT_MODEL;
    delete process.env.OPENAI_JARVIS_MODEL;
    expect(resolveJarvisModelPolicy("intent")).toMatchObject({
      model: "gpt-5.6-luna",
      reasoningEffort: "low",
      maxOutputTokens: 180,
      timeoutMs: 4000,
    });
  });

  it("keeps everyday management on Terra and never enables Fast implicitly", () => {
    delete process.env.OPENAI_MANAGEMENT_MODEL;
    delete process.env.OPENAI_JARVIS_SOL_FAST_ENABLED;
    const policy = resolveJarvisModelPolicy("management");
    expect(policy).toMatchObject({
      model: "gpt-5.6-terra",
      reasoningEffort: "medium",
    });
    expect(policy.serviceTier).toBeUndefined();
  });

  it("allows Sol Fast only for the explicit complex workload and kill switch", () => {
    process.env.OPENAI_JARVIS_COMPLEX_MODEL = "gpt-5.6-sol";
    process.env.OPENAI_JARVIS_SOL_FAST_ENABLED = "true";
    expect(resolveJarvisModelPolicy("complex").serviceTier).toBe("fast");
    expect(resolveJarvisModelPolicy("sales").serviceTier).toBeUndefined();
  });

  it("extracts token usage without retaining prompts or business context", () => {
    expect(
      readJarvisModelUsage({
        usage: {
          input_tokens: 120,
          output_tokens: 30,
          input_tokens_details: { cached_tokens: 80 },
        },
      })
    ).toEqual({
      inputTokens: 120,
      cachedInputTokens: 80,
      outputTokens: 30,
    });
  });

  it("logs only bounded operational telemetry", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    recordJarvisModelTelemetry({
      policy: resolveJarvisModelPolicy("intent"),
      startedAt: Date.now(),
      ok: true,
      usage: {
        inputTokens: 100,
        cachedInputTokens: 20,
        outputTokens: 10,
      },
    });
    expect(info).toHaveBeenCalledWith(
      "JARVIS model telemetry",
      expect.objectContaining({
        workload: "intent",
        model: "gpt-5.6-luna",
        serviceTier: "standard",
        ok: true,
      })
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("question");
  });
});
