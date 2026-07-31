import type { Prisma, PrismaClient } from "@prisma/client";
import type { CatalogPackageComponentSnapshot } from "@/lib/analytics/catalog-performance";

type InvoiceMaterialLine = {
  catalogItemId: string;
  catalogType: string;
  quantity: number;
  packageComponentsSnapshot: unknown;
};

const INACTIVE_INVOICE_STATUSES = new Set([
  "Entwurf",
  "Storniert",
  "Stornorechnung",
  "Gelöscht",
  "Geloescht",
  "deleted",
]);

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getInvoiceArticleQuantities(lines: InvoiceMaterialLine[]) {
  const quantities = new Map<string, number>();
  const add = (itemId: string, quantity: number) => {
    if (!itemId || quantity <= 0) return;
    quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
  };

  for (const line of lines) {
    const lineQuantity = Math.max(0, finite(line.quantity));
    if (line.catalogType === "article") {
      add(line.catalogItemId, lineQuantity);
    }
    if (line.catalogType !== "package" || !Array.isArray(line.packageComponentsSnapshot)) continue;
    for (const rawComponent of line.packageComponentsSnapshot) {
      const component = rawComponent as Partial<CatalogPackageComponentSnapshot>;
      if (component.componentType !== "article") continue;
      add(
        String(component.componentItemId ?? ""),
        lineQuantity * Math.max(0, finite(component.quantityPerPackage))
      );
    }
  }
  return quantities;
}

function inventoryDate(serviceDate: string, fallback: Date) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return new Date(`${serviceDate}T12:00:00.000Z`);
  }
  return fallback;
}

export async function syncInvoiceInventoryMovements(input: {
  db: PrismaClient | Prisma.TransactionClient;
  organizationId: string;
  invoiceId: string;
  actorUserId?: string;
  actorName?: string;
  catalogItemIds?: string[];
  useExistingTransaction?: boolean;
}) {
  const invoice = await input.db.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: input.organizationId },
    include: { lines: true },
  });
  if (!invoice) return;

  const project = await input.db.workPilotProject.findFirst({
    where: { id: invoice.projectId, organizationId: input.organizationId },
    select: { contactId: true },
  });
  const desiredArticles = INACTIVE_INVOICE_STATUSES.has(invoice.status)
    ? new Map<string, number>()
    : getInvoiceArticleQuantities(invoice.lines).entries();
  const desired = new Map<string, number>(
    Array.from(desiredArticles, ([itemId, quantity]): [string, number] => [itemId, -quantity]).filter(
      ([itemId]) => !input.catalogItemIds?.length || input.catalogItemIds.includes(itemId)
    )
  );
  const existing = await input.db.catalogInventoryMovement.groupBy({
    by: ["catalogItemId"],
    where: {
      organizationId: input.organizationId,
      referenceType: "invoice",
      referenceId: invoice.id,
      ...(input.catalogItemIds?.length ? { catalogItemId: { in: input.catalogItemIds } } : {}),
    },
    _sum: { quantityDelta: true },
  });
  const current = new Map(
    existing.map((entry) => [entry.catalogItemId, finite(entry._sum.quantityDelta)])
  );
  const itemIds = new Set([...desired.keys(), ...current.keys()]);
  const occurredAt = inventoryDate(invoice.serviceDate, invoice.createdAt);

  const applyChanges = async (tx: Prisma.TransactionClient) => {
    for (const catalogItemId of itemIds) {
      const delta = finite(desired.get(catalogItemId)) - finite(current.get(catalogItemId));
      if (Math.abs(delta) < 0.000001) continue;
      await tx.catalogInventoryMovement.create({
        data: {
          organizationId: input.organizationId,
          catalogItemId,
          movementType: delta < 0 ? "sale" : "reversal",
          quantityDelta: delta,
          occurredAt,
          referenceType: "invoice",
          referenceId: invoice.id,
          referenceNumber: invoice.invoiceNumber,
          customerId: project?.contactId ?? "",
          customerName: invoice.customerName,
          projectId: invoice.projectId,
          projectNumber: invoice.projectNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          actorUserId: input.actorUserId || null,
          actorName: input.actorName ?? "",
          note:
            delta < 0
              ? "Automatische Materialentnahme durch fakturierte Rechnung"
              : "Automatische Gegenbuchung der Materialentnahme",
        },
      });
      await tx.$executeRaw`
        UPDATE "CatalogItem"
        SET "stockQuantity" = COALESCE("stockQuantity", 0) + ${delta},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "organizationId" = ${input.organizationId} AND "id" = ${catalogItemId}
      `;
    }
  };
  if (input.useExistingTransaction) {
    await applyChanges(input.db as Prisma.TransactionClient);
  } else {
    await (input.db as PrismaClient).$transaction(applyChanges);
  }
}
