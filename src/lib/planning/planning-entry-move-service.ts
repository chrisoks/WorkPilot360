import { createHash, randomUUID } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { canManagePlanningEntries } from "@/lib/permissions";
import { getNetPlanningMinutes, resolvePlanningActionVariant } from "@/lib/planning/shared-planning";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import { sendPushToUserSafely } from "@/lib/push/web-push";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export type PlanningMoveActor = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId: string;
};

type PlanningEntryRow = {
  id: string; organizationId: string; source: string; board: string; groupName: string;
  userId: string | null; employeeName: string | null; date: string; startTime: string;
  endTime: string; durationMinutes: number; title: string; description: string | null;
  customer: string | null; projectId: string | null; projectLabel: string | null;
  objectAddressId: string | null; objectAddressLabel: string | null; planningTrade: string | null;
  billingCatalogItemId: string | null; billingCatalogItemLabel: string | null;
  billingGroupId: string | null; offerId: string | null; offerLineId: string | null;
  offerLabel: string | null; offerTotalMinutes: number | null; offerPlannedMinutes: number | null;
  batchId: string | null; overbookingKind: string | null; overbookingReason: string | null;
  marketingContentItemId: string | null; marketingContentScheduleId: string | null;
  recurrenceId: string | null; recurrenceRule: string | null; approvalStatus: string | null;
  requestedByUserId: string | null; requestedByName: string | null;
  approvedByUserId: string | null; approvedAt: Date | null; deletedAt: Date | null;
  createdAt: Date; updatedAt: Date;
};

type PlanningUserRow = {
  id: string; firstName: string; lastName: string; email: string; isActive: boolean;
  planningBoard: string | null; planningGroup: string | null; planningBreakWindows: unknown;
};

type ProjectRow = {
  id: string; projectNumber: string; title: string; status: string;
  projectKind: string | null; recurringBillingMode: string | null;
  timeBudgetAllocations: unknown; updatedAt: Date;
};

type OfferRow = { id: string; offerNumber: string; status: string; plannedExecutionMonth: string };

export type PlanningEntryMoveScope = "single" | "series_from_entry";

type PlanningEntryMoveTarget = {
  entryId: string;
  userId: string;
  projectId: string;
  projectLabel: string;
  title: string;
  approvalStatus: "confirmed" | "requested";
  from: { date: string; startTime: string; endTime: string; durationMinutes: number };
  to: { date: string; startTime: string; endTime: string; durationMinutes: number };
};

export type PlanningEntryMoveEvaluation = {
  scope: PlanningEntryMoveScope;
  entry: {
    id: string; title: string; projectId: string; projectLabel: string; employee: string;
    approvalStatus: "confirmed" | "requested"; recurrenceRule: string;
  };
  from: { date: string; startTime: string; endTime: string; durationMinutes: number };
  to: { date: string; startTime: string; endTime: string; durationMinutes: number };
  reason: string;
  warnings: Array<{ code: string; message: string }>;
  overbooking: {
    required: boolean; kind: "offer" | "monthly" | null; label: string;
    availableMinutes: number; requestedMinutes: number; exceededMinutes: number;
    fingerprint: string | null;
  };
  series: {
    recurrenceId: string; count: number; entryIds: string[]; employeeCount: number;
    fromDate: string; toDate: string; targetFromDate: string; targetToDate: string;
    deltaDays: number; deltaMinutes: number;
  } | null;
  targets: PlanningEntryMoveTarget[];
  fingerprint: string;
};

export type PlanningEntryMoveResult = {
  entry: PlanningEntryMoveEvaluation["entry"] & PlanningEntryMoveEvaluation["to"];
  previous: PlanningEntryMoveEvaluation["from"];
  scope: PlanningEntryMoveScope;
  affected: Array<{ entry: PlanningEntryMoveEvaluation["entry"] & PlanningEntryMoveEvaluation["to"]; previous: PlanningEntryMoveEvaluation["from"] }>;
  affectedEntryIds: string[];
  series: PlanningEntryMoveEvaluation["series"];
  reason: string;
  replayed: boolean;
};

export class PlanningEntryMoveError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400, readonly details?: unknown) {
    super(message);
    this.name = "PlanningEntryMoveError";
  }
}

export function isPlanningEntryMoveError(error: unknown): error is PlanningEntryMoveError {
  return error instanceof PlanningEntryMoveError;
}

export function getPlanningEntryMoveConfirmationText(entryId: string, scope: PlanningEntryMoveScope = "single") {
  return `${scope === "series_from_entry" ? "TERMIN-SERIE VERSCHIEBEN" : "TERMIN VERSCHIEBEN"} ${entryId.trim()}`;
}

export function matchesPlanningEntryMoveConfirmation(entryId: string, confirmationText: string, scope: PlanningEntryMoveScope = "single") {
  return confirmationText.trim() === getPlanningEntryMoveConfirmationText(entryId, scope);
}

