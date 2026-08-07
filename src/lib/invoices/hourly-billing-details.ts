export type HourlyBillingEntrySnapshot = {
  timeEntryId: string;
  planningEntryId: string;
  date: string;
  startTime: string;
  endTime: string;
  employeeName: string;
  stampedHours: number;
  billedHours: number;
  stampComment: string;
  appointmentDescription: string;
};

export type HourlyBillingDaySnapshot = {
  date: string;
  customerText: string;
  customerTextEdited: boolean;
  entries: HourlyBillingEntrySnapshot[];
};

function cleanText(value: unknown, maxLength = 4_000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanHours(value: unknown) {
  const hours = Number(value ?? 0);
  return Number.isFinite(hours) ? Math.max(0, Number(hours.toFixed(2))) : 0;
}

function cleanDate(value: unknown) {
  const date = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function cleanTime(value: unknown) {
  const time = cleanText(value, 5);
  return /^\d{2}:\d{2}$/.test(time) ? time : "";
}

export function normalizeHourlyBillingEntry(value: unknown): HourlyBillingEntrySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<HourlyBillingEntrySnapshot>;
  const timeEntryId = cleanText(entry.timeEntryId, 160);
  const date = cleanDate(entry.date);
  if (!timeEntryId || !date) return null;
  return {
    timeEntryId,
    planningEntryId: cleanText(entry.planningEntryId, 160),
    date,
    startTime: cleanTime(entry.startTime),
    endTime: cleanTime(entry.endTime),
    employeeName: cleanText(entry.employeeName, 240),
    stampedHours: cleanHours(entry.stampedHours),
    billedHours: cleanHours(entry.billedHours),
    stampComment: cleanText(entry.stampComment),
    appointmentDescription: cleanText(entry.appointmentDescription),
  };
}

function suggestedCustomerText(entries: HourlyBillingEntrySnapshot[]) {
  return Array.from(
    new Set(entries.map((entry) => entry.appointmentDescription.trim()).filter(Boolean))
  ).join(" · ");
}

export function normalizeHourlyBillingDays(value: unknown): HourlyBillingDaySnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const day = candidate as Partial<HourlyBillingDaySnapshot>;
      const date = cleanDate(day.date);
      if (!date) return [];
      const entries = Array.isArray(day.entries)
        ? day.entries
            .map(normalizeHourlyBillingEntry)
            .filter((entry): entry is HourlyBillingEntrySnapshot => Boolean(entry))
            .filter((entry) => entry.date === date)
        : [];
      if (entries.length === 0) return [];
      const customerTextEdited = day.customerTextEdited === true;
      const normalizedCustomerText = cleanText(day.customerText);
      return [{
        date,
        customerText: customerTextEdited
          ? normalizedCustomerText
          : normalizedCustomerText || suggestedCustomerText(entries),
        customerTextEdited,
        entries: entries.sort((first, second) =>
          `${first.startTime}-${first.endTime}-${first.employeeName}`.localeCompare(
            `${second.startTime}-${second.endTime}-${second.employeeName}`,
            "de"
          )
        ),
      }];
    })
    .sort((first, second) => first.date.localeCompare(second.date));
}

export function reconcileHourlyBillingDays(
  currentValue: unknown,
  entriesValue: HourlyBillingEntrySnapshot[]
): HourlyBillingDaySnapshot[] {
  const currentDays = normalizeHourlyBillingDays(currentValue);
  const currentByDate = new Map(currentDays.map((day) => [day.date, day]));
  const uniqueEntries = Array.from(
    new Map(
      entriesValue
        .map(normalizeHourlyBillingEntry)
        .filter((entry): entry is HourlyBillingEntrySnapshot => Boolean(entry))
        .map((entry) => [entry.timeEntryId, entry])
    ).values()
  );
  const entriesByDate = new Map<string, HourlyBillingEntrySnapshot[]>();
  for (const entry of uniqueEntries) {
    entriesByDate.set(entry.date, [...(entriesByDate.get(entry.date) ?? []), entry]);
  }
  return Array.from(entriesByDate.entries())
    .map(([date, entries]) => {
      const current = currentByDate.get(date);
      const customerTextEdited = current?.customerTextEdited === true;
      return {
        date,
        customerText: customerTextEdited
          ? current?.customerText ?? ""
          : suggestedCustomerText(entries),
        customerTextEdited,
        entries: entries.sort((first, second) =>
          `${first.startTime}-${first.endTime}-${first.employeeName}`.localeCompare(
            `${second.startTime}-${second.endTime}-${second.employeeName}`,
            "de"
          )
        ),
      };
    })
    .sort((first, second) => first.date.localeCompare(second.date));
}

export function upsertHourlyBillingEntry(
  currentValue: unknown,
  entryValue: HourlyBillingEntrySnapshot
) {
  const currentDays = normalizeHourlyBillingDays(currentValue);
  const entries = currentDays
    .flatMap((day) => day.entries)
    .filter((entry) => entry.timeEntryId !== entryValue.timeEntryId);
  entries.push(entryValue);
  return reconcileHourlyBillingDays(currentDays, entries);
}

export function updateHourlyBillingDayCustomerText(
  currentValue: unknown,
  date: string,
  customerText: string
) {
  return normalizeHourlyBillingDays(currentValue).map((day) =>
    day.date === date
      ? { ...day, customerText: cleanText(customerText), customerTextEdited: true }
      : day
  );
}

export function getHourlyBillingDayHours(day: HourlyBillingDaySnapshot) {
  return Number(day.entries.reduce((sum, entry) => sum + entry.billedHours, 0).toFixed(2));
}

export function formatGermanBillingDate(dateKey: string) {
  const match = cleanDate(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(2)}` : "";
}

export function formatGermanBillingHours(hours: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cleanHours(hours));
}

export function getHourlyBillingCustomerLines(value: unknown) {
  return normalizeHourlyBillingDays(value).map((day) => ({
    date: formatGermanBillingDate(day.date),
    hours: getHourlyBillingDayHours(day),
    hoursLabel: `${formatGermanBillingHours(getHourlyBillingDayHours(day))} Std.`,
    customerText: day.customerText,
  }));
}

export function appendHourlyBillingCustomerDescription(
  description: string | null | undefined,
  value: unknown
) {
  return [
    cleanText(description),
    ...getHourlyBillingCustomerLines(value).map(
      (detail) => `${detail.date} | ${detail.hoursLabel} | ${detail.customerText}`
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

export function getMissingHourlyBillingCustomerTextDates(value: unknown) {
  return normalizeHourlyBillingDays(value)
    .filter((day) => !day.customerText.trim())
    .map((day) => formatGermanBillingDate(day.date));
}
