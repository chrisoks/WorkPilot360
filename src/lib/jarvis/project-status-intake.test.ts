import { describe, expect, it } from "vitest";
import { extractProjectStatusChange, looksLikeProjectStatusChangeRequest } from "@/lib/jarvis/project-status-intake";

describe("JARVIS project status intake", () => {
  it.each([
    "Setze GLR-449 auf Geplant. Grund: Termin bestätigt.",
    "Ändere den Projektstatus von HAS-1 auf Umsetzung, weil die Arbeit begonnen hat.",
  ])("recognizes a concrete status command: %s", (question) => {
    expect(looksLikeProjectStatusChangeRequest(question)).toBe(true);
  });

  it("keeps status reads and explanations outside the write intent", () => {
    expect(looksLikeProjectStatusChangeRequest("Welchen Status hat GLR-449?")).toBe(false);
    expect(looksLikeProjectStatusChangeRequest("Warum steht GLR-449 auf Geplant?")).toBe(false);
  });

  it("extracts project, approved target and reason", () => {
    expect(extractProjectStatusChange("Setze GLR-449 auf Geplant. Grund: Termin bestätigt.")).toEqual({
      projectNumber: "GLR-449",
      targetStatus: "Geplant",
      reason: "Termin bestätigt",
    });
  });
});
