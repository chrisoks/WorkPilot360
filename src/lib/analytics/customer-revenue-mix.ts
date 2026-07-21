export type RevenueInvoiceInput = {
  id: string;
  projectId?: string | null;
  status: string;
  netTotal: number;
  serviceDate?: string | Date | null;
  createdAt: string | Date;
};

export type RevenueProjectInput = {
  id: string;
  contactId?: string | null;
};

export type CustomerFirstRevenueEvidence = {
  customerId: string;
  firstRevenueAt: string | Date;
};

export type RevenuePeriodInput = {
  from: string | Date;
  to: string | Date;
};

export type CustomerRevenueBucket = {
  revenue: number;
  shareOfTotalPercent: number | null;
  customerCount: number;
  invoiceCount: number;
};

export type CustomerRevenueMix = {
  totalRevenue: number;
  totalInvoiceCount: number;
  newCustomers: CustomerRevenueBucket;
  existingCustomers: CustomerRevenueBucket;
  unassigned: CustomerRevenueBucket;
  classifiedRevenue: number;
  classificationCoveragePercent: number | null;
  earliestObservedRevenueAt: string | null;
  hasObservedRevenueBeforePeriod: boolean;
  excludedInvoiceCount: number;
  invalidDateInvoiceCount: number;
};

type RevenueBucketKey = "newCustomers" | "existingCustomers" | "unassigned";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundPercent = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

