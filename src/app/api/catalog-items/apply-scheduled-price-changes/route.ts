import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canManageCatalogItems } from "@/lib/permissions";

type DueCatalogPriceRow = {
  id: string;
  organizationId: string;
  type: string;
  number: string;
  name: string;
  purchasePrice: number;
  salesPrice: number;
  salesPriceCalculationMode: string;
  salesRatePerHour: number | null;
  planningMinutesPerUnit: number;
  scheduledSalesPrice: number;
  scheduledSalesRatePerHour: number | null;
  scheduledSalesPriceValidFrom: Date;
  scheduledSalesPriceUpdatePackages: boolean;
};

function getActorName(actor: User) {
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasCronAuthorization(req: Request) {
  const configuredSecret =
    process.env.CATALOG_PRICE_CRON_SECRET ||
    process.env.WORKPILOT_CRON_SECRET ||
    process.env.CRON_SECRET ||
    "";
  if (!configuredSecret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${configuredSecret}`;
}

async function ensureScheduledPriceColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "CatalogItem"
    ADD COLUMN IF NOT EXISTS "salesPriceCalculationMode" TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS "salesRatePerHour" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "scheduledSalesRatePerHour" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "scheduledSalesPrice" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "scheduledSalesPriceValidFrom" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "scheduledSalesPriceCreatedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "scheduledSalesPriceUpdatePackages" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "lastSalesPriceChangedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastSalesPriceOldValue" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "lastSalesPriceNewValue" DOUBLE PRECISION
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CatalogItemHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "catalogItemId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "fieldName" TEXT,
      "oldValue" TEXT,
      "newValue" TEXT,
      "actorUserId" TEXT,
      "actorName" TEXT,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function getDuePriceChanges(organizationId: string, catalogItemId?: string) {
  if (catalogItemId) {
    return prisma.$queryRaw<DueCatalogPriceRow[]>`
      SELECT "id", "organizationId", "type", "number", "name", "purchasePrice", "salesPrice", "salesPriceCalculationMode", "salesRatePerHour", "planningMinutesPerUnit", "scheduledSalesPrice", "scheduledSalesRatePerHour", "scheduledSalesPriceValidFrom", "scheduledSalesPriceUpdatePackages"
      FROM "CatalogItem"
      WHERE "organizationId" = ${organizationId}
        AND "id" = ${catalogItemId}
        AND "scheduledSalesPrice" IS NOT NULL
        AND "scheduledSalesPriceValidFrom" IS NOT NULL
        AND "scheduledSalesPriceValidFrom" <= CURRENT_TIMESTAMP
      ORDER BY "scheduledSalesPriceValidFrom" ASC, "number" ASC
    `;
  }

  return prisma.$queryRaw<DueCatalogPriceRow[]>`
    SELECT "id", "organizationId", "type", "number", "name", "purchasePrice", "salesPrice", "salesPriceCalculationMode", "salesRatePerHour", "planningMinutesPerUnit", "scheduledSalesPrice", "scheduledSalesRatePerHour", "scheduledSalesPriceValidFrom", "scheduledSalesPriceUpdatePackages"
    FROM "CatalogItem"
    WHERE "organizationId" = ${organizationId}
      AND "scheduledSalesPrice" IS NOT NULL
      AND "scheduledSalesPriceValidFrom" IS NOT NULL
      AND "scheduledSalesPriceValidFrom" <= CURRENT_TIMESTAMP
    ORDER BY "scheduledSalesPriceValidFrom" ASC, "number" ASC
  `;
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureScheduledPriceColumns();

  const body = await req.json().catch(() => ({}));
  const apply = body.apply === true;
  const catalogItemId = cleanString(body.catalogItemId);
  const hasCronAuth = hasCronAuthorization(req);
  let actorUserId: string | null = null;
  let actorName = hasCronAuth ? "Automatiklauf" : "";

  if (!hasCronAuth) {
    const actorResult = await getSessionBoundActor(req, users, body.actorId ?? body.actorUserId);
    if (!actorResult.ok) {
      return sessionBoundActorResponse(actorResult);
    }
    const actor = actorResult.actor;
    if (!canManageCatalogItems(actor)) {
      return NextResponse.json(
        { error: "Nur Admins und Geschaeftsfuehrung duerfen geplante Preisänderungen übernehmen." },
        { status: 403 }
      );
    }
    actorUserId = actor.id;
    actorName = getActorName(actor);
  }

  const dueItems = await getDuePriceChanges(organization.id, catalogItemId || undefined);
  if (!apply) {
    return NextResponse.json({
      success: true,
      applied: false,
      dueCount: dueItems.length,
      items: dueItems.map((item) => ({
        id: item.id,
        number: item.number,
        name: item.name,
        oldSalesPrice: item.salesPrice,
        newSalesPrice: item.scheduledSalesPrice,
        validFrom: item.scheduledSalesPriceValidFrom.toISOString(),
      })),
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const item of dueItems) {
      await tx.$executeRaw`
        UPDATE "CatalogItem"
        SET
          "salesPrice" = ${item.scheduledSalesPrice},
          "salesRatePerHour" = CASE
            WHEN "salesPriceCalculationMode" = 'time_based' THEN ${item.scheduledSalesRatePerHour}
            ELSE "salesRatePerHour"
          END,
          "lastSalesPriceChangedAt" = CURRENT_TIMESTAMP,
          "lastSalesPriceOldValue" = ${item.salesPrice},
          "lastSalesPriceNewValue" = ${item.scheduledSalesPrice},
          "scheduledSalesPrice" = NULL,
          "scheduledSalesRatePerHour" = NULL,
          "scheduledSalesPriceValidFrom" = NULL,
          "scheduledSalesPriceCreatedAt" = NULL,
          "scheduledSalesPriceUpdatePackages" = false,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${item.id}
          AND "organizationId" = ${organization.id}
      `;

      if (item.scheduledSalesPriceUpdatePackages) {
        await tx.$executeRaw`
          UPDATE "CatalogPackageItem"
          SET
            "purchasePriceSnapshot" = ${item.purchasePrice},
            "salesPriceSnapshot" = ${item.scheduledSalesPrice},
            "planningMinutesOverride" = CASE
              WHEN ${item.type} = 'service' THEN ${item.planningMinutesPerUnit}
              ELSE "planningMinutesOverride"
            END,
            "priceOverride" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "organizationId" = ${organization.id}
            AND "componentItemId" = ${item.id}
        `;
      }

      await tx.$executeRaw`
        INSERT INTO "CatalogItemHistory" (
          "id", "organizationId", "catalogItemId", "eventType", "fieldName",
          "oldValue", "newValue", "actorUserId", "actorName", "note", "createdAt"
        )
        VALUES (
          ${randomUUID()}, ${organization.id}, ${item.id}, 'scheduled-price-applied', 'Verkaufspreis',
          ${String(item.salesPrice)}, ${String(item.scheduledSalesPrice)}, ${actorUserId}, ${actorName},
          ${`Geplante Preisänderung ab ${item.scheduledSalesPriceValidFrom.toLocaleDateString("de-DE")} übernommen.`},
          CURRENT_TIMESTAMP
        )
      `;
    }
  });

  return NextResponse.json({
    success: true,
    applied: true,
    appliedCount: dueItems.length,
    items: dueItems.map((item) => ({
      id: item.id,
      number: item.number,
      name: item.name,
      oldSalesPrice: item.salesPrice,
      newSalesPrice: item.scheduledSalesPrice,
      validFrom: item.scheduledSalesPriceValidFrom.toISOString(),
    })),
  });
}
