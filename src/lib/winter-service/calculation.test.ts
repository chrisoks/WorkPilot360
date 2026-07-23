import { describe, expect, it } from "vitest";
import {
  calculateWinterService,
  WinterServiceCalculationValidationError,
  type WinterServiceCalculationInput,
} from "./calculation";

const excelInput: WinterServiceCalculationInput = {
  areaSqm: 500,
  readinessPricePerSqmPerMonth: 0.085,
  seasonMonths: 7,
  expectedDeployments: 20,
  baseServiceMinutes: 45,
  laborSalesRatePerHour: 120,
  saltGramsPerSqm: 45,
  saltSalesPricePerKg: 0.65,
  plowTimeIncreasePercent: 25,
  plowSaltIncreasePercent: 50,
  mixedSpreadingPercent: 65,
  mixedPlowingPercent: 35,
};

describe("winter service calculation", () => {
  it("reproduces the Excel readiness, labor and salt formulas", () => {
    const result = calculateWinterService(excelInput);

    expect(result.readiness).toEqual({
      monthlyFee: 42.5,
      seasonFee: 297.5,
      amountPerDeployment: 14.875,
    });
    expect(result.variants.spreading).toMatchObject({
      serviceMinutes: 45,
      laborHours: 0.75,
      laborAmount: 90,
      saltGramsPerSqm: 45,
      saltKg: 22.5,
      saltAmount: 14.625,
      effortAmountPerDeployment: 104.625,
      pricePerDeployment: 119.5,
      plannedSeasonRevenue: 2390,
    });
  });

  it("applies the adjustable plowing surcharges", () => {
    const result = calculateWinterService(excelInput);

    expect(result.variants.spreadingAndPlowing).toMatchObject({
      serviceMinutes: 56.25,
      laborAmount: 112.5,
      saltGramsPerSqm: 67.5,
      saltKg: 33.75,
      saltAmount: 21.9375,
      pricePerDeployment: 149.3125,
    });
  });

  it("builds option one as a 65/35 mixed calculation", () => {
    const result = calculateWinterService(excelInput);

    expect(result.variants.mixed).toMatchObject({
      serviceMinutes: 48.9375,
      laborAmount: 97.875,
      saltGramsPerSqm: 52.875,
      saltKg: 26.4375,
      saltAmount: 17.184375,
      effortAmountPerDeployment: 115.059375,
      pricePerDeployment: 129.934375,
      plannedSeasonRevenue: 2598.6875,
    });
  });

  it("keeps the monthly readiness model as a separate comparison", () => {
    const result = calculateWinterService(excelInput);

    expect(result.variants.mixed.monthlyReadinessModel).toEqual({
      monthlyReadinessFee: 42.5,
      seasonReadinessFee: 297.5,
      effortAmountPerDeployment: 115.059375,
      plannedSeasonRevenue: 2598.6875,
    });
  });

  it("rejects shares that do not add up to 100 percent", () => {
    expect(() =>
      calculateWinterService({
        ...excelInput,
        mixedSpreadingPercent: 60,
        mixedPlowingPercent: 35,
      })
    ).toThrowError(WinterServiceCalculationValidationError);
  });

  it("rejects zero expected deployments to avoid division by zero", () => {
    expect(() =>
      calculateWinterService({
        ...excelInput,
        expectedDeployments: 0,
      })
    ).toThrowError(WinterServiceCalculationValidationError);
  });
});
