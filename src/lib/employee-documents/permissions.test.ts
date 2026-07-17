import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  canDeleteEmployeeDocument,
  canUploadEmployeeDocument,
  canViewEmployeeDocuments,
} from "./permissions";

describe("Personalakten-Berechtigungen", () => {
  const employee = { id: "employee", role: Role.MITARBEITER };
  const manager = { id: "manager", role: Role.FUEHRUNGSKRAFT };
  const executive = { id: "executive", role: Role.GESCHAEFTSFUEHRER };

  it("erlaubt Mitarbeitern ausschließlich die eigenen Unterlagen", () => {
    expect(canViewEmployeeDocuments(employee, "employee")).toBe(true);
    expect(canViewEmployeeDocuments(employee, "other")).toBe(false);
    expect(canViewEmployeeDocuments(manager, "employee")).toBe(false);
    expect(canViewEmployeeDocuments(executive, "employee")).toBe(true);
  });

  it("begrenzt Mitarbeiter-Uploads auf Nachweise und Weiterbildungen", () => {
    expect(canUploadEmployeeDocument(employee, "employee", "sick_note")).toBe(true);
    expect(canUploadEmployeeDocument(employee, "employee", "vacation_proof")).toBe(true);
    expect(canUploadEmployeeDocument(employee, "employee", "training")).toBe(true);
    expect(canUploadEmployeeDocument(employee, "employee", "payroll")).toBe(false);
    expect(canUploadEmployeeDocument(employee, "other", "training")).toBe(false);
    expect(canUploadEmployeeDocument(executive, "employee", "payroll")).toBe(true);
  });

  it("erlaubt Mitarbeitern nur das Entfernen eigener selbst hochgeladener Nachweise", () => {
    expect(
      canDeleteEmployeeDocument(employee, { employeeId: "employee", uploadedById: "employee", category: "training" })
    ).toBe(true);
    expect(
      canDeleteEmployeeDocument(employee, { employeeId: "employee", uploadedById: "executive", category: "training" })
    ).toBe(false);
    expect(
      canDeleteEmployeeDocument(employee, { employeeId: "employee", uploadedById: "employee", category: "payroll" })
    ).toBe(false);
    expect(
      canDeleteEmployeeDocument(executive, { employeeId: "employee", uploadedById: "employee", category: "payroll" })
    ).toBe(true);
  });
});
