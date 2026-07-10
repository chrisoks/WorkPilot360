import { describe, expect, it } from "vitest";
import {
  getInternalAutomationHeaders,
  isInternalAutomationRequest,
} from "@/lib/auth/internal-automation";

describe("internal automation authentication", () => {
  it("accepts only the server-generated automation token", () => {
    const headers = getInternalAutomationHeaders();
    expect(isInternalAutomationRequest(new Request("http://localhost", { headers }))).toBe(true);
    expect(
      isInternalAutomationRequest(
        new Request("http://localhost", { headers: { "x-workpilot-internal-automation": "invalid" } })
      )
    ).toBe(false);
    expect(isInternalAutomationRequest(new Request("http://localhost"))).toBe(false);
  });
});
