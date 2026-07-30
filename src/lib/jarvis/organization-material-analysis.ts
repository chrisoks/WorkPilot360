import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import {
  analyzeProjectMaterials,
  type ProjectMaterialAnalysis,
  type ProjectMaterialInventoryMovement,
  type ProjectMaterialInvoice,
} from "@/lib/jarvis/project-material-analysis";
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
  type JarvisPriceCorridor,
  type JarvisPricingPolicy,
  type JarvisPricingPolicySource,
} from "@/lib/jarvis/pricing-policy";

export type OrganizationMaterialCatalogItem = {
  id: string;
  number: string;
  name: string;
  unit: string;
  purchasePrice: number;
  salesPrice: number;
  isActive: boolean;
  reviewStatus: string;
};

export type OrganizationMaterialSourceData = {
  invoices: ProjectMaterialInvoice[];
  inventoryMovements: ProjectMaterialInventoryMovement[];
  catalogItems: OrganizationMaterialCatalogItem[];
};

export type OrganizationMaterialSource = JarvisPricingPolicySource & {
  load(input: {
    organizationId: string;
    periodStart: Date;
    includeCosts: boolean;
  }): Promise<OrganizationMaterialSourceData>;
};

const INTENT_PATTERNS = [
  /\b(analysier|pruf|vergleich|auswert|bewert)\w*\b.*\b(material|artikel|lager|paketbestandteil)\w*\b/,
  /\b(welche|wo)\b.*\b(material|artikel)\w*\b.*\b(preis|zu gunstig|marge|kosten|anpass|erhoh|auffallig|wirtschaftlich|rentabel)\w*\b/,
  /\b(welche|wo)\b.*\b(material|artikel)\w*\b.*\b(meist|haufig|verkauf|abgerechnet|verbraucht)\w*\b/,
  /\b(materialverbrauch|materialmenge|lagerentnahme|lagerbewegung)\w*\b.*\b(stimm|abweich|vergleich|pruf)\w*\b/,
  /\b(stimm|abweich|vergleich|pruf)\w*\b.*\b(materialverbrauch|materialmenge|lagerentnahme|lagerbewegung)\w*\b/,
  /\b(wie hoch|wie viel|zeig|nenne)\b.*\b(materialverbrauch|materialeinsatz|materialmenge|material|artikel|streugut|streusalz|salz)\w*\b/,
  /\b(wo|welche)\b.*\b(verbrauch|einsatz|entnahme)\w*\b.*\b(material|artikel|streugut|streusalz|salz)\w*\b/,
  /\b(wo|welche)\b.*\b(material|artikel|streugut|streusalz|salz)\w*\b.*\b(auffallig|zu viel|haufig|verbrauch|einsatz|entnahme)\w*\b/,
  /\b(?:wo|welche)\b.*\b(?:wirtschaftlich\w*\s+)?materialauffallig\w*\b/,
];

function normalize(value: string) {
  return normalizeJarvisIntentText(value)
    .replace(/\s+/g, " ")
    .trim();
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number, unit: string) {
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}

function roundedQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeMovementType(value: string) {
  return normalize(value);
}

export function resolveJarvisOrganizationMaterialIntent(question: string) {
  if (extractJarvisProjectReferences(question).length > 0) return false;
  const value = normalize(question);
  return INTENT_PATTERNS.some((pattern) => pattern.test(value));
}

