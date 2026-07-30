import { describe, expect, it } from "vitest";
import { hasLeadingZeroBits } from "./client-security";

describe("online request client proof helper", () => {
  it("counts complete and partial leading zero bytes", () => {
    expect(hasLeadingZeroBits(Uint8Array.from([0, 0b00011111]), 11)).toBe(true);
    expect(hasLeadingZeroBits(Uint8Array.from([0, 0b00111111]), 11)).toBe(false);
    expect(hasLeadingZeroBits(Uint8Array.from([0, 0]), 16)).toBe(true);
    expect(hasLeadingZeroBits(Uint8Array.from([0, 1]), 16)).toBe(false);
  });
});
