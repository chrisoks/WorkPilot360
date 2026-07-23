export type WinterServiceCalculationInput = {
  areaSqm: number;
  readinessPricePerSqmPerMonth: number;
  seasonMonths: number;
  expectedDeployments: number;
  baseServiceMinutes: number;
  laborSalesRatePerHour: number;
  saltGramsPerSqm: number;
  saltSalesPricePerKg: number;
  plowTimeIncreasePercent: number;
  plowSaltIncreasePercent: number;
  mixedSpreadingPercent: number;
  mixedPlowingPercent: number;
};

export type WinterServiceVariantResult = {
  key: "mixed" | "spreading" | "spreadingAndPlowing";
  serviceMinutes: number;
  laborHours: number;
  laborAmount: number;
  saltGramsPerSqm: number;
  saltKg: number;
  saltAmount: number;
  readinessAmountPerDeployment: number;
  effortAmountPerDeployment: number;
  pricePerDeployment: number;
  plannedSeasonRevenue: number;
  monthlyReadinessModel: {
    monthlyReadinessFee: number;
    seasonReadinessFee: number;
    effortAmountPerDeployment: number;
    plannedSeasonRevenue: number;
  };
};

export type WinterServiceCalculationResult = {
  readiness: {
    monthlyFee: number;
    seasonFee: number;
    amountPerDeployment: number;
  };
  variants: {
    mixed: WinterServiceVariantResult;
    spreading: WinterServiceVariantResult;
    spreadingAndPlowing: WinterServiceVariantResult;
  };
};

export class WinterServiceCalculationValidationError extends Error {
  readonly fields: Record<string, string>;

  constructor(fields: Record<string, string>) {
    super("Die Winterdienst-Kalkulation enthält ungültige Eingaben.");
    this.name = "WinterServiceCalculationValidationError";
    this.fields = fields;
  }
}

const MAX_INPUTS = {
  areaSqm: 10_000_000,
  readinessPricePerSqmPerMonth: 10_000,
  seasonMonths: 24,
  deployments: 10_000,
  serviceMinutes: 24 * 60,
  laborSalesRatePerHour: 100_000,
  saltGramsPerSqm: 10_000,
  saltSalesPricePerKg: 10_000,
  increasePercent: 1_000,
} as const;

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

function requirePositive(
  fields: Record<string, string>,
  field: keyof WinterServiceCalculationInput,
  value: number,
  max: number
) {
  if (!isFiniteNumber(value) || value <= 0 || value > max) {
    fields[field] = `Muss größer als 0 und höchstens ${max} sein.`;
  }
}

function requireNonNegative(
  fields: Record<string, string>,
  field: keyof WinterServiceCalculationInput,
  value: number,
  max: number
) {
  if (!isFiniteNumber(value) || value < 0 || value > max) {
    fields[field] = `Muss mindestens 0 und höchstens ${max} sein.`;
  }
}

function requireInteger(
  fields: Record<string, string>,
  field: keyof WinterServiceCalculationInput,
  value: number
) {
  if (!Number.isInteger(value)) {
    fields[field] = "Muss eine ganze Zahl sein.";
  }
}

