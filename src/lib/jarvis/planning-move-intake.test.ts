import { describe, expect, it } from "vitest";
import { extractPlanningMoveRequest, looksLikePlanningMoveRequest } from "@/lib/jarvis/planning-move-intake";

describe("planning move intake", () => {
  it("extracts the visible entry id, target window and reasons", () => {
    const question = "Verschiebe Termin plan-entry-123456 auf 04.08.2026 von 09:15 bis 11:30. Grund: Kunde kann erst später. Überplanung: Geschäftsführung hat die Zusatzzeit freigegeben";
    expect(looksLikePlanningMoveRequest(question)).toBe(true);
    expect(extractPlanningMoveRequest(question)).toMatchObject({
      entryId: "plan-entry-123456", date: "2026-08-04", startTime: "09:15", endTime: "11:30",
      reason: "Kunde kann erst später", overbookingReason: "Geschäftsführung hat die Zusatzzeit freigegeben", seriesRequested: false,
    });
  });

  it("detects an explicitly requested whole-series move", () => {
    expect(extractPlanningMoveRequest("Verschiebe die komplette Terminserie Termin abcdef-123456 auf 05.08.2026 von 10:00 bis 11:00. Grund: Objektzugang geändert").seriesRequested).toBe(true);
  });

  it("does not confuse appointment help with a move action", () => {
    expect(looksLikePlanningMoveRequest("Wie verschiebe ich einen Termin?" )).toBe(false);
  });
});
