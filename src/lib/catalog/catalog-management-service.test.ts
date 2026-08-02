import { describe, expect, it, vi } from "vitest";
import { evaluateCatalogChange, evaluateCatalogCreation, executeCatalogManagement, getCatalogManagementConfirmationText } from "@/lib/catalog/catalog-management-service";

function db(overrides: { existing?: Record<string, unknown>; duplicates?: Array<Record<string, unknown>>; packages?: number } = {}) {
  const existing = overrides.existing ?? null;
  return {
    catalogItem: {
      findFirst: vi.fn().mockResolvedValue(existing), findMany: vi.fn().mockImplementation(({ where }) => where?.OR ? Promise.resolve(overrides.duplicates ?? []) : Promise.resolve([{ number: "A1004" }]) ),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "item-new", ...data, updatedAt: new Date("2026-08-02T03:00:00Z") })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "item-1", number: "L1001" }), findFirstOrThrow: vi.fn().mockResolvedValue(existing),
    },
    catalogPackageItem: { count: vi.fn().mockResolvedValue(overrides.packages ?? 0) }, offerLine: { count: vi.fn().mockResolvedValue(0) }, invoiceLine: { count: vi.fn().mockResolvedValue(0) },
    planningEntry: { count: vi.fn().mockResolvedValue(0) }, projectTimeEntry: { count: vi.fn().mockResolvedValue(0) }, catalogInventoryMovement: { count: vi.fn().mockResolvedValue(0) },
    marketingContentQuota: { count: vi.fn().mockResolvedValue(0) }, marketingContentItem: { count: vi.fn().mockResolvedValue(0) }, catalogItemHistory: { create: vi.fn().mockResolvedValue({}) }, $executeRaw: vi.fn().mockResolvedValue(1),
  };
}
const existing = { id: "item-1", organizationId: "org-1", type: "service", number: "L1001", name: "Glasreinigung", category: "Reinigung", trade: "Glasreinigung", unit: "Std", description: null, purchasePrice: 30, salesPrice: 50, vatRate: 19, laborCostRateKey: "service", isLaborPosition: true, isPlanningRelevant: true, planningMinutesPerUnit: 60, defaultPlanningBoard: null, defaultPlanningGroup: null, reviewStatus: "approved", reviewedAt: new Date("2026-08-01T08:00:00Z"), reviewedByUserId: "user-1", reviewedByName: "Test", lastSalesPriceChangedAt: null, lastSalesPriceOldValue: null, lastSalesPriceNewValue: null, updatedAt: new Date("2026-08-02T02:00:00Z") };

describe("catalog management service", () => {
  it("creates a complete article preview with serialized number and margin", async () => {
    const evaluation = await evaluateCatalogCreation({ organizationId: "org-1", values: { type: "article", name: "Reinigungsmittel", purchasePrice: 10, salesPrice: 18, vatRate: 19 }, db: db() as never });
    expect(evaluation.item.number).toBe("A1005");
    expect(evaluation.calculation).toMatchObject({ grossProfit: 8, marginPercent: 44.44 });
    expect(evaluation.blockingIssues).toEqual([]);
    expect(getCatalogManagementConfirmationText("create", evaluation.item.number)).toBe("KATALOGPOSITION ANLEGEN A1005");
  });

  it("blocks duplicates and invalid planning values", async () => {
    const evaluation = await evaluateCatalogCreation({ organizationId: "org-1", values: { type: "service", number: "L1001", name: "Glasreinigung", isPlanningRelevant: true, planningMinutesPerUnit: 0 }, db: db({ duplicates: [{ id: "other", number: "L1001", name: "Glasreinigung" }] }) as never });
    expect(evaluation.blockingIssues.join(" ")).toContain("Mögliche Dublette");
    expect(evaluation.blockingIssues.join(" ")).toContain("positive Planminuten");
  });

  it("blocks a custom number that does not match the selected catalog type", async () => {
    const fakeDb = db();
    const result = await evaluateCatalogCreation({ organizationId: "org-1", values: { type: "service", number: "A1001", name: "Falsches Präfix", salesPrice: 100 }, db: fakeDb as never });
    expect(result.blockingIssues).toContain("Die Katalognummer muss zur Art passen und dem Format L plus 3 bis 12 Ziffern entsprechen.");
  });

  it("shows package impact and invalidates an approved review on price change", async () => {
    const evaluation = await evaluateCatalogChange({ organizationId: "org-1", catalogItemId: "item-1", changes: { salesPrice: 55 }, db: db({ existing, packages: 2 }) as never });
    expect(evaluation.reviewWillBeInvalidated).toBe(true);
    expect(evaluation.impacts).toContainEqual({ key: "packages", label: "verwendende Pakete", count: 2 });
    expect(evaluation.warnings.join(" ")).toContain("Snapshots");
  });

  it("executes a bound creation and writes history", async () => {
    const tx = db();
    const evaluation = await evaluateCatalogCreation({ organizationId: "org-1", values: { type: "article", name: "Reinigungsmittel", purchasePrice: 10, salesPrice: 18 }, db: tx as never });
    const created = await executeCatalogManagement({ tx: tx as never, organizationId: "org-1", mode: "create", values: evaluation.values, actorId: "user-1", actorName: "Jarvis Tester", requestId: "draft-1", expectedFingerprint: evaluation.fingerprint });
    expect(created.id).toBe("item-new");
    expect(tx.catalogItemHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "created" }) }));
  });
});
