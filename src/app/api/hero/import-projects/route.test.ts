import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("legacy HERO project import route", () => {
  it("keeps the unreviewed mass-import path disabled", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain("frühere HERO-Massenimport ist deaktiviert");
  });
});
