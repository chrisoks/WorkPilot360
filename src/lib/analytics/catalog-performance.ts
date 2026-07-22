export type CatalogPerformanceItemType = "article" | "service" | "package" | "unknown";

export type CatalogPackageComponentSnapshot = {
  componentItemId: string;
  componentNumber: string;
  componentName: string;
  componentType: "article" | "service";
  componentUnit: string;
  quantityPerPackage: number;
  salesValuePerPackage: number;
  costValuePerPackage: number;
};

export type CatalogPerformanceCatalogItem = {
  id: string;
  type: "article" | "service" | "package";
  number?: string;
  name: string;
  unit?: string;
  purchasePrice?: number;
  planningMinutesPerUnit?: number;
  packageItems?: Array<{
    componentItemId: string;
    componentNumber?: string;
    componentName: string;
    componentType: "article" | "service" | "package";
    componentUnit?: string;
    quantity?: number;
    priceOverride?: number | null;
    purchasePriceSnapshot?: number | null;
    salesPriceSnapshot?: number | null;
    planningMinutesOverride?: number | null;
    componentPurchasePrice?: number;
    componentSalesPrice?: number;
    componentPlanningMinutesPerUnit?: number;
  }>;
};

export type CatalogPerformanceLine = {
  id?: string;
  catalogItemId?: string;
  catalogType?: string;
  quantity?: number;
  unit?: string;
  title?: string;
  unitPrice?: number;
  discountPercent?: number;
  materialCostSnapshot?: number;
  laborCostSnapshot?: number;
  costSnapshotAt?: string;
  packageComponentsSnapshot?: CatalogPackageComponentSnapshot[];
  catalogCostSnapshotVersion?: number;
  laborItems?: Array<{ totalCost?: number }>;
};

export type CatalogPerformanceInvoice = {
  id: string;
  invoiceNumber: string;
  projectId?: string;
  projectNumber?: string;
  projectTitle?: string;
  customerName?: string;
  serviceDate?: string;
  createdAt?: string;
  lines: CatalogPerformanceLine[];
};

export type CatalogPerformanceDetail = {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  projectId: string;
  projectLabel: string;
  customerName: string;
  serviceDate: string;
  catalogItemId: string;
  packageTitle: string;
  source: "direct" | "package";
  basis: "snapshot" | "reconstructed" | "missing";
  quantity: number;
  revenue: number;
  cost: number;
};

export type CatalogPerformanceRow = {
  key: string;
  id: string;
  title: string;
  type: CatalogPerformanceItemType;
  unit: string;
  quantity: number;
  directQuantity: number;
  packageQuantity: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
  invoiceCount: number;
  reconstructedCount: number;
  details: CatalogPerformanceDetail[];
};

export type CatalogPerformanceResult = {
  positionRows: CatalogPerformanceRow[];
  materialRows: CatalogPerformanceRow[];
  serviceRows: CatalogPerformanceRow[];
  packageRows: CatalogPerformanceRow[];
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  totalMarginPercent: number;
  reconstructedPackageLineCount: number;
  incompleteCostLineCount: number;
};

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getCatalogLineNetRevenue(line: CatalogPerformanceLine) {
  const quantity = numberValue(line.quantity);
  const unitPrice = numberValue(line.unitPrice);
  const discountPercent = Math.max(0, Math.min(100, numberValue(line.discountPercent)));
  return roundMoney(quantity * unitPrice * (1 - discountPercent / 100));
}

function getFallbackPackageComponents(
  catalogItem: CatalogPerformanceCatalogItem | undefined
): CatalogPackageComponentSnapshot[] {
  if (!catalogItem || catalogItem.type !== "package") return [];
  return (catalogItem.packageItems ?? [])
    .filter((item) => item.componentType === "article" || item.componentType === "service")
    .map((item) => {
      const componentType = item.componentType as "article" | "service";
      const planningMinutes = numberValue(
        item.planningMinutesOverride ?? item.componentPlanningMinutesPerUnit
      );
      const salesPrice = numberValue(
        item.priceOverride ?? item.salesPriceSnapshot ?? item.componentSalesPrice
      );
      const purchasePrice = numberValue(
        item.purchasePriceSnapshot ?? item.componentPurchasePrice
      );
      const materialQuantity = Math.max(0, numberValue(item.quantity));
      const quantityPerPackage = componentType === "service"
        ? Math.max(0, planningMinutes / 60)
        : materialQuantity;
      return {
        componentItemId: item.componentItemId,
        componentNumber: item.componentNumber ?? "",
        componentName: item.componentName,
        componentType,
        componentUnit: componentType === "service" ? "Std." : item.componentUnit ?? "",
        quantityPerPackage,
        salesValuePerPackage: componentType === "service"
          ? Math.max(0, salesPrice * planningMinutes / 60)
          : Math.max(0, salesPrice * materialQuantity),
        costValuePerPackage: componentType === "service"
          ? Math.max(0, purchasePrice * planningMinutes / 60)
          : Math.max(0, purchasePrice * materialQuantity),
      };
    });
}

