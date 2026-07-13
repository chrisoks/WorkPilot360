export type MonthlyFinancialValue = {
  lineKey: string;
  effectiveMonth: string;
  amount: number | null;
};

export function getEffectiveMonthlyFinancialAmount(
  values: readonly MonthlyFinancialValue[],
  lineKey: string,
  monthKey: string
) {
  let latestValue: MonthlyFinancialValue | undefined;

  for (const value of values) {
    if (value.lineKey !== lineKey || value.effectiveMonth > monthKey) continue;
    if (!latestValue || value.effectiveMonth > latestValue.effectiveMonth) {
      latestValue = value;
    }
  }

  return latestValue ? latestValue.amount : null;
}

export type MonthlyFinancialInputResult =
  | { ok: true; amount: number | null }
  | { ok: false; amount: null };

export function parseMonthlyFinancialInput(rawValue: string): MonthlyFinancialInputResult {
  const value = rawValue.trim().replace(/[\s€]/g, "");
  if (!value) return { ok: true, amount: null };

  let normalized = value;
  const germanGroupedNumber = /^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/;
  const englishGroupedNumber = /^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;
  const plainNumber = /^-?\d+(?:[.,]\d{1,2})?$/;

  if (germanGroupedNumber.test(value)) {
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else if (englishGroupedNumber.test(value)) {
    normalized = value.replace(/,/g, "");
  } else if (plainNumber.test(value)) {
    normalized = value.replace(",", ".");
  } else {
    return { ok: false, amount: null };
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return { ok: false, amount: null };
  return { ok: true, amount: Math.round(amount * 100) / 100 };
}
