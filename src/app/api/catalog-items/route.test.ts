import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    catalogItem: { findMany: vi.fn() },
  };
  const prisma = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    catalogItem: { findMany: vi.fn() },
  };
  return { prisma, tx };
});

vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/demo/context", () => ({
  getDemoContext: vi.fn().mockResolvedValue({
    organization: { id: "org-1" },
    users: [{ id: "user-1", firstName: "Ada", lastName: "Admin", email: "ada@example.test", role: "ADMIN", isActive: true }],
  }),
}));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "user-1", firstName: "Ada", lastName: "Admin", email: "ada@example.test", role: "ADMIN", isActive: true },
  }),
  sessionBoundActorResponse: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({ canManageCatalogItems: vi.fn(() => true) }));

import { PATCH, POST } from "./route";

function request(method: string, body: Record<string, unknown>) {
  return new Request("http://localhost/api/catalog-items", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function packageRow() {
  return {
    id: "package-1",
    organizationId: "org-1",
    type: "package",
    number: "P1001",
    name: "Bestandspaket",
    category: null,
    trade: "Objektbetreuung",
    unit: "Paket",
    description: null,
    matchcode: null,
    ean: null,
    costCenter: null,
    supplierName: null,
    supplierNumber: null,
    manufacturer: null,
    manufacturerNumber: null,
    manufacturerTypeName: null,
    minimumOrderQuantity: null,
    quantityScale: null,
    priceUnit: null,
    deliveryTime: null,
    stockQuantity: null,
    purchasePrice: 10,
    laborCostRateKey: "",
    listPrice: 0,
    salesPrice: 20,
    salesPriceCalculationMode: "manual",
    salesRatePerHour: null,
    scheduledSalesPrice: null,
    scheduledSalesRatePerHour: null,
    scheduledSalesPriceValidFrom: null,
    scheduledSalesPriceCreatedAt: null,
    scheduledSalesPriceUpdatePackages: false,
    lastSalesPriceChangedAt: null,
    lastSalesPriceOldValue: null,
    lastSalesPriceNewValue: null,
    vatRate: 19,
    isLaborPosition: false,
    isPlanningRelevant: true,
    planningMinutesPerUnit: 30,
    defaultPlanningBoard: "OK immocare",
    defaultPlanningGroup: "VZK",
    reviewStatus: "approved",
    reviewedAt: new Date("2026-08-01T10:00:00.000Z"),
    reviewedByUserId: "user-1",
    reviewedByName: "Ada Admin",
    reviewNote: null,
    isActive: true,
    usedCount: 0,
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    updatedAt: new Date("2026-08-01T10:00:00.000Z"),
  };
}

describe("catalog item package safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$executeRaw.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValue([]);
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.$executeRaw.mockResolvedValue(0);
    mocks.tx.$queryRaw.mockResolvedValue([]);
    mocks.tx.catalogItem.findMany.mockResolvedValue([]);
  });

  it("requires explicit confirmation before saving an article below cost", async () => {
    const response = await POST(request("POST", {
      actorId: "user-1",
      type: "article",
      name: "Verlustartikel",
      purchasePrice: 100,
      salesPrice: 90,
      planningMinutesPerUnit: 0,
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "below_cost_confirmation_required" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("calculates the unit sales price of a new service from SVS and planning minutes", async () => {
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{
      ...packageRow(),
      id: "service-1",
      type: "service",
      number: "L1001",
      name: "Zeitbasierte Leistung",
      purchasePrice: 28.33,
      salesPrice: 23,
      salesPriceCalculationMode: "time_based",
      salesRatePerHour: 46,
      planningMinutesPerUnit: 30,
    }]);

    const response = await POST(request("POST", {
      actorId: "user-1",
      type: "service",
      number: "L1001",
      name: "Zeitbasierte Leistung",
      purchasePrice: 28.33,
      salesPriceCalculationMode: "time_based",
      salesRatePerHour: 46,
      planningMinutesPerUnit: 30,
      confirmBelowCost: true,
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      salesPrice: 23,
      salesPriceCalculationMode: "time_based",
      salesRatePerHour: 46,
    });
    const insertArguments = mocks.prisma.$queryRaw.mock.calls[0] ?? [];
    expect(insertArguments).toContain(23);
    expect(insertArguments).toContain(46);
    expect(insertArguments).toContain("time_based");
  });

  it("validates a new package inside the transaction before inserting its header", async () => {
    const response = await POST(request("POST", {
      actorId: "user-1",
      type: "package",
      name: "Leeres Paket",
      packageItems: [],
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("mindestens einen gültigen") });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("writes package header, history and validated components through the same transaction", async () => {
    mocks.tx.catalogItem.findMany.mockResolvedValue([
      { id: "article-1", number: "A1001", name: "Material", type: "article", isActive: true },
    ]);
    mocks.tx.$queryRaw.mockResolvedValue([{ ...packageRow(), id: "created-package", number: "P1002", name: "Komplettpaket" }]);
    mocks.tx.$executeRaw.mockResolvedValue(1);

    const response = await POST(request("POST", {
      actorId: "user-1",
      type: "package",
      number: "P1002",
      name: "Komplettpaket",
      packageItems: [{ componentItemId: "article-1", quantity: 2 }],
    }));

    expect(response.status).toBe(201);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it("blocks changing a populated package into another catalog type", async () => {
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([packageRow()])
      .mockResolvedValueOnce([{
        componentItemId: "article-1",
        quantity: 1,
        position: 0,
        descriptionOverride: null,
        priceOverride: null,
        purchasePriceSnapshot: 5,
        salesPriceSnapshot: 10,
        planningMinutesOverride: 0,
      }]);

    const response = await PATCH(request("PATCH", {
      actorId: "user-1",
      id: "package-1",
      expectedUpdatedAt: "2026-08-01T10:00:00.000Z",
      type: "article",
      number: "P1001",
      name: "Bestandspaket",
      purchasePrice: 10,
      salesPrice: 20,
      vatRate: 19,
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("solange das Paket Bestandteile enthält") });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
