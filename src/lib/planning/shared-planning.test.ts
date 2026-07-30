import { describe, expect, it } from "vitest";
import {
  generatePlanningDateKeys,
  getNetPlanningMinutes,
  resolvePlanningActionVariant,
  sharedPlanningRequestSchema,
} from "@/lib/planning/shared-planning";

describe("shared planning contract", () => {
  it.each([
    [{ projectKind: "Einmalprojekt" }, "single"],
    [
      { projectKind: "Dauerläufer", recurringBillingMode: "hourly" },
      "recurring_hourly",
    ],
    [
      { projectKind: "Dauerläufer", recurringBillingMode: "flat" },
      "recurring_flat",
    ],
  ] as const)("resolves the project planning variant", (input, expected) => {
    expect(resolvePlanningActionVariant(input)).toBe(expected);
  });

  it("rejects duplicate assignees and empty descriptions", () => {
    const parsed = sharedPlanningRequestSchema.safeParse({
      requestId: "request-1",
      projectId: "project-1",
      expectedProjectUpdatedAt: "2026-07-30T10:00:00.000Z",
      approvalStatus: "confirmed",
      assigneeIds: ["user-1", "user-1"],
      title: "Montage",
      description: "",
      startAt: "2026-08-03T06:00:00.000Z",
      endAt: "2026-08-03T08:00:00.000Z",
      recurrence: { type: "once", weekdays: [] },
    });
    expect(parsed.success).toBe(false);
  });

  it("generates weekly, biweekly and monthly occurrences deterministically", () => {
    expect(
      generatePlanningDateKeys({
        startDate: "2026-08-03",
        recurrence: {
          type: "weekly",
          until: "2026-08-17",
          weekdays: [1],
        },
      })
    ).toEqual(["2026-08-03", "2026-08-10", "2026-08-17"]);
    expect(
      generatePlanningDateKeys({
        startDate: "2026-08-03",
        recurrence: {
          type: "biweekly",
          until: "2026-08-31",
          weekdays: [1],
        },
      })
    ).toEqual(["2026-08-03", "2026-08-17", "2026-08-31"]);
    expect(
      generatePlanningDateKeys({
        startDate: "2026-08-03",
        recurrence: {
          type: "monthly",
          until: "2026-10-31",
          weekdays: [1],
        },
      })
    ).toEqual(["2026-08-03", "2026-09-07", "2026-10-05"]);
  });

  it("subtracts an overlapping break for each employee occurrence", () => {
    expect(
      getNetPlanningMinutes({
        startTime: "10:00",
        endTime: "14:00",
        breakWindow: { start: "12:00", end: "12:30" },
      })
    ).toBe(210);
    expect(
      getNetPlanningMinutes({
        startTime: "08:00",
        endTime: "10:00",
        breakWindow: { start: "12:00", end: "12:30" },
      })
    ).toBe(120);
  });
});