function clean(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function actorName(actor: PlanningMoveActor) { return `${actor.firstName} ${actor.lastName}`.trim() || actor.email; }
function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value: unknown) { return createHash("sha256").update(stable(value)).digest("hex"); }
function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validTime(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function displayDate(value: string) { const [y, m, d] = value.split("-"); return `${d}.${m}.${y}`; }
function deterministicId(prefix: string, ...parts: string[]) { return `${prefix}-${sha256(parts).slice(0, 32)}`; }
function dateDay(value: string) { return Math.floor(Date.parse(`${value}T12:00:00Z`) / 86_400_000); }
function addDays(value: string, days: number) { return new Date((dateDay(value) + days) * 86_400_000 + 43_200_000).toISOString().slice(0, 10); }
function timeMinute(value: string) { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }
function addMinutes(value: string, minutes: number) {
  const total = timeMinute(value) + minutes;
  if (total < 0 || total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function planningMoveNotificationId(organizationId: string, requestId: string, userId: string) {
  return deterministicId("planning-move-notification", organizationId, requestId, userId);
}

function planningMoveNotificationText(entry: PlanningEntryRow, previous: PlanningEntryMoveEvaluation["from"]) {
  const subject = entry.approvalStatus === "requested" ? "Terminwunsch verschoben" : "Termin verschoben";
  const body = `${entry.approvalStatus === "requested" ? "Der Terminwunsch" : "Der Termin"} „${entry.title}“ wurde von ${displayDate(previous.date)}, ${previous.startTime}-${previous.endTime} auf ${displayDate(entry.date)}, ${entry.startTime}-${entry.endTime} verschoben.`;
  return { subject, body };
}

function parseMonthBudgets(value: unknown) {
  const result = new Map<string, number>();
  for (const item of Array.isArray(value) ? value : []) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const month = clean(row.month); const hours = Number(row.hours);
    if (/^\d{4}-\d{2}$/.test(month) && Number.isFinite(hours) && hours >= 0) result.set(month, Math.round(hours * 60));
  }
  return result;
}

function breakWindow(user: PlanningUserRow, date: string) {
  const raw = user.planningBreakWindows && typeof user.planningBreakWindows === "object" && !Array.isArray(user.planningBreakWindows)
    ? user.planningBreakWindows as Record<string, unknown> : {};
  const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(`${date}T12:00:00Z`).getUTCDay()];
  const value = weekday ? raw[weekday] : null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>; const start = clean(row.start); const end = clean(row.end);
  return start && end ? { start, end } : null;
}

async function loadEntry(db: DatabaseClient, organizationId: string, entryId: string, lock = false) {
  const rows = lock
    ? await db.$queryRaw<PlanningEntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${organizationId} AND "id"=${entryId} LIMIT 1 FOR UPDATE`
    : await db.$queryRaw<PlanningEntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${organizationId} AND "id"=${entryId} LIMIT 1`;
  if (!rows[0]) throw new PlanningEntryMoveError("not_found", "Der Termin wurde in dieser Organisation nicht gefunden.", 404);
  return rows[0];
}

async function evaluateInternal(input: {
  db: DatabaseClient; organizationId: string; actor: PlanningMoveActor; entryId: string;
  date: string; startTime: string; endTime: string; reason: string; requireManagement?: boolean; lock?: boolean;
}) {
  const entry = await loadEntry(input.db, input.organizationId, clean(input.entryId), input.lock);
  const reason = clean(input.reason); const date = clean(input.date); const startTime = clean(input.startTime); const endTime = clean(input.endTime);
  const mayManage = canManagePlanningEntries(input.actor);
  const ownsOpenRequest = entry.approvalStatus === "requested" && (entry.userId === input.actor.id || entry.requestedByUserId === input.actor.id);
  if (!mayManage && (!ownsOpenRequest || input.requireManagement)) {
    throw new PlanningEntryMoveError("forbidden", input.requireManagement ? "Nur die Planungsverantwortung darf Termine mit JARVIS verschieben." : "Du darfst nur eigene offene Terminwünsche verschieben.", 403);
  }
  if (entry.deletedAt) throw new PlanningEntryMoveError("deleted", "Der Termin ist bereits gelöscht.", 409);
  if (reason.length < 3 || reason.length > 500) throw new PlanningEntryMoveError("reason_required", "Bitte einen nachvollziehbaren Verschiebungsgrund mit 3 bis 500 Zeichen angeben.", 400);
  if (!validDate(date) || !validTime(startTime) || !validTime(endTime)) throw new PlanningEntryMoveError("invalid_datetime", "Bitte ein gültiges Datum sowie Beginn und Ende angeben.", 400);
  if (endTime <= startTime) throw new PlanningEntryMoveError("invalid_datetime", "Das Terminende muss nach dem Beginn liegen.", 400);
  if (entry.date === date && entry.startTime === startTime && entry.endTime === endTime) throw new PlanningEntryMoveError("no_change", "Der Termin liegt bereits genau in diesem Zeitraum.", 409);
  if (!entry.userId) throw new PlanningEntryMoveError("assignee_missing", "Der Termin hat keine eindeutig zugeordnete Person.", 409);

  const users = await input.db.$queryRaw<PlanningUserRow[]>`SELECT "id","firstName","lastName","email","isActive","planningBoard","planningGroup","planningBreakWindows" FROM "User" WHERE "organizationId"=${input.organizationId} AND "id"=${entry.userId} LIMIT 1`;
  const user = users[0];
  if (!user?.isActive) throw new PlanningEntryMoveError("assignee_inactive", "Die eingeplante Person ist nicht mehr aktiv.", 409);
  const durationMinutes = getNetPlanningMinutes({ startTime, endTime, breakWindow: breakWindow(user, date) });
  if (durationMinutes <= 0) throw new PlanningEntryMoveError("invalid_duration", "Der Zielzeitraum enthält keine planbare Arbeitszeit.", 400);

  const absences = await input.db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Absence" WHERE "organizationId"=${input.organizationId} AND "userId"=${entry.userId} AND "date"=${date}::date AND "deletedAt" IS NULL AND "status"='genehmigt' AND "type" IN ('urlaub','krank','ueberstundenabbau') AND (COALESCE("dayPart",'full')='full' OR ("dayPart"='first-half' AND ${startTime}<'12:00') OR ("dayPart"='second-half' AND ${endTime}>'12:00')) LIMIT 1`;
  if (absences.length) throw new PlanningEntryMoveError("absence_conflict", `${entry.employeeName || "Die eingeplante Person"} ist im Zielzeitraum genehmigt abwesend.`, 409);

  const duplicates = entry.projectId ? await input.db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"<>${entry.id} AND "projectId"=${entry.projectId} AND "userId"=${entry.userId} AND "date"=${date} AND "deletedAt" IS NULL LIMIT 1` : [];
  if (duplicates.length) throw new PlanningEntryMoveError("duplicate_project_day", "Diese Person ist am Zieltag bereits auf dasselbe Projekt geplant. Bitte den vorhandenen Termin prüfen.", 409);
  const overlaps = await input.db.$queryRaw<Array<{ id: string; title: string; startTime: string; endTime: string }>>`SELECT "id","title","startTime","endTime" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"<>${entry.id} AND "userId"=${entry.userId} AND "date"=${date} AND "deletedAt" IS NULL AND COALESCE("approvalStatus",'confirmed')='confirmed' AND "startTime"<${endTime} AND "endTime">${startTime} ORDER BY "startTime"`;

  const projects = entry.projectId ? await input.db.$queryRaw<ProjectRow[]>`SELECT "id","projectNumber","title","status","projectKind","recurringBillingMode","timeBudgetAllocations","updatedAt" FROM "WorkPilotProject" WHERE "organizationId"=${input.organizationId} AND "id"=${entry.projectId} LIMIT 1` : [];
  const project = projects[0] ?? null;
  if (entry.projectId && !project) throw new PlanningEntryMoveError("project_missing", "Das verknüpfte Projekt wurde nicht gefunden.", 409);
  if (project?.status.toLocaleLowerCase("de-DE").includes("archiviert")) throw new PlanningEntryMoveError("project_archived", "Ein Termin in einem archivierten Projekt darf nicht verschoben werden.", 409);

  let overbooking: PlanningEntryMoveEvaluation["overbooking"] = { required: false, kind: null, label: "Kein Kontingent überschritten", availableMinutes: 0, requestedMinutes: durationMinutes, exceededMinutes: 0, fingerprint: null };
  const variant = project ? resolvePlanningActionVariant(project) : null;
  if (project && variant === "single" && entry.offerId) {
    const offers = await input.db.$queryRaw<OfferRow[]>`SELECT "id","offerNumber","status","plannedExecutionMonth" FROM "Offer" WHERE "organizationId"=${input.organizationId} AND "projectId"=${project.id} AND "id"=${entry.offerId} LIMIT 1`;
    const offer = offers[0];
    if (!offer || ["Entwurf","Verloren","Angebot verloren","Gelöscht"].includes(offer.status)) throw new PlanningEntryMoveError("offer_invalid", "Das verknüpfte finale Angebot ist nicht mehr planbar.", 409);
    if (offer.plannedExecutionMonth !== date.slice(0, 7)) throw new PlanningEntryMoveError("offer_month_mismatch", `Der Zielmonat stimmt nicht mit dem Ausführungsmonat des Angebots ${offer.offerNumber} überein.`, 409);
    const totals = await input.db.$queryRaw<Array<{ total: number }>>`SELECT COALESCE(SUM(COALESCE("offerPlannedMinutes","durationMinutes")),0)::int AS "total" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"<>${entry.id} AND "offerId"=${entry.offerId} AND "deletedAt" IS NULL`;
    const quota = Math.max(0, Number(entry.offerTotalMinutes ?? 0)); const used = Math.max(0, Number(totals[0]?.total ?? 0)); const available = Math.max(0, quota - used); const exceeded = Math.max(0, durationMinutes - available);
    overbooking = { required: exceeded > 0, kind: exceeded > 0 ? "offer" : null, label: `Angebot ${offer.offerNumber}`, availableMinutes: available, requestedMinutes: durationMinutes, exceededMinutes: exceeded, fingerprint: null };
  } else if (project && variant === "recurring_flat") {
    const month = date.slice(0, 7); const quota = parseMonthBudgets(project.timeBudgetAllocations).get(month) ?? 0;
    if (quota <= 0) throw new PlanningEntryMoveError("monthly_quota_missing", `Für ${month} ist kein Monatskontingent hinterlegt.`, 409);
    const totals = await input.db.$queryRaw<Array<{ total: number }>>`SELECT COALESCE(SUM("durationMinutes"),0)::int AS "total" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id"<>${entry.id} AND "projectId"=${project.id} AND "date" LIKE ${`${month}%`} AND "deletedAt" IS NULL`;
    const used = Math.max(0, Number(totals[0]?.total ?? 0)); const available = Math.max(0, quota - used); const exceeded = Math.max(0, durationMinutes - available);
    overbooking = { required: exceeded > 0, kind: exceeded > 0 ? "monthly" : null, label: `Monatskontingent ${month}`, availableMinutes: available, requestedMinutes: durationMinutes, exceededMinutes: exceeded, fingerprint: null };
  }

  const evidence = { entry, target: { date, startTime, endTime, durationMinutes }, user, absenceIds: absences.map((item) => item.id), duplicateIds: duplicates.map((item) => item.id), overlaps, project, overbooking: { ...overbooking, fingerprint: null } };
  const fingerprint = sha256(evidence);
  if (overbooking.required) overbooking.fingerprint = fingerprint;
  return {
    scope: "single",
    entry: { id: entry.id, title: entry.title, projectId: entry.projectId ?? "", projectLabel: entry.projectLabel ?? "", employee: entry.employeeName ?? (`${user.firstName} ${user.lastName}`.trim() || user.email), approvalStatus: entry.approvalStatus === "requested" ? "requested" : "confirmed", recurrenceRule: entry.recurrenceRule ?? "" },
    from: { date: entry.date, startTime: entry.startTime, endTime: entry.endTime, durationMinutes: entry.durationMinutes },
    to: { date, startTime, endTime, durationMinutes }, reason, fingerprint, overbooking,
    series: null,
    targets: [{
      entryId: entry.id, userId: entry.userId, projectId: entry.projectId ?? "", projectLabel: entry.projectLabel ?? "", title: entry.title,
      approvalStatus: entry.approvalStatus === "requested" ? "requested" : "confirmed",
      from: { date: entry.date, startTime: entry.startTime, endTime: entry.endTime, durationMinutes: entry.durationMinutes },
      to: { date, startTime, endTime, durationMinutes },
    }],
    warnings: [
      ...(entry.recurrenceId || entry.recurrenceRule ? [{ code: "single_occurrence", message: "Es wird nur dieser einzelne Serientermin verschoben; die übrige Serie bleibt unverändert." }] : []),
      ...overlaps.map((item) => ({ code: "overlap", message: `Überschneidung mit „${item.title}“ von ${item.startTime} bis ${item.endTime}.` })),
    ],
  } satisfies PlanningEntryMoveEvaluation;
}

async function evaluateSeriesInternal(input: {
  db: DatabaseClient; organizationId: string; actor: PlanningMoveActor; entryId: string;
  date: string; startTime: string; endTime: string; reason: string; requireManagement?: boolean; lock?: boolean;
}) {
  if (!canManagePlanningEntries(input.actor)) {
    throw new PlanningEntryMoveError("forbidden", "Nur die Planungsverantwortung darf einen Termin und alle folgenden Serieneinträge gemeinsam verschieben.", 403);
  }
  const anchor = await loadEntry(input.db, input.organizationId, clean(input.entryId), input.lock);
  if (anchor.deletedAt) throw new PlanningEntryMoveError("deleted", "Der ausgewählte Serientermin ist bereits gelöscht.", 409);
  if (!anchor.recurrenceId) throw new PlanningEntryMoveError("series_missing", "Dieser Planungseintrag gehört keiner eindeutig gespeicherten Terminserie an.", 409);
  const reason = clean(input.reason); const date = clean(input.date); const startTime = clean(input.startTime); const endTime = clean(input.endTime);
  if (reason.length < 3 || reason.length > 500) throw new PlanningEntryMoveError("reason_required", "Bitte einen nachvollziehbaren Verschiebungsgrund mit 3 bis 500 Zeichen angeben.", 400);
  if (!validDate(date) || !validTime(startTime) || !validTime(endTime) || endTime <= startTime) throw new PlanningEntryMoveError("invalid_datetime", "Bitte ein gültiges Datum sowie einen Zeitraum mit Ende nach Beginn angeben.", 400);
  if (anchor.date === date && anchor.startTime === startTime && anchor.endTime === endTime) throw new PlanningEntryMoveError("no_change", "Der ausgewählte Serientermin liegt bereits genau in diesem Zeitraum.", 409);
  const anchorDuration = timeMinute(anchor.endTime) - timeMinute(anchor.startTime);
  if (timeMinute(endTime) - timeMinute(startTime) !== anchorDuration) {
    throw new PlanningEntryMoveError("series_duration_change", "Bei einer Serienverschiebung muss die bisherige Termindauer unverändert bleiben. Eine Daueränderung ist ein getrennter Bearbeitungsschritt.", 409);
  }
  const deltaDays = dateDay(date) - dateDay(anchor.date);
  const deltaMinutes = timeMinute(startTime) - timeMinute(anchor.startTime);
  const seriesRows = input.lock
    ? await input.db.$queryRaw<PlanningEntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "recurrenceId"=${anchor.recurrenceId} AND "date">=${anchor.date} AND "deletedAt" IS NULL ORDER BY "date","startTime","id" FOR UPDATE`
    : await input.db.$queryRaw<PlanningEntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "recurrenceId"=${anchor.recurrenceId} AND "date">=${anchor.date} AND "deletedAt" IS NULL ORDER BY "date","startTime","id"`;
  if (!seriesRows.some((entry) => entry.id === anchor.id) || !seriesRows.length) throw new PlanningEntryMoveError("stale_context", "Der ausgewählte Serienabschnitt ist nicht mehr vollständig vorhanden.", 409);
  if (seriesRows.some((entry) => !entry.userId)) throw new PlanningEntryMoveError("assignee_missing", "Mindestens ein folgender Serientermin hat keine eindeutig zugeordnete Person.", 409);
  const entryIds = seriesRows.map((entry) => entry.id);
  const userIds = [...new Set(seriesRows.map((entry) => entry.userId!).filter(Boolean))];
  const users = await input.db.$queryRaw<PlanningUserRow[]>`SELECT "id","firstName","lastName","email","isActive","planningBoard","planningGroup","planningBreakWindows" FROM "User" WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(userIds)})`;
  const userById = new Map(users.map((user) => [user.id, user]));
  if (userIds.some((id) => !userById.get(id)?.isActive)) throw new PlanningEntryMoveError("assignee_inactive", "Mindestens eine in der Serie eingeplante Person ist nicht mehr aktiv.", 409);

  const targets: PlanningEntryMoveTarget[] = seriesRows.map((entry) => {
    const targetStart = addMinutes(entry.startTime, deltaMinutes); const targetEnd = addMinutes(entry.endTime, deltaMinutes);
    if (!targetStart || !targetEnd || targetEnd <= targetStart) throw new PlanningEntryMoveError("series_time_out_of_day", "Der bestätigte Zeitversatz würde mindestens einen Serientermin über die Tagesgrenze verschieben.", 409);
    const targetDate = addDays(entry.date, deltaDays); const user = userById.get(entry.userId!)!;
    const durationMinutes = getNetPlanningMinutes({ startTime: targetStart, endTime: targetEnd, breakWindow: breakWindow(user, targetDate) });
    if (durationMinutes <= 0) throw new PlanningEntryMoveError("invalid_duration", `Der Zielzeitraum von ${entry.employeeName || user.email} am ${targetDate} enthält keine planbare Arbeitszeit.`, 409);
    return {
      entryId: entry.id, userId: entry.userId!, projectId: entry.projectId ?? "", projectLabel: entry.projectLabel ?? "", title: entry.title,
      approvalStatus: entry.approvalStatus === "requested" ? "requested" : "confirmed",
      from: { date: entry.date, startTime: entry.startTime, endTime: entry.endTime, durationMinutes: entry.durationMinutes },
      to: { date: targetDate, startTime: targetStart, endTime: targetEnd, durationMinutes },
    };
  });

  for (const [index, target] of targets.entries()) {
    const absence = await input.db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Absence" WHERE "organizationId"=${input.organizationId} AND "userId"=${target.userId} AND "date"=${target.to.date}::date AND "deletedAt" IS NULL AND "status"='genehmigt' AND "type" IN ('urlaub','krank','ueberstundenabbau') AND (COALESCE("dayPart",'full')='full' OR ("dayPart"='first-half' AND ${target.to.startTime}<'12:00') OR ("dayPart"='second-half' AND ${target.to.endTime}>'12:00')) LIMIT 1`;
    if (absence.length) throw new PlanningEntryMoveError("absence_conflict", `${seriesRows[index].employeeName || "Eine eingeplante Person"} ist am ${target.to.date} im Zielzeitraum genehmigt abwesend.`, 409);
    if (target.projectId) {
      const duplicate = await input.db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id" NOT IN (${Prisma.join(entryIds)}) AND "projectId"=${target.projectId} AND "userId"=${target.userId} AND "date"=${target.to.date} AND "deletedAt" IS NULL LIMIT 1`;
      if (duplicate.length) throw new PlanningEntryMoveError("duplicate_project_day", `${seriesRows[index].employeeName || "Eine eingeplante Person"} ist am ${target.to.date} bereits auf dasselbe Projekt geplant.`, 409);
    }
    const overlap = await input.db.$queryRaw<Array<{ id: string; title: string; startTime: string; endTime: string }>>`SELECT "id","title","startTime","endTime" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id" NOT IN (${Prisma.join(entryIds)}) AND "userId"=${target.userId} AND "date"=${target.to.date} AND "deletedAt" IS NULL AND COALESCE("approvalStatus",'confirmed')='confirmed' AND "startTime"<${target.to.endTime} AND "endTime">${target.to.startTime} ORDER BY "startTime" LIMIT 1`;
    if (overlap.length) throw new PlanningEntryMoveError("overlap_conflict", `${seriesRows[index].employeeName || "Eine eingeplante Person"} überschneidet sich am ${target.to.date} mit „${overlap[0].title}“ (${overlap[0].startTime}-${overlap[0].endTime}).`, 409);
  }
  for (let left = 0; left < targets.length; left += 1) for (let right = left + 1; right < targets.length; right += 1) {
    const a = targets[left]; const b = targets[right];
    if (a.userId === b.userId && a.to.date === b.to.date && a.to.startTime < b.to.endTime && a.to.endTime > b.to.startTime) {
      throw new PlanningEntryMoveError("series_internal_overlap", `Die Verschiebung würde zwei Serientermine derselben Person am ${a.to.date} überlappen lassen.`, 409);
    }
  }

  const projectIds = [...new Set(targets.map((target) => target.projectId).filter(Boolean))];
  const projects = projectIds.length
    ? await input.db.$queryRaw<ProjectRow[]>`SELECT "id","projectNumber","title","status","projectKind","recurringBillingMode","timeBudgetAllocations","updatedAt" FROM "WorkPilotProject" WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(projectIds)})`
    : [];
  const projectById = new Map(projects.map((project) => [project.id, project]));
  if (projectIds.some((id) => !projectById.has(id))) throw new PlanningEntryMoveError("project_missing", "Mindestens ein verknüpftes Serienprojekt wurde nicht gefunden.", 409);
  if (projects.some((project) => project.status.toLocaleLowerCase("de-DE").includes("archiviert"))) throw new PlanningEntryMoveError("project_archived", "Ein Termin in einem archivierten Projekt darf nicht als Teil der Serie verschoben werden.", 409);

  const quotaDetails: Array<{ kind: "offer" | "monthly"; label: string; available: number; requested: number; exceeded: number }> = [];
  const offerGroups = new Map<string, PlanningEntryMoveTarget[]>(); const monthlyGroups = new Map<string, PlanningEntryMoveTarget[]>();
  for (const target of targets) {
    const row = seriesRows.find((entry) => entry.id === target.entryId)!; const project = target.projectId ? projectById.get(target.projectId) : null; const variant = project ? resolvePlanningActionVariant(project) : null;
    if (project && variant === "single" && row.offerId) offerGroups.set(row.offerId, [...(offerGroups.get(row.offerId) ?? []), target]);
    if (project && variant === "recurring_flat") { const key = `${project.id}:${target.to.date.slice(0, 7)}`; monthlyGroups.set(key, [...(monthlyGroups.get(key) ?? []), target]); }
  }
  for (const [offerId, group] of offerGroups) {
    const offers = await input.db.$queryRaw<OfferRow[]>`SELECT "id","offerNumber","status","plannedExecutionMonth" FROM "Offer" WHERE "organizationId"=${input.organizationId} AND "id"=${offerId} LIMIT 1`;
    const offer = offers[0]; if (!offer || ["Entwurf","Verloren","Angebot verloren","Gelöscht"].includes(offer.status)) throw new PlanningEntryMoveError("offer_invalid", "Mindestens ein verknüpftes finales Angebot ist nicht mehr planbar.", 409);
    if (group.some((target) => target.to.date.slice(0, 7) !== offer.plannedExecutionMonth)) throw new PlanningEntryMoveError("offer_month_mismatch", `Mindestens ein Zielmonat stimmt nicht mit dem Ausführungsmonat des Angebots ${offer.offerNumber} überein.`, 409);
    const rows = seriesRows.filter((entry) => entry.offerId === offerId); const quota = Math.max(0, ...rows.map((entry) => Number(entry.offerTotalMinutes ?? 0)));
    const totals = await input.db.$queryRaw<Array<{ total: number }>>`SELECT COALESCE(SUM(COALESCE("offerPlannedMinutes","durationMinutes")),0)::int AS "total" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id" NOT IN (${Prisma.join(entryIds)}) AND "offerId"=${offerId} AND "deletedAt" IS NULL`;
    const used = Math.max(0, Number(totals[0]?.total ?? 0)); const available = Math.max(0, quota - used); const requested = group.reduce((sum, target) => sum + target.to.durationMinutes, 0);
    quotaDetails.push({ kind: "offer", label: `Angebot ${offer.offerNumber}`, available, requested, exceeded: Math.max(0, requested - available) });
  }
  for (const [key, group] of monthlyGroups) {
    const [projectId, month] = key.split(":"); const project = projectById.get(projectId)!; const quota = parseMonthBudgets(project.timeBudgetAllocations).get(month) ?? 0;
    if (quota <= 0) throw new PlanningEntryMoveError("monthly_quota_missing", `Für ${month} ist im Projekt ${project.projectNumber} kein Monatskontingent hinterlegt.`, 409);
    const totals = await input.db.$queryRaw<Array<{ total: number }>>`SELECT COALESCE(SUM("durationMinutes"),0)::int AS "total" FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "id" NOT IN (${Prisma.join(entryIds)}) AND "projectId"=${projectId} AND "date" LIKE ${`${month}%`} AND "deletedAt" IS NULL`;
    const used = Math.max(0, Number(totals[0]?.total ?? 0)); const available = Math.max(0, quota - used); const requested = group.reduce((sum, target) => sum + target.to.durationMinutes, 0);
    quotaDetails.push({ kind: "monthly", label: `${project.projectNumber} · Monatskontingent ${month}`, available, requested, exceeded: Math.max(0, requested - available) });
  }
  const exceededDetails = quotaDetails.filter((detail) => detail.exceeded > 0);
  let overbooking: PlanningEntryMoveEvaluation["overbooking"] = {
    required: exceededDetails.length > 0,
    kind: exceededDetails[0]?.kind ?? null,
    label: exceededDetails.length ? exceededDetails.map((detail) => detail.label).join(" · ") : "Alle betroffenen Kontingente sind ausreichend",
    availableMinutes: quotaDetails.reduce((sum, detail) => sum + detail.available, 0),
    requestedMinutes: quotaDetails.reduce((sum, detail) => sum + detail.requested, 0),
    exceededMinutes: exceededDetails.reduce((sum, detail) => sum + detail.exceeded, 0),
    fingerprint: null,
  };
  const series = {
    recurrenceId: anchor.recurrenceId, count: targets.length, entryIds,
    employeeCount: new Set(targets.map((target) => target.userId)).size,
    fromDate: targets[0].from.date, toDate: targets.at(-1)!.from.date,
    targetFromDate: targets[0].to.date, targetToDate: targets.at(-1)!.to.date,
    deltaDays, deltaMinutes,
  };
  const evidence = { scope: "series_from_entry", anchor, seriesRows, targets, users, projects, quotaDetails, series };
  const fingerprint = sha256(evidence); if (overbooking.required) overbooking = { ...overbooking, fingerprint };
  const anchorTarget = targets.find((target) => target.entryId === anchor.id)!; const anchorUser = userById.get(anchor.userId!)!;
  return {
    scope: "series_from_entry" as const,
    entry: { id: anchor.id, title: anchor.title, projectId: anchor.projectId ?? "", projectLabel: anchor.projectLabel ?? "", employee: anchor.employeeName ?? (`${anchorUser.firstName} ${anchorUser.lastName}`.trim() || anchorUser.email), approvalStatus: anchor.approvalStatus === "requested" ? "requested" as const : "confirmed" as const, recurrenceRule: anchor.recurrenceRule ?? "" },
    from: anchorTarget.from, to: anchorTarget.to, reason,
    warnings: [{ code: "series_from_entry", message: "Der ausgewählte Termin und alle zeitlich folgenden aktiven Serieneinträge werden einschließlich aller gebuchten Mitarbeitenden gemeinsam verschoben; frühere Folgen bleiben unverändert." }],
    overbooking, series, targets, fingerprint,
  } satisfies PlanningEntryMoveEvaluation;
}

export async function evaluatePlanningEntryMove(input: Omit<Parameters<typeof evaluateInternal>[0], "db" | "lock"> & { db?: DatabaseClient; scope?: PlanningEntryMoveScope }) {
  const db = input.db ?? prisma;
  return input.scope === "series_from_entry"
    ? evaluateSeriesInternal({ ...input, db })
    : evaluateInternal({ ...input, db });
}

async function executePlanningSeriesMoveInTransaction(input: {
  tx: Prisma.TransactionClient; organizationId: string; actor: PlanningMoveActor; entryId: string;
  date: string; startTime: string; endTime: string; reason: string; expectedFingerprint: string;
  requestId: string; overbookingApproval?: { fingerprint: string; reason: string };
}): Promise<PlanningEntryMoveResult> {
  const seed = await loadEntry(input.tx, input.organizationId, input.entryId, false);
  if (!seed.recurrenceId) throw new PlanningEntryMoveError("series_missing", "Dieser Planungseintrag gehört keiner eindeutig gespeicherten Terminserie an.", 409);
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}),hashtext(${`planning-series-move:${seed.recurrenceId}`}))`;
  const activeSeries = await input.tx.$queryRaw<PlanningEntryRow[]>`SELECT * FROM "PlanningEntry" WHERE "organizationId"=${input.organizationId} AND "recurrenceId"=${seed.recurrenceId} AND "deletedAt" IS NULL ORDER BY "date","startTime","id" FOR UPDATE`;
  const expectedHistoryIds = activeSeries.map((entry) => deterministicId("planning-series-move-history", input.organizationId, input.requestId, entry.id));
  const replayHistories = expectedHistoryIds.length
    ? await input.tx.$queryRaw<Array<{ id: string; planningEntryId: string }>>`SELECT "id","planningEntryId" FROM "PlanningEntryHistory" WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(expectedHistoryIds)}) ORDER BY "createdAt","planningEntryId"`
    : [];
  if (replayHistories.length) {
    const affectedIds = replayHistories.map((history) => history.planningEntryId);
    const affectedRows = activeSeries.filter((entry) => affectedIds.includes(entry.id));
    const anchor = affectedRows.find((entry) => entry.id === input.entryId);
    if (!anchor || anchor.date !== input.date || anchor.startTime !== input.startTime || anchor.endTime !== input.endTime || replayHistories.length !== affectedIds.length) {
      throw new PlanningEntryMoveError("replay_conflict", "Die frühere Serienverschiebung passt nicht mehr zum angeforderten Zielzeitraum.", 409);
    }
    const affected = affectedRows.map((entry) => ({
      entry: { id: entry.id, title: entry.title, projectId: entry.projectId ?? "", projectLabel: entry.projectLabel ?? "", employee: entry.employeeName ?? "", approvalStatus: entry.approvalStatus === "requested" ? "requested" as const : "confirmed" as const, recurrenceRule: entry.recurrenceRule ?? "", date: entry.date, startTime: entry.startTime, endTime: entry.endTime, durationMinutes: entry.durationMinutes },
      previous: { date: entry.date, startTime: entry.startTime, endTime: entry.endTime, durationMinutes: entry.durationMinutes },
    }));
    const anchorResult = affected.find((item) => item.entry.id === input.entryId)!;
    return {
      entry: anchorResult.entry, previous: anchorResult.previous, scope: "series_from_entry", affected, affectedEntryIds: affectedIds,
      series: { recurrenceId: seed.recurrenceId, count: affected.length, entryIds: affectedIds, employeeCount: new Set(affectedRows.map((entry) => entry.userId).filter(Boolean)).size, fromDate: affectedRows[0]?.date ?? anchor.date, toDate: affectedRows.at(-1)?.date ?? anchor.date, targetFromDate: affectedRows[0]?.date ?? anchor.date, targetToDate: affectedRows.at(-1)?.date ?? anchor.date, deltaDays: 0, deltaMinutes: 0 },
      reason: clean(input.reason), replayed: true,
    };
  }
  const evaluation = await evaluateSeriesInternal({ ...input, db: input.tx, lock: true, requireManagement: true });
  if (evaluation.fingerprint !== input.expectedFingerprint) throw new PlanningEntryMoveError("stale_context", "Der Serienumfang oder eine Planungsgrundlage wurde zwischenzeitlich verändert. Bitte neu prüfen.", 409);
  if (evaluation.overbooking.required) {
    const approval = input.overbookingApproval;
    if (!approval || approval.fingerprint !== evaluation.overbooking.fingerprint || clean(approval.reason).length < 10) throw new PlanningEntryMoveError("overbooking_confirmation_required", "Die Überplanung der Terminserie muss mit dem aktuellen Prüfwert und mindestens 10 Zeichen begründet bestätigt werden.", 409, evaluation.overbooking);
  }
  const overbookingReason = evaluation.overbooking.required ? clean(input.overbookingApproval?.reason) : null;
  const affected: PlanningEntryMoveResult["affected"] = [];
  for (const target of evaluation.targets) {
    const rows = await input.tx.$queryRaw<PlanningEntryRow[]>`UPDATE "PlanningEntry" SET "date"=${target.to.date},"startTime"=${target.to.startTime},"endTime"=${target.to.endTime},"durationMinutes"=${target.to.durationMinutes},"offerPlannedMinutes"=CASE WHEN "offerPlannedMinutes" IS NULL THEN NULL ELSE ${target.to.durationMinutes} END,"overbookingKind"=${evaluation.overbooking.kind},"overbookingReason"=${overbookingReason},"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId} AND "id"=${target.entryId} RETURNING *`;
    const saved = rows[0]; if (!saved) throw new PlanningEntryMoveError("stale_context", "Mindestens ein Serientermin wurde parallel verändert. Bitte neu prüfen.", 409);
    const note = `Als Serie verschoben von ${displayDate(target.from.date)} ${target.from.startTime}-${target.from.endTime} auf ${displayDate(target.to.date)} ${target.to.startTime}-${target.to.endTime}. Grund: ${evaluation.reason}${overbookingReason ? ` Überplanung: ${overbookingReason}` : ""}`;
    const historyId = deterministicId("planning-series-move-history", input.organizationId, input.requestId, saved.id);
    await input.tx.$executeRaw`INSERT INTO "PlanningEntryHistory" ("id","organizationId","planningEntryId","projectId","eventType","actorUserId","actorName","fromStatus","toStatus","note","createdAt") VALUES (${historyId},${input.organizationId},${saved.id},${saved.projectId},'series_moved',${input.actor.id},${actorName(input.actor)},${saved.approvalStatus},${saved.approvalStatus},${note},CURRENT_TIMESTAMP)`;
    const perEntryRequestId = `${input.requestId}:${saved.id}`;
    if (saved.projectId) await input.tx.projectLogbookEntry.upsert({ where: { organizationId_source_callReference_projectId: { organizationId: input.organizationId, source: "planning-entry-move", callReference: perEntryRequestId, projectId: saved.projectId } }, update: {}, create: { id: randomUUID(), organizationId: input.organizationId, projectId: saved.projectId, title: saved.approvalStatus === "requested" ? "Terminwunschserie verschoben" : "Terminserie verschoben", body: `${saved.title}: ${note}`, author: actorName(input.actor), authorUserId: input.actor.id, source: "planning-entry-move", callReference: perEntryRequestId } });
    const notificationText = planningMoveNotificationText(saved, target.from);
    for (const userId of new Set([clean(saved.userId), clean(saved.requestedByUserId)].filter(Boolean))) {
      if (userId === input.actor.id) continue;
      const id = planningMoveNotificationId(input.organizationId, perEntryRequestId, userId);
      await input.tx.notification.upsert({ where: { id }, update: {}, create: { id, organizationId: input.organizationId, userId, taskId: null, channel: "app", subject: saved.approvalStatus === "requested" ? "Terminwunschserie verschoben" : "Terminserie verschoben", body: notificationText.body, linkTarget: "planning-entry", linkTargetId: saved.id, linkLabel: "Termin öffnen", sentAt: null } });
    }
    affected.push({
      entry: { id: saved.id, title: saved.title, projectId: saved.projectId ?? "", projectLabel: saved.projectLabel ?? "", employee: saved.employeeName ?? "", approvalStatus: saved.approvalStatus === "requested" ? "requested" : "confirmed", recurrenceRule: saved.recurrenceRule ?? "", ...target.to },
      previous: target.from,
    });
  }
  const anchorResult = affected.find((item) => item.entry.id === input.entryId)!;
  return { entry: anchorResult.entry, previous: anchorResult.previous, scope: "series_from_entry", affected, affectedEntryIds: affected.map((item) => item.entry.id), series: evaluation.series, reason: evaluation.reason, replayed: false };
}