async function loadLiveOrganizationMaterialData(input: {
  organizationId: string;
  periodStart: Date;
  includeCosts: boolean;
}): Promise<OrganizationMaterialSourceData> {
  const [invoices, catalogItems] = await Promise.all([
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
    prisma.catalogItem.findMany({
      where: {
        organizationId: input.organizationId,
        type: "article",
      },
      select: {
        id: true,
        number: true,
        name: true,
        unit: true,
        purchasePrice: true,
        salesPrice: true,
        isActive: true,
        reviewStatus: true,
      },
    }),
  ]);
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const inventoryMovements =
    invoiceIds.length > 0
      ? await prisma.catalogInventoryMovement.findMany({
          where: {
            organizationId: input.organizationId,
            invoiceId: { in: invoiceIds },
          },
          select: {
            catalogItemId: true,
            movementType: true,
            quantityDelta: true,
            invoiceId: true,
          },
        })
      : [];

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
        materialCostSnapshot: input.includeCosts
          ? line.materialCostSnapshot
          : 0,
        laborCostSnapshot: input.includeCosts ? line.laborCostSnapshot : 0,
        packageComponentsSnapshot: Array.isArray(
          line.packageComponentsSnapshot
        )
          ? line.packageComponentsSnapshot.map((component) => {
              if (!component || typeof component !== "object") {
                return component;
              }
              return input.includeCosts
                ? component
                : { ...component, costValuePerPackage: 0 };
            }) as NonNullable<
              ProjectMaterialInvoice["lines"][number]["packageComponentsSnapshot"]
            >
          : [],
        catalogCostSnapshotVersion: line.catalogCostSnapshotVersion,
        costSnapshotAt: input.includeCosts
          ? line.costSnapshotAt?.toISOString()
          : undefined,
        laborItems: input.includeCosts ? line.laborItems : [],
      })),
    })),
    inventoryMovements,
    catalogItems: catalogItems.map((item) => ({
      ...item,
      purchasePrice: input.includeCosts ? item.purchasePrice : 0,
    })),
  };
}

const liveSource: OrganizationMaterialSource = {
  load: loadLiveOrganizationMaterialData,
  loadPricingPolicy: loadJarvisPricingPolicy,
};

type MaterialComparison = {
  id: string;
  title: string;
  unit: string;
  quantity: number;
  directQuantity: number;
  packageQuantity: number;
  invoiceCount: number;
  revenue: number;
  realizedUnitPrice: number;
  historicalUnitCost: number;
  historicalCostComplete: boolean;
  currentSalesPrice: number;
  currentPurchasePrice: number;
  bookedWithdrawal: number;
  inventoryDifference: number;
  hasStableCatalogLink: boolean;
  catalogApproved: boolean;
  repeatedDataBasisSufficient: boolean;
  recommendationBasisSufficient: boolean;
  partialCostPriceCorridor?: JarvisPriceCorridor;
};

function buildComparisons(
  analysis: ProjectMaterialAnalysis,
  data: OrganizationMaterialSourceData,
  includeCosts: boolean,
  pricingPolicy: JarvisPricingPolicy
): MaterialComparison[] {
  const catalogById = new Map(
    data.catalogItems.map((item) => [item.id, item])
  );
  const movementsByItem = new Map<string, number>();
  for (const movement of data.inventoryMovements) {
    if (!["sale", "reversal"].includes(
      normalizeMovementType(movement.movementType)
    )) {
      continue;
    }
    movementsByItem.set(
      movement.catalogItemId,
      (movementsByItem.get(movement.catalogItemId) ?? 0) +
        Number(movement.quantityDelta || 0)
    );
  }

  return analysis.materials.map((material) => {
    const catalogItem = catalogById.get(material.id);
    const hasStableCatalogLink = material.details.some(
      (detail) => detail.catalogItemId === material.id
    );
    const bookedWithdrawal = hasStableCatalogLink
      ? Math.max(0, -(movementsByItem.get(material.id) ?? 0))
      : 0;
    const repeatedDataBasisSufficient =
      material.invoiceCount >= 3 && material.quantity > 0;
    const catalogApproved = catalogItem?.reviewStatus === "approved";
    const recommendationBasisSufficient =
      repeatedDataBasisSufficient && catalogApproved;
    const historicalUnitCost =
      includeCosts && material.quantity > 0
        ? material.cost / material.quantity
        : 0;
    const historicalCostComplete =
      includeCosts && material.reconstructedCount === 0;
    return {
      id: material.id,
      title: material.title,
      unit: material.unit,
      quantity: material.quantity,
      directQuantity: material.directQuantity,
      packageQuantity: material.packageQuantity,
      invoiceCount: material.invoiceCount,
      revenue: material.revenue,
      realizedUnitPrice:
        material.quantity > 0 ? material.revenue / material.quantity : 0,
      historicalUnitCost,
      historicalCostComplete,
      currentSalesPrice: catalogItem?.salesPrice ?? 0,
      currentPurchasePrice:
        includeCosts ? catalogItem?.purchasePrice ?? 0 : 0,
      bookedWithdrawal,
      inventoryDifference: hasStableCatalogLink
        ? roundedQuantity(material.quantity - bookedWithdrawal)
        : 0,
      hasStableCatalogLink,
      catalogApproved,
      repeatedDataBasisSufficient,
      recommendationBasisSufficient,
      partialCostPriceCorridor:
        recommendationBasisSufficient && historicalCostComplete
          ? calculateJarvisPartialCostPriceCorridor(
              historicalUnitCost,
              pricingPolicy
            )
          : undefined,
    };
  });
}

