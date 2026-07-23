import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { canManageCatalogItems, canViewCustomerRevenueAnalytics } from "@/lib/permissions";

const receiptSchema = z.object({
  actorId: z.string().optional(),
  catalogItemId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  occurredAt: z.string().min(1),
  supplierName: z.string().optional(),
  referenceNumber: z.string().optional(),
  note: z.string().optional(),
});

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function actorName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function seasonRange(now = new Date()) {
  const startYear = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    label: `${startYear}/${String(startYear + 1).slice(-2)}`,
    from: new Date(Date.UTC(startYear, 9, 1)),
    to: new Date(Date.UTC(startYear + 1, 4, 1)),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, url.searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Lagerkennzahlen nicht einsehen." }, { status: 403 });
  }

  const catalogItemId = clean(url.searchParams.get("catalogItemId"));
  const item = await prisma.catalogItem.findFirst({
    where: catalogItemId
      ? { id: catalogItemId, organizationId: organization.id }
      : { number: "OKI0448", organizationId: organization.id },
    select: { id: true, number: true, name: true, unit: true, stockQuantity: true },
  });
  if (!item) return NextResponse.json({ error: "Der Streugutartikel wurde nicht gefunden." }, { status: 404 });

  const season = seasonRange();
  const [seasonMovements, recentMovements] = await Promise.all([
    prisma.catalogInventoryMovement.findMany({
      where: {
        organizationId: organization.id,
        catalogItemId: item.id,
        occurredAt: { gte: season.from, lt: season.to },
      },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.catalogInventoryMovement.findMany({
      where: { organizationId: organization.id, catalogItemId: item.id },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);
  const purchasedKg = seasonMovements
    .filter((entry) => entry.movementType === "purchase")
    .reduce((sum, entry) => sum + Math.max(0, entry.quantityDelta), 0);
  const soldKg = -seasonMovements
    .filter((entry) => ["sale", "reversal"].includes(entry.movementType))
    .reduce((sum, entry) => sum + entry.quantityDelta, 0);
  const customers = new Map<string, { customerId: string; customerName: string; soldKg: number }>();
  for (const movement of seasonMovements) {
    if (!movement.customerId || !["sale", "reversal"].includes(movement.movementType)) continue;
    const current = customers.get(movement.customerId) ?? {
      customerId: movement.customerId,
      customerName: movement.customerName || movement.customerId,
      soldKg: 0,
    };
    current.soldKg -= movement.quantityDelta;
    customers.set(movement.customerId, current);
  }

  return NextResponse.json({
    item,
    season: { label: season.label, from: season.from.toISOString(), to: season.to.toISOString() },
    summary: {
      purchasedKg,
      soldKg,
      differenceKg: purchasedKg - soldKg,
      stockQuantity: item.stockQuantity ?? 0,
    },
    customers: Array.from(customers.values()).sort((a, b) => b.soldKg - a.soldKg),
    movements: recentMovements,
  });
}

export async function POST(req: Request) {
  const body = receiptSchema.parse(await req.json());
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageCatalogItems(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Lagerbewegungen nicht buchen." }, { status: 403 });
  }
  const item = await prisma.catalogItem.findFirst({
    where: { id: body.catalogItemId, organizationId: organization.id, type: "article" },
  });
  if (!item) return NextResponse.json({ error: "Artikel wurde nicht gefunden." }, { status: 404 });
  const occurredAt = new Date(body.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "Buchungsdatum ist ungültig." }, { status: 400 });
  }

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.catalogInventoryMovement.create({
      data: {
        id: randomUUID(),
        organizationId: organization.id,
        catalogItemId: item.id,
        movementType: "purchase",
        quantityDelta: body.quantity,
        unitCost: body.unitCost,
        occurredAt,
        referenceType: "purchase",
        referenceId: randomUUID(),
        referenceNumber: clean(body.referenceNumber),
        actorUserId: actorResult.actor.id,
        actorName: actorName(actorResult.actor),
        supplierName: clean(body.supplierName) || item.supplierName || "",
        note: clean(body.note),
      },
    });
    await tx.$executeRaw`
      UPDATE "CatalogItem"
      SET "stockQuantity" = COALESCE("stockQuantity", 0) + ${body.quantity},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id} AND "id" = ${item.id}
    `;
    return created;
  });
  return NextResponse.json(movement);
}
