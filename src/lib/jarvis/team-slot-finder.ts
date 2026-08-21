import { Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { createJarvisDialogChoice } from "@/lib/jarvis/dialog";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

type SlotUser = {
  id: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
  planningBoard: string | null;
  planningGroup: string | null;
  planningStartTime: string;
  planningEndTime: string;
  weeklyCapacity: unknown;
  planningTimeWindows: unknown;
  planningBreakWindows: unknown;
  leadershipManagerId: string | null;
  leadershipDeputyId: string | null;
};

type SlotAbsence = {
  userId: string;
  date: Date;
  dayPart: string;
  status: string;
  deletedAt: Date | null;
};

type SlotPlanningEntry = {
  userId: string | null;
  employeeName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  approvalStatus: string;
  deletedAt: Date | null;
};

export type JarvisTeamSlotSnapshot = {
  users: SlotUser[];
  absences: SlotAbsence[];
  planningEntries: SlotPlanningEntry[];
};

export type JarvisTeamSlotSource = {
  load(input: {
    organizationId: string;
    accessProfile: JarvisAccessProfile;
    startDate: string;
    endDate: string;
  }): Promise<JarvisTeamSlotSnapshot>;
};

export type JarvisTeamSlotQuery = {
  recognized: boolean;
  employeeCount?: number;
  durationMinutes?: number;
  serviceLabel: string;
  earliestOnly: boolean;
};

export type JarvisTeamSlotPreparation = {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  employeeNames: string[];
};

type MinuteInterval = { start: number; end: number };
type TeamSlot = { date: string; start: number; end: number; users: SlotUser[] };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  einer: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  funf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

function normalize(value: string | null | undefined) {
  return normalizeJarvisIntentText(value ?? "").replace(/\s+/g, " ").trim();
}

function numericWord(value: string | undefined) {
  if (!value) return undefined;
  const numeric = Number(value.replace(",", "."));
  if (Number.isFinite(numeric)) return numeric;
  return NUMBER_WORDS[normalize(value)];
}

function serviceLabel(question: string) {
  const value = normalize(question);
  if (/\brasen\w*\b.*\bmah\w*\b|\brasenmahen\b/.test(value)) return "Rasenmähen";
  if (/\bgrunpflege\b|\bgartenpflege\b/.test(value)) return "Grünpflege";
  if (/\bglas\w*\b.*\breinig\w*\b/.test(value)) return "Glasreinigung";
  if (/\btreppenhaus\w*\b.*\breinig\w*\b/.test(value)) return "Treppenhausreinigung";
  if (/\bwinterdienst\b|\bschnee\w*\b|\bstreu\w*\b/.test(value)) return "Winterdienst";
  return "Einsatz";
}

export function parseJarvisTeamSlotQuery(question: string): JarvisTeamSlotQuery {
  const value = normalize(question);
  const employeeMatch = value.match(
    /\b(\d{1,2}|ein(?:e|en|er|s)?|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn)\b\s+(?:von\s+(?:(?:den|die)\s+)?(?:unser\w*\s+)?)?(?:jungs|mitarbeiter\w*|kolleg\w*|leut\w*|person\w*)\b/
  );
  const durationMatch = value.match(
    /\b(\d{1,2}(?:[.,]\d+)?|ein(?:e|en|s)?|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn)\s*(?:h|std|stunde\w*)\b/
  );
  const employeeCount = numericWord(employeeMatch?.[1]);
  const durationHours = numericWord(durationMatch?.[1]);
  const availabilitySignal = /\b(?:wann|nachstmoglich\w*|frei\w*|zeit\w*|verfugbar\w*|termin\w*)\b/.test(value);
  const employeeSignal = /\b(?:jungs|mitarbeiter\w*|kolleg\w*|team|leut\w*|person\w*)\b/.test(value);
  return {
    recognized: availabilitySignal && employeeSignal && Boolean(employeeCount || durationHours),
    employeeCount: employeeCount && employeeCount > 0 && employeeCount <= 10 ? Math.floor(employeeCount) : undefined,
    durationMinutes: durationHours && durationHours > 0 && durationHours <= 12 ? Math.round(durationHours * 60) : undefined,
    serviceLabel: serviceLabel(question),
    earliestOnly: /\b(?:nachstmoglich\w*|fruhest\w*|als nachstes)\b/.test(value),
  };
}

export function parseJarvisTeamSlotPreparationRequest(
  question: string
): JarvisTeamSlotPreparation | undefined {
  const dateMatch = question.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/u);
  const timeMatch = question.match(
    /\bvon\s+([01]?\d|2[0-3]):([0-5]\d)\s+(?:Uhr\s+)?bis\s+([01]?\d|2[0-3]):([0-5]\d)\b/iu
  );
  const titleMatch = question.match(
    /\beinen?\s+(.{2,120}?)-Termin\s+mit\s+(.+?)\s+vor\b/iu
  );
  if (!dateMatch || !timeMatch || !titleMatch || !/\bbereit\w*\b/iu.test(question)) {
    return undefined;
  }
  const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  const parsedDate = new Date(`${date}T12:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return undefined;
  }
  const startTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  const endTime = `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}`;
  if (endTime <= startTime) return undefined;
  const employeeNames = titleMatch[2]
    .replace(/\s*,\s*und\s+/giu, ",")
    .split(/\s*(?:,|\bund\b)\s*/iu)
    .map((value) => value.trim().replace(/[.!?]+$/, ""))
    .filter((value) => value.length >= 3)
    .slice(0, 10);
  const title = titleMatch[1].trim().replace(/[.!?]+$/, "");
  if (!title || employeeNames.length === 0) return undefined;
  return { date, startTime, endTime, title, employeeNames };
}

function actorVisibilityWhere(actor: JarvisAccessProfile["effectiveActor"]): Prisma.UserWhereInput {
  if (actor.role === Role.ADMIN || actor.role === Role.GESCHAEFTSFUEHRER) return {};
  if (actor.role === Role.FUEHRUNGSKRAFT) {
    return { OR: [{ id: actor.id }, { leadershipManagerId: actor.id }, { leadershipDeputyId: actor.id }] };
  }
  if (actor.role === Role.MITARBEITER && actor.teamId) return { teamId: actor.teamId };
  return actor.id ? { id: actor.id } : { id: "__jarvis_no_visible_employee__" };
}

function actorCanSeeUser(actor: JarvisAccessProfile["effectiveActor"], user: SlotUser) {
  if (actor.role === Role.ADMIN || actor.role === Role.GESCHAEFTSFUEHRER) return true;
  if (actor.role === Role.FUEHRUNGSKRAFT) {
    return user.id === actor.id || user.leadershipManagerId === actor.id || user.leadershipDeputyId === actor.id;
  }
  if (actor.role === Role.MITARBEITER && actor.teamId) return user.teamId === actor.teamId;
  return user.id === actor.id;
}

function visibleUsers(profile: JarvisAccessProfile, users: SlotUser[]) {
  return users.filter(
    (user) => actorCanSeeUser(profile.sessionActor, user) && actorCanSeeUser(profile.effectiveActor, user)
  );
}

const liveSource: JarvisTeamSlotSource = {
  async load({ organizationId, accessProfile, startDate, endDate }) {
    const users = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        sellableCapacityEnabled: { not: false },
        AND: [actorVisibilityWhere(accessProfile.sessionActor), actorVisibilityWhere(accessProfile.effectiveActor)],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        teamId: true,
        planningBoard: true,
        planningGroup: true,
        planningStartTime: true,
        planningEndTime: true,
        weeklyCapacity: true,
        planningTimeWindows: true,
        planningBreakWindows: true,
        leadershipManagerId: true,
        leadershipDeputyId: true,
      },
    });
    const userIds = users.map((user) => user.id);
    if (!userIds.length) return { users, absences: [], planningEntries: [] };
    const [absences, planningEntries] = await Promise.all([
      prisma.absence.findMany({
        where: {
          organizationId,
          userId: { in: userIds },
          date: { gte: new Date(`${startDate}T00:00:00.000Z`), lte: new Date(`${endDate}T00:00:00.000Z`) },
          deletedAt: null,
        },
        select: { userId: true, date: true, dayPart: true, status: true, deletedAt: true },
      }),
      prisma.planningEntry.findMany({
        where: { organizationId, userId: { in: userIds }, date: { gte: startDate, lte: endDate }, deletedAt: null },
        select: { userId: true, employeeName: true, date: true, startTime: true, endTime: true, approvalStatus: true, deletedAt: true },
      }),
    ]);
    return { users, absences, planningEntries };
  },
};

function berlinParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${read("year")}-${read("month")}-${read("day")}`, minutes: Number(read("hour")) * 60 + Number(read("minute")) };
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function parseTime(value: string | null | undefined, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  if (!match) return fallback;
  const result = Number(match[1]) * 60 + Number(match[2]);
  return result >= 0 && result < 24 * 60 ? result : fallback;
}

function timeLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function weekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function dayWindow(value: unknown, day: string, fallbackStart: string, fallbackEnd: string) {
  const row = objectValue(objectValue(value)[day]);
  return {
    start: parseTime(typeof row.start === "string" ? row.start : fallbackStart, parseTime(fallbackStart, 8 * 60)),
    end: parseTime(typeof row.end === "string" ? row.end : fallbackEnd, parseTime(fallbackEnd, 17 * 60)),
  };
}

function optionalDayWindow(value: unknown, day: string) {
  const row = objectValue(objectValue(value)[day]);
  if (typeof row.start !== "string" || typeof row.end !== "string") return undefined;
  if (!/^\d{1,2}:\d{2}$/.test(row.start) || !/^\d{1,2}:\d{2}$/.test(row.end)) return undefined;
  const start = parseTime(row.start, -1);
  const end = parseTime(row.end, -1);
  return start >= 0 && end > start ? { start, end } : undefined;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function unavailableAbsenceIntervals(user: SlotUser, date: string, absences: SlotAbsence[], work: MinuteInterval) {
  const absence = absences.find(
    (item) => item.userId === user.id && dateKey(item.date) === date && !item.deletedAt && ["genehmigt", "approved"].includes(normalize(item.status))
  );
  if (!absence) return [];
  const part = normalize(absence.dayPart);
  const midpoint = work.start + (work.end - work.start) / 2;
  if (["first-half", "first half", "first_half", "morning", "vormittag"].includes(part)) return [{ start: work.start, end: midpoint }];
  if (["second-half", "second half", "second_half", "afternoon", "nachmittag"].includes(part)) return [{ start: midpoint, end: work.end }];
  return [{ start: work.start, end: work.end }];
}

function userIsAvailable(input: {
  user: SlotUser;
  date: string;
  start: number;
  end: number;
  absences: SlotAbsence[];
  entries: SlotPlanningEntry[];
}) {
  const day = weekday(input.date);
  const capacity = Number(objectValue(input.user.weeklyCapacity)[day] ?? 0);
  if (!Number.isFinite(capacity) || capacity <= 0) return false;
  const work = dayWindow(input.user.planningTimeWindows, day, input.user.planningStartTime, input.user.planningEndTime);
  if (work.end <= work.start || input.start < work.start || input.end > work.end) return false;
  const breakWindow = optionalDayWindow(input.user.planningBreakWindows, day);
  const blocked: MinuteInterval[] = [
    ...unavailableAbsenceIntervals(input.user, input.date, input.absences, work),
    ...(breakWindow ? [breakWindow] : []),
    ...input.entries
      .filter((entry) => entry.userId === input.user.id && entry.date === input.date && !entry.deletedAt)
      .filter((entry) => !/abgelehnt|rejected|withdrawn|zuruckgezogen|cancelled|abgesagt/.test(normalize(entry.approvalStatus)))
      .map((entry) => ({ start: parseTime(entry.startTime, 0), end: parseTime(entry.endTime, 24 * 60) })),
  ];
  return blocked.every((interval) => input.end <= interval.start || input.start >= interval.end);
}

function relevanceScore(user: SlotUser, service: string) {
  const value = normalize(`${user.planningBoard ?? ""} ${user.planningGroup ?? ""}`);
  const terms = service === "Rasenmähen" || service === "Grünpflege"
    ? ["rasen", "grun", "garten", "pflege"]
    : normalize(service).split(" ").filter((term) => term.length >= 4);
  return terms.reduce((score, term) => score + (value.includes(term) ? 1 : 0), 0);
}

function findSlots(input: {
  users: SlotUser[];
  absences: SlotAbsence[];
  entries: SlotPlanningEntry[];
  startDate: string;
  searchDays: number;
  now: Date;
  employeeCount: number;
  durationMinutes: number;
  service: string;
}) {
  const current = berlinParts(input.now);
  const rankedUsers = [...input.users].sort((left, right) => relevanceScore(right, input.service) - relevanceScore(left, input.service) || `${left.lastName}${left.firstName}`.localeCompare(`${right.lastName}${right.firstName}`, "de"));
  const result: TeamSlot[] = [];
  for (let dayOffset = 0; dayOffset < input.searchDays && result.length < 5; dayOffset += 1) {
    const date = addDays(input.startDate, dayOffset);
    const earliest = date === current.date ? Math.ceil((current.minutes + 15) / 15) * 15 : 0;
    for (let start = earliest; start + input.durationMinutes <= 24 * 60; start += 15) {
      const end = start + input.durationMinutes;
      const available = rankedUsers.filter((user) => userIsAvailable({ user, date, start, end, absences: input.absences, entries: input.entries }));
      if (available.length < input.employeeCount) continue;
      result.push({ date, start, end, users: available.slice(0, input.employeeCount) });
      break;
    }
  }
  return result;
}

function germanDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`));
}

function employeeNames(users: SlotUser[]) {
  return users.map((user) => `${user.firstName} ${user.lastName}`.trim()).join(" und ");
}

export async function resolveJarvisTeamSlotRequest(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  now?: Date;
  source?: JarvisTeamSlotSource;
}): Promise<JarvisReadResponse | undefined> {
  const query = parseJarvisTeamSlotQuery(input.question);
  if (!query.recognized) return undefined;
  const decision = getJarvisActionDecision("planning.analysis.read", input.accessProfile);
  if (!decision.executable) {
    return { type: "refusal", topicId: "planning.team-slot.refused", message: "Deine aktuelle WorkPilot-Rolle darf gemeinsame Teamverfügbarkeiten nicht über JARVIS auswerten.", deterministic: true };
  }
  if (!query.employeeCount || !query.durationMinutes) {
    return {
      type: "clarification",
      topicId: "planning.team-slot.requirements",
      message: !query.employeeCount
        ? "Wie viele Mitarbeitende müssen für den Einsatz gleichzeitig frei sein?"
        : "Wie viele zusammenhängende Stunden soll der gemeinsame Einsatz dauern?",
      choices: !query.employeeCount
        ? [1, 2, 3].map((count) => createJarvisDialogChoice(`team-slot-count-${count}`, `${count} Mitarbeitende`, `Finde den nächstmöglichen Termin für ${count} Mitarbeitende für ${query.serviceLabel}`))
        : [2, 4, 8].map((hours) => createJarvisDialogChoice(`team-slot-hours-${hours}`, `${hours} Stunden`, `Finde den nächstmöglichen Termin für ${query.employeeCount} Mitarbeitende mit ${hours} Stunden Dauer für ${query.serviceLabel}`)),
      deterministic: true,
    };
  }
  const now = input.now ?? new Date();
  const startDate = berlinParts(now).date;
  const endDate = addDays(startDate, 20);
  const snapshot = await (input.source ?? liveSource).load({ organizationId: input.organizationId, accessProfile: input.accessProfile, startDate, endDate });
  const users = visibleUsers(input.accessProfile, snapshot.users);
  if (users.length < query.employeeCount) {
    return {
      type: "answer",
      topicId: "planning.team-slot.insufficient-visible-team",
      message: `In deinem rollenbezogen sichtbaren Planungsbereich sind nur ${users.length} planbare Mitarbeitende vorhanden. Für den gewünschten gemeinsamen Einsatz werden ${query.employeeCount} benötigt. Ich erweitere den sichtbaren Mitarbeiterkreis nicht eigenmächtig.`,
      deterministic: true,
    };
  }
  const slots = findSlots({ users, absences: snapshot.absences, entries: snapshot.planningEntries, startDate, searchDays: 21, now, employeeCount: query.employeeCount, durationMinutes: query.durationMinutes, service: query.serviceLabel });
  if (!slots.length) {
    return {
      type: "answer",
      topicId: "planning.team-slot.empty",
      message: `In den nächsten 21 Kalendertagen habe ich für ${query.employeeCount} Mitarbeitende keinen gemeinsamen freien Block über ${(query.durationMinutes / 60).toLocaleString("de-DE")} Stunden gefunden. Berücksichtigt wurden Arbeits- und Pausenfenster, Abwesenheiten sowie bestehende bestätigte und noch offene Planungen.`,
      navigation: { label: "Planungsboard öffnen", tab: "planning" },
      deterministic: true,
    };
  }
  const first = slots[0];
  const firstLabel = `${germanDate(first.date)}, ${timeLabel(first.start)}–${timeLabel(first.end)}`;
  const qualificationMatches = first.users.filter((user) => relevanceScore(user, query.serviceLabel) > 0).length;
  const qualificationNote = qualificationMatches === first.users.length
    ? `Die ausgewählten Planungsgruppen passen namentlich zur Leistung ${query.serviceLabel}. Eine formale Qualifikationsmatrix ist in WorkPilot derzeit dennoch nicht hinterlegt.`
    : `Die zeitliche Verfügbarkeit ist belegt; eine formale Mitarbeiter-Qualifikationsmatrix für ${query.serviceLabel} ist in WorkPilot derzeit nicht hinterlegt und muss vor der Buchung fachlich bestätigt werden.`;
  return {
    type: "answer",
    topicId: "planning.team-slot",
    message: `Der nächstmögliche gemeinsame Termin ist ${firstLabel} mit ${employeeNames(first.users)}. ${qualificationNote} Kunde beziehungsweise Projekt und Fahrzeit sind vor der verbindlichen Buchung noch festzulegen. Es wurde nichts gebucht.`,
    structured: {
      title: `Gemeinsame Einsatzzeit · ${query.serviceLabel}`,
      facts: [
        { label: "Benötigte Mitarbeitende", value: String(query.employeeCount) },
        { label: "Zusammenhängende Dauer", value: `${(query.durationMinutes / 60).toLocaleString("de-DE")} Std.` },
        { label: "Nächstmöglicher Slot", value: firstLabel, tone: "positive" },
        { label: "Suchhorizont", value: "21 Kalendertage" },
      ],
      sections: [
        { title: "Früheste Vorschläge", items: slots.map((slot) => `${germanDate(slot.date)}, ${timeLabel(slot.start)}–${timeLabel(slot.end)} · ${employeeNames(slot.users)}`) },
        { title: "Berücksichtigte Daten", items: ["persönliche Arbeits- und Pausenfenster", "genehmigte Ganz- und Halbtagsabwesenheiten", "bestätigte sowie noch offene Planungen", "rollenbezogen sichtbarer Mitarbeiterkreis"] },
        { title: "Vor Buchung noch prüfen", items: ["Kunde und konkretes Projekt", "Fahr- und Rüstzeit", `fachliche Eignung für ${query.serviceLabel}`], tone: "warning" },
      ],
    },
    choices: slots.slice(0, 3).map((slot, index) => createJarvisDialogChoice(
      `team-slot-prepare-${index + 1}`,
      `${germanDate(slot.date)} · ${timeLabel(slot.start)}`,
      `Bereite für ${germanDate(slot.date)} von ${timeLabel(slot.start)} bis ${timeLabel(slot.end)} einen ${query.serviceLabel}-Termin mit ${employeeNames(slot.users)} vor. Frage mich zuerst nach Kunde und Projekt.`
    )),
    navigation: { label: "Planungsboard öffnen", tab: "planning" },
    deterministic: true,
  };
}
