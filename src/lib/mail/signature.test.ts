import { describe, expect, it } from "vitest";
import { normalizeMailSignatureHtml } from "./signature";

describe("mail signature", () => {
  it("formats a plain-text signature without losing line breaks", () => {
    expect(normalizeMailSignatureHtml("Mit freundlichen Grüßen\nChristian Eid")).toBe(
      "<p>Mit freundlichen Grüßen<br>Christian Eid</p>"
    );
  });

  it("keeps stored signature markup but removes executable content", () => {
    expect(normalizeMailSignatureHtml('<p onclick="alert(1)">Christian</p><script>alert(2)</script>')).toBe(
      "<p>Christian</p>"
    );
  });
});
