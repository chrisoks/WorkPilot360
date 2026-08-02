import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { evaluatePersonnelChange, executePersonnelChange, getPersonnelManagementConfirmationText } from "@/lib/users/personnel-management-service";

const employee: Record<string, unknown> & { id: string; email: string; role: Role; updatedAt: Date } = { id: "user-2", organizationId: "org-1", firstName: "Max", lastName: "Muster", email: "max@example.test", passwordHash: "x", role: Role.MITARBEITER, isActive: true, personalNumber: "P-22", phone: null, mobile: null, street: null, postalCode: null, city: null, planningBoard: "OK solutions", planningGroup: "Marketing", updatedAt: new Date("2026-08-02T04:00:00Z") };
function db(overrides: { employee?: typeof employee; duplicates?: unknown[]; executives?: number; sessions?: number } = {}) { return { user: { findFirst: vi.fn().mockResolvedValue(overrides.employee ?? employee), findMany: vi.fn().mockResolvedValue(overrides.duplicates ?? []), count: vi.fn().mockResolvedValue(overrides.executives ?? 2), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ ...employee, role: Role.FUEHRUNGSKRAFT }) }, authSession: { count: vi.fn().mockResolvedValue(overrides.sessions ?? 1), deleteMany: vi.fn().mockResolvedValue({ count: overrides.sessions ?? 1 }) }, task: { count: vi.fn().mockResolvedValue(2) }, planningEntry: { count: vi.fn().mockResolvedValue(3) }, projectTimeEntry: { count: vi.fn().mockResolvedValue(4) }, auditLog: { create: vi.fn().mockResolvedValue({}) }, $executeRaw: vi.fn().mockResolvedValue(1) }; }

describe("personnel management service", () => {
  it("previews role and contact changes with impacts and session revocation", async () => {
    const result = await evaluatePersonnelChange({ organizationId: "org-1", employeeId: employee.id, actorId: "user-1", actorRole: Role.GESCHAEFTSFUEHRER, changes: { role: "FUEHRUNGSKRAFT", mobile: "+49 171 1234567" }, db: db() as never });
    expect(result.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "role" }), expect.objectContaining({ field: "mobile", after: "+491711234567" })]));
    expect(result.roleSessionsWillBeRevoked).toBe(true);
    expect(result.impacts).toContainEqual({ key: "tasks", label: "offene eigene Aufgaben", count: 2 });
    expect(getPersonnelManagementConfirmationText(employee.email)).toBe("MITARBEITER ÄNDERN max@example.test");
  });
  it("blocks self-role escalation, higher roles, duplicates and the last executive", async () => {
    const self = await evaluatePersonnelChange({ organizationId: "org-1", employeeId: employee.id, actorId: employee.id, actorRole: Role.GESCHAEFTSFUEHRER, changes: { role: "ADMIN" }, db: db({ duplicates: [{ id: "x" }] }) as never });
    expect(self.blockingIssues.join(" ")).toContain("eigene Rolle"); expect(self.blockingIssues.join(" ")).toContain("höhere Rolle"); expect(self.blockingIssues.join(" ")).toContain("bereits");
    const executive = { ...employee, role: Role.GESCHAEFTSFUEHRER };
    const last = await evaluatePersonnelChange({ organizationId: "org-1", employeeId: employee.id, actorId: "admin", actorRole: Role.ADMIN, changes: { role: "MITARBEITER" }, db: db({ employee: executive, executives: 1 }) as never });
    expect(last.blockingIssues.join(" ")).toContain("letzte aktive Geschäftsführung");
  });
  it("executes a fingerprint-bound update, revokes sessions and audits", async () => {
    const tx = db(); const evaluation = await evaluatePersonnelChange({ organizationId: "org-1", employeeId: employee.id, actorId: "user-1", actorRole: Role.GESCHAEFTSFUEHRER, changes: { role: "FUEHRUNGSKRAFT" }, db: tx as never });
    await executePersonnelChange({ tx: tx as never, organizationId: "org-1", employeeId: employee.id, actorId: "user-1", actorRole: Role.GESCHAEFTSFUEHRER, changes: { role: "FUEHRUNGSKRAFT" }, requestId: "draft-1", expectedFingerprint: evaluation.fingerprint });
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: employee.id } }); expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "personnel.changed" }) }));
  });
});
