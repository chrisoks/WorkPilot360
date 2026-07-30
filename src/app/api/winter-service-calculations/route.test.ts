import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  winterCreate: vi.fn(),
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
    winterServiceCalculation: {
      create: mocks.winterCreate,
    },
  },
}));

import { POST } from "@/app/api/winter-service-calculations/route";
import { calculateWinterService } from "@/lib/winter-service/calculation";

const input = {
  areaSqm: 1000,
  readinessPricePerSqmPerMonth: 0.2,
  seasonMonths: 5,
  expectedDeployments: 20,
  baseServiceMinutes: 60,
  laborSalesRatePerHour: 45,
  saltGramsPerSqm: 15,
  saltSalesPricePerKg: 0.8,
  plowTimeIncreasePercent: 30,
  plowSaltIncreasePercent: 10,
  mixedSpreadingPercent: 70,
  mixedPlowingPercent: 30,
};

function request(action: "calculate" | "save") {
  return new Request(
    "https://workpilot.example/api/winter-service-calculations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: "employee-1",
        action,
        input,
        customerId: "contact-1",
        projectId: "project-1",
      }),
    }
  );
}

describe("winter-service calculation API permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({
      organization: { id: "org-1" },
      users: [],
    });
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: {
        id: "employee-1",
        role: "MITARBEITER",
        isActive: true,
      },
    });
  });

  it("allows an internal employee to calculate with the central engine", async () => {
    const response = await POST(request("calculate"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      input,
      result: calculateWinterService(input),
    });
    expect(mocks.winterCreate).not.toHaveBeenCalled();
  });

  it("does not let the employee turn the same calculation into a project write", async () => {
    const response = await POST(request("save"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("berechnen"),
    });
    expect(mocks.winterCreate).not.toHaveBeenCalled();
  });

  it("keeps guests fully outside the internal calculator", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: { id: "guest-1", role: "GAST", isActive: true },
    });

    const response = await POST(request("calculate"));

    expect(response.status).toBe(403);
    expect(mocks.winterCreate).not.toHaveBeenCalled();
  });
});
