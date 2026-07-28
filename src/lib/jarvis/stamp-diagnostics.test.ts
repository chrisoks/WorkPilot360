import { describe, expect, it } from "vitest";
import {
  diagnoseProjectStamps,
  type StampDiagnosticEntry,
  type StampDiagnosticInput,
} from "@/lib/jarvis/stamp-diagnostics";

const now = new Date("2026-07-27T10:00:00.000Z");

function entry(
  overrides: Partial<StampDiagnosticEntry> = {}
): StampDiagnosticEntry {
  return {
    id: "stamp-1",
    mode: "project",
    projectId: "project-1",
    trade: "Dachreinigung",
    planningEntryId: null,
    offerId: "offer-1",
    billingCatalogItemId: null,
    billingCatalogItemLabel: null,
    userId: "user-1",
    employee: "Max Muster",
    entrySource: "stamped",
    date: "2026-07-20",
    startTime: "08:00",
    endTime: "10:00",
    durationMs: 2 * 3_600_000,
    pauseMs: 0,
    laborCostRateSnapshot: 25,
    comment: "Dachfläche gereinigt",
    invoiceId: null,
    completionStatus: "finished",
    overtimeApprovalStatus: "not_required",
    overtimeApprovedByUserId: null,
    overtimeApprovedByName: null,
    overtimeApprovedAt: null,
    ...overrides,
  };
}

function diagnosticInput(
  overrides: Partial<StampDiagnosticInput> = {}
): StampDiagnosticInput {
  return {
    projectId: "project-1",
    isHourlyRecurring: false,
    entries: [entry()],
    activeSessions: [],
    planningEntries: [],
    verifyInterruptionTasks: false,
    roundingFactorHours: 0.5,
    now,
    ...overrides,
  };
}

