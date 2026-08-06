import { describe, expect, it } from "vitest";
import {
  clampProjectMonthKey,
  getProjectMonthWindow,
  shiftProjectMonthKey,
} from "@/lib/projects/project-month-range";

describe("project month range", () => {
  it("clamps navigation to the contractual project term", () => {
    expect(clampProjectMonthKey("2026-07", "2026-08", "2027-01")).toBe("2026-08");
    expect(clampProjectMonthKey("2027-02", "2026-08", "2027-01")).toBe("2027-01");
    expect(clampProjectMonthKey("2026-11", "2026-08", "2027-01")).toBe("2026-11");
  });

  it("shifts correctly across year boundaries", () => {
    expect(shiftProjectMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftProjectMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("never renders months outside the project term", () => {
    expect(
      getProjectMonthWindow({
        selectedMonth: "2026-08",
        startMonth: "2026-08",
        endMonth: "2027-01",
      })
    ).toEqual(["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"]);
  });
});
