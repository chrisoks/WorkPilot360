import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(), getSessionBoundActor: vi.fn(), sessionBoundActorResponse: vi.fn(),
  evaluateEmployeeCostChange: vi.fn(), executeEmployeeCostChange: vi.fn(), executeRaw: vi.fn(), queryRaw: vi.fn(), transaction: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({ getDemoContext: mocks.getDemoContext }));
vi.mock("@/lib/auth/actor", () => ({ getSessionBoundActor: mocks.getSessionBoundActor, sessionBoundActorResponse: mocks.sessionBoundActorResponse }));
vi.mock("@/lib/db/client", () => ({ prisma: { $executeRaw: mocks.executeRaw, $queryRaw: mocks.queryRaw, $transaction: mocks.transaction } }));
vi.mock("@/lib/employee-costs/employee-cost-management-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/employee-costs/employee-cost-management-service")>("@/lib/employee-costs/employee-cost-management-service");
  return { ...actual, evaluateEmployeeCostChange: mocks.evaluateEmployeeCostChange, executeEmployeeCostChange: mocks.executeEmployeeCostChange };
});

import { PUT } from "@/app/api/employee-costs/route";

describe("PUT /api/employee-costs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const actor = { id: "user-1", firstName: "Jarvis", lastName: "Tester", role: "GESCHAEFTSFUEHRER", isActive: true };
    mocks.getDemoContext.mockResolvedValue({ organization: { id: "org-1" }, users: [actor] });
    mocks.getSessionBoundActor.mockResolvedValue({ ok: true, actor });
    mocks.queryRaw.mockResolvedValue([{ id: "user-2" }]);
    mocks.evaluateEmployeeCostChange.mockResolvedValue({ blockingIssues: [], fingerprint: "a".repeat(64) });
    mocks.executeEmployeeCostChange.mockResolvedValue({ id: "cost-2", organizationId: "org-1", userId: "user-2", monthlySalary: 3200, fullCostFactor: 1.4, annualHours: 2080, vacationDays: 30, trainingDays: 0, sickDays: 10, hoursPerDay: 8, updatedByUserId: "user-1", updatedByName: "Jarvis Tester", createdAt: new Date("2026-08-02T04:00:00Z"), updatedAt: new Date("2026-08-02T04:00:00Z") });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({}));
  });

  it("uses the shared validated service instead of a separate UI calculation", async () => {
    const response = await PUT(new Request("http://localhost/api/employee-costs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: "user-1", userId: "user-2", monthlySalary: 3200, fullCostFactor: 1.4 }) }));
    expect(response.status).toBe(200);
    expect(mocks.evaluateEmployeeCostChange).toHaveBeenCalledWith({ organizationId: "org-1", userId: "user-2", changes: { monthlySalary: 3200, fullCostFactor: 1.4 } });
    expect(mocks.executeEmployeeCostChange).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", userId: "user-2", source: "employee-cost-ui", expectedFingerprint: "a".repeat(64) }));
  });

  it("returns validation problems without writing", async () => {
    mocks.evaluateEmployeeCostChange.mockResolvedValueOnce({ blockingIssues: ["Berechnung nicht möglich."], fingerprint: "b".repeat(64) });
    const response = await PUT(new Request("http://localhost/api/employee-costs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: "user-1", userId: "user-2", annualHours: 0 }) }));
    expect(response.status).toBe(400);
    expect(mocks.executeEmployeeCostChange).not.toHaveBeenCalled();
  });
});
