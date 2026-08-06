import { describe, expect, it } from "vitest";
import {
  getConfiguredDocumentBccRecipients,
  normalizeDocumentBccKinds,
} from "@/lib/mail/bcc-routing";

describe("document BCC routing", () => {
  it("normalizes only supported, unique document kinds", () => {
    expect(normalizeDocumentBccKinds(["invoice", "invoice", "offer", "unknown", null])).toEqual([
      "invoice",
      "offer",
    ]);
  });

  it("returns the hidden BCC only for an enabled document kind", () => {
    const account = {
      bcc: "buchhaltung@example.com; Archiv@example.com, buchhaltung@example.com",
      bccDocumentKinds: ["invoice", "cancellation"],
    };

    expect(getConfiguredDocumentBccRecipients(account, "invoice")).toEqual([
      "buchhaltung@example.com",
      "Archiv@example.com",
    ]);
    expect(getConfiguredDocumentBccRecipients(account, "offer")).toEqual([]);
  });

  it("fails closed when no document kinds were selected", () => {
    expect(
      getConfiguredDocumentBccRecipients({ bcc: "buchhaltung@example.com" }, "invoice")
    ).toEqual([]);
  });
});
