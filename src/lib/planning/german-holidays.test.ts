import { describe, expect, it } from "vitest";
import {
  getGermanHoliday,
  normalizeGermanState,
} from "@/lib/planning/german-holidays";

describe("German planning holidays", () => {
  it("calculates fixed and Easter-relative holidays", () => {
    expect(getGermanHoliday("2026-01-01", "BW")).toBe("Neujahr");
    expect(getGermanHoliday("2026-04-03", "BW")).toBe("Karfreitag");
    expect(getGermanHoliday("2026-04-06", "BW")).toBe("Ostermontag");
    expect(getGermanHoliday("2026-05-14", "BW")).toBe(
      "Christi Himmelfahrt"
    );
  });

  it("applies state-specific holidays without cross-state leakage", () => {
    expect(getGermanHoliday("2026-01-06", "BW")).toBe(
      "Heilige Drei Könige"
    );
    expect(getGermanHoliday("2026-01-06", "NI")).toBeNull();
    expect(getGermanHoliday("2026-10-31", "NI")).toBe("Reformationstag");
    expect(getGermanHoliday("2026-10-31", "BW")).toBeNull();
  });

  it("falls back safely to Baden-Württemberg", () => {
    expect(normalizeGermanState("ni")).toBe("NI");
    expect(normalizeGermanState("unknown")).toBe("BW");
    expect(normalizeGermanState({})).toBe("BW");
  });
});