describe("diagnoseProjectStamps", () => {
  it("accepts a coherent completed project stamp", () => {
    const result = diagnoseProjectStamps(diagnosticInput());

    expect(result.issues).toEqual([]);
    expect(result.metrics).toMatchObject({
      entries: 1,
      totalHours: 2,
      employees: 1,
      activeSessions: 0,
    });
  });

  it("detects impossible time math, duplicates and overlaps", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      entries: [
        entry({
          id: "stamp-1",
          endTime: "09:00",
          durationMs: 4 * 3_600_000,
          pauseMs: -60_000,
        }),
        entry({ id: "stamp-2" }),
        entry({ id: "stamp-3" }),
        entry({
          id: "stamp-4",
          startTime: "09:30",
          endTime: "11:00",
          durationMs: 3 * 3_600_000,
        }),
      ],
    }));

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "stamp-pause-invalid",
        "stamp-duration-inconsistent",
        "stamp-duplicate",
        "stamp-overlap",
      ])
    );
    expect(result.metrics.duplicateEntries).toBe(1);
    expect(result.metrics.overlappingPairs).toBeGreaterThan(0);
  });

  it("does not treat a normal pause as a project error", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      entries: [
        entry({
          pauseMs: 30 * 60_000,
          durationMs: 90 * 60_000,
        }),
      ],
    }));

    expect(result.issues).toEqual([]);
    expect(result.checkedRules.join(" ")).toContain("Wiederaufnahme");
  });

  it("detects authorized overlaps with time entries from other projects", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      entries: [entry({ id: "target-stamp" })],
      comparisonEntries: [
        entry({
          id: "other-project-stamp",
          projectId: "other-project",
          startTime: "09:00",
          endTime: "11:00",
        }),
      ],
      crossProjectComparisonPerformed: true,
    }));

    expect(result.issues.map((issue) => issue.id)).toContain("stamp-overlap");
    expect(result.metrics.overlappingPairs).toBe(1);
    expect(result.checkedRules.join(" ")).toContain("projektübergreifend");
  });

  it("checks planning, interruption and overtime evidence", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      entries: [
        entry({
          id: "interrupted",
          planningEntryId: "plan-wrong",
          completionStatus: "interrupted",
          overtimeApprovalStatus: "approved",
          overtimeApprovedByUserId: null,
          overtimeApprovedByName: null,
          overtimeApprovedAt: null,
        }),
      ],
      planningEntries: [{
        id: "plan-wrong",
        projectId: "other-project",
        userId: "other-user",
        date: "2026-07-21",
        deletedAt: null,
      }],
      verifyInterruptionTasks: true,
      interruptionTaskDescriptions: [],
    }));

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "stamp-planning-link-conflict",
        "stamp-interruption-task-missing",
        "stamp-overtime-approval-invalid",
      ])
    );
  });

  it("explains a missing interruption task from before the automation as legacy data", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      entries: [
        entry({
          id: "legacy-interruption",
          date: "2026-06-25",
          completionStatus: "interrupted",
        }),
      ],
      verifyInterruptionTasks: true,
      interruptionTaskDescriptions: [],
    }));

    const issue = result.issues.find(
      (candidate) => candidate.id === "stamp-interruption-task-missing"
    );
    expect(issue).toMatchObject({
      severity: "critical",
      title: "Für eine ältere Arbeitsunterbrechung fehlt die Klärungsaufgabe",
    });
    expect(issue?.evidence).toContain(
      "vor Einführung der automatischen Klärungsaufgabe am 27.06.2026"
    );
    expect(issue?.evidence).toContain(
      "rückwirkend keine Aufgabe angelegt"
    );
  });

  it("accepts one coherent hourly monthly draft with rounded labor hours", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      isHourlyRecurring: true,
      entries: [
        entry({
          id: "hourly-1",
          billingCatalogItemId: "service-1",
          billingCatalogItemLabel: "DL-1 | Dachreinigung",
          durationMs: 61 * 60_000,
          endTime: "09:01",
          invoiceId: "invoice-1",
        }),
        entry({
          id: "hourly-2",
          startTime: "10:00",
          endTime: "10:30",
          billingCatalogItemId: "service-1",
          billingCatalogItemLabel: "DL-1 | Dachreinigung",
          durationMs: 30 * 60_000,
          invoiceId: "invoice-1",
        }),
      ],
      invoices: [{
        id: "invoice-1",
        projectId: "project-1",
        status: "Entwurf",
        billingSource: "hourly-recurring",
        plannedExecutionMonth: "2026-07",
        netTotal: 200,
      }],
      invoiceLines: [{
        id: "line-1",
        invoiceId: "invoice-1",
        catalogItemId: "service-1",
        quantity: 2,
        unitPrice: 100,
        totalNet: 200,
      }],
      invoiceLaborItems: [{
        invoiceId: "invoice-1",
        invoiceLineId: "line-1",
        userId: "user-1",
        plannedHours: 2,
      }],
    }));

    expect(result.issues).toEqual([]);
    expect(result.metrics.invoicedEntries).toBe(2);
    expect(result.checkedRules.join(" ")).toContain("Rundung");
  });

  it("finds broken hourly invoice links, duplicate drafts and hour mismatches", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      isHourlyRecurring: true,
      entries: [
        entry({
          id: "hourly-missing",
          trade: null,
          billingCatalogItemId: null,
          billingCatalogItemLabel: null,
          invoiceId: null,
        }),
        entry({
          id: "hourly-linked",
          startTime: "10:00",
          endTime: "11:00",
          billingCatalogItemId: "service-1",
          billingCatalogItemLabel: "DL-1 | Dachreinigung",
          invoiceId: "invoice-1",
        }),
      ],
      invoices: [
        {
          id: "invoice-1",
          projectId: "project-1",
          status: "Entwurf",
          billingSource: "hourly-recurring",
          plannedExecutionMonth: "2026-07",
          netTotal: 50,
        },
        {
          id: "invoice-2",
          projectId: "project-1",
          status: "Entwurf",
          billingSource: "hourly-recurring",
          plannedExecutionMonth: "2026-07",
          netTotal: 0,
        },
      ],
      invoiceLines: [{
        id: "line-1",
        invoiceId: "invoice-1",
        catalogItemId: "service-1",
        quantity: 3,
        unitPrice: 100,
        totalNet: 300,
      }],
      invoiceLaborItems: [{
        invoiceId: "invoice-1",
        invoiceLineId: "line-1",
        userId: "user-1",
        plannedHours: 3,
      }],
    }));

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "hourly-trade-missing",
        "hourly-billing-item-missing",
        "hourly-invoice-link-missing",
        "hourly-duplicate-month-drafts",
        "hourly-labor-hours-mismatch",
        "hourly-invoice-total-mismatch",
      ])
    );
    const missingInvoiceLink = result.issues.find(
      (issue) => issue.id === "hourly-invoice-link-missing"
    );
    expect(missingInvoiceLink?.evidence).toContain(
      "bei der Monatsabrechnung fehlen"
    );
    expect(missingInvoiceLink?.recommendation).toContain(
      "genau ein Entwurf"
    );
  });

  it("detects stale and incomplete active sessions", () => {
    const result = diagnoseProjectStamps(diagnosticInput({
      isHourlyRecurring: true,
      activeSessions: [{
        id: "session-1",
        mode: "project",
        projectId: "project-1",
        userId: "user-1",
        employee: "Max Muster",
        trade: null,
        planningEntryId: null,
        billingCatalogItemId: null,
        billingCatalogItemLabel: null,
        comment: null,
        startedAt: new Date("2026-07-26T10:00:00.000Z"),
        pauseStartedAt: null,
        createdAt: new Date("2026-07-26T10:00:00.000Z"),
      }],
    }));

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "active-session-too-long-session-1",
        "active-session-comment-session-1",
        "active-session-hourly-context-session-1",
      ])
    );
  });
});
