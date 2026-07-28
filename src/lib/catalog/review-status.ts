export const catalogReviewStatuses = [
  "unreviewed",
  "needs_review",
  "approved",
] as const;

export type CatalogReviewStatus = (typeof catalogReviewStatuses)[number];

export const catalogReviewRelevantFields = [
  "type",
  "number",
  "name",
  "category",
  "trade",
  "unit",
  "description",
  "matchcode",
  "ean",
  "costCenter",
  "supplierName",
  "supplierNumber",
  "manufacturer",
  "manufacturerNumber",
  "manufacturerTypeName",
  "minimumOrderQuantity",
  "quantityScale",
  "priceUnit",
  "deliveryTime",
  "purchasePrice",
  "laborCostRateKey",
  "salesPrice",
  "scheduledSalesPrice",
  "scheduledSalesPriceValidFrom",
  "scheduledSalesPriceUpdatePackages",
  "vatRate",
  "isLaborPosition",
  "isPlanningRelevant",
  "planningMinutesPerUnit",
  "defaultPlanningBoard",
  "defaultPlanningGroup",
  "isActive",
] as const;

const catalogPackageReviewRelevantFields = [
  "componentItemId",
  "quantity",
  "position",
  "descriptionOverride",
  "priceOverride",
  "purchasePriceSnapshot",
  "salesPriceSnapshot",
  "planningMinutesOverride",
] as const;

const catalogPackageNumericFields = new Set([
  "quantity",
  "position",
  "priceOverride",
  "purchasePriceSnapshot",
  "salesPriceSnapshot",
  "planningMinutesOverride",
]);

export function normalizeCatalogReviewStatus(
  value: unknown
): CatalogReviewStatus {
  return catalogReviewStatuses.includes(value as CatalogReviewStatus)
    ? (value as CatalogReviewStatus)
    : "unreviewed";
}

function comparableCatalogReviewValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : "";
  }
  return String(value).trim();
}

export function hasCatalogReviewRelevantChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  return catalogReviewRelevantFields.some(
    (field) =>
      comparableCatalogReviewValue(before[field]) !==
      comparableCatalogReviewValue(after[field])
  );
}

function normalizeCatalogPackageReviewItems(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object")
    )
    .map((item, index) =>
      Object.fromEntries(
        catalogPackageReviewRelevantFields.map((field) => [
          field,
          field === "position" && (item[field] === null || item[field] === undefined)
            ? index
            : catalogPackageNumericFields.has(field) &&
                item[field] !== null &&
                item[field] !== undefined &&
                item[field] !== ""
              ? comparableCatalogReviewValue(Number(item[field]))
            : comparableCatalogReviewValue(item[field]),
        ])
      )
    )
    .sort(
      (left, right) =>
        Number(left.position) - Number(right.position) ||
        String(left.componentItemId).localeCompare(
          String(right.componentItemId)
        )
    );
}

export function hasCatalogPackageReviewRelevantChange(
  before: unknown,
  after: unknown
) {
  return (
    JSON.stringify(normalizeCatalogPackageReviewItems(before)) !==
    JSON.stringify(normalizeCatalogPackageReviewItems(after))
  );
}

export function getCatalogReviewStatusAfterEdit(input: {
  previousStatus: unknown;
  hasRelevantChange: boolean;
}): CatalogReviewStatus {
  const previousStatus = normalizeCatalogReviewStatus(input.previousStatus);
  return previousStatus === "approved" && input.hasRelevantChange
    ? "needs_review"
    : previousStatus;
}
