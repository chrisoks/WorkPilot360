import { describe, expect, it } from "vitest";
import { resolvePublicAppOrigin } from "./public-app-origin";

describe("resolvePublicAppOrigin", () => {
  it("prefers the configured public application URL", () => {
    expect(resolvePublicAppOrigin({
      configuredOrigin: "https://workpilot360.oks-cloudservices.com/",
      forwardedHost: "localhost:3000",
      requestUrl: "http://localhost:3000/api/document-mail",
    })).toBe("https://workpilot360.oks-cloudservices.com");
  });

  it("uses trusted proxy headers when no public URL is configured", () => {
    expect(resolvePublicAppOrigin({
      forwardedHost: "workpilot.example.com",
      forwardedProto: "https",
      requestUrl: "http://localhost:3000/api/document-mail",
    })).toBe("https://workpilot.example.com");
  });

  it("falls back to the request origin for local development", () => {
    expect(resolvePublicAppOrigin({ requestUrl: "http://localhost:3001/api/document-mail" }))
      .toBe("http://localhost:3001");
  });

  it("rejects non-http configured URLs", () => {
    expect(resolvePublicAppOrigin({
      configuredOrigin: "javascript:alert(1)",
      requestUrl: "https://workpilot.example.com/api/document-mail",
    })).toBe("https://workpilot.example.com");
  });
});