function materialPriority(
  material: MaterialComparison,
  includeCosts: boolean
) {
  if (
    includeCosts &&
    material.historicalCostComplete &&
    material.historicalUnitCost > 0 &&
    material.realizedUnitPrice <= material.historicalUnitCost
  ) {
    return 500;
  }
  if (
    includeCosts &&
    material.currentPurchasePrice > 0 &&
    material.currentSalesPrice <= material.currentPurchasePrice
  ) {
    return 450;
  }
  if (
    material.hasStableCatalogLink &&
    Math.abs(material.inventoryDifference) >= 0.001
  ) {
    return 400;
  }
  if (
    material.currentSalesPrice > 0 &&
    material.realizedUnitPrice > 0 &&
    material.realizedUnitPrice < material.currentSalesPrice * 0.95
  ) {
    return 300;
  }
  return material.recommendationBasisSufficient ? 200 : 100;
}

function materialRecommendation(
  material: MaterialComparison,
  includeCosts: boolean
) {
  if (!material.catalogApproved) {
    return "Artikelstammdaten zuerst fachlich prüfen und freigeben; bis dahin gibt JARVIS keine Preisempfehlung";
  }
  if (
    includeCosts &&
    material.historicalCostComplete &&
    material.historicalUnitCost > 0 &&
    material.realizedUnitPrice <= material.historicalUnitCost
  ) {
    return "Historischen Verkaufspreis, Rabatte und belegte Einkaufskosten zuerst gemeinsam prüfen";
  }
  if (
    includeCosts &&
    material.currentPurchasePrice > 0 &&
    material.currentSalesPrice <= material.currentPurchasePrice
  ) {
    return "Aktuellen Einkaufs- und Verkaufspreis in „Artikel & Leistungen“ dringend prüfen";
  }
  if (
    material.hasStableCatalogLink &&
    Math.abs(material.inventoryDifference) >= 0.001
  ) {
    return "Fertige Rechnungen und Lagerbewegungshistorie gegeneinander prüfen";
  }
  if (
    material.currentSalesPrice > 0 &&
    material.realizedUnitPrice > 0 &&
    material.realizedUnitPrice < material.currentSalesPrice * 0.95
  ) {
    return "Rabatte, alte Projektpreise und damalige Preisstände prüfen";
  }
  return material.recommendationBasisSufficient
    ? "Aus den freigegebenen Daten ergibt sich kein belegter sofortiger Änderungsbedarf"
    : "Noch keine belastbare allgemeine Preisempfehlung";
}

