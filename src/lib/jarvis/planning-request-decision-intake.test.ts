import { describe, expect, it } from "vitest";
import {
  extractPlanningRequestDecision,
  looksLikePlanningRequestDecision,
} from "@/lib/jarvis/planning-request-decision-intake";

describe("planning request decision intake", () => {
  it("extracts an approval with a full visible id", () => {
    const question = "Terminwunsch 5aa3c3d4-1234-4abc-9def-1234567890ab freigeben";
    expect(looksLikePlanningRequestDecision(question)).toBe(true);
    expect(extractPlanningRequestDecision(question)).toEqual({
      entryId: "5aa3c3d4-1234-4abc-9def-1234567890ab",
      decision: "approve",
      reason: "",
    });
  });

  it("extracts a rejection reason", () => {
    expect(extractPlanningRequestDecision("Terminwunsch-ID request-123 ablehnen. Grund: Mitarbeiter ist bereits ausgelastet")).toEqual({
      entryId: "request-123",
      decision: "reject",
      reason: "Mitarbeiter ist bereits ausgelastet",
    });
  });

  it("extracts cancellation of a confirmed appointment and its reason", () => {
    const question = "Termin-ID 5aa3c3d4-1234-4abc-9def-1234567890ab absagen. Grund: Kunde hat abgesagt";
    expect(looksLikePlanningRequestDecision(question)).toBe(true);
    expect(extractPlanningRequestDecision(question)).toEqual({
      entryId: "5aa3c3d4-1234-4abc-9def-1234567890ab",
      decision: "cancel",
      reason: "Kunde hat abgesagt",
    });
  });
});
