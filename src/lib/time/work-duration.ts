export type WorkBreakWindow = {
  start?: string | null;
  end?: string | null;
};

type WeeklyBreakWindows = Record<string, WorkBreakWindow | undefined>;

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function parseWorkTimeMinutes(value: unknown) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function getScheduledBreakWindowForDate(
  planningBreakWindows: unknown,
  dateKey: string,
): WorkBreakWindow | null {
  if (!planningBreakWindows || typeof planningBreakWindows !== "object") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const weekdayKey = WEEKDAY_KEYS[date.getUTCDay()];
  const window = (planningBreakWindows as WeeklyBreakWindows)[weekdayKey];
  return window && typeof window === "object" ? window : null;
}

export function getScheduledBreakOverlapMinutes(input: {
  startTime: string;
  endTime: string;
  breakWindow?: WorkBreakWindow | null;
}) {
  const start = parseWorkTimeMinutes(input.startTime);
  const end = parseWorkTimeMinutes(input.endTime);
  const breakStart = parseWorkTimeMinutes(input.breakWindow?.start);
  const breakEnd = parseWorkTimeMinutes(input.breakWindow?.end);
  if (
    start === null ||
    end === null ||
    breakStart === null ||
    breakEnd === null ||
    end <= start ||
    breakEnd <= breakStart
  ) {
    return 0;
  }
  return Math.max(0, Math.min(end, breakEnd) - Math.max(start, breakStart));
}

export function getScheduledBreakShortfallMinutes(input: {
  startTime: string;
  endTime: string;
  pauseMs: bigint | number;
  breakWindow?: WorkBreakWindow | null;
}) {
  const scheduledMinutes = getScheduledBreakOverlapMinutes(input);
  const recordedMinutes = Math.max(0, Number(input.pauseMs || 0)) / 60_000;
  return Math.max(0, Math.ceil(scheduledMinutes - recordedMinutes));
}

export function getNetWorkDurationMs(durationMs: bigint | number) {
  return Math.max(0, Number(durationMs || 0));
}
