import { describe, expect, it } from "vitest";
import {
  getProjectReviewStatusAfterEdit,
  hasProjectReviewRelevantChange,
  isValidProjectReviewOfferStatus,
  normalizeProjectReviewStatus,
  validateProjectReviewApprovalInput,
} from "@/lib/projects/review-status";

const validBaseProject = {
  projectType: "Projekt OK solutions",
  projectKind: "einmaliges Projekt",
  projectRuntimeFrom: "",
  projectRuntimeUntil: "",
  billingInterval: "",
  recurringBillingMode: "",
  contactId: "contact-1",
  trade: "Hausmeisterservice",
  branch: "OK solutions GmbH",
  responsibleName: "Christian Eid",
  status: "Umsetzung",
  objectAddressId: "",
  addressContactId: "",
  offerStatuses: ["Angebot gewonnen"],
};

describe("project review status", () => {
  it("accepts only the defined states", () => {
    expect(normalizeProjectReviewStatus("approved")).toBe("approved");
    expect(normalizeProjectReviewStatus("needs_review")).toBe("needs_review");
    expect(normalizeProjectReviewStatus("invalid")).toBe("unreviewed");
  });

  it("withdraws approval after a billing-relevant change", () => {
    expect(
      getProjectReviewStatusAfterEdit({
        previousStatus: "approved",
        hasRelevantChange: hasProjectReviewRelevantChange(
          {
            projectKind: "Dauerläufer-Projekt",
            recurringBillingMode: "monthlyFlat",
          },
          {
            projectKind: "Dauerläufer-Projekt",
            recurringBillingMode: "hourly",
          }
        ),
      })
    ).toBe("needs_review");
  });

  it("keeps approval after a normal pipeline status change", () => {
    expect(
      hasProjectReviewRelevantChange(
        {
          projectKind: "einmaliges Projekt",
          recurringBillingMode: "",
          status: "Geplant",
        },
        {
          projectKind: "einmaliges Projekt",
          recurringBillingMode: "",
          status: "Umsetzung",
        }
      )
    ).toBe(false);
  });

  it.each([
    {
      name: "einmaliges Projekt",
      project: validBaseProject,
    },
    {
      name: "Dauerläufer mit Monatspauschale",
      project: {
        ...validBaseProject,
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "monthlyFlat",
        billingInterval: "monatlich",
        projectRuntimeFrom: "2026-01-01",
        projectRuntimeUntil: "2026-12-31",
      },
    },
    {
      name: "Dauerläufer mit Stundenabrechnung",
      project: {
        ...validBaseProject,
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "hourly",
        billingInterval: "monatlich",
        projectRuntimeFrom: "2026-01-01",
        projectRuntimeUntil: "2026-12-31",
      },
    },
  ])("allows a complete $name", ({ project }) => {
    expect(validateProjectReviewApprovalInput(project)).toEqual([]);
  });

  it.each([
    ["Entwurf", false],
    ["Angebot verloren", false],
    ["Abgelehnt", false],
    ["Gelöscht", false],
    ["", false],
    ["Versendet", true],
    ["Angebot gewonnen", true],
    ["Verbindlich angenommen", true],
  ])("classifies offer status %s as valid=%s", (status, expected) => {
    expect(isValidProjectReviewOfferStatus(status)).toBe(expected);
  });

  it("blocks a recurring project without a complete runtime", () => {
    const problems = validateProjectReviewApprovalInput({
      ...validBaseProject,
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "hourly",
      billingInterval: "monatlich",
    });

    expect(problems).toContain(
      "Projektlaufzeit des Dauerläufers ist nicht vollständig gepflegt"
    );
  });

  it("blocks an immocare project without an object address", () => {
    const problems = validateProjectReviewApprovalInput({
      ...validBaseProject,
      projectType: "Projekt OK immocare",
      branch: "OK immocare GmbH",
    });

    expect(problems).toContain("Objektadresse des Immocare-Projekts fehlt");
  });

  it("blocks a project whose only offer is still a draft", () => {
    const problems = validateProjectReviewApprovalInput({
      ...validBaseProject,
      offerStatuses: ["Entwurf"],
    });

    expect(problems.join(" ")).toContain("kein gültiges Angebot");
  });

  it.each([
    ["projectKind", "einmaliges Projekt", "Dauerläufer-Projekt"],
    ["recurringBillingMode", "monthlyFlat", "hourly"],
    ["billingInterval", "monatlich", "quartalsweise"],
    ["contactId", "contact-1", "contact-2"],
    ["trade", "Hausmeisterservice", "Winterdienst"],
    ["branch", "OK solutions GmbH", "OK immocare GmbH"],
    ["responsibleName", "Christian Eid", "Ramona Eid"],
    ["projectRuntimeUntil", "2026-12-31", "2027-12-31"],
  ])(
    "withdraws approval when %s changes",
    (field, beforeValue, afterValue) => {
      const hasRelevantChange = hasProjectReviewRelevantChange(
        { ...validBaseProject, [field]: beforeValue },
        { ...validBaseProject, [field]: afterValue }
      );
      expect(hasRelevantChange).toBe(true);
      expect(
        getProjectReviewStatusAfterEdit({
          previousStatus: "approved",
          hasRelevantChange,
        })
      ).toBe("needs_review");
    }
  );

  it.each([
    ["status", "Geplant", "Umsetzung"],
    ["description", "Alt", "Neu"],
    ["participants", "Christian", "Christian, Ramona"],
  ])("keeps approval when only %s changes", (field, beforeValue, afterValue) => {
    expect(
      hasProjectReviewRelevantChange(
        { ...validBaseProject, [field]: beforeValue },
        { ...validBaseProject, [field]: afterValue }
      )
    ).toBe(false);
  });
});
