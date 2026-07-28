import {
  buildCatalogPerformance,
  type CatalogPerformanceInvoice,
} from "@/lib/analytics/catalog-performance";

export type ProjectServiceRateCatalogItem = {
  id: string;
  number: string;
  name: string;
  unit: string;
  salesPrice: number;
  isActive: boolean;
  reviewStatus?: string;
};

export type ProjectServiceRateTimeEntry = {
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  durationMs: number | bigint;
  laborCostSnapshot: number;
  costSnapshotAt: Date | string | null;
};

export type ProjectServiceRateInvoice = CatalogPerformanceInvoice & {
  status: string;
};

export type ProjectServiceRateIssue = {
  id: string;
  severity: "critical" | "warning";
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

export type ProjectServiceRateRow = {
  id: string;
  title: string;
  unit: string;
  invoiceCount: number;
  billedHours: number;
  stampedHours: number;
  netRevenue: number;
  realizedBilledRate: number;
  revenuePerStampedHour: number;
  currentSalesRate: number;
  stampedLaborCost: number;
  laborCostPerStampedHour: number;
  contributionAfterLabor: number;
  contributionAfterLaborPercent: number;
  costBasisComplete: boolean;
  recommendationBasisSufficient: boolean;
};

export type ProjectServiceRateAnalysis = {
  finalInvoiceCount: number;
  hourlyServiceCount: number;
  unassignedStampedHours: number;
  services: ProjectServiceRateRow[];
  issues: ProjectServiceRateIssue[];
  includeCosts: boolean;
  checkedRules: string[];
  basisNote: string;
};

type ProjectServiceRateAnalysisInput = {
  invoices: ProjectServiceRateInvoice[];
  timeEntries: ProjectServiceRateTimeEntry[];
  catalogItems: ProjectServiceRateCatalogItem[];
  includeCosts: boolean;
  scope?: "project" | "organization";
};

const INACTIVE_OR_UNFINISHED_STATUSES = [
  "entwurf",
  "storniert",
  "stornorechnung",
  "geloscht",
  "geloescht",
  "deleted",
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(round(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round(value));
}

function durationHours(value: number | bigint) {
  return Math.max(0, finite(value) / 3_600_000);
}

function isFinishedInvoice(invoice: ProjectServiceRateInvoice) {
  const status = normalize(invoice.status);
  const compactStatus = status.replace(/[^a-z]/g, "");
  return (
    !/^gel.*scht$/.test(compactStatus) &&
    !INACTIVE_OR_UNFINISHED_STATUSES.includes(status)
  );
}

function isHourUnit(unit: string) {
  const value = normalize(unit).replace(/[.\s]/g, "");
  return ["h", "std", "stunde", "stunden", "hour", "hours"].includes(value);
}

function buildIssues(
  rows: ProjectServiceRateRow[],
  unassignedStampedHours: number,
  includeCosts: boolean
) {
  const issues: ProjectServiceRateIssue[] = [];

  if (unassignedStampedHours > 0.01) {
    issues.push({
      id: "service-rate-unassigned-stamps",
      severity: "warning",
      area: "Stundenverrechnung & Wirtschaftlichkeit",
      title: "Stempelstunden können keiner abgerechneten Stundenleistung sicher gegenübergestellt werden",
      evidence: `${formatNumber(unassignedStampedHours)} Stunden besitzen entweder keine Abrechnungsleistungs-ID oder ihre verknüpfte Leistung kommt in den fertigen Rechnungen nicht als Stundenleistung vor. Sie können deshalb keinem tatsächlich berechneten Stundenverrechnungssatz zuverlässig gegenübergestellt werden.`,
      recommendation:
        "Prüfe bei den betroffenen Zeiteinträgen Gewerk und Abrechnungsleistung sowie die zugehörigen fertigen Rechnungen. Ordne die Stunden erst nach fachlicher Prüfung zu; JARVIS nimmt keine automatische Zuordnung anhand eines ähnlichen Namens vor.",
    });
  }

  for (const row of rows) {
    if (row.stampedHours > row.billedHours * 1.05 && row.stampedHours - row.billedHours > 0.25) {
      issues.push({
        id: `service-rate-hours-gap-${row.id}`,
        severity: "warning",
        area: "Stundenverrechnung & Wirtschaftlichkeit",
        title: `Bei „${row.title}“ wurden weniger Stunden abgerechnet als gestempelt`,
        evidence: `${formatNumber(row.stampedHours)} Stunden wurden eindeutig zugeordnet, aber nur ${formatNumber(row.billedHours)} Stunden über fertige Rechnungen abgerechnet.`,
        recommendation:
          "Prüfe zuerst, ob alle zugehörigen Stempelungen bereits in einer fertigen Rechnung enthalten sind. Kläre danach bewusst, ob Stunden nicht berechnet werden sollten oder ob eine Rechnungsposition fehlt.",
      });
    }

    if (
      row.currentSalesRate > 0 &&
      row.realizedBilledRate > 0 &&
      row.realizedBilledRate < row.currentSalesRate * 0.95
    ) {
      issues.push({
        id: `service-rate-below-current-price-${row.id}`,
        severity: "warning",
        area: "Stundenverrechnung & Wirtschaftlichkeit",
        title: `Der tatsächlich berechnete Stundensatz von „${row.title}“ liegt unter dem aktuellen Stammdatenpreis`,
        evidence: `Aus fertigen Rechnungen ergeben sich ${formatMoney(row.realizedBilledRate)} je abgerechneter Stunde. In „Artikel & Leistungen“ sind aktuell ${formatMoney(row.currentSalesRate)} je Stunde hinterlegt.`,
        recommendation:
          "Prüfe zuerst Rabatte, abweichende Projektpreise und alte Rechnungsstände. Erhöhe den Stammdatenpreis nicht allein wegen dieser Abweichung; möglicherweise wurde der aktuelle Preis nur nicht vollständig durchgesetzt.",
      });
    }

    if (
      includeCosts &&
      row.costBasisComplete &&
      row.stampedHours > 0 &&
      row.netRevenue <= row.stampedLaborCost
    ) {
      issues.push({
        id: `service-rate-cost-not-covered-${row.id}`,
        severity: "critical",
        area: "Stundenverrechnung & Wirtschaftlichkeit",
        title: `Der Erlös von „${row.title}“ deckt die gespeicherten Mitarbeiterkosten nicht`,
        evidence: `${formatMoney(row.netRevenue)} Nettoerlös stehen ${formatMoney(row.stampedLaborCost)} gespeicherten Mitarbeiterkosten gegenüber. Material-, Fahrzeug- und Gemeinkosten sind dabei noch nicht berücksichtigt.`,
        recommendation:
          `Prüfe Preis, abgerechnete Stunden und tatsächlich benötigte Zeit gemeinsam. ${formatMoney(row.laborCostPerStampedHour)} je gestempelter Stunde ist lediglich die nachgewiesene Untergrenze zur Deckung der gespeicherten Mitarbeiterkosten und noch kein sinnvoller Verkaufspreis.`,
      });
    }
  }

  return issues;
}

export function analyzeProjectServiceRates(
  input: ProjectServiceRateAnalysisInput
): ProjectServiceRateAnalysis {
  const finalInvoices = input.invoices.filter(isFinishedInvoice);
  const performance = buildCatalogPerformance(finalInvoices, []);
  const catalogById = new Map(input.catalogItems.map((item) => [item.id, item]));
  const timeByService = new Map<
    string,
    {
      hours: number;
      laborCost: number;
      costBasisComplete: boolean;
    }
  >();
  let unassignedStampedHours = 0;

  for (const entry of input.timeEntries) {
    const hours = durationHours(entry.durationMs);
    if (!entry.billingCatalogItemId) {
      unassignedStampedHours += hours;
      continue;
    }
    const current = timeByService.get(entry.billingCatalogItemId) ?? {
      hours: 0,
      laborCost: 0,
      costBasisComplete: true,
    };
    current.hours += hours;
    if (input.includeCosts) {
      current.laborCost += Math.max(0, finite(entry.laborCostSnapshot));
      current.costBasisComplete =
        current.costBasisComplete && Boolean(entry.costSnapshotAt);
    }
    timeByService.set(entry.billingCatalogItemId, current);
  }

  const services = performance.serviceRows
    .filter((service) => service.id && isHourUnit(service.unit))
    .map((service): ProjectServiceRateRow => {
      const time = timeByService.get(service.id);
      const billedHours = round(service.quantity);
      const stampedHours = round(time?.hours ?? 0);
      const netRevenue = round(service.revenue);
      const realizedBilledRate =
        billedHours > 0 ? round(netRevenue / billedHours) : 0;
      const revenuePerStampedHour =
        stampedHours > 0 ? round(netRevenue / stampedHours) : 0;
      const stampedLaborCost = input.includeCosts
        ? round(time?.laborCost ?? 0)
        : 0;
      const laborCostPerStampedHour =
        input.includeCosts && stampedHours > 0
          ? round(stampedLaborCost / stampedHours)
          : 0;
      const contributionAfterLabor = input.includeCosts
        ? round(netRevenue - stampedLaborCost)
        : 0;
      const contributionAfterLaborPercent =
        input.includeCosts && netRevenue > 0
          ? round((contributionAfterLabor / netRevenue) * 100)
          : 0;
      const costBasisComplete =
        input.includeCosts &&
        stampedHours > 0 &&
        Boolean(time?.costBasisComplete);

      return {
        id: service.id,
        title: service.title,
        unit: service.unit,
        invoiceCount: service.invoiceCount,
        billedHours,
        stampedHours,
        netRevenue,
        realizedBilledRate,
        revenuePerStampedHour,
        currentSalesRate: round(catalogById.get(service.id)?.salesPrice ?? 0),
        stampedLaborCost,
        laborCostPerStampedHour,
        contributionAfterLabor,
        contributionAfterLaborPercent,
        costBasisComplete,
        recommendationBasisSufficient:
          service.invoiceCount >= 3 &&
          billedHours >= 10 &&
          stampedHours >= 10,
      };
    })
    .sort(
      (left, right) =>
        right.netRevenue - left.netRevenue ||
        left.title.localeCompare(right.title, "de")
    );
  const billedServiceIds = new Set(services.map((service) => service.id));
  for (const [serviceId, time] of timeByService) {
    if (!billedServiceIds.has(serviceId)) {
      unassignedStampedHours += time.hours;
    }
  }

  const issues = buildIssues(
    services,
    round(unassignedStampedHours),
    input.includeCosts
  );
  const organizationWide = input.scope === "organization";

  return {
    finalInvoiceCount: finalInvoices.length,
    hourlyServiceCount: services.length,
    unassignedStampedHours: round(unassignedStampedHours),
    services,
    issues,
    includeCosts: input.includeCosts,
    checkedRules: [
      "Es werden ausschließlich fertige Rechnungen ausgewertet; Entwürfe, Stornos und gelöschte Rechnungen zählen nicht.",
      "Der tatsächlich berechnete Stundensatz ergibt sich aus Nettoerlös geteilt durch abgerechnete Stunden.",
      "Der wirtschaftliche Erlös je eingesetzter Stunde wird getrennt aus Nettoerlös und eindeutig zugeordneter Stempelzeit berechnet.",
      "Stempelungen werden nur über die stabile ID der Abrechnungsleistung zugeordnet und niemals anhand eines ähnlich klingenden Namens.",
      ...(input.includeCosts
        ? ["Mitarbeiterkosten werden nur aus gespeicherten historischen Kostenständen der Stempelungen einbezogen."]
        : []),
    ],
    basisNote: organizationWide
      ? "Die Auswertung vergleicht den gewählten Unternehmenszeitraum über alle Projekte. Neue, noch nicht abgerechnete Stempelungen können den Vergleich beeinflussen. Eine belastbare Preisempfehlung benötigt je Leistung mehrere fertige Rechnungen, ausreichend abgerechnete und eindeutig zugeordnete gestempelte Stunden sowie – für GF/Admin – vollständige historische Kostenstände. Material-, Fahrzeug- und Gemeinkosten müssen zusätzlich betrachtet werden."
      : "Die Auswertung betrachtet das gesamte Projekt. Bei laufenden Projekten können neue, noch nicht abgerechnete Stempelungen den Vergleich beeinflussen. Eine einzelne Projektanalyse beweist noch keinen allgemein richtigen Verkaufspreis. Eine belastbare Preisempfehlung benötigt mehrere fertige Rechnungen, ausreichend abgerechnete und gestempelte Stunden sowie – für GF/Admin – vollständige historische Kostenstände. Material-, Fahrzeug- und Gemeinkosten müssen zusätzlich betrachtet werden.",
  };
}