function parseRevenueDate(value: string | Date | null | undefined, endOfDateOnlyDay = false) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  const timestamp = dateOnlyMatch
    ? Date.UTC(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        endOfDateOnlyDay ? 23 : 0,
        endOfDateOnlyDay ? 59 : 0,
        endOfDateOnlyDay ? 59 : 0,
        endOfDateOnlyDay ? 999 : 0
      )
    : Date.parse(normalized);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function toIsoDate(timestamp: number | null) {
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

function percentage(part: number, total: number) {
  return total === 0 ? null : roundPercent((part / total) * 100);
}

export function isFinanciallyActiveRevenueInvoice(invoice: Pick<RevenueInvoiceInput, "status">) {
  const status = invoice.status.trim().toLowerCase();
  return status !== "entwurf" && !status.includes("gelöscht") && !status.includes("geloescht") &&
    !status.includes("gel\u00e3\u00b6scht") &&
    !status.includes("storniert") && !status.includes("storno");
}

export function getRevenueInvoiceTimestamp(
  invoice: Pick<RevenueInvoiceInput, "serviceDate" | "createdAt">
) {
  return parseRevenueDate(invoice.serviceDate) ?? parseRevenueDate(invoice.createdAt);
}

export function calculateCustomerRevenueMix(args: {
  invoices: readonly RevenueInvoiceInput[];
  projects: readonly RevenueProjectInput[];
  period: RevenuePeriodInput;
  firstRevenueEvidence?: readonly CustomerFirstRevenueEvidence[];
}): CustomerRevenueMix {
  const periodFrom = parseRevenueDate(args.period.from);
  const periodTo = parseRevenueDate(args.period.to, true);
  if (periodFrom === null || periodTo === null || periodFrom > periodTo) {
    throw new Error("Der Auswertungszeitraum ist ungültig.");
  }

  const projectCustomerIds = new Map(
    args.projects.map((project) => [project.id, project.contactId?.trim() || null] as const)
  );
  const firstRevenueByCustomer = new Map<string, number>();
  let earliestObservedRevenueTimestamp: number | null = null;
  let excludedInvoiceCount = 0;
  let invalidDateInvoiceCount = 0;

  const activeInvoices = args.invoices.flatMap((invoice) => {
    if (!isFinanciallyActiveRevenueInvoice(invoice) || !Number.isFinite(invoice.netTotal)) {
      excludedInvoiceCount += 1;
      return [];
    }

    const revenueTimestamp = getRevenueInvoiceTimestamp(invoice);
    if (revenueTimestamp === null) {
      invalidDateInvoiceCount += 1;
      return [];
    }

    earliestObservedRevenueTimestamp = earliestObservedRevenueTimestamp === null
      ? revenueTimestamp
      : Math.min(earliestObservedRevenueTimestamp, revenueTimestamp);

    const customerId = invoice.projectId ? projectCustomerIds.get(invoice.projectId) ?? null : null;
    if (customerId) {
      const currentFirstRevenue = firstRevenueByCustomer.get(customerId);
      if (currentFirstRevenue === undefined || revenueTimestamp < currentFirstRevenue) {
        firstRevenueByCustomer.set(customerId, revenueTimestamp);
      }
    }

    return [{ invoice, revenueTimestamp, customerId }];
  });

  for (const evidence of args.firstRevenueEvidence ?? []) {
    const customerId = evidence.customerId.trim();
    const timestamp = parseRevenueDate(evidence.firstRevenueAt);
    if (!customerId || timestamp === null) continue;

    earliestObservedRevenueTimestamp = earliestObservedRevenueTimestamp === null
      ? timestamp
      : Math.min(earliestObservedRevenueTimestamp, timestamp);
    const currentFirstRevenue = firstRevenueByCustomer.get(customerId);
    if (currentFirstRevenue === undefined || timestamp < currentFirstRevenue) {
      firstRevenueByCustomer.set(customerId, timestamp);
    }
  }

  const totals: Record<RevenueBucketKey, { revenue: number; invoiceCount: number; customerIds: Set<string> }> = {
    newCustomers: { revenue: 0, invoiceCount: 0, customerIds: new Set() },
    existingCustomers: { revenue: 0, invoiceCount: 0, customerIds: new Set() },
    unassigned: { revenue: 0, invoiceCount: 0, customerIds: new Set() },
  };
  let totalRevenue = 0;
  let totalAbsoluteRevenue = 0;
  let classifiedAbsoluteRevenue = 0;
  let totalInvoiceCount = 0;

  for (const { invoice, revenueTimestamp, customerId } of activeInvoices) {
    if (revenueTimestamp < periodFrom || revenueTimestamp > periodTo) continue;

    const revenue = roundMoney(invoice.netTotal);
    totalRevenue += revenue;
    totalAbsoluteRevenue += Math.abs(revenue);
    totalInvoiceCount += 1;

    let bucketKey: RevenueBucketKey = "unassigned";
    if (customerId) {
      const firstRevenueTimestamp = firstRevenueByCustomer.get(customerId);
      bucketKey = firstRevenueTimestamp !== undefined && firstRevenueTimestamp < periodFrom
        ? "existingCustomers"
        : "newCustomers";
      classifiedAbsoluteRevenue += Math.abs(revenue);
      totals[bucketKey].customerIds.add(customerId);
    }

    totals[bucketKey].revenue += revenue;
    totals[bucketKey].invoiceCount += 1;
  }

  totalRevenue = roundMoney(totalRevenue);
  const makeBucket = (key: RevenueBucketKey): CustomerRevenueBucket => {
    const revenue = roundMoney(totals[key].revenue);
    return {
      revenue,
      shareOfTotalPercent: percentage(revenue, totalRevenue),
      customerCount: totals[key].customerIds.size,
      invoiceCount: totals[key].invoiceCount,
    };
  };
  const newCustomers = makeBucket("newCustomers");
  const existingCustomers = makeBucket("existingCustomers");
  const unassigned = makeBucket("unassigned");

  return {
    totalRevenue,
    totalInvoiceCount,
    newCustomers,
    existingCustomers,
    unassigned,
    classifiedRevenue: roundMoney(newCustomers.revenue + existingCustomers.revenue),
    classificationCoveragePercent: totalAbsoluteRevenue === 0
      ? null
      : roundPercent((classifiedAbsoluteRevenue / totalAbsoluteRevenue) * 100),
    earliestObservedRevenueAt: toIsoDate(earliestObservedRevenueTimestamp),
    hasObservedRevenueBeforePeriod:
      earliestObservedRevenueTimestamp !== null && earliestObservedRevenueTimestamp < periodFrom,
    excludedInvoiceCount,
    invalidDateInvoiceCount,
  };
}
