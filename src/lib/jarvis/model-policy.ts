export type JarvisModelWorkload =
  | "intent"
  | "sales"
  | "management"
  | "complex";

type JarvisReasoningEffort = "low" | "medium" | "high";

export type JarvisModelPolicy = {
  workload: JarvisModelWorkload;
  model: string;
  reasoningEffort: JarvisReasoningEffort;
  maxOutputTokens: number;
  timeoutMs: number;
  serviceTier?: "fast";
};

export type JarvisModelUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

const STANDARD_RATES_USD_PER_MILLION: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
  "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12 },
  "gpt-5.6-sol": { input: 5, cachedInput: 0.5, output: 30 },
};

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed)
    ? Math.max(minimum, Math.min(maximum, parsed))
    : fallback;
}

export function resolveJarvisModelPolicy(
  workload: JarvisModelWorkload
): JarvisModelPolicy {
  if (workload === "intent") {
    return {
      workload,
      model:
        process.env.OPENAI_JARVIS_INTENT_MODEL ||
        process.env.OPENAI_JARVIS_MODEL ||
        "gpt-5.6-luna",
      reasoningEffort: "low",
      maxOutputTokens: boundedInteger(
        process.env.OPENAI_JARVIS_INTENT_MAX_OUTPUT_TOKENS,
        180,
        80,
        500
      ),
      timeoutMs: boundedInteger(
        process.env.OPENAI_JARVIS_INTENT_TIMEOUT_MS,
        4000,
        1000,
        15_000
      ),
    };
  }

  const isComplex = workload === "complex";
  const model = isComplex
    ? process.env.OPENAI_JARVIS_COMPLEX_MODEL || "gpt-5.6-sol"
    : process.env.OPENAI_MANAGEMENT_MODEL || "gpt-5.6-terra";
  const fastEnabled =
    isComplex &&
    model === "gpt-5.6-sol" &&
    process.env.OPENAI_JARVIS_SOL_FAST_ENABLED === "true";
  return {
    workload,
    model,
    reasoningEffort: isComplex ? "high" : "medium",
    maxOutputTokens: boundedInteger(
      process.env.OPENAI_MANAGEMENT_MAX_OUTPUT_TOKENS,
      isComplex ? 800 : 520,
      200,
      2000
    ),
    timeoutMs: boundedInteger(
      process.env.OPENAI_MANAGEMENT_TIMEOUT_MS,
      isComplex ? 30_000 : 18_000,
      3000,
      60_000
    ),
    ...(fastEnabled ? { serviceTier: "fast" as const } : {}),
  };
}

export function readJarvisModelUsage(value: unknown): JarvisModelUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = (value as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const source = usage as Record<string, unknown>;
  const details =
    source.input_tokens_details &&
    typeof source.input_tokens_details === "object"
      ? (source.input_tokens_details as Record<string, unknown>)
      : {};
  const inputTokens = Number(source.input_tokens);
  const outputTokens = Number(source.output_tokens);
  const cachedInputTokens = Number(details.cached_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return undefined;
  }
  return {
    inputTokens,
    cachedInputTokens: Number.isFinite(cachedInputTokens)
      ? cachedInputTokens
      : 0,
    outputTokens,
  };
}

function estimatedCostUsd(
  policy: JarvisModelPolicy,
  usage: JarvisModelUsage | undefined
) {
  if (!usage) return undefined;
  const rates = STANDARD_RATES_USD_PER_MILLION[policy.model];
  if (!rates) return undefined;
  const multiplier = policy.serviceTier === "fast" ? 2 : 1;
  const uncachedInput = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens
  );
  return (
    ((uncachedInput * rates.input +
      usage.cachedInputTokens * rates.cachedInput +
      usage.outputTokens * rates.output) /
      1_000_000) *
    multiplier
  );
}

export function recordJarvisModelTelemetry(input: {
  policy: JarvisModelPolicy;
  startedAt: number;
  ok: boolean;
  status?: number;
  usage?: JarvisModelUsage;
  errorCode?: string;
}) {
  console.info("JARVIS model telemetry", {
    workload: input.policy.workload,
    model: input.policy.model,
    serviceTier: input.policy.serviceTier ?? "standard",
    reasoningEffort: input.policy.reasoningEffort,
    durationMs: Math.max(0, Date.now() - input.startedAt),
    ok: input.ok,
    status: input.status,
    usage: input.usage,
    estimatedCostUsd: estimatedCostUsd(input.policy, input.usage),
    errorCode: input.errorCode,
  });
}
