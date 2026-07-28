import { describe, expect, it } from "vitest";
import {
  calculateJarvisPartialCostPriceCorridor,
  DEFAULT_JARVIS_PRICING_POLICY,
  normalizeJarvisPricingPolicy,
} from "@/lib/jarvis/pricing-policy";

describe("JARVIS pricing policy", () => {
  it("uses the approved safe default margins", () => {
    expect(DEFAULT_JARVIS_PRICING_POLICY).toEqual({
      minimumMarginPercent: 18,
      targetMarginPercent: 30,
    });
  });

  it("rejects invalid or reversed margin settings", () => {
    expect(
      normalizeJarvisPricingPolicy({
        minimumMarginPercent: 30,
        targetMarginPercent: 18,
      })
    ).toEqual(DEFAULT_JARVIS_PRICING_POLICY);
    expect(normalizeJarvisPricingPolicy({})).toEqual(
      DEFAULT_JARVIS_PRICING_POLICY
    );
  });

  it("calculates margin on selling price instead of adding markup to cost", () => {
    const corridor = calculateJarvisPartialCostPriceCorridor(
      100,
      DEFAULT_JARVIS_PRICING_POLICY
    );

    expect(corridor?.minimumPrice).toBeCloseTo(121.9512, 4);
    expect(corridor?.targetPrice).toBeCloseTo(142.8571, 4);
  });

  it("does not calculate a corridor without a positive cost basis", () => {
    expect(
      calculateJarvisPartialCostPriceCorridor(
        0,
        DEFAULT_JARVIS_PRICING_POLICY
      )
    ).toBeUndefined();
  });
});