export async function resolveJarvisOrganizationMaterialRequest(
  input: {
    question: string;
    organizationId: string;
    accessProfile: JarvisAccessProfile;
    now?: Date;
  },
  source: OrganizationMaterialSource = liveSource
): Promise<JarvisReadResponse | undefined> {
  if (!resolveJarvisOrganizationMaterialIntent(input.question)) {
    return undefined;
  }

  const decision = getJarvisActionDecision(
    "management.material-analysis.read",
    input.accessProfile
  );
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: "management.materials.refused",
      message:
        "Der unternehmensweite Material- und Artikelvergleich verwendet Rechnungs- und Lagerdaten. Diese Sicht ist für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      deterministic: true,
    };
  }

  const now = input.now ?? new Date();
  const periodStart = trailingTwelveMonthStart(now);
  const periodLabel = formatPeriod(periodStart, now);
  const includeCosts = canAccessJarvisDataClass(
    input.accessProfile,
    "payroll"
  );
  const data = await source.load({
    organizationId: input.organizationId,
    periodStart,
    includeCosts,
  });
  const pricingPolicy =
    includeCosts && source.loadPricingPolicy
      ? await source.loadPricingPolicy(input.organizationId)
      : DEFAULT_JARVIS_PRICING_POLICY;
  const analysis = analyzeProjectMaterials({
    invoices: data.invoices,
    inventoryMovements: data.inventoryMovements,
    includeCosts,
  });
  const comparisons = buildComparisons(
    analysis,
    data,
    includeCosts,
    pricingPolicy
  ).sort(
    (left, right) =>
      materialPriority(right, includeCosts) -
        materialPriority(left, includeCosts) ||
      right.revenue - left.revenue
  );
  const sufficientCount = comparisons.filter(
    (material) => material.recommendationBasisSufficient
  ).length;
  const approvedCount = comparisons.filter(
    (material) => material.catalogApproved
  ).length;
  const inventoryComparisons = comparisons.filter(
    (material) => material.hasStableCatalogLink
  );
  const inventoryMismatchCount = inventoryComparisons.filter(
    (material) => Math.abs(material.inventoryDifference) >= 0.001
  ).length;

  if (analysis.finalInvoiceCount === 0 || comparisons.length === 0) {
    const emptySummary =
      analysis.finalInvoiceCount === 0
        ? "Es wurde im gewählten Zeitraum noch keine fertige Rechnung gefunden."
        : analysis.finalInvoiceCount === 1
          ? "Eine fertige Rechnung wurde geprüft. Darin wurde keine auswertbare Materialposition gefunden."
          : `${analysis.finalInvoiceCount} fertige Rechnungen wurden geprüft. Darin wurde keine auswertbare Materialposition gefunden.`;
    return {
      type: "answer",
      topicId: "management.materials",
      message:
        `Für ${periodLabel} wurde noch keine auswertbare Materialposition in einer fertigen Rechnung gefunden. JARVIS nimmt deshalb keine Preis- oder Verbrauchsbewertung vor.`,
      structured: {
        title: "Material & Artikel · Unternehmensvergleich",
        subtitle: periodLabel,
        summary: emptySummary,
        facts: [
          {
            label: "Fertige Rechnungen",
            value: String(analysis.finalInvoiceCount),
          },
          { label: "Materialarten", value: "0" },
          { label: "Belastbar bewertbar", value: "0" },
        ],
        sections: [{
          title: "Nächster Schritt",
          items: [
            "Prüfe, ob Artikel in fertigen Rechnungen über ihre stabile Artikel-ID verknüpft sind und Paketbestandteile beim Rechnungsabschluss gespeichert wurden.",
            analysis.basisNote,
          ],
        }],
      },
      deterministic: true,
    };
  }

  const materialItems = comparisons.slice(0, 8).map((material) => {
    const invoiceCountLabel =
      material.invoiceCount === 1
        ? "1 fertige Rechnung"
        : `${material.invoiceCount} fertige Rechnungen`;
    const values = [
      invoiceCountLabel,
      `${formatQuantity(material.quantity, material.unit)} abgerechnet`,
      material.packageQuantity > 0
        ? `${formatQuantity(material.packageQuantity, material.unit)} davon aus Paketen`
        : "",
      `${formatMoney(material.realizedUnitPrice)} durchschnittlich tatsächlich berechnet`,
      material.currentSalesPrice > 0
        ? `${formatMoney(material.currentSalesPrice)} aktueller Verkaufspreis`
        : "",
      material.hasStableCatalogLink
        ? `${formatQuantity(material.bookedWithdrawal, material.unit)} als Lagerentnahme gebucht`
        : "kein sicherer Lagerabgleich ohne stabile Artikel-ID",
      includeCosts && material.historicalCostComplete
        ? `${formatMoney(material.historicalUnitCost)} belegte historische Materialkosten je Einheit`
        : "",
      includeCosts && material.currentPurchasePrice > 0
        ? `${formatMoney(material.currentPurchasePrice)} aktueller Einkaufspreis`
        : "",
      includeCosts && material.partialCostPriceCorridor
        ? `${formatMoney(material.partialCostPriceCorridor.minimumPrice)} vorläufiger Mindestpreis bei ${formatNumber(material.partialCostPriceCorridor.minimumMarginPercent)} % Mindestmarge`
        : "",
      includeCosts && material.partialCostPriceCorridor
        ? `${formatMoney(material.partialCostPriceCorridor.targetPrice)} vorläufiger Zielpreis bei ${formatNumber(material.partialCostPriceCorridor.targetMarginPercent)} % Zielmarge`
        : "",
    ].filter(Boolean);
    return `${material.title}: ${values.join("; ")}. Einordnung: ${materialRecommendation(material, includeCosts)}.`;
  });
  const issueItems = analysis.issues
    .filter((issue) => issue.id !== "project-material-inventory-mismatch")
    .slice(0, 3)
    .map(
      (issue) =>
        `${issue.title}. Nächster Schritt: ${issue.recommendation}`
    );
  if (inventoryMismatchCount > 0) {
    issueItems.unshift(
      `${inventoryMismatchCount} Materialart/Materialarten weichen zwischen abgerechneter Menge und systemseitiger Lagerentnahme ab. Nächster Schritt: Prüfe die fertigen Rechnungen und die Lagerbewegungshistorie; ändere nichts ungeprüft.`
    );
  }
  const nextStep =
    sufficientCount === 0
      ? approvedCount === 0
        ? "Keiner der ausgewerteten Artikel ist fachlich freigegeben. Prüfe zuerst die Artikelstammdaten; JARVIS nennt bis dahin keinen allgemeinen neuen Artikelpreis."
        : "Keine fachlich freigegebene Materialart kommt derzeit in mindestens drei fertigen Rechnungen vor. JARVIS nennt deshalb keinen allgemeinen neuen Artikelpreis."
      : `Kläre zuerst Lager- und Verknüpfungsabweichungen. Prüfe danach bei ausreichend häufig abgerechneten Artikeln, warum der aktuelle Verkaufspreis nicht erreicht wird. JARVIS verwendet vorläufig ${formatNumber(pricingPolicy.minimumMarginPercent)} % Mindestmarge und ${formatNumber(pricingPolicy.targetMarginPercent)} % Zielmarge, ändert aber keine Stammdaten automatisch.`;

  return {
    type: "answer",
    topicId: "management.materials",
    message:
      `JARVIS hat ${comparisons.length === 1 ? "eine Materialart" : `${comparisons.length} Materialarten`} aus ${analysis.finalInvoiceCount} fertigen Rechnungen im Zeitraum ${periodLabel} verglichen. ${sufficientCount} davon kommen in mindestens drei fertigen Rechnungen vor.`,
    structured: {
      title: "Material & Artikel · Unternehmensvergleich",
      subtitle: periodLabel,
      summary:
        `${comparisons.length === 1 ? "Eine Materialart wurde" : `${comparisons.length} Materialarten wurden`} positionsweise einschließlich gespeicherter Paketbestandteile ausgewertet.`,
      facts: [
        {
          label: "Fertige Rechnungen",
          value: String(analysis.finalInvoiceCount),
        },
        {
          label: "Materialarten",
          value: String(comparisons.length),
        },
        {
          label: "Fachlich freigegeben",
          value: String(approvedCount),
          tone: approvedCount > 0 ? "positive" : "warning",
        },
        {
          label: "Lagerabweichungen",
          value:
            inventoryComparisons.length === 0
              ? "Kein sicherer Vergleich"
              : `${inventoryMismatchCount} von ${inventoryComparisons.length}`,
          tone: inventoryMismatchCount > 0 ? "warning" : "positive",
        },
        {
          label: "Belastbar bewertbar",
          value: String(sufficientCount),
          tone: sufficientCount > 0 ? "positive" : "warning",
        },
        ...(includeCosts
          ? [{
              label: "Preisrichtlinie",
              value: `${formatNumber(pricingPolicy.minimumMarginPercent)} % / ${formatNumber(pricingPolicy.targetMarginPercent)} %`,
            }]
          : []),
      ],
      sections: [
        {
          title: "Materialvergleich",
          items: materialItems,
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
              ? ["Die genannten Mindest- und Zielpreise sind eine vorläufige Teilkostenberechnung aus den gespeicherten Materialkosten. Beschaffung, Lager, Verwaltung, Fahrzeuge und weitere Gemeinkosten sind noch nicht vollständig enthalten. Sie sind deshalb keine fertige Preisentscheidung."]
              : []),
            analysis.basisNote,
          ],
        },
      ],
    },
    deterministic: true,
  };
}
