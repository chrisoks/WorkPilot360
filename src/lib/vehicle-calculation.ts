export type VehicleTripCalculationInput = {
  distanceKm: number;
  consumptionLitersPer100Km: number;
  fuelPricePerLiter: number;
  selfCostPerKm: number;
  salesPricePerKm: number;
};

export type VehicleTripCalculationResult = {
  fuelLiters: number;
  fuelCost: number;
  vehicleSelfCost: number;
  totalSelfCost: number;
  vehicleSales: number;
  totalSales: number;
  profit: number;
  markupPercent: number;
  marginPercent: number;
};

export class VehicleTripCalculationValidationError extends Error {
  fields: Partial<Record<keyof VehicleTripCalculationInput, string>>;

  constructor(fields: Partial<Record<keyof VehicleTripCalculationInput, string>>) {
    super("Die Fahrtenkalkulation enthält ungültige Werte.");
    this.name = "VehicleTripCalculationValidationError";
    this.fields = fields;
  }
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateVehicleTrip(
  input: VehicleTripCalculationInput
): VehicleTripCalculationResult {
  const fields: Partial<Record<keyof VehicleTripCalculationInput, string>> = {};

  if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0) {
    fields.distanceKm = "Die Strecke muss größer als 0 km sein.";
  }
  if (
    !Number.isFinite(input.consumptionLitersPer100Km) ||
    input.consumptionLitersPer100Km < 0
  ) {
    fields.consumptionLitersPer100Km = "Der Verbrauch darf nicht negativ sein.";
  }
  if (!Number.isFinite(input.fuelPricePerLiter) || input.fuelPricePerLiter < 0) {
    fields.fuelPricePerLiter = "Der Kraftstoffpreis darf nicht negativ sein.";
  }
  if (!Number.isFinite(input.selfCostPerKm) || input.selfCostPerKm < 0) {
    fields.selfCostPerKm = "Die Selbstkosten dürfen nicht negativ sein.";
  }
  if (!Number.isFinite(input.salesPricePerKm) || input.salesPricePerKm < 0) {
    fields.salesPricePerKm = "Der Verkaufspreis darf nicht negativ sein.";
  }

  if (Object.keys(fields).length > 0) {
    throw new VehicleTripCalculationValidationError(fields);
  }

  const fuelLiters = (input.distanceKm / 100) * input.consumptionLitersPer100Km;
  const fuelCost = fuelLiters * input.fuelPricePerLiter;
  const vehicleSelfCost = input.distanceKm * input.selfCostPerKm;
  const totalSelfCost = fuelCost + vehicleSelfCost;
  const vehicleSales = input.distanceKm * input.salesPricePerKm;
  // Wie in der gelieferten Excel wird der Kraftstoff ohne zusätzlichen
  // Aufschlag weiterberechnet; der Kilometer-VK trägt den Fahrzeugaufschlag.
  const totalSales = fuelCost + vehicleSales;
  const profit = totalSales - totalSelfCost;

  return {
    fuelLiters: round(fuelLiters),
    fuelCost: round(fuelCost),
    vehicleSelfCost: round(vehicleSelfCost),
    totalSelfCost: round(totalSelfCost),
    vehicleSales: round(vehicleSales),
    totalSales: round(totalSales),
    profit: round(profit),
    markupPercent: totalSelfCost > 0 ? round((profit / totalSelfCost) * 100) : 0,
    marginPercent: totalSales > 0 ? round((profit / totalSales) * 100) : 0,
  };
}
