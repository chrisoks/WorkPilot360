import { describe, expect, it } from "vitest";
import { extractContactDeletionRequest, looksLikeContactDeletionRequest } from "@/lib/jarvis/contact-deletion-intake";

describe("contact deletion intake", () => {
  it("recognizes an explicit deletion with customer number and reason", () => {
    const question = "Lösche Kontakt 7000049 endgültig. Grund: Versehentliche Doppelanlage.";
    expect(looksLikeContactDeletionRequest(question)).toBe(true);
    expect(extractContactDeletionRequest(question)).toEqual({ customerNumber: "7000049", reason: "Versehentliche Doppelanlage." });
  });

  it("does not confuse contact creation with deletion", () => {
    expect(looksLikeContactDeletionRequest("Lege einen neuen Firmenkontakt an.")).toBe(false);
  });
});
