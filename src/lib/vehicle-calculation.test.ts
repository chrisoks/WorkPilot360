import { describe, expect, it } from "vitest";
import {
  calculateVehicleTrip,
  VehicleTripCalculationValidationError,
} from "./vehicle-calculation";

describe("calculateVehicleTrip", () => {
  it("reproduces the vehicle-only Crafter calculation without personnel costs", () => {
    const result = calculateVehicleTrip({
      distanceKm: 798,
      consumptionLitersPer100Km: 8,
      fuelPricePerLiter: 1.8,
      selfCostPerKm: 0.24,
      salesPricePerKm: 0.3,
    });

    expect(result.fuelLiters).toBe(63.84);
    expect(result.fuelCost).toBe(114.912);
    expect(result.vehicleSelfCost).toBe(191.52);
    expect(result.totalSelfCost).toBe(306.432);
    expect(result.vehicleSales).toBe(239.4);
    expect(result.totalSales).toBe(354.312);
    expect(result.profit).toBe(47.88);
    expect(result.markupPercent).toBeCloseTo(15.625, 3);
    expect(result.marginPercent).toBeCloseTo(13.5135, 3);
  });

  it("rejects a missing distance", () => {
    expect(() =>
      calculateVehicleTrip({
        distanceKm: 0,
        consumptionLitersPer100Km: 8,
        fuelPricePerLiter: 1.8,
        selfCostPerKm: 0.24,
        salesPricePerKm: 0.3,
      })
    ).toThrow(VehicleTripCalculationValidationError);
  });
});
