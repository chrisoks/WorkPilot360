const PROJECT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isProjectMonthKey(value: string) {
  return PROJECT_MONTH_PATTERN.test(value);
}

export function shiftProjectMonthKey(monthKey: string, offset: number) {
  if (!isProjectMonthKey(monthKey)) return "";
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1, 12);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function clampProjectMonthKey(monthKey: string, startMonth = "", endMonth = "") {
  if (!isProjectMonthKey(monthKey)) return "";
  if (isProjectMonthKey(startMonth) && monthKey < startMonth) return startMonth;
  if (isProjectMonthKey(endMonth) && monthKey > endMonth) return endMonth;
  return monthKey;
}

export function getProjectMonthWindow(input: {
  selectedMonth: string;
  startMonth?: string;
  endMonth?: string;
  size?: number;
  monthsBeforeSelection?: number;
}) {
  const size = Math.max(1, Math.floor(input.size ?? 13));
  const monthsBeforeSelection = Math.max(0, Math.floor(input.monthsBeforeSelection ?? 3));
  const selectedMonth = clampProjectMonthKey(input.selectedMonth, input.startMonth, input.endMonth);
  if (!selectedMonth) return [];

  let firstMonth = clampProjectMonthKey(
    shiftProjectMonthKey(selectedMonth, -monthsBeforeSelection),
    input.startMonth,
    input.endMonth
  );

  if (isProjectMonthKey(input.endMonth || "")) {
    const finalMonth = shiftProjectMonthKey(firstMonth, size - 1);
    if (finalMonth > (input.endMonth || "")) {
      firstMonth = clampProjectMonthKey(
        shiftProjectMonthKey(input.endMonth || "", -(size - 1)),
        input.startMonth,
        input.endMonth
      );
    }
  }

  return Array.from({ length: size }, (_, index) => shiftProjectMonthKey(firstMonth, index)).filter(
    (monthKey) =>
      isProjectMonthKey(monthKey) &&
      (!isProjectMonthKey(input.startMonth || "") || monthKey >= (input.startMonth || "")) &&
      (!isProjectMonthKey(input.endMonth || "") || monthKey <= (input.endMonth || ""))
  );
}
