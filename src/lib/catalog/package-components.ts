import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type CatalogPackageValidationDb = Prisma.TransactionClient | typeof prisma;

export type ValidatedCatalogPackageComponent = {
  componentItemId: string;
  quantity: number;
  position: number;
  descriptionOverride: string | null;
  priceOverride: number | null;
  purchasePriceSnapshot: number | null;
  salesPriceSnapshot: number | null;
  planningMinutesOverride: number | null;
};

export class CatalogPackageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogPackageValidationError";
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNonNegativeNumber(value: unknown, label: string) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new CatalogPackageValidationError(`${label} muss eine Zahl größer oder gleich 0 sein.`);
  }
  return parsed;
}

function optionalNonNegativeInteger(value: unknown, label: string) {
  const parsed = optionalNonNegativeNumber(value, label);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) {
    throw new CatalogPackageValidationError(`${label} muss eine ganze Zahl sein.`);
  }
  return parsed;
}

export async function validateCatalogPackageComponents(input: {
  organizationId: string;
  components: unknown;
  db?: CatalogPackageValidationDb;
}): Promise<ValidatedCatalogPackageComponent[]> {
  if (!Array.isArray(input.components) || input.components.length === 0) {
    throw new CatalogPackageValidationError("Ein Paket benötigt mindestens einen gültigen Artikel oder eine gültige Leistung.");
  }

  const components = input.components.map((component, index) => {
    if (!component || typeof component !== "object" || Array.isArray(component)) {
      throw new CatalogPackageValidationError(`Paketbestandteil ${index + 1} ist unvollständig.`);
    }
    const row = component as Record<string, unknown>;
    const componentItemId = clean(row.componentItemId);
    if (!componentItemId) {
      throw new CatalogPackageValidationError(`Bitte wähle für Paketbestandteil ${index + 1} einen Artikel oder eine Leistung aus.`);
    }
    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new CatalogPackageValidationError(`Die Menge von Paketbestandteil ${index + 1} muss größer als 0 sein.`);
    }
    const position = row.position === "" || row.position === null || row.position === undefined
      ? index
      : Number(row.position);
    if (!Number.isInteger(position) || position < 0) {
      throw new CatalogPackageValidationError(`Die Position von Paketbestandteil ${index + 1} muss eine ganze Zahl größer oder gleich 0 sein.`);
    }
    return {
      componentItemId,
      quantity,
      position,
      descriptionOverride: clean(row.descriptionOverride) || null,
      priceOverride: optionalNonNegativeNumber(row.priceOverride, `Der abweichende Verkaufspreis von Paketbestandteil ${index + 1}`),
      purchasePriceSnapshot: optionalNonNegativeNumber(row.purchasePriceSnapshot, `Der EK-Snapshot von Paketbestandteil ${index + 1}`),
      salesPriceSnapshot: optionalNonNegativeNumber(row.salesPriceSnapshot, `Der VK-Snapshot von Paketbestandteil ${index + 1}`),
      planningMinutesOverride: optionalNonNegativeInteger(row.planningMinutesOverride, `Die Planungszeit von Paketbestandteil ${index + 1}`),
    };
  });

  const duplicateIds = components
    .map((component) => component.componentItemId)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new CatalogPackageValidationError("Jeder Artikel und jede Leistung darf in einem Paket nur einmal enthalten sein.");
  }

  const db = input.db ?? prisma;
  const catalogItems = await db.catalogItem.findMany({
    where: {
      organizationId: input.organizationId,
      id: { in: components.map((component) => component.componentItemId) },
    },
    select: { id: true, number: true, name: true, type: true, isActive: true },
  });
  const catalogItemById = new Map(catalogItems.map((item) => [item.id, item]));

  for (const [index, component] of components.entries()) {
    const catalogItem = catalogItemById.get(component.componentItemId);
    if (!catalogItem) {
      throw new CatalogPackageValidationError(`Paketbestandteil ${index + 1} wurde in der aktuellen Organisation nicht gefunden.`);
    }
    if (!catalogItem.isActive) {
      throw new CatalogPackageValidationError(`${catalogItem.number} · ${catalogItem.name} ist deaktiviert und kann nicht als Paketbestandteil verwendet werden.`);
    }
    if (catalogItem.type !== "article" && catalogItem.type !== "service") {
      throw new CatalogPackageValidationError("Pakete dürfen nicht in andere Pakete verschachtelt werden. Erlaubt sind ausschließlich Artikel und Leistungen.");
    }
  }

  return components;
}
