import { describe, expect, it } from "vitest";
import { extractProjectLifecycleRequest, looksLikeProjectLifecycleRequest } from "@/lib/jarvis/project-lifecycle-intake";

describe("project lifecycle intake", () => {
  it("detects archive and extracts project plus reason", () => {
    const question = "Archiviere Projekt GLR-449. Grund: Auftrag revisionssicher abgelegt.";
    expect(looksLikeProjectLifecycleRequest(question)).toBe(true);
    expect(extractProjectLifecycleRequest(question)).toEqual({ projectNumber: "GLR-449", lifecycleAction: "archive", reason: "Auftrag revisionssicher abgelegt" });
  });
  it("detects restoration", () => {
    expect(extractProjectLifecycleRequest("Stelle Projekt GLR-449 wieder her. Grund: Folgeauftrag").lifecycleAction).toBe("restore");
  });
  it("does not treat read questions as writes", () => {
    expect(looksLikeProjectLifecycleRequest("Zeig mir archivierte Projekte")).toBe(false);
  });
});
