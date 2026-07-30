import { z } from "zod";

export const PLANNING_ACTION_VARIANTS = [
  "single",
  "recurring_hourly",
  "recurring_flat",
] as const;
export type PlanningActionVariant =
  (typeof PLANNING_ACTION_VARIANTS)[number];

export const PLANNING_RECURRENCE_TYPES = [
  "once",
  "weekly",
  "biweekly",
  "monthly",
] as const;
export type PlanningRecurrenceType =
  (typeof PLANNING_RECURRENCE_TYPES)[number];

export const planningRecurrenceSchema = z
  .object({
    type: z.enum(PLANNING_RECURRENCE_TYPES),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  })
  .strict();

export const planningOverbookingApprovalSchema = z
  .object({
    fingerprint: z.string().trim().min(16).max(180),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();

const boundedId = z.string().trim().min(1).max(120);
const isoDateTime = z.string().datetime({ offset: true });

export const sharedPlanningRequestSchema = z
  .object({
    requestId: boundedId,
    projectId: boundedId,
    expectedProjectUpdatedAt: isoDateTime,
    approvalStatus: z.enum(["confirmed", "requested"]),
    assigneeIds: z.array(boundedId).min(1).max(50),
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(4000),
    startAt: isoDateTime,
    endAt: isoDateTime,
    recurrence: planningRecurrenceSchema.default({
      type: "once",
      weekdays: [],
    }),
    offerId: boundedId.optional(),
    planningTrade: z.string().trim().max(180).optional(),
    billingCatalogItemId: boundedId.optional(),
    overbookingApproval: planningOverbookingApprovalSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.assigneeIds).size !== value.assigneeIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assigneeIds"],
        message: "Mitarbeitende dürfen nicht doppelt ausgewählt werden.",
      });
    }
    if (Date.parse(value.endAt) <= Date.parse(value.startAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "Das Terminende muss nach dem Beginn liegen.",
      });
    }
  });

export type SharedPlanningRequest = z.infer<
  typeof sharedPlanningRequestSchema
>;

export function resolvePlanningActionVariant(input: {
  projectKind?: string | null;
  recurringBillingMode?: string | null;
}): PlanningActionVariant {
  const projectKind = (input.projectKind ?? "")
    .trim()
    .toLocaleLowerCase("de-DE");
  if (!projectKind.startsWith("dauer")) return "single";
  return (input.recurringBillingMode ?? "").trim().toLowerCase() === "hourly"
    ? "recurring_hourly"
    : "recurring_flat";
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  );
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : undefined;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthlyOccurrence(
  year: number,
  monthIndex: number,
  weekday: number,
  occurrence: number
) {
  const first = new Date(Date.UTC(year, monthIndex, 1, 12));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + occurrence * 7;
  const result = new Date(Date.UTC(year, monthIndex, day, 12));
  return result.getUTCMonth() === monthIndex ? result : undefined;
}

export function generatePlanningDateKeys(input: {
  startDate: string;
  recurrence: z.infer<typeof planningRecurrenceSchema>;
  maxOccurrences?: number;
}) {
  const start = parseDateKey(input.startDate);
  if (!start) return [];
  if (input.recurrence.type === "once") return [input.startDate];

  const until = input.recurrence.until
    ? parseDateKey(input.recurrence.until)
    : undefined;
  if (!until || until.getTime() < start.getTime()) return [];
  const maxOccurrences = Math.max(
    1,
    Math.min(366, input.maxOccurrences ?? 120)
  );
  const weekdays =
    input.recurrence.weekdays.length > 0
      ? [...new Set(input.recurrence.weekdays)].sort((a, b) => a - b)
      : [start.getUTCDay()];

  const results: string[] = [];
  if (input.recurrence.type === "monthly") {
    const occurrence = Math.floor((start.getUTCDate() - 1) / 7);
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12)
    );
    while (
      cursor.getTime() <= until.getTime() &&
      results.length < maxOccurrences
    ) {
      for (const weekday of weekdays) {
        const candidate = monthlyOccurrence(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          weekday,
          occurrence
        );
        if (
          candidate &&
          candidate.getTime() >= start.getTime() &&
          candidate.getTime() <= until.getTime()
        ) {
          results.push(dateKey(candidate));
        }
      }
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12)
      );
    }
  } else {
    const intervalWeeks =
      input.recurrence.type === "biweekly" ? 2 : 1;
    let cursor = new Date(start);
    while (
      cursor.getTime() <= until.getTime() &&
      results.length < maxOccurrences
    ) {
      const daysSinceStart = Math.floor(
        (cursor.getTime() - start.getTime()) / 86_400_000
      );
      const weeksSinceStart = Math.floor(daysSinceStart / 7);
      if (
        weeksSinceStart % intervalWeeks === 0 &&
        weekdays.includes(cursor.getUTCDay())
      ) {
        results.push(dateKey(cursor));
      }
      cursor = addUtcDays(cursor, 1);
    }
  }
  return [...new Set(results)].sort().slice(0, maxOccurrences);
}

function timeMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

export function getNetPlanningMinutes(input: {
  startTime: string;
  endTime: string;
  breakWindow?: { start?: string | null; end?: string | null } | null;
}) {
  const start = timeMinutes(input.startTime);
  const end = timeMinutes(input.endTime);
  if (start === undefined || end === undefined || end <= start) return 0;
  const gross = end - start;
  const breakStart = input.breakWindow?.start
    ? timeMinutes(input.breakWindow.start)
    : undefined;
  const breakEnd = input.breakWindow?.end
    ? timeMinutes(input.breakWindow.end)
    : undefined;
  if (
    breakStart === undefined ||
    breakEnd === undefined ||
    breakEnd <= breakStart
  ) {
    return gross;
  }
  const overlap = Math.max(
    0,
    Math.min(end, breakEnd) - Math.max(start, breakStart)
  );
  return Math.max(0, gross - overlap);
}

export function planningWeekdayKey(dateKeyValue: string) {
  const date = parseDateKey(dateKeyValue);
  if (!date) return undefined;
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][date.getUTCDay()];
}
