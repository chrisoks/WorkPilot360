import { describe, expect, it } from "vitest";
import {
  calculateCustomerRevenueMix,
  isFinanciallyActiveRevenueInvoice,
  type RevenueInvoiceInput,
} from "@/lib/analytics/customer-revenue-mix";

const invoice = (
  id: string,
  projectId: string | null,
  netTotal: number,
  serviceDate: string,
  status = "Fakturiert"
): RevenueInvoiceInput => ({
  id,
  projectId,
  netTotal,
  serviceDate,
  status,
  createdAt: `${serviceDate}T12:00:00.000Z`,
});

describe("customer revenue mix", () => {
  it("classifies period revenue by the customer's first active invoice", () => {
    const result = calculateCustomerRevenueMix({
      invoices: [
        invoice("old", "project-existing", 200, "2025-12-10"),
        invoice("existing", "project-existing", 1_000, "2026-06-10"),
        invoice("new-first", "project-new", 500, "2026-03-02"),
        invoice("new-next", "project-new", 250, "2026-06-20"),
      ],
      projects: [
        { id: "project-existing", contactId: "customer-existing" },
        { id: "project-new", contactId: "customer-new" },
      ],
      period: { from: "2026-01-01", to: "2026-12-31" },
    });

    expect(result.totalRevenue).toBe(1_750);
    expect(result.existingCustomers).toEqual({
      revenue: 1_000,
      shareOfTotalPercent: 57.1,
      customerCount: 1,
      invoiceCount: 1,
    });
    expect(result.newCustomers).toEqual({
      revenue: 750,
      shareOfTotalPercent: 42.9,
      customerCount: 1,
      invoiceCount: 2,
    });
    expect(result.classificationCoveragePercent).toBe(100);
    expect(result.hasObservedRevenueBeforePeriod).toBe(true);
  });

  it("uses explicit historical evidence when structured invoices do not reach far enough back", () => {
    const result = calculateCustomerRevenueMix({
      invoices: [invoice("current", "project", 600, "2026-07-05")],
      projects: [{ id: "project", contactId: "customer" }],
      period: { from: "2026-01-01", to: "2026-12-31" },
      firstRevenueEvidence: [{ customerId: "customer", firstRevenueAt: "2024-09-12" }],
    });

    expect(result.existingCustomers.revenue).toBe(600);
    expect(result.newCustomers.revenue).toBe(0);
    expect(result.earliestObservedRevenueAt).toBe("2024-09-12T00:00:00.000Z");
  });

  it("keeps invoices without a stable customer relation in a visible unassigned bucket", () => {
    const result = calculateCustomerRevenueMix({
      invoices: [
        invoice("assigned", "project", 800, "2026-05-01"),
        invoice("missing-project", "unknown-project", 150, "2026-05-02"),
        invoice("no-project", null, 50, "2026-05-03"),
      ],
      projects: [{ id: "project", contactId: "customer" }],
      period: { from: "2026-01-01", to: "2026-12-31" },
    });

    expect(result.totalRevenue).toBe(1_000);
    expect(result.newCustomers.revenue).toBe(800);
    expect(result.unassigned).toEqual({
      revenue: 200,
      shareOfTotalPercent: 20,
      customerCount: 0,
      invoiceCount: 2,
    });
    expect(result.classificationCoveragePercent).toBe(80);
  });

  it("matches the existing report rule for drafts, deleted and cancelled invoices", () => {
    expect(isFinanciallyActiveRevenueInvoice({ status: "Fakturiert" })).toBe(true);
    expect(isFinanciallyActiveRevenueInvoice({ status: "Entwurf" })).toBe(false);
    expect(isFinanciallyActiveRevenueInvoice({ status: "Gelöscht" })).toBe(false);
    expect(isFinanciallyActiveRevenueInvoice({ status: "Gel\u00c3\u00b6scht" })).toBe(false);
    expect(isFinanciallyActiveRevenueInvoice({ status: "Storniert" })).toBe(false);
    expect(isFinanciallyActiveRevenueInvoice({ status: "Stornorechnung" })).toBe(false);

    const result = calculateCustomerRevenueMix({
      invoices: [
        invoice("valid", "project", 100, "2026-04-01"),
        invoice("draft", "project", 900, "2026-04-01", "Entwurf"),
        invoice("cancelled", "project", -100, "2026-04-01", "Stornorechnung"),
      ],
      projects: [{ id: "project", contactId: "customer" }],
      period: { from: "2026-01-01", to: "2026-12-31" },
    });

    expect(result.totalRevenue).toBe(100);
    expect(result.totalInvoiceCount).toBe(1);
    expect(result.excludedInvoiceCount).toBe(2);
  });

  it("reports invalid dates instead of silently assigning them to a cohort", () => {
    const result = calculateCustomerRevenueMix({
      invoices: [{
        id: "invalid",
        projectId: "project",
        status: "Fakturiert",
        netTotal: 100,
        serviceDate: "kein-datum",
        createdAt: "auch-kein-datum",
      }],
      projects: [{ id: "project", contactId: "customer" }],
      period: { from: "2026-01-01", to: "2026-12-31" },
    });

    expect(result.totalRevenue).toBe(0);
    expect(result.invalidDateInvoiceCount).toBe(1);
    expect(result.classificationCoveragePercent).toBeNull();
  });

  it("includes created timestamps throughout a date-only period end", () => {
    const result = calculateCustomerRevenueMix({
      invoices: [{
        id: "end-of-day",
        projectId: "project",
        status: "Fakturiert",
        netTotal: 100,
        serviceDate: null,
        createdAt: "2026-07-31T22:30:00.000Z",
      }],
      projects: [{ id: "project", contactId: "customer" }],
      period: { from: "2026-07-01", to: "2026-07-31" },
    });

    expect(result.totalRevenue).toBe(100);
    expect(result.newCustomers.invoiceCount).toBe(1);
  });

  it("uses absolute revenue for coverage while keeping net revenue for shares", () => {
    const result = calculateCustomerRevenueMix({
      invoices: [
        invoice("assigned", "project", 100, "2026-01-10"),
        invoice("unassigned-credit", null, -20, "2026-01-11", "Gutschrift"),
      ],
      projects: [{ id: "project", contactId: "customer" }],
      period: { from: "2026-01-01", to: "2026-12-31" },
    });

    expect(result.totalRevenue).toBe(80);
    expect(result.classificationCoveragePercent).toBe(83.3);
    expect(result.newCustomers.shareOfTotalPercent).toBe(125);
    expect(result.unassigned.shareOfTotalPercent).toBe(-25);
  });

  it("rejects an invalid or reversed reporting period", () => {
    expect(() => calculateCustomerRevenueMix({
      invoices: [],
      projects: [],
      period: { from: "2026-12-31", to: "2026-01-01" },
    })).toThrowError("Der Auswertungszeitraum ist ungültig.");
  });
});
