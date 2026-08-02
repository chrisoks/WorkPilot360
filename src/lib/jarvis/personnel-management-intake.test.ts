import { describe, expect, it } from "vitest";
import { extractPersonnelManagementRequest, looksLikePersonnelManagementRequest } from "@/lib/jarvis/personnel-management-intake";

describe("personnel management intake", () => {
  it("extracts one target email and controlled master-data changes", () => {
    const question = "Ändere Mitarbeiter max@alt.de: Vorname: Maximilian; Rolle: Führungskraft; Mobil: +49 171 1234567; Planungsgruppe: Glasreinigung.";
    expect(looksLikePersonnelManagementRequest(question)).toBe(true);
    expect(extractPersonnelManagementRequest(question)).toEqual({ employeeEmail: "max@alt.de", changes: { firstName: "Maximilian", role: "FUEHRUNGSKRAFT", mobile: "+49 171 1234567", planningGroup: "Glasreinigung" } });
  });
  it("keeps passwords, payroll, activation and creation outside this action", () => {
    expect(looksLikePersonnelManagementRequest("Ändere Mitarbeiter max@alt.de: Passwort: geheim")).toBe(false);
    expect(looksLikePersonnelManagementRequest("Deaktiviere Mitarbeiter max@alt.de: Rolle: Gast")).toBe(false);
    expect(looksLikePersonnelManagementRequest("Lege Mitarbeiter an: E-Mail: neu@example.test")).toBe(false);
  });
});
