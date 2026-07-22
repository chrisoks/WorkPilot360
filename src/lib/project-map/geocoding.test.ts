import { describe, expect, it } from "vitest";
import {
  isValidProjectCoordinate,
  normalizeProjectMapAddress,
  parseOpenCageProjectGeocodeResponse,
} from "./geocoding";

describe("project map geocoding", () => {
  it("normalizes equivalent address strings to the same cache key", () => {
    expect(normalizeProjectMapAddress(" Birekenweg 12,   74722 Buchen ")).toBe(
      normalizeProjectMapAddress("Birekenweg 12 , 74722 Buchen")
    );
  });

  it("rejects invalid coordinate ranges", () => {
    expect(isValidProjectCoordinate(49.5, 9.3)).toBe(true);
    expect(isValidProjectCoordinate(95, 9.3)).toBe(false);
    expect(isValidProjectCoordinate(49.5, 190)).toBe(false);
  });

  it("uses the first valid German OpenCage result", () => {
    expect(parseOpenCageProjectGeocodeResponse({
      results: [
        { confidence: 10, geometry: { lat: 48.2, lng: 16.3 }, components: { country_code: "at" } },
        {
          confidence: 9,
          formatted: "Birekenweg 12, 74722 Buchen, Deutschland",
          geometry: { lat: 49.518, lng: 9.323 },
          components: { country_code: "de" },
        },
      ],
    })).toEqual({
      latitude: 49.518,
      longitude: 9.323,
      confidence: 9,
      formattedAddress: "Birekenweg 12, 74722 Buchen, Deutschland",
    });
  });
});
