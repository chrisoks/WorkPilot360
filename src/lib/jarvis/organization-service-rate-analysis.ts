import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import {
  analyzeProjectServiceRates,
  type ProjectServiceRateAnalysis,
  type ProjectServiceRateCatalogItem,
  type ProjectServiceRateInvoice,
  type ProjectServiceRateTimeEntry,
} from "@/lib/jarvis/project-service-rate-analysis";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";
import {
  canAccessJarvisDataClass,
  type JarvisAccessProfile,
} from "@/lib/jarvis/security";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import {
  calculateJarvisPartialCostPriceCorridor,
  DEFAULT_JARVIS_PRICING_POLICY,
  loadJarvisPricingPolicy,
  type JarvisPricingPolicySource,
} from "@/lib/jarvis/pricing-policy";

export type OrganizationServiceRateSourceData = {
  invoices: ProjectServiceRateInvoice[];
  timeEntries: ProjectServiceRateTimeEntry[];
  catalogItems: ProjectServiceRateCatalogItem[];
};

export type OrganizationServiceRateSource = JarvisPricingPolicySource & {
  load(input: {
    organizationId: string;
    periodStart: Date;
    periodStartKey: string;
  }): Promise<OrganizationServiceRateSourceData>;
};

const INTENT_PATTERNS = [
  /\b(analysier|pruf|vergleich|auswert|bewert)\w*\b.*\b(stundenverrechnungssatz|stundensatz|svs|stundenleistung)\w*\b/,
  /\b(welche|wo)\b.*\b((?:stunden)?leistung|stundenverrechnungssatz|stundensatz|svs)\w*\b.*\b(preis|erhoh|anpass|unwirtschaft|rentabel|marge)\w*\b/,
  /\b(mussen|sollten|konnen)\b.*\b(stundenverrechnungssatz|stundensatz|svs|leistungspreis)\w*\b.*\b(erhoh|anpass|pruf)\w*\b/,
  /\b(wie)\b.*\b(stehen|entwickel|sind)\w*\b.*\b(unsere|alle)\b.*\b(stundenverrechnungssatz|stundensatz|svs)\w*\b/,
];

function normalize(value: string) {
  return normalizeJarvisIntentText(value)
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function containsSpecificProjectReference(question: string) {
  return extractJarvisProjectReferences(question).length > 0;
}

function trailingTwelveMonthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
}

