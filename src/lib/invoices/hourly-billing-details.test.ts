import { describe, expect, it } from "vitest";
import {
  appendHourlyBillingCustomerDescription,
  getHourlyBillingCustomerLines,
  reconcileHourlyBillingDays,
  updateHourlyBillingDayCustomerText,
  upsertHourlyBillingEntry,
} from "@/lib/invoices/hourly-billing-details";

const entry = (overrides: Partial<Parameters<typeof upsertHourlyBillingEntry>[1]> = {}) => ({
  timeEntryId: "time-1",
  planningEntryId: "planning-1",
  date: "2026-08-03",
  startTime: "08:00",
  endTime: "09:00",
  employeeName: "Hendrik Eid",
  stampedHours: 1,
  billedHours: 1,
  stampComment: "Rasen gemäht",
  appointmentDescription: "Im Bereich 1, 2 und 3",
  ...overrides,
});

describe("hourly invoice billing details", () => {
  it("groups multiple employees of the same service by day", () => {
    const days = reconcileHourlyBillingDays([], [
      entry(),
      entry({ timeEntryId: "time-2", employeeName: "Mert Tozkular", startTime: "09:00", endTime: "09:30", billedHours: 0.5 }),
    ]);
    expect(getHourlyBillingCustomerLines(days)).toEqual([{
      date: "03.08.26",
      hours: 1.5,
      hoursLabel: "1,50 Std.",
      customerText: "Im Bereich 1, 2 und 3",
    }]);
  });

  it("keeps different days below the same invoice line", () => {
    const days = reconcileHourlyBillingDays([], [
      entry(),
      entry({ timeEntryId: "time-2", date: "2026-08-04", billedHours: 2.25 }),
    ]);
    expect(days.map((day) => day.date)).toEqual(["2026-08-03", "2026-08-04"]);
  });

  it("preserves a manually edited customer text when another stamp is added", () => {
    const initial = updateHourlyBillingDayCustomerText(
      reconcileHourlyBillingDays([], [entry()]),
      "2026-08-03",
      "Rasenpflege im gesamten Innenhof"
    );
    const updated = upsertHourlyBillingEntry(initial, entry({
      timeEntryId: "time-2",
      appointmentDescription: "Andere interne Terminbeschreibung",
    }));
    expect(updated[0].customerText).toBe("Rasenpflege im gesamten Innenhof");
    expect(updated[0].customerTextEdited).toBe(true);
    expect(updated[0].entries).toHaveLength(2);
  });

  it("removes no longer selected time entries while keeping the day text", () => {
    const initial = updateHourlyBillingDayCustomerText(
      reconcileHourlyBillingDays([], [entry(), entry({ timeEntryId: "time-2" })]),
      "2026-08-03",
      "Kundentext"
    );
    const updated = reconcileHourlyBillingDays(initial, [entry()]);
    expect(updated[0].entries.map((item) => item.timeEntryId)).toEqual(["time-1"]);
    expect(updated[0].customerText).toBe("Kundentext");
  });

  it("adds only the customer-facing daily summary to electronic invoice descriptions", () => {
    const days = updateHourlyBillingDayCustomerText(
      reconcileHourlyBillingDays([], [entry()]),
      "2026-08-03",
      "Rasenpflege im Innenhof"
    );
    const description = appendHourlyBillingCustomerDescription("Grünpflege: Rasenpflege", days);
    expect(description).toBe(
      "Grünpflege: Rasenpflege\n03.08.26 | 1,00 Std. | Rasenpflege im Innenhof"
    );
    expect(description).not.toContain("Hendrik Eid");
    expect(description).not.toContain("Rasen gemäht");
  });
});
