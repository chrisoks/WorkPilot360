import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  vehicleFindFirst: vi.fn(),
  calculationCreate: vi.fn(),
  calculationFindMany: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: mocks.getDemoContext,
}));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    vehicle: { findFirst: mocks.vehicleFindFirst },
    vehicleCalculation: {
      create: mocks.calculationCreate,
      findMany: mocks.calculationFindMany,
    },
  },
}));

import { POST } from "@/app/api/vehicle-calculations/route";

const input = {
  distanceKm: 100,
  consumptionLitersPer100Km: 10,
  fuelPricePerLiter: 1.8,
  selfCostPerKm: 0.5,
  salesPricePerKm: 1.2,
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request("https://workpilot.example/api/vehicle-calculations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("vehicle calculation API roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({
      organization: { id: "org-1" },
      users: [],
    });
    mocks.vehicleFindFirst.mockResolvedValue({
      id: "vehicle-1",
      organizationId: "org-1",
      isActive: true,
      vehicleNumber: "FZ-001",
      name: "Transporter",
      licensePlate: "KA-WP 360",
      fuelType: "DIESEL",
      consumptionLitersPer100Km: 10,
      selfCostPerKm: 0.5,
      salesPricePerKm: 1.2,
      updatedAt: new Date("2026-07-30T20:00:00.000Z"),
    });
    mocks.calculationCreate.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "calculation-1",
        ...data,
      })
    );
  });

  it("allows an employee to calculate but not persist", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: {
        id: "employee-1",
        role: Role.MITARBEITER,
        isActive: true,
      },
    });

    const calculated = await post({
      actorId: "employee-1",
      action: "calculate",
      input,
    });
    expect(calculated.status).toBe(200);
    expect(await calculated.json()).toMatchObject({
      input,
      result: {
        fuelLiters: 10,
        fuelCost: 18,
        vehicleSelfCost: 50,
        totalSelfCost: 68,
        totalSales: 138,
        profit: 70,
      },
    });

    const saveAttempt = await post({
      actorId: "employee-1",
      action: "save",
      vehicleId: "vehicle-1",
      input,
    });
    expect(saveAttempt.status).toBe(403);
    expect(mocks.vehicleFindFirst).not.toHaveBeenCalled();
    expect(mocks.calculationCreate).not.toHaveBeenCalled();
  });

  it("keeps guests out of calculation data", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: {
        id: "guest-1",
        role: Role.GAST,
        isActive: true,
      },
    });
    const response = await post({
      actorId: "guest-1",
      action: "calculate",
      input,
    });
    expect(response.status).toBe(403);
    expect(mocks.calculationCreate).not.toHaveBeenCalled();
  });

  it("replaces tampered rates with current vehicle master data before save", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: {
        id: "executive-1",
        role: Role.GESCHAEFTSFUEHRER,
        isActive: true,
        firstName: "Jarvis",
        lastName: "Tester",
      },
    });
    const response = await post({
      actorId: "executive-1",
      action: "save",
      vehicleId: "vehicle-1",
      input: {
        ...input,
        consumptionLitersPer100Km: 0,
        selfCostPerKm: 0,
        salesPricePerKm: 999,
      },
    });
    expect(response.status).toBe(201);
    expect(mocks.calculationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inputSnapshot: expect.objectContaining({
          distanceKm: 100,
          consumptionLitersPer100Km: 10,
          selfCostPerKm: 0.5,
          salesPricePerKm: 1.2,
          vehicle: expect.objectContaining({
            id: "vehicle-1",
            updatedAt: "2026-07-30T20:00:00.000Z",
          }),
        }),
        resultSnapshot: expect.objectContaining({
          totalSelfCost: 68,
          totalSales: 138,
          profit: 70,
        }),
      }),
    });
  });
});
