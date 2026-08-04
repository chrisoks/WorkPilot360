export type PricedCatalogItemType = "article" | "service" | "package";

function roundCurrency(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
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
