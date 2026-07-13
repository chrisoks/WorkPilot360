import { describe, expect, it } from "vitest";
import {
  getEffectiveMonthlyFinancialAmount,
  parseMonthlyFinancialInput,
} from "@/lib/monthly-financial-report";

describe("monthly financial report", () => {
  const values = [
    { lineKey: "operating_costs", effectiveMonth: "2026-07", amount: 100 },
    { lineKey: "operating_costs", effectiveMonth: "2026-09", amount: 135 },
    { lineKey: "personnel_expenses", effectiveMonth: "2026-07", amount: 500 },
  ];

  it("carries a value forward until the next explicit monthly change", () => {
    expect(getEffectiveMonthlyFinancialAmount(values, "operating_costs", "2026-06")).toBeNull();
    expect(getEffectiveMonthlyFinancialAmount(values, "operating_costs", "2026-07")).toBe(100);
    expect(getEffectiveMonthlyFinancialAmount(values, "operating_costs", "2026-08")).toBe(100);
    expect(getEffectiveMonthlyFinancialAmount(values, "operating_costs", "2026-09")).toBe(135);
    expect(getEffectiveMonthlyFinancialAmount(values, "operating_costs", "2026-12")).toBe(135);
  });

  it("keeps later manual changes when an earlier month is changed", () => {
    const changedValues = values.map((value) =>
      value.lineKey === "operating_costs" && value.effectiveMonth === "2026-07"
        ? { ...value, amount: 110 }
        : value
    );

    expect(getEffectiveMonthlyFinancialAmount(changedValues, "operating_costs", "2026-08")).toBe(110);
    expect(getEffectiveMonthlyFinancialAmount(changedValues, "operating_costs", "2026-09")).toBe(135);
  });

  it("allows an explicit empty month to stop a previous carry-forward", () => {
    const clearedValues = [
      ...values,
      { lineKey: "operating_costs", effectiveMonth: "2026-11", amount: null },
    ];

    expect(getEffectiveMonthlyFinancialAmount(clearedValues, "operating_costs", "2026-10")).toBe(135);
    expect(getEffectiveMonthlyFinancialAmount(clearedValues, "operating_costs", "2026-11")).toBeNull();
    expect(getEffectiveMonthlyFinancialAmount(clearedValues, "operating_costs", "2026-12")).toBeNull();
  });

  it("parses German and input-formatted currency values without changing their scale", () => {
    expect(parseMonthlyFinancialInput("1.234,56")).toEqual({ ok: true, amount: 1234.56 });
    expect(parseMonthlyFinancialInput("651.00")).toEqual({ ok: true, amount: 651 });
    expect(parseMonthlyFinancialInput("-25,5 €")).toEqual({ ok: true, amount: -25.5 });
    expect(parseMonthlyFinancialInput("")).toEqual({ ok: true, amount: null });
    expect(parseMonthlyFinancialInput("12 Euro")).toEqual({ ok: false, amount: null });
  });
});
