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

export type RevenueContactInput = {
  id: string;
  customerStatusOverride?: string | null;
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

export type AdditionalSalesRevenueMix = {
  provenRevenue: number;
  provenInvoiceCount: number;
  attributedRevenue: number;
  attributedInvoiceCount: number;
  unassignedRevenue: number;
  unassignedInvoiceCount: number;
  invoiceSourceCoveragePercent: number | null;
  proofCoveragePercent: number | null;
  excludedInvoiceCount: number;
  invalidDateInvoiceCount: number;
};

export type AdditionalSalesInvoiceInput = RevenueInvoiceInput & {
  sourceOfferId?: string | null;
  sourceOfferNumber?: string | null;
};

export type AdditionalSalesOfferInput = {
  id: string;
  offerNumber: string;
};

export type AdditionalSalesPotentialInput = {
  projectId: string;
  taskId?: string | null;
};

export type AdditionalSalesTaskLinkInput = {
  taskId: string;
  url: string;
};

export type CustomerRevenueAnalyticsPeriod = {
  customerRevenue: CustomerRevenueMix;
  additionalSales: AdditionalSalesRevenueMix;
};

export type CustomerRevenueAnalyticsResponse = {
  period: RevenuePeriodInput;
  previousPeriod: RevenuePeriodInput;
  current: CustomerRevenueAnalyticsPeriod;
  previous: CustomerRevenueAnalyticsPeriod;
  dataQuality: {
    legacyInvoiceCount: number;
    evaluableLegacyInvoiceCount: number;
    legacyInvoicesIncluded: false;
    manualOverrideCount: number;
  };
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
  contacts?: readonly RevenueContactInput[];
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
  const contactOverrides = args.contacts
    ? new Map(args.contacts.map((contact) => [contact.id, contact.customerStatusOverride?.trim() || "automatic"] as const))
    : null;
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
    if (customerId && invoice.netTotal > 0) {
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
    const override = customerId ? contactOverrides?.get(customerId) ?? "automatic" : "automatic";
    const hasKnownContact = Boolean(customerId && (!contactOverrides || contactOverrides.has(customerId)));
    if (customerId && hasKnownContact && override !== "prospect") {
      const firstRevenueTimestamp = firstRevenueByCustomer.get(customerId);
      if (override === "existing") {
        bucketKey = "existingCustomers";
      } else if (override === "new") {
        bucketKey = "newCustomers";
      } else if (firstRevenueTimestamp !== undefined) {
        bucketKey = firstRevenueTimestamp < periodFrom ? "existingCustomers" : "newCustomers";
      }
      if (bucketKey !== "unassigned") {
        classifiedAbsoluteRevenue += Math.abs(revenue);
        totals[bucketKey].customerIds.add(customerId);
      }
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

export function calculateAdditionalSalesRevenueMix(args: {
  invoices: readonly AdditionalSalesInvoiceInput[];
  offers: readonly AdditionalSalesOfferInput[];
  potentials: readonly AdditionalSalesPotentialInput[];
  taskLinks: readonly AdditionalSalesTaskLinkInput[];
  period: RevenuePeriodInput;
}): AdditionalSalesRevenueMix {
  const periodFrom = parseRevenueDate(args.period.from);
  const periodTo = parseRevenueDate(args.period.to, true);
  if (periodFrom === null || periodTo === null || periodFrom > periodTo) {
    throw new Error("Der Auswertungszeitraum ist ungültig.");
  }

  const offerIdByNumber = new Map(
    args.offers.map((offer) => [offer.offerNumber.trim(), offer.id] as const).filter(([number]) => Boolean(number))
  );
  const potentialProjectsByTaskId = args.potentials.reduce<Map<string, Set<string>>>((projectsByTaskId, potential) => {
    const taskId = potential.taskId?.trim();
    const projectId = potential.projectId.trim();
    if (!taskId || !projectId) return projectsByTaskId;
    const projectIds = projectsByTaskId.get(taskId) ?? new Set<string>();
    projectIds.add(projectId);
    projectsByTaskId.set(taskId, projectIds);
    return projectsByTaskId;
  }, new Map());
  const potentialProjectsByOfferId = args.taskLinks.reduce<Map<string, Set<string>>>((projectsByOfferId, link) => {
    const offerId = link.url.startsWith("offer:") ? link.url.replace(/^offer:/, "").trim() : "";
    const projectIds = potentialProjectsByTaskId.get(link.taskId);
    if (!offerId || !projectIds) return projectsByOfferId;
    const linkedProjects = projectsByOfferId.get(offerId) ?? new Set<string>();
    projectIds.forEach((projectId) => linkedProjects.add(projectId));
    projectsByOfferId.set(offerId, linkedProjects);
    return projectsByOfferId;
  }, new Map());

  let provenRevenue = 0;
  let attributedRevenue = 0;
  let unassignedRevenue = 0;
  let provenAbsoluteRevenue = 0;
  let attributedAbsoluteRevenue = 0;
  let totalAbsoluteRevenue = 0;
  let provenInvoiceCount = 0;
  let attributedInvoiceCount = 0;
  let unassignedInvoiceCount = 0;
  let excludedInvoiceCount = 0;
  let invalidDateInvoiceCount = 0;

  for (const invoice of args.invoices) {
    if (!isFinanciallyActiveRevenueInvoice(invoice) || !Number.isFinite(invoice.netTotal)) {
      excludedInvoiceCount += 1;
      continue;
    }
    const revenueTimestamp = getRevenueInvoiceTimestamp(invoice);
    if (revenueTimestamp === null) {
      invalidDateInvoiceCount += 1;
      continue;
    }
    if (revenueTimestamp < periodFrom || revenueTimestamp > periodTo) continue;

    const revenue = roundMoney(invoice.netTotal);
    const absoluteRevenue = Math.abs(revenue);
    totalAbsoluteRevenue += absoluteRevenue;
    const sourceOfferId = invoice.sourceOfferId?.trim()
      || offerIdByNumber.get(invoice.sourceOfferNumber?.trim() || "")
      || "";
    if (!sourceOfferId) {
      unassignedRevenue += revenue;
      unassignedInvoiceCount += 1;
      continue;
    }

    attributedRevenue += revenue;
    attributedAbsoluteRevenue += absoluteRevenue;
    attributedInvoiceCount += 1;
    if (potentialProjectsByOfferId.get(sourceOfferId)?.has(invoice.projectId?.trim() || "")) {
      provenRevenue += revenue;
      provenAbsoluteRevenue += absoluteRevenue;
      provenInvoiceCount += 1;
    }
  }

  return {
    provenRevenue: roundMoney(provenRevenue),
    provenInvoiceCount,
    attributedRevenue: roundMoney(attributedRevenue),
    attributedInvoiceCount,
    unassignedRevenue: roundMoney(unassignedRevenue),
    unassignedInvoiceCount,
    invoiceSourceCoveragePercent: totalAbsoluteRevenue === 0
      ? null
      : roundPercent((attributedAbsoluteRevenue / totalAbsoluteRevenue) * 100),
    proofCoveragePercent: attributedAbsoluteRevenue === 0
      ? null
      : roundPercent((provenAbsoluteRevenue / attributedAbsoluteRevenue) * 100),
    excludedInvoiceCount,
    invalidDateInvoiceCount,
  };
}
