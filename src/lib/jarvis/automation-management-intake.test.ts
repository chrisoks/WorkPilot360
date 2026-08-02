import { describe, expect, it } from "vitest";
import { extractProjectStatusAutomationRequest } from "./automation-management-intake";

describe("extractProjectStatusAutomationRequest", () => {
  it.each([
    ["Aktiviere die Projektstatus-Frühwarnung.", true],
    ["Schalte die Projektstatus-Automation ein", true],
    ["Deaktiviere die Projektstatus-Automation", false],
    ["Stoppe die Projektstatus-Eskalation", false],
  ])("erkennt %s", (question, enabled) => {
    expect(extractProjectStatusAutomationRequest(question)).toEqual({ enabled });
  });

  it("ignoriert allgemeine Automationswünsche ohne eindeutigen Schalter", () => {
    expect(extractProjectStatusAutomationRequest("Zeig mir alle Automationen")).toBeNull();
    expect(extractProjectStatusAutomationRequest("Ändere die Projektstatus-Fristen")).toBeNull();
  });
});
