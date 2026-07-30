export const GERMAN_STATE_CODES = [
  "BW",
  "BY",
  "BE",
  "BB",
  "HB",
  "HH",
  "HE",
  "MV",
  "NI",
  "NW",
  "RP",
  "SL",
  "SN",
  "ST",
  "SH",
  "TH",
] as const;

export type GermanStateCode = (typeof GERMAN_STATE_CODES)[number];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function relativeToEaster(year: number, offsetDays: number) {
  const date = easterSunday(year);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function prayerAndRepentanceDay(year: number) {
  const date = new Date(Date.UTC(year, 10, 23, 12));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 4) % 7));
  return dateKey(year, date.getUTCMonth() + 1, date.getUTCDate());
}

export function getGermanHoliday(
  value: string,
  state: GermanStateCode
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const fixed = new Map<string, string>([
    [dateKey(year, 1, 1), "Neujahr"],
    [relativeToEaster(year, -2), "Karfreitag"],
    [relativeToEaster(year, 1), "Ostermontag"],
    [dateKey(year, 5, 1), "Tag der Arbeit"],
    [relativeToEaster(year, 39), "Christi Himmelfahrt"],
    [relativeToEaster(year, 50), "Pfingstmontag"],
    [dateKey(year, 10, 3), "Tag der Deutschen Einheit"],
    [dateKey(year, 12, 25), "1. Weihnachtstag"],
    [dateKey(year, 12, 26), "2. Weihnachtstag"],
  ]);
  if (["BW", "BY", "ST"].includes(state)) fixed.set(dateKey(year, 1, 6), "Heilige Drei Könige");
  if (["BE", "MV"].includes(state)) fixed.set(dateKey(year, 3, 8), "Internationaler Frauentag");
  if (["BW", "BY", "HE", "NW", "RP", "SL", "TH"].includes(state)) {
    fixed.set(relativeToEaster(year, 60), "Fronleichnam");
  }
  if (["BY", "SL"].includes(state)) fixed.set(dateKey(year, 8, 15), "Mariä Himmelfahrt");
  if (state === "TH") fixed.set(dateKey(year, 9, 20), "Weltkindertag");
  if (["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"].includes(state)) {
    fixed.set(dateKey(year, 10, 31), "Reformationstag");
  }
  if (["BW", "BY", "NW", "RP", "SL"].includes(state)) fixed.set(dateKey(year, 11, 1), "Allerheiligen");
  if (state === "SN") fixed.set(prayerAndRepentanceDay(year), "Buß- und Bettag");
  return fixed.get(value) ?? null;
}

export function normalizeGermanState(value: unknown): GermanStateCode {
  const state = typeof value === "string" ? value.trim().toUpperCase() : "";
  return GERMAN_STATE_CODES.includes(state as GermanStateCode)
    ? (state as GermanStateCode)
    : "BW";
}
