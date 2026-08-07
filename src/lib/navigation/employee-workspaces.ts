const employeeWorkspaceTabs = new Set([
  "calculators",
  "planningBoard",
  "processAutomation",
  "personalData",
]);

export function hasEmployeeWorkspaceAccess(tab: string, role?: string | null) {
  return role !== "GAST" && employeeWorkspaceTabs.has(tab);
}