export async function executePlanningEntryMoveInTransaction(input: {
  tx: Prisma.TransactionClient; organizationId: string; actor: PlanningMoveActor; entryId: string;
  date: string; startTime: string; endTime: string; reason: string; expectedFingerprint: string;
  requestId: string; requireManagement?: boolean; scope?: PlanningEntryMoveScope; overbookingApproval?: { fingerprint: string; reason: string };
}) {
  if (input.scope === "series_from_entry") return executePlanningSeriesMoveInTransaction(input);
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}),hashtext(${`planning-entry-move:${input.entryId}`}))`;
  const historyId = deterministicId("planning-history", input.organizationId, input.requestId);
  const previousHistory = await input.tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "PlanningEntryHistory" WHERE "organizationId"=${input.organizationId} AND "id"=${historyId} LIMIT 1`;
  if (previousHistory.length) {
    const current = await loadEntry(input.tx, input.organizationId, input.entryId, true);
    if (current.date !== input.date || current.startTime !== input.startTime || current.endTime !== input.endTime) throw new PlanningEntryMoveError("replay_conflict", "Die frühere Ausführung passt nicht mehr zum angeforderten Zielzeitraum.", 409);
    const replayEntry = { id: current.id, title: current.title, projectId: current.projectId ?? "", projectLabel: current.projectLabel ?? "", employee: current.employeeName ?? "", approvalStatus: current.approvalStatus === "requested" ? "requested" as const : "confirmed" as const, recurrenceRule: current.recurrenceRule ?? "", date: current.date, startTime: current.startTime, endTime: current.endTime, durationMinutes: current.durationMinutes };
    const replayPrevious = { date: current.date, startTime: current.startTime, endTime: current.endTime, durationMinutes: current.durationMinutes };
    return { entry: replayEntry, previous: replayPrevious, scope: "single" as const, affected: [{ entry: replayEntry, previous: replayPrevious }], affectedEntryIds: [current.id], series: null, reason: clean(input.reason), replayed: true };
  }
  const evaluation = await evaluateInternal({ ...input, db: input.tx, lock: true });
  if (evaluation.fingerprint !== input.expectedFingerprint) throw new PlanningEntryMoveError("stale_context", "Der Termin oder seine Planungsgrundlage wurde zwischenzeitlich verändert. Bitte neu prüfen.", 409);
  if (evaluation.overbooking.required) {
    const approval = input.overbookingApproval;
    if (!approval || approval.fingerprint !== evaluation.overbooking.fingerprint || clean(approval.reason).length < 10) throw new PlanningEntryMoveError("overbooking_confirmation_required", "Die Überplanung muss mit dem aktuellen Prüfwert und mindestens 10 Zeichen begründet bestätigt werden.", 409, evaluation.overbooking);
  }
  const overbookingReason = evaluation.overbooking.required ? clean(input.overbookingApproval?.reason) : null;
  const rows = await input.tx.$queryRaw<PlanningEntryRow[]>`UPDATE "PlanningEntry" SET "date"=${evaluation.to.date},"startTime"=${evaluation.to.startTime},"endTime"=${evaluation.to.endTime},"durationMinutes"=${evaluation.to.durationMinutes},"offerPlannedMinutes"=CASE WHEN "offerPlannedMinutes" IS NULL THEN NULL ELSE ${evaluation.to.durationMinutes} END,"overbookingKind"=${evaluation.overbooking.kind},"overbookingReason"=${overbookingReason},"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId} AND "id"=${input.entryId} RETURNING *`;
  const saved = rows[0]; if (!saved) throw new PlanningEntryMoveError("stale_context", "Der Termin wurde parallel verändert. Bitte neu prüfen.", 409);
  const note = `Verschoben von ${displayDate(evaluation.from.date)} ${evaluation.from.startTime}-${evaluation.from.endTime} auf ${displayDate(evaluation.to.date)} ${evaluation.to.startTime}-${evaluation.to.endTime}. Grund: ${evaluation.reason}${overbookingReason ? ` Überplanung: ${overbookingReason}` : ""}`;
  await input.tx.$executeRaw`INSERT INTO "PlanningEntryHistory" ("id","organizationId","planningEntryId","projectId","eventType","actorUserId","actorName","fromStatus","toStatus","note","createdAt") VALUES (${historyId},${input.organizationId},${saved.id},${saved.projectId},'moved',${input.actor.id},${actorName(input.actor)},${saved.approvalStatus},${saved.approvalStatus},${note},CURRENT_TIMESTAMP)`;
  if (saved.projectId) await input.tx.projectLogbookEntry.upsert({ where: { organizationId_source_callReference_projectId: { organizationId: input.organizationId, source: "planning-entry-move", callReference: input.requestId, projectId: saved.projectId } }, update: {}, create: { id: randomUUID(), organizationId: input.organizationId, projectId: saved.projectId, title: saved.approvalStatus === "requested" ? "Terminwunsch verschoben" : "Termin verschoben", body: `${saved.title}: ${note}`, author: actorName(input.actor), authorUserId: input.actor.id, source: "planning-entry-move", callReference: input.requestId } });
  const notificationText = planningMoveNotificationText(saved, evaluation.from);
  for (const userId of new Set([clean(saved.userId), clean(saved.requestedByUserId)].filter(Boolean))) {
    if (userId === input.actor.id) continue;
    const id = planningMoveNotificationId(input.organizationId, input.requestId, userId);
    await input.tx.notification.upsert({
      where: { id }, update: {}, create: {
        id, organizationId: input.organizationId, userId, taskId: null, channel: "app",
        subject: notificationText.subject, body: notificationText.body,
        linkTarget: "planning-entry", linkTargetId: saved.id, linkLabel: "Termin öffnen", sentAt: null,
      },
    });
  }
  const movedEntry = { ...evaluation.entry, ...evaluation.to };
  return { entry: movedEntry, previous: evaluation.from, scope: "single", affected: [{ entry: movedEntry, previous: evaluation.from }], affectedEntryIds: [movedEntry.id], series: null, reason: evaluation.reason, replayed: false } satisfies PlanningEntryMoveResult;
}

