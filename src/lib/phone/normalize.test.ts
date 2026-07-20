import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "./normalize";

describe("phone normalization", () => {
  it.each([
    "0170 1234567",
    "0049 170 1234567",
    "+49 (170) 1234567",
  ])("normalizes German formats to the same E.164 value: %s", (input) => {
    expect(normalizePhoneNumber(input)).toMatchObject({
      kind: "valid",
      normalized: "+491701234567",
    });
  });

  it("provides the canonical value used for both display and API storage", () => {
    const result = normalizePhoneNumber("06281 / 123456");
    expect(result).toMatchObject({
      kind: "valid",
      normalized: "+496281123456",
    });
  });

  it("keeps a valid international number", () => {
    expect(normalizePhoneNumber("+44 20 7946 0958")).toMatchObject({
      kind: "valid",
      normalized: "+442079460958",
      country: "GB",
    });
  });

  it("does not silently turn an invalid value into a German number", () => {
    expect(normalizePhoneNumber("123")).toMatchObject({ kind: "invalid", normalized: null });
    expect(normalizePhoneNumber("1701234567")).toMatchObject({ kind: "invalid", normalized: null });
  });

  it("accepts an empty optional number", () => {
    expect(normalizePhoneNumber("  ")).toEqual({ kind: "empty", input: "", normalized: null });
  });
});
