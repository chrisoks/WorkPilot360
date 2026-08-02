import { describe, expect, it, vi } from "vitest";
import { calculateEmployeeCostMetrics, evaluateEmployeeCostChange, executeEmployeeCostChange, getEmployeeCostConfirmationText } from "@/lib/employee-costs/employee-cost-management-service";

const row = { id: "cost-1", organizationId: "org-1", userId: "user-2", monthlySalary: 3000, fullCostFactor: 1.35, annualHours: 2080, vacationDays: 30, trainingDays: 5, sickDays: 10, hoursPerDay: 8, updatedByUserId: null, updatedByName: null, createdAt: new Date("2026-08-02T04:00:00Z"), updatedAt: new Date("2026-08-02T04:00:00Z") };
function db(overrides: { row?: typeof row | null; active?: boolean; snapshots?: number; unrated?: number; stamps?: number } = {}) { return { user: { findFirst: vi.fn().mockResolvedValue({ id: "user-2", firstName: "Max", lastName: "Muster", email: "max@example.test", isActive: overrides.active ?? true }) }, employeeCostCalculation: { findUnique: vi.fn().mockResolvedValue(overrides.row === undefined ? row : overrides.row), upsert: vi.fn().mockResolvedValue({ ...row, monthlySalary: 3200 }) }, projectTimeEntry: { count: vi.fn().mockImplementation(({ where }: { where: { laborCostRateSnapshot: { gt?: number; lte?: number } } }) => Promise.resolve(where.laborCostRateSnapshot.gt === 0 ? overrides.snapshots ?? 4 : overrides.unrated ?? 1)) }, activeStampSession: { count: vi.fn().mockResolvedValue(overrides.stamps ?? 1) }, auditLog: { create: vi.fn().mockResolvedValue({}) }, $executeRaw: vi.fn().mockResolvedValue(1) }; }

describe("employee cost management service", () => {
  it("calculates a transparent future hourly rate and preserves history", async () => {
    const result = await evaluateEmployeeCostChange({ organizationId: "org-1", userId: "user-2", changes: { monthlySalary: 3200 }, db: db() as never });
    expect(result.metrics.hourlyCost).toBeGreaterThan(0); expect(result.changes).toContainEqual(expect.objectContaining({ field: "monthlySalary", before: 3000, after: 3200 }));
    expect(result.impacts).toContainEqual({ key: "historicalSnapshots", label: "historische Zeiten mit Kostensnapshot", count: 4 });
    expect(result.warnings.join(" ")).toContain("nicht rückwirkend"); expect(getEmployeeCostConfirmationText("MAX@EXAMPLE.TEST")).toBe("LOHNKOSTEN ÄNDERN max@example.test");
  });
  it("blocks impossible or non-effective calculations", async () => {
    const blocked = await evaluateEmployeeCostChange({ organizationId: "org-1", userId: "user-2", changes: { fullCostFactor: 0, annualHours: 100, vacationDays: 100, hoursPerDay: 8 }, db: db() as never });
    expect(blocked.blockingIssues.join(" ")).toContain("Vollkostenfaktor"); expect(blocked.blockingIssues.join(" ")).toContain("alle Jahresstunden");
    const unchanged = await evaluateEmployeeCostChange({ organizationId: "org-1", userId: "user-2", changes: { monthlySalary: 3000 }, db: db({ stamps: 0, unrated: 0 }) as never });
    expect(unchanged.blockingIssues.join(" ")).toContain("keine wirksame");
  });
  it("executes fingerprint-bound upsert and audit", async () => {
    const tx = db(); const evaluation = await evaluateEmployeeCostChange({ organizationId: "org-1", userId: "user-2", changes: { monthlySalary: 3200 }, db: tx as never });
    await executeEmployeeCostChange({ tx: tx as never, organizationId: "org-1", userId: "user-2", changes: { monthlySalary: 3200 }, actorId: "user-1", actorName: "GF", requestId: "draft-1", expectedFingerprint: evaluation.fingerprint });
    expect(tx.employeeCostCalculation.upsert).toHaveBeenCalled(); expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "employee-cost.changed" }) }));
  });
  it("keeps the shared metric formula stable", () => { expect(calculateEmployeeCostMetrics({ monthlySalary: 3000, fullCostFactor: 1.35, annualHours: 2080, vacationDays: 30, trainingDays: 0, sickDays: 10, hoursPerDay: 8 }).hourlyCost).toBe(27.61); });
});
