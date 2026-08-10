type HourlyForecastPlanningEntry = {
  id: string;
  projectId: string;
  date: string;
  durationMinutes: number;
  approvalStatus: string;
  deletedAt?: string | null;
  billingCatalogItemId?: string | null;
};

type HourlyForecastTimeEntry = {
  planningEntryId?: string | null;
  invoiceId?: string | null;
  deletedAt?: string | null;
};

type HourlyForecastInvoiceLine = {
  hourlyBillingDetails?: Array<{
    entries?: Array<{ planningEntryId?: string | null }>;
  }> | null;
};

type HourlyForecastDraftInvoice = {
  id: string;
  netTotal: number;
  lines?: HourlyForecastInvoiceLine[];
};

type HourlyForecastCatalogItem = {
  id: string;
  salesPrice: number;
};

export type HourlyRecurringForecastResult = {
  forecastValue: number;
  invoiceValue: number;
  draftValue: number;
  plannedValue: number;
  plannedEntryCount: number;
  missingPriceEntryCount: number;
  source:
    | "invoice"
    | "draft-and-planning"
    | "draft"
    | "planning"
    | "history"
    | "none";
};

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundedBillableHours(durationMinutes: number, factorValue: number) {
  const hours = Math.max(0, Number(durationMinutes || 0) / 60);
  if (hours <= 0) return 0;
  const factor = [0.25, 0.5, 1].includes(Number(factorValue))
    ? Number(factorValue)
    : 0.5;
  return Number((Math.ceil(hours / factor) * factor).toFixed(2));
}

export function calculateHourlyRecurringForecast(input: {
  projectId: string;
  monthKey: string;
  hasFinalInvoice: boolean;
  finalInvoiceNetTotal: number;
  historicalInvoiceNetTotal: number;
  roundingFactorHours: number;
  planningEntries: HourlyForecastPlanningEntry[];
  timeEntries: HourlyForecastTimeEntry[];
  draftInvoices: HourlyForecastDraftInvoice[];
  catalogItems: HourlyForecastCatalogItem[];
}): HourlyRecurringForecastResult {
  const invoiceValue = roundMoney(input.finalInvoiceNetTotal);
  if (input.hasFinalInvoice) {
    return {
      forecastValue: invoiceValue,
      invoiceValue,
      draftValue: 0,
      plannedValue: 0,
      plannedEntryCount: 0,
      missingPriceEntryCount: 0,
      source: "invoice",
    };
  }

  const draftIds = new Set(input.draftInvoices.map((invoice) => invoice.id));
  const actualizedPlanningEntryIds = new Set(
    input.timeEntries
      .filter(
        (entry) =>
          !entry.deletedAt && entry.invoiceId && draftIds.has(entry.invoiceId),
      )
      .map((entry) => String(entry.planningEntryId ?? "").trim())
      .filter(Boolean),
  );
  for (const invoice of input.draftInvoices) {
    for (const line of invoice.lines ?? []) {
      for (const day of line.hourlyBillingDetails ?? []) {
        for (const entry of day.entries ?? []) {
          const planningEntryId = String(entry.planningEntryId ?? "").trim();
          if (planningEntryId) actualizedPlanningEntryIds.add(planningEntryId);
        }
      }
    }
  }

  const catalogPrices = new Map(
    input.catalogItems.map((item) => [
      item.id,
      Math.max(0, Number(item.salesPrice || 0)),
    ]),
  );
  const plannedHoursByCatalog = new Map<string, number>();
  let plannedEntryCount = 0;
  let missingPriceEntryCount = 0;
  for (const entry of input.planningEntries) {
    if (
      entry.projectId !== input.projectId ||
      !entry.date.startsWith(input.monthKey) ||
      entry.approvalStatus !== "confirmed" ||
      entry.deletedAt ||
      actualizedPlanningEntryIds.has(entry.id)
    ) {
      continue;
    }
    const catalogItemId = String(entry.billingCatalogItemId ?? "").trim();
    const salesPrice = catalogPrices.get(catalogItemId);
    const hours = roundedBillableHours(
      entry.durationMinutes,
      input.roundingFactorHours,
    );
    if (
      !catalogItemId ||
      salesPrice === undefined ||
      salesPrice <= 0 ||
      hours <= 0
    ) {
      missingPriceEntryCount += 1;
      continue;
    }
    plannedHoursByCatalog.set(
      catalogItemId,
      Number(
        ((plannedHoursByCatalog.get(catalogItemId) ?? 0) + hours).toFixed(2),
      ),
    );
    plannedEntryCount += 1;
  }

  const plannedValue = roundMoney(
    Array.from(plannedHoursByCatalog.entries()).reduce(
      (sum, [catalogItemId, hours]) =>
        sum + roundMoney(hours * Number(catalogPrices.get(catalogItemId) ?? 0)),
      0,
    ),
  );
  const draftValue = roundMoney(
    input.draftInvoices.reduce(
      (sum, invoice) => sum + Math.max(0, Number(invoice.netTotal || 0)),
      0,
    ),
  );
  const currentValue = roundMoney(draftValue + plannedValue);
  if (currentValue > 0) {
    return {
      forecastValue: currentValue,
      invoiceValue: 0,
      draftValue,
      plannedValue,
      plannedEntryCount,
      missingPriceEntryCount,
      source:
        draftValue > 0 && plannedValue > 0
          ? "draft-and-planning"
          : draftValue > 0
            ? "draft"
            : "planning",
    };
  }

  const historicalValue = roundMoney(input.historicalInvoiceNetTotal);
  return {
    forecastValue: historicalValue,
    invoiceValue: 0,
    draftValue: 0,
    plannedValue: 0,
    plannedEntryCount: 0,
    missingPriceEntryCount,
    source: historicalValue > 0 ? "history" : "none",
  };
}
