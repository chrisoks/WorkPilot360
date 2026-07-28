import { prisma } from "@/lib/db/client";

export const JARVIS_PRICING_POLICY_KEY = "jarvis.pricing-policy.v1";

export type JarvisPricingPolicy = {
  minimumMarginPercent: number;
  targetMarginPercent: number;
};

export type JarvisPriceCorridor = {
  partialCostPerUnit: number;
  minimumPrice: number;
  targetPrice: number;
  minimumMarginPercent: number;
  targetMarginPercent: number;
};

export type JarvisPricingPolicySource = {
  loadPricingPolicy?(organizationId: string): Promise<JarvisPricingPolicy>;
};

export const DEFAULT_JARVIS_PRICING_POLICY: JarvisPricingPolicy = {
  minimumMarginPercent: 18,
  targetMarginPercent: 30,
};

function finitePercent(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeJarvisPricingPolicy(
  value: unknown
): JarvisPricingPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_JARVIS_PRICING_POLICY;
  }
  const candidate = value as Record<string, unknown>;
  const minimumMarginPercent = finitePercent(candidate.minimumMarginPercent);
  const targetMarginPercent = finitePercent(candidate.targetMarginPercent);
  if (
    minimumMarginPercent === undefined ||
    targetMarginPercent === undefined ||
    minimumMarginPercent < 0 ||
    minimumMarginPercent >= 95 ||
    targetMarginPercent <= minimumMarginPercent ||
    targetMarginPercent >= 95
  ) {
    return DEFAULT_JARVIS_PRICING_POLICY;
  }
  return {
    minimumMarginPercent,
    targetMarginPercent,
  };
}

export async function loadJarvisPricingPolicy(
  organizationId: string
): Promise<JarvisPricingPolicy> {
  const setting = await prisma.organizationSetting.findUnique({
    where: {
      organizationId_key: {
        organizationId,
        key: JARVIS_PRICING_POLICY_KEY,
      },
    },
    select: { value: true },
  });
  return normalizeJarvisPricingPolicy(setting?.value);
}

export function calculateJarvisPartialCostPriceCorridor(
  partialCostPerUnit: number,
  policy: JarvisPricingPolicy
): JarvisPriceCorridor | undefined {
  if (!Number.isFinite(partialCostPerUnit) || partialCostPerUnit <= 0) {
    return undefined;
  }
  const normalizedPolicy = normalizeJarvisPricingPolicy(policy);
  return {
    partialCostPerUnit,
    minimumPrice:
      partialCostPerUnit /
      (1 - normalizedPolicy.minimumMarginPercent / 100),
    targetPrice:
      partialCostPerUnit /
      (1 - normalizedPolicy.targetMarginPercent / 100),
    ...normalizedPolicy,
  };
}
