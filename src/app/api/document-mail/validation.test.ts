import { describe, expect, it } from "vitest";

import { isDraftDocument } from "./validation";

describe("document mail validation", () => {
  it("blocks offer and invoice drafts", () => {
    expect(isDraftDocument("offer", "Entwurf")).toBe(true);
    expect(isDraftDocument("invoice", "Entwurf")).toBe(true);
  });

  it("does not misclassify finalized documents or other kinds", () => {
    expect(isDraftDocument("offer", "Erstellt")).toBe(false);
    expect(isDraftDocument("invoice", "Fakturiert")).toBe(false);
    expect(isDraftDocument("reminder", "Entwurf")).toBe(false);
  });
});
