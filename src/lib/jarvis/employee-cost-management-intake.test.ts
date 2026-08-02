import { describe, expect, it } from "vitest";
import { extractEmployeeCostManagementRequest, looksLikeEmployeeCostManagementRequest } from "@/lib/jarvis/employee-cost-management-intake";

describe("employee cost management intake", () => {
  it("extracts the employee and all controlled cost fields", () => {
    const question = "Ändere Lohnkosten für max@example.test: Monatsgehalt: 3.200,50; Vollkostenfaktor: 1,4; Jahresstunden: 2080; Urlaubstage: 30; Schulungstage: 4; Krankheitstage: 9; Stunden pro Arbeitstag: 8.";
    expect(looksLikeEmployeeCostManagementRequest(question)).toBe(true);
    expect(extractEmployeeCostManagementRequest(question)).toEqual({ employeeEmail: "max@example.test", changes: { monthlySalary: 3200.5, fullCostFactor: 1.4, annualHours: 2080, vacationDays: 30, trainingDays: 4, sickDays: 9, hoursPerDay: 8 } });
  });
  it("does not capture payroll questions without a concrete change", () => {
    expect(looksLikeEmployeeCostManagementRequest("Wie hoch sind die Lohnkosten von Max?")).toBe(false);
  });
  it("distinguishes German thousands from dot decimals", () => {
    expect(extractEmployeeCostManagementRequest("Ändere Lohnkosten für max@example.test: Monatsgehalt: 3.200; Vollkostenfaktor: 1.35").changes).toEqual({ monthlySalary: 3200, fullCostFactor: 1.35 });
  });
  it("ignores sentence punctuation after the last number", () => {
    expect(extractEmployeeCostManagementRequest("Ändere Lohnkosten für max@example.test: Monatsgehalt: 3.200.").changes).toEqual({ monthlySalary: 3200 });
  });
});
