UPDATE "CatalogItem"
SET
  "salesPriceCalculationMode" = 'time_based',
  "salesRatePerHour" = CASE
    WHEN "planningMinutesPerUnit" > 0
      THEN "salesPrice" * 60.0 / "planningMinutesPerUnit"
    ELSE 0
  END,
  "scheduledSalesRatePerHour" = CASE
    WHEN "scheduledSalesPrice" IS NOT NULL AND "planningMinutesPerUnit" > 0
      THEN "scheduledSalesPrice" * 60.0 / "planningMinutesPerUnit"
    ELSE NULL
  END
WHERE "type" = 'service'
  AND "salesPriceCalculationMode" = 'manual'
  AND ("planningMinutesPerUnit" > 0 OR "salesPrice" = 0);
