import { describe, expect, it } from "vitest";
import {
  buildCatalogPerformance,
  getCatalogLineNetRevenue,
  type CatalogPerformanceCatalogItem,
  type CatalogPerformanceInvoice,
} from "./catalog-performance";

const catalogItems: CatalogPerformanceCatalogItem[] = [
  {
    id: "material-1",
    type: "article",
    name: "Schraube",
    unit: "Stk",
    purchasePrice: 1,
  },
  {
    id: "service-1",
    type: "service",
    name: "Montage",
    unit: "Std.",
    purchasePrice: 30,
    planningMinutesPerUnit: 60,
  },
  {
    id: "package-1",
    type: "package",
    name: "Montagepaket",
    unit: "Paket",
    packageItems: [
      {
        componentItemId: "material-1",
        componentNumber: "MAT-1",
        componentName: "Schraube",
        componentType: "article",
        componentUnit: "Stk",
        quantity: 4,
        componentPurchasePrice: 1,
        componentSalesPrice: 2,
      },
      {
        componentItemId: "service-1",
        componentNumber: "LEI-1",
        componentName: "Montage",
        componentType: "service",
        componentUnit: "Std.",
        componentPurchasePrice: 30,
        componentSalesPrice: 60,
        componentPlanningMinutesPerUnit: 120,
      },
    ],
  },
];

describe("catalog performance", () => {
  it("berücksichtigt Positionsrabatte im Nettoumsatz", () => {
    expect(getCatalogLineNetRevenue({ quantity: 2, unitPrice: 100, discountPercent: 10 })).toBe(180);
  });

  it("addiert direktes Material und Material aus Paketen", () => {
    const invoices: CatalogPerformanceInvoice[] = [{
      id: "invoice-1",
      invoiceNumber: "RE-1",
      lines: [
        {
          id: "line-direct",
          catalogItemId: "material-1",
          catalogType: "article",
          title: "Schraube",
          unit: "Stk",
          quantity: 2,
          unitPrice: 2,
          materialCostSnapshot: 2,
          laborCostSnapshot: 0,
          catalogCostSnapshotVersion: 1,
          costSnapshotAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "line-package",
          catalogItemId: "package-1",
          catalogType: "package",
          title: "Montagepaket",
          unit: "Paket",
          quantity: 3,
          unitPrice: 128,
          materialCostSnapshot: 12,
          laborCostSnapshot: 180,
          catalogCostSnapshotVersion: 1,
          costSnapshotAt: "2026-07-01T00:00:00.000Z",
          packageComponentsSnapshot: [
            {
              componentItemId: "material-1",
              componentNumber: "MAT-1",
              componentName: "Schraube",
              componentType: "article",
              componentUnit: "Stk",
              quantityPerPackage: 4,
              salesValuePerPackage: 8,
              costValuePerPackage: 4,
            },
            {
              componentItemId: "service-1",
              componentNumber: "LEI-1",
              componentName: "Montage",
              componentType: "service",
              componentUnit: "Std.",
              quantityPerPackage: 2,
              salesValuePerPackage: 120,
              costValuePerPackage: 60,
            },
          ],
        },
      ],
    }];

    const result = buildCatalogPerformance(invoices, catalogItems);
    const material = result.materialRows.find((row) => row.id === "material-1");
    expect(material?.quantity).toBe(14);
    expect(material?.directQuantity).toBe(2);
    expect(material?.packageQuantity).toBe(12);
    expect(material?.revenue).toBe(28);
    expect(result.reconstructedPackageLineCount).toBe(0);
  });

  it("kennzeichnet alte Paketrechnungen mit heutiger Zusammensetzung als rekonstruiert", () => {
    const result = buildCatalogPerformance([{
      id: "invoice-old",
      invoiceNumber: "RE-ALT",
      lines: [{
        catalogItemId: "package-1",
        catalogType: "package",
        title: "Montagepaket",
        quantity: 2,
        unitPrice: 128,
      }],
    }], catalogItems);

    expect(result.reconstructedPackageLineCount).toBe(1);
    expect(result.materialRows[0]?.packageQuantity).toBe(8);
    expect(result.materialRows[0]?.details[0]?.basis).toBe("reconstructed");
  });

  it("verwendet gespeicherte Kosten statt später geänderter Stammdatenpreise", () => {
    const result = buildCatalogPerformance([{
      id: "invoice-snapshot",
      invoiceNumber: "RE-SNAPSHOT",
      lines: [{
        catalogItemId: "material-1",
        catalogType: "article",
        title: "Schraube",
        quantity: 2,
        unitPrice: 10,
        materialCostSnapshot: 6,
        costSnapshotAt: "2026-07-01T00:00:00.000Z",
      }],
    }], [{ ...catalogItems[0], purchasePrice: 99 }]);

    expect(result.materialRows[0]?.cost).toBe(6);
    expect(result.materialRows[0]?.margin).toBe(14);
  });
});
