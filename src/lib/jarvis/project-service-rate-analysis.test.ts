import { describe, expect, it } from "vitest";
import {
  analyzeProjectServiceRates,
  type ProjectServiceRateInvoice,
} from "@/lib/jarvis/project-service-rate-analysis";

function invoice(
  overrides: Partial<ProjectServiceRateInvoice> = {}
): ProjectServiceRateInvoice {
  return {
    id: "invoice-1",
    invoiceNumber: "R-1",
    status: "Fakturiert",
    lines: [{
      id: "line-1",
      catalogItemId: "service-1",
      catalogType: "service",
      quantity: 10,
      unit: "Std.",
      title: "Hausmeisterstunde",
      unitPrice: 60,
      discountPercent: 0,
      costSnapshotAt: "2026-07-01T00:00:00.000Z",
      laborCostSnapshot: 300,
      catalogCostSnapshotVersion: 1,
    }],
    ...overrides,
  };
}

describe("analyzeProjectServiceRates", () => {
  it("calculates billed and economic hourly rates from finished invoices and stable service links", () => {
    const result = analyzeProjectServiceRates({
      invoices: [
        invoice(),
        invoice({
          id: "invoice-2",
          invoiceNumber: "R-2",
          lines: [{
            id: "line-2",
            catalogItemId: "service-1",
            catalogType: "service",
            quantity: 5,
            unit: "Std.",
            title: "Hausmeisterstunde",
            unitPrice: 60,
            discountPercent: 10,
            costSnapshotAt: "2026-07-10T00:00:00.000Z",
            laborCostSnapshot: 150,
            catalogCostSnapshotVersion: 1,
          }],
        }),
      ],
      timeEntries: [{
        billingCatalogItemId: "service-1",
        billingCatalogItemLabel: "Hausmeisterstunde",
        durationMs: 16 * 3_600_000,
        laborCostSnapshot: 480,
        costSnapshotAt: new Date("2026-07-10T00:00:00.000Z"),
      }],
      catalogItems: [{
        id: "service-1",
        number: "L-1",
        name: "Hausmeisterstunde",
        unit: "Std.",
        salesPrice: 60,
        isActive: true,
      }],
      includeCosts: true,
    });

    expect(result.finalInvoiceCount).toBe(2);
    expect(result.services).toEqual([
      expect.objectContaining({
        billedHours: 15,
        stampedHours: 16,
        netRevenue: 870,
        realizedBilledRate: 58,
        revenuePerStampedHour: 54.38,
        currentSalesRate: 60,
        stampedLaborCost: 480,
        laborCostPerStampedHour: 30,
      }),
    ]);
  });

  it("excludes drafts, cancellations and historical mojibake deletion statuses", () => {
    const result = analyzeProjectServiceRates({
      invoices: [
        invoice({ id: "draft", status: "Entwurf" }),
        invoice({ id: "cancelled", status: "Storniert" }),
        invoice({ id: "deleted", status: "Gel\u00c3\u00b6scht" }),
        invoice({ id: "final", status: "Fakturiert" }),
      ],
      timeEntries: [],
      catalogItems: [],
      includeCosts: false,
    });

    expect(result.finalInvoiceCount).toBe(1);
    expect(result.services[0]?.netRevenue).toBe(600);
  });

  it("does not expose or infer payroll costs when cost access is disabled", () => {
    const result = analyzeProjectServiceRates({
      invoices: [invoice()],
      timeEntries: [{
        billingCatalogItemId: "service-1",
        billingCatalogItemLabel: "Hausmeisterstunde",
        durationMs: 10 * 3_600_000,
        laborCostSnapshot: 9_999,
        costSnapshotAt: new Date(),
      }],
      catalogItems: [],
      includeCosts: false,
    });

    expect(result.services[0]).toEqual(
      expect.objectContaining({
        stampedLaborCost: 0,
        laborCostPerStampedHour: 0,
        contributionAfterLabor: 0,
        costBasisComplete: false,
      })
    );
  });

  it("reports unassigned hours and withholds a price recommendation on a thin basis", () => {
    const result = analyzeProjectServiceRates({
      invoices: [invoice()],
      timeEntries: [{
        billingCatalogItemId: null,
        billingCatalogItemLabel: null,
        durationMs: 2 * 3_600_000,
        laborCostSnapshot: 0,
        costSnapshotAt: null,
      }],
      catalogItems: [],
      includeCosts: true,
    });

    expect(result.unassignedStampedHours).toBe(2);
    expect(result.services[0]?.recommendationBasisSufficient).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toContain(
      "service-rate-unassigned-stamps"
    );
  });

  it("marks proven labor-cost undercoverage without presenting break-even as a sales target", () => {
    const result = analyzeProjectServiceRates({
      invoices: [invoice({
        lines: [{
          id: "line-1",
          catalogItemId: "service-1",
          catalogType: "service",
          quantity: 10,
          unit: "Std.",
          title: "Hausmeisterstunde",
          unitPrice: 20,
          discountPercent: 0,
          costSnapshotAt: "2026-07-01T00:00:00.000Z",
          laborCostSnapshot: 300,
          catalogCostSnapshotVersion: 1,
        }],
      })],
      timeEntries: [{
        billingCatalogItemId: "service-1",
        billingCatalogItemLabel: "Hausmeisterstunde",
        durationMs: 10 * 3_600_000,
        laborCostSnapshot: 300,
        costSnapshotAt: new Date(),
      }],
      catalogItems: [],
      includeCosts: true,
    });

    const issue = result.issues.find(
      (candidate) => candidate.id === "service-rate-cost-not-covered-service-1"
    );
    expect(issue?.severity).toBe("critical");
    expect(issue?.recommendation).toContain("Untergrenze");
    expect(issue?.recommendation).toContain("noch kein sinnvoller Verkaufspreis");
  });

  it("uses stored package components for packaged service hours", () => {
    const result = analyzeProjectServiceRates({
      invoices: [invoice({
        lines: [{
          id: "package-line",
          catalogItemId: "package-1",
          catalogType: "package",
          quantity: 2,
          unit: "Paket",
          title: "Hausmeisterpaket",
          unitPrice: 120,
          discountPercent: 0,
          costSnapshotAt: "2026-07-01T00:00:00.000Z",
          laborCostSnapshot: 100,
          catalogCostSnapshotVersion: 1,
          packageComponentsSnapshot: [{
            componentItemId: "service-1",
            componentNumber: "L-1",
            componentName: "Hausmeisterstunde",
            componentType: "service",
            componentUnit: "Std.",
            quantityPerPackage: 2,
            salesValuePerPackage: 120,
            costValuePerPackage: 50,
          }],
        }],
      })],
      timeEntries: [],
      catalogItems: [],
      includeCosts: true,
    });

    expect(result.services).toEqual([
      expect.objectContaining({
        id: "service-1",
        billedHours: 4,
        netRevenue: 240,
        realizedBilledRate: 60,
      }),
    ]);
  });

  it("marks a recommendation basis as sufficient only after several invoices and enough hours", () => {
    const result = analyzeProjectServiceRates({
      invoices: [
        invoice({ id: "invoice-1", invoiceNumber: "R-1" }),
        invoice({ id: "invoice-2", invoiceNumber: "R-2" }),
        invoice({ id: "invoice-3", invoiceNumber: "R-3" }),
      ],
      timeEntries: [{
        billingCatalogItemId: "service-1",
        billingCatalogItemLabel: "Hausmeisterstunde",
        durationMs: 30 * 3_600_000,
        laborCostSnapshot: 900,
        costSnapshotAt: new Date(),
      }],
      catalogItems: [],
      includeCosts: true,
    });

    expect(result.services[0]?.invoiceCount).toBe(3);
    expect(result.services[0]?.billedHours).toBe(30);
    expect(result.services[0]?.recommendationBasisSufficient).toBe(true);
  });
});
