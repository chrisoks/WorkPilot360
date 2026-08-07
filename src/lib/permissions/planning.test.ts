import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canCreateFixedPlanningEntries, canManagePlanningEntries } from "@/lib/permissions";

describe("planning permissions", () => {
  it("allows the sales base role and sales add-on role to create fixed appointments", () => {
    expect(canCreateFixedPlanningEntries({ role: Role.VERTRIEB })).toBe(true);
    expect(
      canCreateFixedPlanningEntries({ role: Role.MITARBEITER, salesRoleEnabled: true })
    ).toBe(true);
  });

  it("does not grant fixed appointment creation to regular employees", () => {
    expect(canCreateFixedPlanningEntries({ role: Role.MITARBEITER })).toBe(false);
    expect(canCreateFixedPlanningEntries({ role: Role.BUCHHALTUNG })).toBe(false);
  });

  it("keeps approval and planning management restricted to leadership", () => {
    expect(canManagePlanningEntries({ role: Role.VERTRIEB })).toBe(false);
    expect(canManagePlanningEntries({ role: Role.MITARBEITER, salesRoleEnabled: true })).toBe(false);
    expect(canManagePlanningEntries({ role: Role.FUEHRUNGSKRAFT })).toBe(true);
    expect(canManagePlanningEntries({ role: Role.GESCHAEFTSFUEHRER })).toBe(true);
  });
});
