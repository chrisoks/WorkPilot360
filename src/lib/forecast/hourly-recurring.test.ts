import { describe, expect, it } from "vitest";
import { calculateHourlyRecurringForecast } from "./hourly-recurring";

const baseInput = {
  projectId: "project-1",
  monthKey: "2026-08",
  hasFinalInvoice: false,
  finalInvoiceNetTotal: 0,
  historicalInvoiceNetTotal: 0,
  roundingFactorHours: 0.25,
  planningEntries: [],
  timeEntries: [],
  draftInvoices: [],
  catalogItems: [{ id: "service-1", salesPrice: 60.5 }],
};

describe("hourly recurring forecast", () => {
  it("forecasts confirmed multi-employee appointments using invoice rounding and sales price", () => {
    const result = calculateHourlyRecurringForecast({
      ...baseInput,
      planningEntries: [
        {
          id: "plan-1",
          projectId: "project-1",
          date: "2026-08-15",
          durationMinutes: 61,
          approvalStatus: "confirmed",
          billingCatalogItemId: "service-1",
        },
        {
          id: "plan-2",
          projectId: "project-1",
          date: "2026-08-15",
          durationMinutes: 61,
          approvalStatus: "confirmed",
          billingCatalogItemId: "service-1",
        },
      ],
    });

    expect(result).toMatchObject({
      forecastValue: 151.25,
      plannedValue: 151.25,
      plannedEntryCount: 2,
      source: "planning",
    });
  });

  it("combines the complete draft including material with only remaining planned appointments", () => {
    const result = calculateHourlyRecurringForecast({
      ...baseInput,
      planningEntries: [
        {
          id: "plan-done",
          projectId: "project-1",
          date: "2026-08-05",
          durationMinutes: 60,
          approvalStatus: "confirmed",
          billingCatalogItemId: "service-1",
        },
        {
          id: "plan-future",
          projectId: "project-1",
          date: "2026-08-18",
          durationMinutes: 60,
          approvalStatus: "confirmed",
          billingCatalogItemId: "service-1",
        },
      ],
      timeEntries: [{ planningEntryId: "plan-done", invoiceId: "draft-1" }],
      draftInvoices: [{ id: "draft-1", netTotal: 145.5, lines: [] }],
    });

    expect(result).toMatchObject({
      forecastValue: 206,
      draftValue: 145.5,
      plannedValue: 60.5,
      plannedEntryCount: 1,
      source: "draft-and-planning",
    });
  });

  it("deduplicates a planned appointment from the draft snapshot even without a loaded time entry", () => {
    const result = calculateHourlyRecurringForecast({
      ...baseInput,
      planningEntries: [
        {
          id: "plan-done",
          projectId: "project-1",
          date: "2026-08-05",
          durationMinutes: 60,
          approvalStatus: "confirmed",
          billingCatalogItemId: "service-1",
        },
      ],
      draftInvoices: [
        {
          id: "draft-1",
          netTotal: 100,
          lines: [
            {
              hourlyBillingDetails: [
                { entries: [{ planningEntryId: "plan-done" }] },
              ],
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      forecastValue: 100,
      plannedValue: 0,
      source: "draft",
    });
  });

  it("excludes wishes, deleted entries and appointments without a usable billing price", () => {
    const result = calculateHourlyRecurringForecast({
      ...baseInput,
      planningEntries: [
        {
          id: "request",
          projectId: "project-1",
          date: "2026-08-10",
          durationMinutes: 60,
          approvalStatus: "requested",
          billingCatalogItemId: "service-1",
        },
        {
          id: "deleted",
          projectId: "project-1",
          date: "2026-08-11",
          durationMinutes: 60,
          approvalStatus: "confirmed",
          deletedAt: "2026-08-01",
          billingCatalogItemId: "service-1",
        },
        {
          id: "missing-price",
          projectId: "project-1",
          date: "2026-08-12",
          durationMinutes: 60,
          approvalStatus: "confirmed",
          billingCatalogItemId: "unknown",
        },
      ],
    });

    expect(result).toMatchObject({
      forecastValue: 0,
      plannedEntryCount: 0,
      missingPriceEntryCount: 1,
      source: "none",
    });
  });

  it("lets the final monthly invoice replace draft, planning, material and history", () => {
    const result = calculateHourlyRecurringForecast({
      ...baseInput,
      hasFinalInvoice: true,
      finalInvoiceNetTotal: 780,
      historicalInvoiceNetTotal: 600,
      planningEntries: [
        {
          id: "plan-1",
          projectId: "project-1",
          date: "2026-08-20",
          durationMinutes: 480,
          approvalStatus: "confirmed",
          billingCatalogItemId: "service-1",
        },
      ],
      draftInvoices: [{ id: "draft-1", netTotal: 500 }],
    });

    expect(result).toEqual({
      forecastValue: 780,
      invoiceValue: 780,
      draftValue: 0,
      plannedValue: 0,
      plannedEntryCount: 0,
      missingPriceEntryCount: 0,
      source: "invoice",
    });
  });
});
