import { describe, expect, it } from "vitest";
import {
  getCatalogReviewStatusAfterEdit,
  hasCatalogPackageReviewRelevantChange,
  hasCatalogReviewRelevantChange,
  normalizeCatalogReviewStatus,
} from "@/lib/catalog/review-status";

describe("catalog review status", () => {
  it("accepts only the defined review states", () => {
    expect(normalizeCatalogReviewStatus("approved")).toBe("approved");
    expect(normalizeCatalogReviewStatus("needs_review")).toBe("needs_review");
    expect(normalizeCatalogReviewStatus("anything")).toBe("unreviewed");
  });

  it("resets an approved item when a relevant field changes", () => {
    expect(
      getCatalogReviewStatusAfterEdit({
        previousStatus: "approved",
        hasRelevantChange: true,
      })
    ).toBe("needs_review");
  });

  it("keeps approval when only non-review metadata changes", () => {
    expect(
      getCatalogReviewStatusAfterEdit({
        previousStatus: "approved",
        hasRelevantChange: false,
      })
    ).toBe("approved");
  });

  it("detects price, planning and assignment changes", () => {
    expect(
      hasCatalogReviewRelevantChange(
        {
          salesPrice: 100,
          planningMinutesPerUnit: 60,
          defaultPlanningGroup: "VZK",
        },
        {
          salesPrice: 110,
          planningMinutesPerUnit: 60,
          defaultPlanningGroup: "VZK",
        }
      )
    ).toBe(true);
    expect(
      hasCatalogReviewRelevantChange(
        { salesPrice: 100, reviewNote: "Alt" },
        { salesPrice: 100, reviewNote: "Neu" }
      )
    ).toBe(false);
  });

  it("detects changed package components but ignores equivalent values", () => {
    const before = [{
      componentItemId: "service-1",
      quantity: 2,
      position: 0,
      purchasePriceSnapshot: 40,
      salesPriceSnapshot: 80,
      planningMinutesOverride: 120,
    }];
    expect(
      hasCatalogPackageReviewRelevantChange(before, [{
        ...before[0],
        quantity: 3,
      }])
    ).toBe(true);
    expect(
      hasCatalogPackageReviewRelevantChange(before, [{
        ...before[0],
        quantity: "2",
      }])
    ).toBe(false);
  });
});
