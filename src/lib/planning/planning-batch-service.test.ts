import { describe, expect, it } from "vitest";
import { resolveOfferPlanningMinutes } from "@/lib/planning/planning-batch-service";

describe("planning batch offer quota", () => {
  it("uses assigned labor hours when a labor allocation exists", () => {
    expect(
      resolveOfferPlanningMinutes([
        {
          quantity: 8,
          isLaborPosition: true,
          plannedLaborHours: 5.5,
        },
      ])
    ).toBe(330);
  });

  it("uses the labor-position quantity for productive legacy offers without allocations", () => {
    expect(
      resolveOfferPlanningMinutes([
        {
          quantity: 1,
          isLaborPosition: true,
          plannedLaborHours: 0,
        },
      ])
    ).toBe(60);
  });

  it("does not turn material quantities into labor quota", () => {
    expect(
      resolveOfferPlanningMinutes([
        {
          quantity: 12,
          isLaborPosition: false,
          plannedLaborHours: 0,
        },
      ])
    ).toBe(0);
  });

  it("adds modern and legacy productive lines with minute precision", () => {
    expect(
      resolveOfferPlanningMinutes([
        {
          quantity: 10,
          isLaborPosition: true,
          plannedLaborHours: 2.25,
        },
        {
          quantity: 1.5,
          isLaborPosition: true,
          plannedLaborHours: 0,
        },
        {
          quantity: 100,
          isLaborPosition: false,
          plannedLaborHours: 0,
        },
      ])
    ).toBe(225);
  });
});
