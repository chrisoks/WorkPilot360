import { describe, expect, it } from "vitest";
import {
  assertCurrentProjectMasterdataVersion,
  getProtectedProjectLifecycleState,
  ProjectMasterdataConflictError,
} from "./project-masterdata-guard";

describe("project masterdata guard", () => {
  it("always creates a project in Lead / Klärung", () => {
    expect(getProtectedProjectLifecycleState(null)).toEqual({
      status: "Lead / Klärung",
      statusCode: "lead",
    });
  });

  it("preserves the server-side lifecycle state during masterdata edits", () => {
    expect(getProtectedProjectLifecycleState({ status: "Zur Planung bereit", statusCode: "planning" }))
      .toEqual({ status: "Zur Planung bereit", statusCode: "planning" });
  });

  it("accepts only the exact current project version", () => {
    const currentUpdatedAt = new Date("2026-08-03T10:00:00.000Z");
    expect(() => assertCurrentProjectMasterdataVersion({
      currentUpdatedAt,
      expectedUpdatedAt: currentUpdatedAt.toISOString(),
    })).not.toThrow();

    expect(() => assertCurrentProjectMasterdataVersion({
      currentUpdatedAt,
      expectedUpdatedAt: "2026-08-03T09:59:59.000Z",
    })).toThrow(ProjectMasterdataConflictError);
    expect(() => assertCurrentProjectMasterdataVersion({
      currentUpdatedAt,
      expectedUpdatedAt: "",
    })).toThrow("neu geladen");
  });
});
