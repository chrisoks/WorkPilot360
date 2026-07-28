import { describe, expect, it } from "vitest";
import { analyzeProjectMaterials } from "@/lib/jarvis/project-material-analysis";

function invoice(
  lines: Array<Record<string, unknown>>,
  status = "Fakturiert"
) {
  return {
    id: "invoice-1",
    invoiceNumber: "RE-1",
    status,
    projectId: "project-1",
    projectNumber: "HAS-1",
    projectTitle: "Hausmeisterservice",
    customerName: "Klaus Testmann",
    serviceDate: "2026-07-01",
    createdAt: "2026-07-01T08:00:00.000Z",
    lines,
  };
}

describe("JARVIS project material analysis", () => {
  it("counts identical invoice positions separately instead of deduplicating them", () => {
    const result = analyzeProjectMaterials({
      invoices: [
        invoice([
          {
            id: "line-1",
            catalogItemId: "article-1",
            catalogType: "article",
            title: "Streusalz",
            unit: "kg",
            quantity: 10,
            unitPrice: 2,
          },
          {
            id: "line-2",
            catalogItemId: "article-1",
            catalogType: "article",
            title: "Streusalz",
            unit: "kg",
            quantity: 5,
            unitPrice: 2,
          },
        ]),
      ],
      inventoryMovements: [
        {
          catalogItemId: "article-1",
          movementType: "sale",
          quantityDelta: -15,
          invoiceId: "invoice-1",
        },
      ],
      includeCosts: false,
    });

    expect(result.materialPositionCount).toBe(2);
    expect(result.materials).toEqual([
      expect.objectContaining({
        id: "article-1",
        quantity: 15,
        directQuantity: 15,
      }),
    ]);
    expect(result.issues).toHaveLength(0);
  });

  it("includes article quantities from stored package components", () => {
    const result = analyzeProjectMaterials({
      invoices: [
        invoice([
          {
            id: "package-line",
            catalogItemId: "package-1",
            catalogType: "package",
            title: "Winterdienst-Paket",
            unit: "Paket",
            quantity: 3,
            unitPrice: 100,
            packageComponentsSnapshot: [
              {
                componentItemId: "salt-1",
                componentNumber: "OKI0448",
                componentName: "Streusalz",
                componentType: "article",
                componentUnit: "kg",
                quantityPerPackage: 4,
                salesValuePerPackage: 20,
                costValuePerPackage: 8,
              },
            ],
          },
        ]),
      ],
      inventoryMovements: [
        {
          catalogItemId: "salt-1",
          movementType: "sale",
          quantityDelta: -12,
          invoiceId: "invoice-1",
        },
      ],
      includeCosts: false,
    });

    expect(result.packagePositionCount).toBe(1);
    expect(result.materials[0]).toMatchObject({
      id: "salt-1",
      quantity: 12,
      packageQuantity: 12,
    });
    expect(result.issues).toHaveLength(0);
  });

  it("reports an inventory mismatch without calling it physical consumption", () => {
    const result = analyzeProjectMaterials({
      invoices: [
        invoice([
          {
            id: "line-1",
            catalogItemId: "article-1",
            catalogType: "article",
            title: "Streusalz",
            unit: "kg",
            quantity: 10,
            unitPrice: 2,
          },
        ]),
      ],
      inventoryMovements: [],
      includeCosts: false,
    });

    expect(result.issues).toEqual([
      expect.objectContaining({ id: "project-material-inventory-mismatch" }),
    ]);
    expect(result.basisNote).toContain("keinen tatsächlichen physischen Verbrauch");
  });

  it("does not invent an inventory comparison for a free invoice position without a stable article ID", () => {
    const result = analyzeProjectMaterials({
      invoices: [
        invoice([{
          id: "free-line",
          catalogItemId: "",
          catalogType: "article",
          title: "Freie Materialposition",
          unit: "Stk.",
          quantity: 2,
          unitPrice: 10,
        }]),
      ],
      inventoryMovements: [],
      includeCosts: false,
    });

    expect(result.materials).toHaveLength(1);
    expect(result.inventoryComparedMaterialCount).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it("ignores drafts and warns about missing historical package and cost snapshots", () => {
    const result = analyzeProjectMaterials({
      invoices: [
        invoice([
          {
            id: "draft-line",
            catalogItemId: "article-1",
            catalogType: "article",
            title: "Nicht fertige Position",
            quantity: 999,
          },
        ], "Entwurf"),
        {
          ...invoice([
            {
              id: "legacy-deleted-line",
              catalogItemId: "article-1",
              catalogType: "article",
              title: "Historisch gelöscht",
              quantity: 999,
            },
          ], "Gel\u00c3\u00b6scht"),
          id: "invoice-legacy-deleted",
          invoiceNumber: "RE-GELOESCHT",
        },
        {
          ...invoice([
            {
              id: "package-line",
              catalogItemId: "package-1",
              catalogType: "package",
              title: "Altes Paket",
              quantity: 1,
              unitPrice: 100,
              packageComponentsSnapshot: [],
            },
          ]),
          id: "invoice-2",
          invoiceNumber: "RE-2",
        },
      ],
      inventoryMovements: [],
      includeCosts: true,
    });

    expect(result.finalInvoiceCount).toBe(1);
    expect(result.materials).toHaveLength(0);
    expect(result.issues.map((issue) => issue.id)).toEqual([
      "project-package-material-snapshot-missing",
      "project-material-cost-snapshot-missing",
    ]);
  });
});
