import { describe, expect, it } from "vitest";
import {
  getProjectBusinessAreaCode,
  PROJECT_BUSINESS_AREA_IMMOCARE,
  PROJECT_BUSINESS_AREA_SOLUTIONS,
} from "../src/lib/project-business-area";

describe("project business area API contract", () => {
  it("classifies Immocare by structured project type", () => {
    expect(getProjectBusinessAreaCode({
      projectType: "Projekt OK immocare",
      branch: "OK immocare GmbH",
      projectNumber: "DAR-399",
    })).toBe(PROJECT_BUSINESS_AREA_IMMOCARE);
  });

  it("classifies Solutions by structured project type", () => {
    expect(getProjectBusinessAreaCode({
      projectType: "Projekt OK solutions",
      branch: "OK solutions GmbH",
      projectNumber: "MKG-400",
    })).toBe(PROJECT_BUSINESS_AREA_SOLUTIONS);
  });

  it("keeps the historical OKI project-number fallback", () => {
    expect(getProjectBusinessAreaCode({ projectNumber: "OKI-123" })).toBe(
      PROJECT_BUSINESS_AREA_IMMOCARE
    );
  });

  it("keeps unclassified legacy imports in the established Solutions pipeline", () => {
    expect(getProjectBusinessAreaCode({ projectNumber: "MKG-376" })).toBe(
      PROJECT_BUSINESS_AREA_SOLUTIONS
    );
  });
});
