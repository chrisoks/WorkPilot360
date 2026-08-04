import { describe, expect, it } from "vitest";
import { getEffectiveCatalogPurchasePrice, isCatalogSalesPriceBelowCost } from "@/lib/catalog/pricing";

describe("catalog pricing safeguards", () => {
  it("uses the article purchase price as effective cost", () => {
    expect(getEffectiveCatalogPurchasePrice({ type: "article", purchasePrice: 55.2, planningMinutesPerUnit: 0 })).toBe(55.2);
    expect(isCatalogSalesPriceBelowCost({ type: "article", purchasePrice: 55.2, salesPrice: 50, planningMinutesPerUnit: 0 })).toBe(true);
  });

  it("calculates service cost from hourly labor cost and planning minutes", () => {
    expect(getEffectiveCatalogPurchasePrice({ type: "service", purchasePrice: 42.37, planningMinutesPerUnit: 30 })).toBe(21.19);
    expect(isCatalogSalesPriceBelowCost({ type: "service", purchasePrice: 42.37, salesPrice: 21, planningMinutesPerUnit: 30 })).toBe(true);
    expect(isCatalogSalesPriceBelowCost({ type: "service", purchasePrice: 42.37, salesPrice: 21.19, planningMinutesPerUnit: 30 })).toBe(false);
  });

  it("does not apply the simple safeguard to calculated packages", () => {
    expect(isCatalogSalesPriceBelowCost({ type: "package", purchasePrice: 100, salesPrice: 0, planningMinutesPerUnit: 0 })).toBe(false);
  });
});
