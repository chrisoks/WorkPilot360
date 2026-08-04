export type PricedCatalogItemType = "article" | "service" | "package";
export type CatalogSalesPriceCalculationMode = "manual" | "time_based";

function roundCurrency(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeCatalogSalesPriceCalculationMode(
  value: unknown,
  fallback: CatalogSalesPriceCalculationMode = "manual"
): CatalogSalesPriceCalculationMode {
  return value === "time_based" ? "time_based" : value === "manual" ? "manual" : fallback;
}

export function getTimeBasedCatalogSalesPrice(input: {
  salesRatePerHour: number | null | undefined;
  planningMinutesPerUnit: number;
}) {
  return roundCurrency(
    (Math.max(0, Number(input.salesRatePerHour) || 0) *
      Math.max(0, Number(input.planningMinutesPerUnit) || 0)) /
      60
  );
}

export function getEffectiveCatalogSalesPrice(input: {
  type: PricedCatalogItemType;
  salesPriceCalculationMode?: CatalogSalesPriceCalculationMode | string | null;
  salesRatePerHour?: number | null;
  salesPrice: number;
  planningMinutesPerUnit: number;
}) {
  if (
    input.type === "service" &&
    normalizeCatalogSalesPriceCalculationMode(input.salesPriceCalculationMode) === "time_based"
  ) {
    return getTimeBasedCatalogSalesPrice({
      salesRatePerHour: Number(input.salesRatePerHour) || 0,
      planningMinutesPerUnit: input.planningMinutesPerUnit,
    });
  }
  return roundCurrency(input.salesPrice);
}

export function getImpliedCatalogSalesRatePerHour(input: {
  salesPrice: number;
  planningMinutesPerUnit: number;
}) {
  const minutes = Math.max(0, Number(input.planningMinutesPerUnit) || 0);
  if (minutes <= 0) return 0;
  return roundCurrency((Math.max(0, Number(input.salesPrice) || 0) * 60) / minutes);
}

export function getEffectiveCatalogServicePricing(input: {
  type: string;
  salesPrice: number;
  planningMinutesPerUnit: number;
  salesPriceCalculationMode?: CatalogSalesPriceCalculationMode | string | null;
  salesRatePerHour?: number | null;
  scheduledSalesPrice?: number | null;
  scheduledSalesRatePerHour?: number | null;
}) {
  if (input.type !== "service") {
    return {
      salesPriceCalculationMode: "manual" as const,
      salesRatePerHour: null,
      scheduledSalesRatePerHour: null,
    };
  }

  const planningMinutesPerUnit = Math.max(0, Number(input.planningMinutesPerUnit) || 0);
  const salesPrice = Math.max(0, Number(input.salesPrice) || 0);
  const storedMode = normalizeCatalogSalesPriceCalculationMode(input.salesPriceCalculationMode);
  const canSafelyConvertLegacyPrice = planningMinutesPerUnit > 0 || salesPrice === 0;
  if (storedMode !== "time_based" && !canSafelyConvertLegacyPrice) {
    return {
      salesPriceCalculationMode: "manual" as const,
      salesRatePerHour: null,
      scheduledSalesRatePerHour: null,
    };
  }

  const storedSalesRate = Math.max(0, Number(input.salesRatePerHour) || 0);
  const salesRatePerHour =
    storedSalesRate > 0 || salesPrice === 0
      ? storedSalesRate
      : getImpliedCatalogSalesRatePerHour({ salesPrice, planningMinutesPerUnit });
  const scheduledSalesPrice = Math.max(0, Number(input.scheduledSalesPrice) || 0);
  const storedScheduledRate = Math.max(0, Number(input.scheduledSalesRatePerHour) || 0);
  const scheduledSalesRatePerHour =
    storedScheduledRate > 0
      ? storedScheduledRate
      : scheduledSalesPrice > 0 && planningMinutesPerUnit > 0
        ? getImpliedCatalogSalesRatePerHour({
            salesPrice: scheduledSalesPrice,
            planningMinutesPerUnit,
          })
        : null;

  return {
    salesPriceCalculationMode: "time_based" as const,
    salesRatePerHour,
    scheduledSalesRatePerHour,
  };
}

export function getEffectiveCatalogPurchasePrice(input: {
  type: PricedCatalogItemType;
  purchasePrice: number;
  planningMinutesPerUnit: number;
}) {
  if (input.type === "service") {
    return roundCurrency((input.purchasePrice * Math.max(0, input.planningMinutesPerUnit)) / 60);
  }
  return roundCurrency(input.purchasePrice);
}

export function isCatalogSalesPriceBelowCost(input: {
  type: PricedCatalogItemType;
  purchasePrice: number;
  salesPrice: number;
  planningMinutesPerUnit: number;
}) {
  if (input.type === "package") return false;
  return roundCurrency(input.salesPrice) < getEffectiveCatalogPurchasePrice(input);
}