function getDirectFallbackCosts(
  line: CatalogPerformanceLine,
  catalogItem: CatalogPerformanceCatalogItem | undefined
) {
  if (!catalogItem) return { material: 0, labor: 0 };
  const quantity = Math.max(0, numberValue(line.quantity));
  if (catalogItem.type === "article") {
    return { material: Math.max(0, numberValue(catalogItem.purchasePrice) * quantity), labor: 0 };
  }
  if (catalogItem.type === "service") {
    return {
      material: 0,
      labor: Math.max(
        0,
        numberValue(catalogItem.purchasePrice) * numberValue(catalogItem.planningMinutesPerUnit) / 60 * quantity
      ),
    };
  }
  const components = getFallbackPackageComponents(catalogItem);
  return components.reduce(
    (costs, component) => {
      costs[component.componentType === "service" ? "labor" : "material"] += component.costValuePerPackage * quantity;
      return costs;
    },
    { material: 0, labor: 0 }
  );
}

function getLineCost(
  line: CatalogPerformanceLine,
  catalogItem: CatalogPerformanceCatalogItem | undefined
) {
  const laborItemCost = (line.laborItems ?? []).reduce(
    (sum, item) => sum + Math.max(0, numberValue(item.totalCost)),
    0
  );
  const fallbackCosts = getDirectFallbackCosts(line, catalogItem);
  if (line.costSnapshotAt) {
    const materialCost = Math.max(0, numberValue(line.materialCostSnapshot));
    if (laborItemCost > 0) {
      return { cost: materialCost + laborItemCost, basis: "snapshot" as const };
    }
    if (numberValue(line.catalogCostSnapshotVersion) >= 1) {
      return {
        cost: materialCost + Math.max(0, numberValue(line.laborCostSnapshot)),
        basis: "snapshot" as const,
      };
    }
    if (catalogItem?.type === "service" || catalogItem?.type === "package") {
      return { cost: materialCost + fallbackCosts.labor, basis: "reconstructed" as const };
    }
    return { cost: materialCost, basis: "snapshot" as const };
  }
  return {
    cost: fallbackCosts.material + (laborItemCost > 0 ? laborItemCost : fallbackCosts.labor),
    basis: catalogItem ? "reconstructed" as const : "missing" as const,
  };
}

type MutableRow = Omit<CatalogPerformanceRow, "margin" | "marginPercent" | "invoiceCount"> & {
  invoiceIds: Set<string>;
};

function addRow(
  groups: Map<string, MutableRow>,
  input: {
    id: string;
    title: string;
    type: CatalogPerformanceItemType;
    unit: string;
    quantity: number;
    revenue: number;
    cost: number;
    detail: CatalogPerformanceDetail;
  }
) {
  const key = `${input.type}:${input.id || input.title}`;
  const row = groups.get(key) ?? {
    key,
    id: input.id,
    title: input.title,
    type: input.type,
    unit: input.unit,
    quantity: 0,
    directQuantity: 0,
    packageQuantity: 0,
    revenue: 0,
    cost: 0,
    reconstructedCount: 0,
    details: [],
    invoiceIds: new Set<string>(),
  };
  row.quantity += input.quantity;
  if (input.detail.source === "package") row.packageQuantity += input.quantity;
  else row.directQuantity += input.quantity;
  row.revenue += input.revenue;
  row.cost += input.cost;
  if (input.detail.basis !== "snapshot") row.reconstructedCount += 1;
  row.details.push(input.detail);
  row.invoiceIds.add(input.detail.invoiceId);
  groups.set(key, row);
}

function finalizeRows(groups: Map<string, MutableRow>) {
  return Array.from(groups.values())
    .map(({ invoiceIds, ...row }) => {
      const revenue = roundMoney(row.revenue);
      const cost = roundMoney(row.cost);
      const margin = roundMoney(revenue - cost);
      return {
        ...row,
        quantity: Math.round(row.quantity * 100) / 100,
        directQuantity: Math.round(row.directQuantity * 100) / 100,
        packageQuantity: Math.round(row.packageQuantity * 100) / 100,
        revenue,
        cost,
        margin,
        marginPercent: revenue > 0 ? Math.round((margin / revenue) * 10_000) / 100 : 0,
        invoiceCount: invoiceIds.size,
      };
    })
    .sort((first, second) => second.revenue - first.revenue || first.title.localeCompare(second.title, "de"));
}

