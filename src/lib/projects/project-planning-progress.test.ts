import { describe, expect, it } from "vitest";
import { getHourlyRecurringPlanningProgressState } from "@/lib/projects/project-planning-progress";

describe("hourly recurring project planning progress", () => {
  it("stays open when the selected month has no planning", () => {
    expect(
      getHourlyRecurringPlanningProgressState({ confirmedEntries: 0, requestedEntries: 0 })
    ).toBe("open");
  });

  it("is partial when the selected month only has appointment requests", () => {
    expect(
      getHourlyRecurringPlanningProgressState({ confirmedEntries: 0, requestedEntries: 2 })
    ).toBe("partial");
  });

  it("is done when the selected month has a confirmed appointment", () => {
    expect(
      getHourlyRecurringPlanningProgressState({ confirmedEntries: 1, requestedEntries: 3 })
    ).toBe("done");
  });
});
