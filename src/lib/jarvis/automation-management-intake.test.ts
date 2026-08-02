import { describe, expect, it } from "vitest";
import { extractProjectStatusAutomationRequest } from "./automation-management-intake";

describe("extractProjectStatusAutomationRequest", () => {
  it.each([
    ["Aktiviere die Projektstatus-Frühwarnung.", true],
    ["Schalte die Projektstatus-Automation ein", true],
    ["Deaktiviere die Projektstatus-Automation", false],
    ["Stoppe die Projektstatus-Eskalation", false],
  ])("erkennt %s", (question, enabled) => {
    expect(extractProjectStatusAutomationRequest(question)).toEqual({ operation: "switch", enabled });
  });

  it("erkennt genau eine benannte Statusregel mit beiden Schwellen", () => {
    expect(extractProjectStatusAutomationRequest("Ändere die Projektstatus-Regel Umsetzung: verantwortliche Person nach 10 Tagen, Geschäftsführung nach 20 Tagen.")).toEqual({
      operation: "rule", status: "Umsetzung", responsibleAfterDays: 10, managementAfterDays: 20,
    });
  });

  it("erkennt das kontrollierte Deaktivieren einer benannten Statusregel", () => {
    expect(extractProjectStatusAutomationRequest("Deaktiviere die Projektstatus-Regel Endkontrolle.")).toEqual({
      operation: "rule", status: "Endkontrolle", enabled: false,
    });
  });

  it("ignoriert allgemeine Automationswünsche ohne eindeutigen Schalter", () => {
    expect(extractProjectStatusAutomationRequest("Zeig mir alle Automationen")).toBeNull();
    expect(extractProjectStatusAutomationRequest("Ändere die Projektstatus-Fristen")).toBeNull();
  });
});