export function validateWinterServiceCalculationInput(input: WinterServiceCalculationInput) {
  const fields: Record<string, string> = {};

  requirePositive(fields, "areaSqm", input.areaSqm, MAX_INPUTS.areaSqm);
  requireNonNegative(
    fields,
    "readinessPricePerSqmPerMonth",
    input.readinessPricePerSqmPerMonth,
    MAX_INPUTS.readinessPricePerSqmPerMonth
  );
  requirePositive(fields, "seasonMonths", input.seasonMonths, MAX_INPUTS.seasonMonths);
  requireInteger(fields, "seasonMonths", input.seasonMonths);
  requirePositive(
    fields,
    "expectedDeployments",
    input.expectedDeployments,
    MAX_INPUTS.deployments
  );
  requireInteger(fields, "expectedDeployments", input.expectedDeployments);

  requirePositive(
    fields,
    "baseServiceMinutes",
    input.baseServiceMinutes,
    MAX_INPUTS.serviceMinutes
  );
  requireNonNegative(
    fields,
    "laborSalesRatePerHour",
    input.laborSalesRatePerHour,
    MAX_INPUTS.laborSalesRatePerHour
  );
  requireNonNegative(
    fields,
    "saltGramsPerSqm",
    input.saltGramsPerSqm,
    MAX_INPUTS.saltGramsPerSqm
  );
  requireNonNegative(
    fields,
    "saltSalesPricePerKg",
    input.saltSalesPricePerKg,
    MAX_INPUTS.saltSalesPricePerKg
  );
  requireNonNegative(
    fields,
    "plowTimeIncreasePercent",
    input.plowTimeIncreasePercent,
    MAX_INPUTS.increasePercent
  );
  requireNonNegative(
    fields,
    "plowSaltIncreasePercent",
    input.plowSaltIncreasePercent,
    MAX_INPUTS.increasePercent
  );
  requireNonNegative(fields, "mixedSpreadingPercent", input.mixedSpreadingPercent, 100);
  requireNonNegative(fields, "mixedPlowingPercent", input.mixedPlowingPercent, 100);

  if (
    isFiniteNumber(input.mixedSpreadingPercent) &&
    isFiniteNumber(input.mixedPlowingPercent) &&
    Math.abs(input.mixedSpreadingPercent + input.mixedPlowingPercent - 100) > 0.000001
  ) {
    fields.mixedShares = "Streuen- und Räumen-Anteil müssen zusammen genau 100 % ergeben.";
  }

  if (Object.keys(fields).length > 0) {
    throw new WinterServiceCalculationValidationError(fields);
  }
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

type VariantBasis = {
  serviceMinutes: number;
  saltGramsPerSqm: number;
};

function calculateVariant(
  key: WinterServiceVariantResult["key"],
  input: WinterServiceCalculationInput,
  basis: VariantBasis,
  readinessPerDeployment: number,
  monthlyReadinessFee: number,
  seasonReadinessFee: number
): WinterServiceVariantResult {
  const laborHours = basis.serviceMinutes / 60;
  const laborAmount = laborHours * input.laborSalesRatePerHour;
  const saltKg = (input.areaSqm * basis.saltGramsPerSqm) / 1_000;
  const saltAmount = saltKg * input.saltSalesPricePerKg;
  const effortAmountPerDeployment = laborAmount + saltAmount;
  const pricePerDeployment = readinessPerDeployment + effortAmountPerDeployment;
  return {
    key,
    serviceMinutes: round(basis.serviceMinutes),
    laborHours: round(laborHours),
    laborAmount: round(laborAmount),
    saltGramsPerSqm: round(basis.saltGramsPerSqm),
    saltKg: round(saltKg),
    saltAmount: round(saltAmount),
    readinessAmountPerDeployment: round(readinessPerDeployment),
    effortAmountPerDeployment: round(effortAmountPerDeployment),
    pricePerDeployment: round(pricePerDeployment),
    plannedSeasonRevenue: round(pricePerDeployment * input.expectedDeployments),
    monthlyReadinessModel: {
      monthlyReadinessFee: round(monthlyReadinessFee),
      seasonReadinessFee: round(seasonReadinessFee),
      effortAmountPerDeployment: round(effortAmountPerDeployment),
      plannedSeasonRevenue: round(
        seasonReadinessFee + effortAmountPerDeployment * input.expectedDeployments
      ),
    },
  };
}

export function calculateWinterService(
  input: WinterServiceCalculationInput
): WinterServiceCalculationResult {
  validateWinterServiceCalculationInput(input);

  const monthlyReadinessFee = input.areaSqm * input.readinessPricePerSqmPerMonth;
  const seasonReadinessFee = monthlyReadinessFee * input.seasonMonths;
  const readinessPerDeployment = seasonReadinessFee / input.expectedDeployments;

  const spreadingBasis: VariantBasis = {
    serviceMinutes: input.baseServiceMinutes,
    saltGramsPerSqm: input.saltGramsPerSqm,
  };
  const spreadingAndPlowingBasis: VariantBasis = {
    serviceMinutes: input.baseServiceMinutes * (1 + input.plowTimeIncreasePercent / 100),
    saltGramsPerSqm: input.saltGramsPerSqm * (1 + input.plowSaltIncreasePercent / 100),
  };
  const spreadingShare = input.mixedSpreadingPercent / 100;
  const plowingShare = input.mixedPlowingPercent / 100;
  const mixedBasis: VariantBasis = {
    serviceMinutes:
      spreadingBasis.serviceMinutes * spreadingShare +
      spreadingAndPlowingBasis.serviceMinutes * plowingShare,
    saltGramsPerSqm:
      spreadingBasis.saltGramsPerSqm * spreadingShare +
      spreadingAndPlowingBasis.saltGramsPerSqm * plowingShare,
  };

  return {
    readiness: {
      monthlyFee: round(monthlyReadinessFee),
      seasonFee: round(seasonReadinessFee),
      amountPerDeployment: round(readinessPerDeployment),
    },
    variants: {
      mixed: calculateVariant(
        "mixed",
        input,
        mixedBasis,
        readinessPerDeployment,
        monthlyReadinessFee,
        seasonReadinessFee
      ),
      spreading: calculateVariant(
        "spreading",
        input,
        spreadingBasis,
        readinessPerDeployment,
        monthlyReadinessFee,
        seasonReadinessFee
      ),
      spreadingAndPlowing: calculateVariant(
        "spreadingAndPlowing",
        input,
        spreadingAndPlowingBasis,
        readinessPerDeployment,
        monthlyReadinessFee,
        seasonReadinessFee
      ),
    },
  };
}