function formatPeriod(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
  return `${formatter.format(start)} bis ${formatter.format(end)}`;
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value)} Std.`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function issuePriority(
  analysis: ProjectServiceRateAnalysis,
  serviceId: string
) {
  const issues = analysis.issues.filter((issue) => issue.id.endsWith(serviceId));
  if (issues.some((issue) => issue.severity === "critical")) return 400;
  if (issues.some((issue) => issue.id.startsWith("service-rate-hours-gap-"))) {
    return 320;
  }
  if (
    issues.some((issue) =>
      issue.id.startsWith("service-rate-below-current-price-")
    )
  ) {
    return 300;
  }
  const service = analysis.services.find((candidate) => candidate.id === serviceId);
  return service?.recommendationBasisSufficient ? 200 : 100;
}

function serviceRecommendation(
  analysis: ProjectServiceRateAnalysis,
  serviceId: string
) {
  const issues = analysis.issues.filter((issue) => issue.id.endsWith(serviceId));
  if (
    issues.some((issue) =>
      issue.id.startsWith("service-rate-cost-not-covered-")
    )
  ) {
    return "Preis, Zeitbedarf und Leistungsumfang zuerst gemeinsam prüfen";
  }
  if (
    issues.some((issue) =>
      issue.id.startsWith("service-rate-hours-gap-")
    )
  ) {
    return "Abrechnungsvollständigkeit und nicht berechnete Stunden prüfen";
  }
  if (
    issues.some((issue) =>
      issue.id.startsWith("service-rate-below-current-price-")
    )
  ) {
    return "Zuerst prüfen, warum der aktuelle Stammdatenpreis nicht erreicht wurde";
  }
  const service = analysis.services.find((candidate) => candidate.id === serviceId);
  return service?.recommendationBasisSufficient
    ? "Aus den vorhandenen Daten ergibt sich kein belegter sofortiger Änderungsbedarf"
    : "Noch keine belastbare allgemeine Preisempfehlung";
}

export function resolveJarvisOrganizationServiceRateIntent(question: string) {
  if (containsSpecificProjectReference(question)) return false;
  const value = normalize(question);
  return INTENT_PATTERNS.some((pattern) => pattern.test(value));
}

async function loadLiveOrganizationServiceRateData(input: {
  organizationId: string;
  periodStart: Date;
  periodStartKey: string;
}): Promise<OrganizationServiceRateSourceData> {
  const [invoices, timeEntries, catalogItems] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        organizationId: input.organizationId,
        createdAt: { gte: input.periodStart },
      },
      select: {
        id: true,
        invoiceNumber: true,
        projectId: true,
        projectNumber: true,
        projectTitle: true,
        customerName: true,
        serviceDate: true,
        createdAt: true,
        status: true,
        lines: {
          select: {
            id: true,
            catalogItemId: true,
            catalogType: true,
            quantity: true,
            unit: true,
            title: true,
            unitPrice: true,
            discountPercent: true,
            materialCostSnapshot: true,
            laborCostSnapshot: true,
            packageComponentsSnapshot: true,
            catalogCostSnapshotVersion: true,
            costSnapshotAt: true,
            laborItems: {
              select: { totalCost: true },
            },
          },
        },
      },
    }),
    prisma.projectTimeEntry.findMany({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        date: { gte: input.periodStartKey },
        mode: "project",
      },
      select: {
        billingCatalogItemId: true,
        billingCatalogItemLabel: true,
        durationMs: true,
        laborCostSnapshot: true,
        costSnapshotAt: true,
      },
    }),
    prisma.catalogItem.findMany({
      where: {
        organizationId: input.organizationId,
        type: "service",
      },
      select: {
        id: true,
        number: true,
        name: true,
        unit: true,
        salesPrice: true,
        isActive: true,
        reviewStatus: true,
      },
    }),
  ]);

  return {
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber || invoice.id,
      projectId: invoice.projectId,
      projectNumber: invoice.projectNumber,
      projectTitle: invoice.projectTitle,
      customerName: invoice.customerName,
      serviceDate: invoice.serviceDate,
      createdAt: invoice.createdAt.toISOString(),
      status: invoice.status,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        catalogItemId: line.catalogItemId,
        catalogType: line.catalogType,
        quantity: line.quantity,
        unit: line.unit,
        title: line.title,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        materialCostSnapshot: line.materialCostSnapshot,
        laborCostSnapshot: line.laborCostSnapshot,
        packageComponentsSnapshot: Array.isArray(
          line.packageComponentsSnapshot
        )
          ? line.packageComponentsSnapshot as NonNullable<
              ProjectServiceRateInvoice["lines"][number]["packageComponentsSnapshot"]
            >
          : [],
        catalogCostSnapshotVersion: line.catalogCostSnapshotVersion,
        costSnapshotAt: line.costSnapshotAt?.toISOString(),
        laborItems: line.laborItems,
      })),
    })),
    timeEntries,
    catalogItems,
  };
}

const liveSource: OrganizationServiceRateSource = {
  load: loadLiveOrganizationServiceRateData,
  loadPricingPolicy: loadJarvisPricingPolicy,
};

export async function resolveJarvisOrganizationServiceRateRequest(
  input: {
    question: string;
    organizationId: string;
    accessProfile: JarvisAccessProfile;
    now?: Date;
  },
  source: OrganizationServiceRateSource = liveSource
): Promise<JarvisReadResponse | undefined> {
  if (!resolveJarvisOrganizationServiceRateIntent(input.question)) {
    return undefined;
  }

  const decision = getJarvisActionDecision(
    "management.service-rate-analysis.read",
    input.accessProfile
  );
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: "management.service-rates.refused",
      message:
        "Der unternehmensweite Vergleich von Stundenverrechnungssätzen verwendet Rechnungs- und Arbeitszeitdaten. Diese Sicht ist für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      deterministic: true,
    };
  }

  const now = input.now ?? new Date();
  const periodStart = trailingTwelveMonthStart(now);
  const periodStartKey = periodStart.toISOString().slice(0, 10);
  const periodLabel = formatPeriod(periodStart, now);
  const data = await source.load({
    organizationId: input.organizationId,
    periodStart,
    periodStartKey,
  });
  const includeCosts = canAccessJarvisDataClass(
    input.accessProfile,
    "payroll"
  );
  const pricingPolicy =
    includeCosts && source.loadPricingPolicy
      ? await source.loadPricingPolicy(input.organizationId)
      : DEFAULT_JARVIS_PRICING_POLICY;
  const analysis = analyzeProjectServiceRates({
    ...data,
    includeCosts,
    scope: "organization",
  });
  const rankedServices = [...analysis.services].sort(
    (left, right) =>
      issuePriority(analysis, right.id) - issuePriority(analysis, left.id) ||
      right.netRevenue - left.netRevenue
  );
  const approvedServiceIds = new Set(
    data.catalogItems
      .filter((item) => item.reviewStatus === "approved")
      .map((item) => item.id)
  );
  const sufficientCount = analysis.services.filter(
    (service) =>
      service.recommendationBasisSufficient &&
      approvedServiceIds.has(service.id)
  ).length;
  const serviceCountLabel =
    analysis.hourlyServiceCount === 1
      ? "eine Stundenleistung"
      : `${analysis.hourlyServiceCount} Stundenleistungen`;

  if (analysis.finalInvoiceCount === 0 || analysis.services.length === 0) {
    return {
      type: "answer",
      topicId: "management.service-rates",
      message:
        `Für ${periodLabel} wurde noch keine ausreichend verknüpfte, fertige Stundenleistung gefunden. JARVIS nimmt deshalb keine Preisbewertung vor.`,
      structured: {
        title: "Stundenverrechnungssätze · Unternehmensvergleich",
        subtitle: periodLabel,
        summary:
          "Es gibt derzeit keine belastbare Stundenleistungsbasis für einen Unternehmensvergleich.",
        facts: [
          { label: "Fertige Rechnungen", value: String(analysis.finalInvoiceCount) },
          { label: "Stundenleistungen", value: String(analysis.hourlyServiceCount) },
          { label: "Belastbar bewertbar", value: "0" },
        ],
        sections: [{
          title: "Nächster Schritt",
          items: [
            "Prüfe, ob Stundenleistungen in „Artikel & Leistungen“ mit der Einheit Stunde gepflegt und in Rechnungen sowie Stempelungen über ihre stabile Leistungs-ID verknüpft sind.",
            analysis.basisNote,
          ],
        }],
      },
      deterministic: true,
    };
  }

  const serviceItems = rankedServices.slice(0, 8).map((service) => {
    const invoiceCountLabel =
      service.invoiceCount === 1
        ? "1 fertige Rechnung"
        : `${service.invoiceCount} fertige Rechnungen`;
    const stampedHoursComparable =
      service.stampedHours > 0 &&
      service.billedHours > 0 &&
      service.stampedHours >= service.billedHours * 0.5;
    const partialCostPriceCorridor =
      includeCosts &&
      service.costBasisComplete &&
      service.recommendationBasisSufficient &&
      approvedServiceIds.has(service.id)
        ? calculateJarvisPartialCostPriceCorridor(
            service.laborCostPerStampedHour,
            pricingPolicy
          )
        : undefined;
    const values = [
      invoiceCountLabel,
      `${formatHours(service.billedHours)} abgerechnet`,
      `${formatHours(service.stampedHours)} eindeutig gestempelt`,
      `${formatMoney(service.realizedBilledRate)} tatsächlich berechnet`,
      stampedHoursComparable && service.revenuePerStampedHour > 0
        ? `${formatMoney(service.revenuePerStampedHour)} Nettoerlös je gestempelter Stunde`
        : "Nettoerlös je gestempelter Stunde wegen unvollständiger Zeitzuordnung nicht belastbar",
      service.currentSalesRate > 0
        ? `${formatMoney(service.currentSalesRate)} aktueller Stammdatenpreis`
        : "",
      includeCosts && service.costBasisComplete
        ? `${formatMoney(service.laborCostPerStampedHour)} gespeicherte Mitarbeiterkosten je gestempelter Stunde`
        : "",
      partialCostPriceCorridor
        ? `${formatMoney(partialCostPriceCorridor.minimumPrice)} vorläufiger Mindeststundensatz bei ${partialCostPriceCorridor.minimumMarginPercent} % Mindestmarge`
        : "",
      partialCostPriceCorridor
        ? `${formatMoney(partialCostPriceCorridor.targetPrice)} vorläufiger Zielstundensatz bei ${partialCostPriceCorridor.targetMarginPercent} % Zielmarge`
        : "",
    ].filter(Boolean);
    const recommendation = approvedServiceIds.has(service.id)
      ? serviceRecommendation(analysis, service.id)
      : "Leistungsstammdaten zuerst fachlich prüfen und freigeben; bis dahin gibt JARVIS keine Preisempfehlung";
    return `${service.title}: ${values.join("; ")}. Einordnung: ${recommendation}.`;
  });
  const issueItems = analysis.issues
    .slice(0, 5)
    .map(
      (issue) =>
        `${issue.title}. Nächster Schritt: ${issue.recommendation}`
    );
  const nextStep =
    sufficientCount === 0
      ? approvedServiceIds.size === 0
        ? "Keine ausgewertete Stundenleistung ist fachlich freigegeben. Prüfe zuerst die Leistungsstammdaten; JARVIS nennt bis dahin keinen neuen allgemeinen Stundensatz."
        : "Keine fachlich freigegebene Leistung erreicht derzeit die festgelegte Mindestbasis aus drei fertigen Rechnungen, zehn abgerechneten und zehn eindeutig zugeordneten gestempelten Stunden. JARVIS nennt deshalb keinen neuen allgemeinen Stundensatz."
      : `Bearbeite zuerst Abrechnungs- und Zuordnungsfehler. Prüfe danach je belastbarer Leistung, ob der aktuelle Stammdatenpreis tatsächlich durchgesetzt wird. JARVIS verwendet vorläufig ${pricingPolicy.minimumMarginPercent} % Mindestmarge und ${pricingPolicy.targetMarginPercent} % Zielmarge. Material-, Fahrzeug- und Gemeinkosten müssen vor einer echten Preisentscheidung zusätzlich berücksichtigt werden.`;

  return {
    type: "answer",
    topicId: "management.service-rates",
    message:
      `JARVIS hat ${serviceCountLabel} aus ${analysis.finalInvoiceCount} fertigen Rechnungen im Zeitraum ${periodLabel} verglichen. ${sufficientCount} davon erfüllen die Mindestdatenbasis für eine vertiefte Preisprüfung.`,
    structured: {
      title: "Stundenverrechnungssätze · Unternehmensvergleich",
      subtitle: periodLabel,
      summary:
        `${serviceCountLabel} wurden über alle Projekte hinweg positionsweise verglichen.`,
      facts: [
        {
          label: "Fertige Rechnungen",
          value: String(analysis.finalInvoiceCount),
        },
        {
          label: "Stundenleistungen",
          value: String(analysis.hourlyServiceCount),
        },
        {
          label: "Fachlich freigegeben",
          value: String(approvedServiceIds.size),
          tone: approvedServiceIds.size > 0 ? "positive" : "warning",
        },
        {
          label: "Belastbar bewertbar",
          value: String(sufficientCount),
          tone: sufficientCount > 0 ? "positive" : "warning",
        },
        ...(includeCosts
          ? [{
              label: "Preisrichtlinie",
              value: `${pricingPolicy.minimumMarginPercent} % / ${pricingPolicy.targetMarginPercent} %`,
            }]
          : []),
      ],
      sections: [
        {
          title: "Leistungsvergleich",
          items: serviceItems,
        },
        ...(issueItems.length > 0
          ? [{
              title: "Auffälligkeiten",
              items: issueItems,
              tone: "warning" as const,
            }]
          : []),
        {
          title: "Nächster Schritt",
          items: [
            nextStep,
            ...(includeCosts && sufficientCount > 0
              ? ["Die genannten Mindest- und Zielstundensätze sind eine vorläufige Teilkostenberechnung aus den gespeicherten Mitarbeiterkosten. Material, Fahrzeuge, Werkzeuge, Verwaltung und weitere Gemeinkosten sind noch nicht vollständig enthalten. Sie sind deshalb keine fertige Preisentscheidung."]
              : []),
            analysis.basisNote,
          ],
        },
      ],
    },
    deterministic: true,
  };
}
