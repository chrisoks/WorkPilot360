import { describe, expect, it } from "vitest";
import {
  isAcceptedTurnstileResponse,
  isPublicRequestMutationSameOrigin,
  readStringList,
} from "./portal-security";

describe("online request portal security", () => {
  it("normalizes persisted string lists", () => {
    expect(readStringList([" trade-1 ", null, "", 4, "trade-2"])).toEqual([
      "trade-1",
      "trade-2",
    ]);
  });

  it("accepts the request origin and rejects unrelated origins", () => {
    const sameOrigin = new Request("https://anfrage.ok-immocare.de/api/public", {
      headers: { origin: "https://anfrage.ok-immocare.de" },
    });
    const foreignOrigin = new Request("https://anfrage.ok-immocare.de/api/public", {
      headers: { origin: "https://evil.example" },
    });
    expect(
      isPublicRequestMutationSameOrigin(sameOrigin, ["anfrage.ok-immocare.de"])
    ).toBe(true);
    expect(
      isPublicRequestMutationSameOrigin(foreignOrigin, ["anfrage.ok-immocare.de"])
    ).toBe(false);
  });

  it("binds Turnstile to the expected action and hostname", () => {
    expect(
      isAcceptedTurnstileResponse(
        {
          success: true,
          action: "online_request",
          hostname: "anfrage.ok-immocare.de",
        },
        ["anfrage.ok-immocare.de"]
      )
    ).toBe(true);
    expect(
      isAcceptedTurnstileResponse(
        {
          success: true,
          action: "login",
          hostname: "anfrage.ok-immocare.de",
        },
        ["anfrage.ok-immocare.de"]
      )
    ).toBe(false);
  });
});
