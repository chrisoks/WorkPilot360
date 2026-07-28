import { describe, expect, it } from "vitest";
import { calculateWeightedLaborCostRate } from "@/lib/employee-costs/labor-cost-rate";

describe("weighted labor cost rate", () => {
  it("does not halve the hourly rate for one employee allocated at 50 percent", () => {
    expect(
      calculateWeightedLaborCostRate([
        { hourlyCostRate: 50, allocationShare: 0.5 },
      ])
    ).toEqual({
      weightedCostTotal: 25,
      allocationTotal: 0.5,
      averageHourlyCostRate: 50,
      contributingPersonCount: 1,
    });
  });

  it("weights different hourly rates by their actual employee shares", () => {
    const result = calculateWeightedLaborCostRate([
      { hourlyCostRate: 40, allocationShare: 1 },
      { hourlyCostRate: 60, allocationShare: 0.5 },
    ]);

    expect(result.weightedCostTotal).toBe(70);
    expect(result.allocationTotal).toBe(1.5);
    expect(result.averageHourlyCostRate).toBeCloseTo(46.6667, 4);
    expect(result.contributingPersonCount).toBe(2);
  });

  it("returns zero safely when no employee share contributes", () => {
    expect(
      calculateWeightedLaborCostRate([
        { hourlyCostRate: 50, allocationShare: 0 },
      ])
    ).toEqual({
      weightedCostTotal: 0,
      allocationTotal: 0,
      averageHourlyCostRate: 0,
      contributingPersonCount: 0,
    });
  });
});
