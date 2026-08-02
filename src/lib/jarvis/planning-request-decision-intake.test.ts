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

  it("extracts withdrawal of an open appointment request and its reason", () => {
    const question = "Terminwunsch-ID request-123 zurückziehen. Grund: Eigener Einsatz nicht mehr möglich";
    expect(looksLikePlanningRequestDecision(question)).toBe(true);
    expect(extractPlanningRequestDecision(question)).toEqual({
      entryId: "request-123",
      decision: "withdraw",
      reason: "Eigener Einsatz nicht mehr möglich",
    });
  });

  it("distinguishes the explicit cancellation of an entire appointment series", () => {
    const question = "Gesamte Terminserie Termin-ID request-123 absagen. Grund: Kunde hat alle Termine abgesagt";
    expect(looksLikePlanningRequestDecision(question)).toBe(true);
    expect(extractPlanningRequestDecision(question)).toEqual({
      entryId: "request-123",
      decision: "cancel_series",
      reason: "Kunde hat alle Termine abgesagt",
    });
  });

  it("distinguishes withdrawal of an entire appointment request series", () => {
    const question = "Komplette Terminwunschserie request-123 zurückziehen. Grund: Einsatzserie nicht mehr möglich";
    expect(looksLikePlanningRequestDecision(question)).toBe(true);
    expect(extractPlanningRequestDecision(question)).toEqual({
      entryId: "request-123",
      decision: "withdraw_series",
      reason: "Einsatzserie nicht mehr möglich",
    });
  });
});