export async function executePlanningEntryMove(input: Omit<Parameters<typeof executePlanningEntryMoveInTransaction>[0], "tx"> & { db?: typeof prisma }) {
  const db = input.db ?? prisma;
  return db.$transaction((tx) => executePlanningEntryMoveInTransaction({ ...input, tx }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deliverPlanningEntryMoveNotifications(input: {
  organizationId: string; requestId: string; entryId: string; actorUserId: string; affectedEntryIds?: string[];
}) {
  const entryIds = input.affectedEntryIds?.length ? input.affectedEntryIds : [input.entryId];
  const rows = await prisma.$queryRaw<Array<{ id: string; userId: string | null; requestedByUserId: string | null }>>`
    SELECT "id","userId","requestedByUserId" FROM "PlanningEntry"
    WHERE "organizationId"=${input.organizationId} AND "id" IN (${Prisma.join(entryIds)})
  `;
  for (const entry of rows) {
    const requestId = input.affectedEntryIds?.length ? `${input.requestId}:${entry.id}` : input.requestId;
    for (const userId of new Set([clean(entry.userId), clean(entry.requestedByUserId)].filter(Boolean))) {
      if (userId === input.actorUserId) continue;
      const id = planningMoveNotificationId(input.organizationId, requestId, userId);
      const notification = await prisma.notification.findUnique({ where: { id } });
      if (!notification) continue;
      await sendNotificationMailSafely({ notificationId: notification.id, userId, subject: notification.subject, body: notification.body });
      await sendPushToUserSafely({
        organizationId: input.organizationId, userId,
        payload: { title: notification.subject, body: notification.body, notificationId: notification.id, linkTarget: "planning-entry", linkTargetId: entry.id, url: `/?target=planning-entry&targetId=${encodeURIComponent(entry.id)}` },
      });
    }
  }
}
