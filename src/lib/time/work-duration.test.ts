import { describe, expect, it } from "vitest";
import {
  getNetWorkDurationMs,
  getScheduledBreakOverlapMinutes,
  getScheduledBreakShortfallMinutes,
  getScheduledBreakWindowForDate,
  parseWorkTimeMinutes,
} from "@/lib/time/work-duration";

describe("work-duration contract", () => {
  const windows = {
    thursday: { start: "12:00", end: "12:30" },
    friday: { start: "12:15", end: "12:45" },
  };

  it("resolves the configured break by German work date without timezone drift", () => {
    expect(getScheduledBreakWindowForDate(windows, "2026-08-06")).toEqual({
      start: "12:00",
      end: "12:30",
    });
    expect(getScheduledBreakWindowForDate(windows, "2026-08-07")).toEqual({
      start: "12:15",
      end: "12:45",
    });
  });

  it("calculates only the overlapping part of a configured break", () => {
    expect(getScheduledBreakOverlapMinutes({
      startTime: "08:00",
      endTime: "16:30",
      breakWindow: windows.thursday,
    })).toBe(30);
    expect(getScheduledBreakOverlapMinutes({
      startTime: "12:15",
      endTime: "12:45",
      breakWindow: windows.thursday,
    })).toBe(15);
    expect(getScheduledBreakOverlapMinutes({
      startTime: "08:00",
      endTime: "11:30",
      breakWindow: windows.thursday,
    })).toBe(0);
  });

  it("reports only an unrecorded scheduled-break shortfall", () => {
    expect(getScheduledBreakShortfallMinutes({
      startTime: "08:00",
      endTime: "16:00",
      pauseMs: 0,
      breakWindow: windows.thursday,
    })).toBe(30);
    expect(getScheduledBreakShortfallMinutes({
      startTime: "08:00",
      endTime: "16:00",
      pauseMs: 15 * 60_000,
      breakWindow: windows.thursday,
    })).toBe(15);
    expect(getScheduledBreakShortfallMinutes({
      startTime: "08:00",
      endTime: "16:00",
      pauseMs: 30 * 60_000,
      breakWindow: windows.thursday,
    })).toBe(0);
  });

  it("treats durationMs as the canonical net working duration", () => {
    expect(getNetWorkDurationMs(8 * 3_600_000)).toBe(8 * 3_600_000);
    expect(getNetWorkDurationMs(-1)).toBe(0);
    expect(parseWorkTimeMinutes("16:30")).toBe(990);
    expect(parseWorkTimeMinutes("24:00")).toBeNull();
  });
});
