type WorkSchedule = {
  planningStartTime: string;
  planningEndTime: string;
  weeklyCapacity: unknown;
};

export type AbsenceDayPart = "full" | "first-half" | "second-half";

type ZonedParts = {
  dateKey: string;
  minutes: number;
};

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function parseTime(value: string, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

function timeValue(minutes: number) {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function getZonedParts(value: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = read("hour");
  const minute = read("minute");
  return {
    dateKey: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
  };
}

export function getAbsenceWindow(schedule: WorkSchedule, dayPart: AbsenceDayPart) {
  const start = parseTime(schedule.planningStartTime, 8 * 60);
  const end = parseTime(schedule.planningEndTime, 17 * 60);
  const safeEnd = end > start ? end : start + 8 * 60;
  const midpoint = start + (safeEnd - start) / 2;
  if (dayPart === "first-half") return { startsAtMinutes: start, endsAtMinutes: midpoint };
  if (dayPart === "second-half") return { startsAtMinutes: midpoint, endsAtMinutes: safeEnd };
  return { startsAtMinutes: 0, endsAtMinutes: 24 * 60 };
}

export function isAbsenceActiveAt(schedule: WorkSchedule, dayPart: AbsenceDayPart, localMinutes: number) {
  const window = getAbsenceWindow(schedule, dayPart);
  return localMinutes >= window.startsAtMinutes && localMinutes < window.endsAtMinutes;
}

export function zonedDateTimeToUtc(dateKey: string, localTime: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const localMinutes = parseTime(localTime, 8 * 60);
  const hour = Math.floor(localMinutes / 60);
  const minute = localMinutes % 60;
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let result = targetAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = getZonedParts(new Date(result), timeZone);
    const [observedYear, observedMonth, observedDay] = observed.dateKey.split("-").map(Number);
    const observedAsUtc = Date.UTC(
      observedYear,
      observedMonth - 1,
      observedDay,
      Math.floor(observed.minutes / 60),
      observed.minutes % 60
    );
    const correction = targetAsUtc - observedAsUtc;
    result += correction;
    if (correction === 0) break;
  }
  return new Date(result);
}

function addDateKeyDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function hasWorkingCapacity(schedule: WorkSchedule, dateKey: string) {
  const weeklyCapacity = schedule.weeklyCapacity;
  if (!weeklyCapacity || typeof weeklyCapacity !== "object" || Array.isArray(weeklyCapacity)) return true;
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = WEEKDAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const value = Number((weeklyCapacity as Record<string, unknown>)[weekday]);
  return !Number.isFinite(value) || value > 0;
}

export function getAvailableAt(input: {
  schedule: WorkSchedule;
  dayPart: AbsenceDayPart;
  currentDateKey: string;
  finalAbsenceDateKey: string;
  timeZone: string;
}) {
  if (input.dayPart === "first-half" && input.finalAbsenceDateKey === input.currentDateKey) {
    const window = getAbsenceWindow(input.schedule, input.dayPart);
    return zonedDateTimeToUtc(input.currentDateKey, timeValue(window.endsAtMinutes), input.timeZone);
  }

  let nextDateKey = addDateKeyDays(input.finalAbsenceDateKey, 1);
  for (let attempts = 0; attempts < 14 && !hasWorkingCapacity(input.schedule, nextDateKey); attempts += 1) {
    nextDateKey = addDateKeyDays(nextDateKey, 1);
  }
  return zonedDateTimeToUtc(nextDateKey, input.schedule.planningStartTime || "08:00", input.timeZone);
}
