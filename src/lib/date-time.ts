export const WORKPILOT_TIME_ZONE = "Europe/Berlin";

export function normalizeStoredDateKey(value: unknown) {
  const raw = String(value ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const germanMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (germanMatch) return `${germanMatch[3]}-${germanMatch[2]}-${germanMatch[1]}`;

  return "";
}

export function formatBerlinDateTime(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WORKPILOT_TIME_ZONE,
  }).format(date);
}

export function getBerlinMonthKey(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: WORKPILOT_TIME_ZONE,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return year && month ? `${year}-${month}` : "";
}
