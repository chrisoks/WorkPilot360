import { describe, expect, it } from "vitest";
import {
  diagnoseRecurringProjectMonths,
  type RecurringMonthDiagnosticProject,
} from "@/lib/jarvis/recurring-month-diagnostics";

const baseProject: RecurringMonthDiagnosticProject = {
  projectRuntimeFrom: "2026-05-01",
  projectRuntimeUntil: "2026-12-31",
  recurringBillingMode: "monthlyFlat",
  timeBudgetEnabled: true,
  timeBudgetHours: "8",
  timeBudgetAllocations: [
    { month: "2026-05", hours: "8" },
    { month: "2026-06", hours: "8" },
    { month: "2026-07", hours: "8" },
  ],
  autoBillingEnabled: true,
  autoBillingStartMonth: "2026-05",
  autoBillingEndMonth: "2026-12",
};

describe("JARVIS recurring month diagnostics", () => {
  it("finds planning, invoice and blocked batch-billing gaps month by month", () => {
    const result = diagnoseRecurringProjectMonths({
      project: baseProject,
      evaluationDateKey: "2026-07-27",
      planningEntries: [
        {
          date: "2026-05-12",
          durationMinutes: 480,
          approvalStatus: "confirmed",
          deletedAt: null,
        },
        {
          date: "2026-06-12",
          durationMinutes: 240,
          approvalStatus: "confirmed",
          deletedAt: null,
        },
      ],
      timeEntries: [
        { date: "2026-05-12", durationMs: 2 * 3_600_000 },
        { date: "2026-06-12", durationMs: 2 * 3_600_000 },
      ],
      invoices: [
        {
          id: "invoice-may",
          status: "Fakturiert",
          plannedExecutionMonth: "2026-05",
          serviceDate: "2026-05-31",
          createdAt: new Date("2026-05-31T12:00:00.000Z"),
        },
      ],
    });

    expect(result.metrics).toMatchObject({
      historicalMonthsChecked: 2,
      underplannedMonths: 1,
      missingInvoiceMonths: 1,
      currentPlannedHours: 0,
      currentRequiredHours: 8,
    });
    expect(result.issues.map((issue) => issue.id)).toEqual([
      "recurring-history-underplanned",
      "recurring-history-invoice-missing",
      "recurring-current-month-underplanned",
      "monthly-flat-previous-invoice-missing",
    ]);
  });

  it("detects multiple active invoices but ignores cancelled records", () => {
    const result = diagnoseRecurringProjectMonths({
      project: baseProject,
      evaluationDateKey: "2026-07-27",
      planningEntries: [],
      timeEntries: [],
      invoices: [
        {
          id: "invoice-1",
          status: "Fakturiert",
          plannedExecutionMonth: "2026-05",
          serviceDate: "",
          createdAt: new Date("2026-05-31T12:00:00.000Z"),
        },
        {
          id: "invoice-2",
          status: "Entwurf",
          plannedExecutionMonth: "2026-05",
          serviceDate: "",
          createdAt: new Date("2026-05-30T12:00:00.000Z"),
        },
        {
          id: "invoice-cancelled",
          status: "Storniert",
          plannedExecutionMonth: "2026-05",
          serviceDate: "",
          createdAt: new Date("2026-05-29T12:00:00.000Z"),
        },
        {
          id: "invoice-legacy-deleted",
          status: "Gel\u00c3\u00b6scht",
          plannedExecutionMonth: "2026-05",
          serviceDate: "",
          createdAt: new Date("2026-05-28T12:00:00.000Z"),
        },
      ],
    });

    expect(result.metrics.duplicateInvoiceMonths).toBe(1);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "recurring-month-duplicate-invoices" }),
      ])
    );
  });

  it("requires an hourly invoice only when hours were actually stamped", () => {
    const result = diagnoseRecurringProjectMonths({
      project: {
        ...baseProject,
        recurringBillingMode: "hourly",
        autoBillingEnabled: false,
      },
      evaluationDateKey: "2026-07-27",
      planningEntries: [],
      timeEntries: [{ date: "2026-06-15", durationMs: 3_600_000 }],
      invoices: [],
    });

    expect(result.metrics.missingInvoiceMonths).toBe(1);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "recurring-history-invoice-missing" }),
      ])
    );
  });

  it("does not infer restricted invoice findings without invoice access", () => {
    const result = diagnoseRecurringProjectMonths({
      project: baseProject,
      evaluationDateKey: "2026-07-27",
      planningEntries: [],
      timeEntries: [],
    });

    expect(result.metrics.missingInvoiceMonths).toBe(0);
    expect(result.issues.some((issue) => issue.area.includes("Abrechnung"))).toBe(false);
    expect(result.summary).toContain(
      "Rechnungsmonate waren für die aktuelle Rolle nicht prüfbar."
    );
  });
});
