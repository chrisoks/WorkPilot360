import { describe, expect, it } from "vitest";
import { hasEmployeeWorkspaceAccess } from "./employee-workspaces";

describe("hasEmployeeWorkspaceAccess", () => {
  const employeeRoles = [
    "MITARBEITER",
    "VERTRIEB",
    "BUCHHALTUNG",
    "FUEHRUNGSKRAFT",
    "GESCHAEFTSFUEHRER",
    "ADMIN",
  ];

  it.each(employeeRoles)("allows the shared workspaces for %s", (role) => {
    expect(hasEmployeeWorkspaceAccess("planningBoard", role)).toBe(true);
    expect(hasEmployeeWorkspaceAccess("calculators", role)).toBe(true);
    expect(hasEmployeeWorkspaceAccess("processAutomation", role)).toBe(true);
    expect(hasEmployeeWorkspaceAccess("personalData", role)).toBe(true);
  });

  it("does not broaden guest access", () => {
    expect(hasEmployeeWorkspaceAccess("planningBoard", "GAST")).toBe(false);
    expect(hasEmployeeWorkspaceAccess("processAutomation", "GAST")).toBe(false);
  });

  it("does not turn unrelated modules into universal employee modules", () => {
    expect(hasEmployeeWorkspaceAccess("settings", "MITARBEITER")).toBe(false);
    expect(hasEmployeeWorkspaceAccess("accounting", "MITARBEITER")).toBe(false);
  });
});