export function buildCatalogPerformance(
  invoices: CatalogPerformanceInvoice[],
  catalogItems: CatalogPerformanceCatalogItem[]
): CatalogPerformanceResult {
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  const positionGroups = new Map<string, MutableRow>();
  const componentGroups = new Map<string, MutableRow>();
  let reconstructedPackageLineCount = 0;
  let incompleteCostLineCount = 0;

  invoices.forEach((invoice) => {
    invoice.lines.forEach((line, lineIndex) => {
      const catalogItem = line.catalogItemId ? catalogById.get(line.catalogItemId) : undefined;
      const type = line.catalogType === "article" || line.catalogType === "service" || line.catalogType === "package"
        ? line.catalogType
        : catalogItem?.type ?? "unknown";
      const quantity = numberValue(line.quantity);
      const revenue = getCatalogLineNetRevenue(line);
      const lineCost = getLineCost(line, catalogItem);
      if (lineCost.basis === "missing") incompleteCostLineCount += 1;
      const commonDetail = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        projectId: invoice.projectId ?? "",
        projectLabel: invoice.projectNumber || invoice.projectTitle || "-",
        customerName: invoice.customerName ?? "",
        serviceDate: invoice.serviceDate || invoice.createdAt || "",
      };

      addRow(positionGroups, {
        id: line.catalogItemId || `${invoice.id}:${line.id || lineIndex}`,
        title: line.title || catalogItem?.name || "Freie Position",
        type,
        unit: line.unit || catalogItem?.unit || "",
        quantity,
        revenue,
        cost: lineCost.cost,
        detail: {
          key: `${invoice.id}:${line.id || lineIndex}:direct`,
          ...commonDetail,
          catalogItemId: line.catalogItemId ?? "",
          packageTitle: "",
          source: "direct",
          basis: lineCost.basis,
          quantity,
          revenue,
          cost: lineCost.cost,
        },
      });

      if (type !== "package") {
        if (type === "article" || type === "service") {
          addRow(componentGroups, {
            id: line.catalogItemId || `${invoice.id}:${line.id || lineIndex}`,
            title: line.title || catalogItem?.name || "Freie Position",
            type,
            unit: line.unit || catalogItem?.unit || "",
            quantity,
            revenue,
            cost: lineCost.cost,
            detail: {
              key: `${invoice.id}:${line.id || lineIndex}:component`,
              ...commonDetail,
              catalogItemId: line.catalogItemId ?? "",
              packageTitle: "",
              source: "direct",
              basis: lineCost.basis,
              quantity,
              revenue,
              cost: lineCost.cost,
            },
          });
        }
        return;
      }

      const storedComponents = Array.isArray(line.packageComponentsSnapshot)
        ? line.packageComponentsSnapshot
        : [];
      const components = storedComponents.length > 0
        ? storedComponents
        : getFallbackPackageComponents(catalogItem);
      const componentBasis = storedComponents.length > 0 ? "snapshot" as const : catalogItem ? "reconstructed" as const : "missing" as const;
      if (componentBasis !== "snapshot") reconstructedPackageLineCount += 1;
      const packageSalesValue = components.reduce(
        (sum, component) => sum + Math.max(0, numberValue(component.salesValuePerPackage)),
        0
      );
      const packageCostValue = components.reduce(
        (sum, component) => sum + Math.max(0, numberValue(component.costValuePerPackage)),
        0
      );

      components.forEach((component, componentIndex) => {
        const salesShare = packageSalesValue > 0
          ? Math.max(0, numberValue(component.salesValuePerPackage)) / packageSalesValue
          : components.length > 0 ? 1 / components.length : 0;
        const costShare = packageCostValue > 0
          ? Math.max(0, numberValue(component.costValuePerPackage)) / packageCostValue
          : salesShare;
        const componentQuantity = quantity * Math.max(0, numberValue(component.quantityPerPackage));
        const componentRevenue = revenue * salesShare;
        const componentCost = lineCost.cost * costShare;
        addRow(componentGroups, {
          id: component.componentItemId || `${line.catalogItemId}:component:${componentIndex}`,
          title: component.componentName || "Paketbestandteil",
          type: component.componentType,
          unit: component.componentUnit || "",
          quantity: componentQuantity,
          revenue: componentRevenue,
          cost: componentCost,
          detail: {
            key: `${invoice.id}:${line.id || lineIndex}:package:${component.componentItemId || componentIndex}`,
            ...commonDetail,
            catalogItemId: component.componentItemId,
            packageTitle: line.title || catalogItem?.name || "Paket",
            source: "package",
            basis: componentBasis,
            quantity: componentQuantity,
            revenue: componentRevenue,
            cost: componentCost,
          },
        });
      });
    });
  });

  const positionRows = finalizeRows(positionGroups);
  const componentRows = finalizeRows(componentGroups);
  const totalRevenue = roundMoney(positionRows.reduce((sum, row) => sum + row.revenue, 0));
  const totalCost = roundMoney(positionRows.reduce((sum, row) => sum + row.cost, 0));
  const totalMargin = roundMoney(totalRevenue - totalCost);
  return {
    positionRows,
    materialRows: componentRows.filter((row) => row.type === "article"),
    serviceRows: componentRows.filter((row) => row.type === "service"),
    packageRows: positionRows.filter((row) => row.type === "package"),
    totalRevenue,
    totalCost,
    totalMargin,
    totalMarginPercent: totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 10_000) / 100 : 0,
    reconstructedPackageLineCount,
    incompleteCostLineCount,
  };
}
