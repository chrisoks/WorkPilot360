import { describe, expect, it } from "vitest";
import {
  getEffectiveCatalogServicePricing,
  getEffectiveCatalogPurchasePrice,
  getEffectiveCatalogSalesPrice,
  getImpliedCatalogSalesRatePerHour,
  getTimeBasedCatalogSalesPrice,
  isCatalogSalesPriceBelowCost,
  normalizeCatalogSalesPriceCalculationMode,
} from "@/lib/catalog/pricing";

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

  it("calculates a service unit price from SVS and planning minutes", () => {
    expect(getTimeBasedCatalogSalesPrice({ salesRatePerHour: 60, planningMinutesPerUnit: 3 })).toBe(3);
    expect(getEffectiveCatalogSalesPrice({
      type: "service",
      salesPriceCalculationMode: "time_based",
      salesRatePerHour: 46,
      salesPrice: 999,
      planningMinutesPerUnit: 30,
    })).toBe(23);
  });

  it("keeps existing manual service prices unchanged", () => {
    expect(getEffectiveCatalogSalesPrice({
      type: "service",
      salesPriceCalculationMode: "manual",
      salesRatePerHour: null,
      salesPrice: 46,
      planningMinutesPerUnit: 30,
    })).toBe(46);
    expect(normalizeCatalogSalesPriceCalculationMode(undefined)).toBe("manual");
  });

  it("derives an hourly sales rate from an existing unit price", () => {
    expect(getImpliedCatalogSalesRatePerHour({ salesPrice: 23, planningMinutesPerUnit: 30 })).toBe(46);
    expect(getImpliedCatalogSalesRatePerHour({ salesPrice: 23, planningMinutesPerUnit: 0 })).toBe(0);
  });

  it("converts an existing timed service to SVS without changing its unit price", () => {
    expect(getEffectiveCatalogServicePricing({
      type: "service",
      salesPrice: 46,
      planningMinutesPerUnit: 60,
      salesPriceCalculationMode: "manual",
      salesRatePerHour: null,
    })).toMatchObject({
      salesPriceCalculationMode: "time_based",
      salesRatePerHour: 46,
    });
  });

  it("keeps a priced legacy service manual when its time basis is missing", () => {
    expect(getEffectiveCatalogServicePricing({
      type: "service",
      salesPrice: 6.5,
      planningMinutesPerUnit: 0,
      salesPriceCalculationMode: "manual",
      salesRatePerHour: null,
    })).toEqual({
      salesPriceCalculationMode: "manual",
      salesRatePerHour: null,
      scheduledSalesRatePerHour: null,
    });
  });
});
