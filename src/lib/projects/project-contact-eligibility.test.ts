import { describe, expect, it } from "vitest";
import { getProjectMainContactEligibilityError } from "./project-contact-eligibility";

describe("project main contact eligibility", () => {
  it("blocks prospects before project and offer creation", () => {
    expect(getProjectMainContactEligibilityError({ category: "Interessent", deletionMarkedAt: null }))
      .toContain("als Gewerbe- oder Privatkunde übernommen");
  });

  it("blocks deletion-marked contacts", () => {
    expect(getProjectMainContactEligibilityError({ category: "Kunde", deletionMarkedAt: new Date() }))
      .toContain("löschmarkiert");
  });

  it("allows active customers", () => {
    expect(getProjectMainContactEligibilityError({ category: "Kunde", deletionMarkedAt: null })).toBeNull();
    expect(getProjectMainContactEligibilityError({ category: "Privatkunde", deletionMarkedAt: null })).toBeNull();
  });
});
