import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canManageCatalogItems } from "@/lib/permissions";
import { getNextWinterServiceCatalogNumber as selectNextWinterServiceCatalogNumber } from "@/lib/winter-service/catalog-number";
import {
  getCatalogReviewStatusAfterEdit,
  hasCatalogPackageReviewRelevantChange,
  hasCatalogReviewRelevantChange,
  normalizeCatalogReviewStatus,
} from "@/lib/catalog/review-status";

type CatalogItemRow = {
  id: string;
  organizationId: string;
  type: string;
  number: string;
  name: string;
  category: string | null;
  trade: string | null;
  unit: string;
  description: string | null;
  matchcode: string | null;
  ean: string | null;
  costCenter: string | null;
  supplierName: string | null;
  supplierNumber: string | null;
  manufacturer: string | null;
  manufacturerNumber: string | null;
  manufacturerTypeName: string | null;
  minimumOrderQuantity: number | null;
  quantityScale: string | null;
  priceUnit: string | null;
  deliveryTime: string | null;
  stockQuantity: number | null;
  purchasePrice: number;
  laborCostRateKey: string | null;
  listPrice: number;
  salesPrice: number;
  scheduledSalesPrice: number | null;
  scheduledSalesPriceValidFrom: Date | null;
  scheduledSalesPriceCreatedAt: Date | null;
  scheduledSalesPriceUpdatePackages: boolean;
  lastSalesPriceChangedAt: Date | null;
  lastSalesPriceOldValue: number | null;
  lastSalesPriceNewValue: number | null;
  vatRate: number;
  isLaborPosition: boolean;
  isPlanningRelevant: boolean;
  planningMinutesPerUnit: number;
  defaultPlanningBoard: string | null;
  defaultPlanningGroup: string | null;
  reviewStatus: string;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  isActive: boolean;
  usedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type CatalogHistoryRow = {
  id: string;
  organizationId: string;
  catalogItemId: string;
  eventType: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  actorUserId: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: Date;
};

type CatalogPackageItemRow = {
  id: string;
  organizationId: string;
  packageId: string;
  componentItemId: string;
  quantity: number;
  position: number;
  descriptionOverride: string | null;
  priceOverride: number | null;
  purchasePriceSnapshot: number | null;
  salesPriceSnapshot: number | null;
  planningMinutesOverride: number | null;
  createdAt: Date;
  updatedAt: Date;
  componentNumber: string;
  componentName: string;
  componentType: string;
  componentUnit: string;
  componentPurchasePrice: number;
  componentSalesPrice: number;
  componentPlanningMinutesPerUnit: number;
  componentIsActive: boolean;
};

let catalogTablesReady: Promise<void> | null = null;

async function initializeCatalogTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CatalogItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'article',
      "number" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT,
      "trade" TEXT NOT NULL DEFAULT '',
      "unit" TEXT NOT NULL DEFAULT 'Stk',
      "description" TEXT,
      "matchcode" TEXT,
      "ean" TEXT,
      "costCenter" TEXT,
      "supplierName" TEXT,
      "supplierNumber" TEXT,
      "manufacturer" TEXT,
      "manufacturerNumber" TEXT,
      "manufacturerTypeName" TEXT,
      "minimumOrderQuantity" DOUBLE PRECISION,
      "quantityScale" TEXT,
      "priceUnit" TEXT,
      "deliveryTime" TEXT,
      "stockQuantity" DOUBLE PRECISION,
      "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "laborCostRateKey" TEXT NOT NULL DEFAULT '',
      "listPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "salesPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "isLaborPosition" BOOLEAN NOT NULL DEFAULT false,
      "isPlanningRelevant" BOOLEAN NOT NULL DEFAULT false,
      "planningMinutesPerUnit" INTEGER NOT NULL DEFAULT 0,
      "defaultPlanningBoard" TEXT,
      "defaultPlanningGroup" TEXT,
      "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
      "reviewedAt" TIMESTAMP(3),
      "reviewedByUserId" TEXT,
      "reviewedByName" TEXT,
      "reviewNote" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "usedCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CatalogItem"
    ADD COLUMN IF NOT EXISTS "laborCostRateKey" TEXT NOT NULL DEFAULT ''
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CatalogItem"
    ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
    ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "reviewedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "reviewNote" TEXT
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "CatalogItem_organizationId_reviewStatus_idx"
    ON "CatalogItem" ("organizationId", "reviewStatus")
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CatalogItem"
    ADD COLUMN IF NOT EXISTS "trade" TEXT NOT NULL DEFAULT ''
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CatalogItem"
    ADD COLUMN IF NOT EXISTS "isLaborPosition" BOOLEAN NOT NULL DEFAULT false
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CatalogItem"
    ADD COLUMN IF NOT EXISTS "scheduledSalesPrice" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "scheduledSalesPriceValidFrom" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "scheduledSalesPriceCreatedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "scheduledSalesPriceUpdatePackages" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "lastSalesPriceChangedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastSalesPriceOldValue" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "lastSalesPriceNewValue" DOUBLE PRECISION
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "SchemaDataPatch" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    UPDATE "CatalogItem"
    SET "isLaborPosition" = true
    WHERE "type" = 'service'
      AND NOT EXISTS (
        SELECT 1 FROM "SchemaDataPatch" WHERE "key" = 'catalog-items-labor-position-backfill'
      )
  `;

  await prisma.$executeRaw`
    INSERT INTO "SchemaDataPatch" ("key")
    VALUES ('catalog-items-labor-position-backfill')
    ON CONFLICT ("key") DO NOTHING
  `;

  await prisma.$executeRaw`
    UPDATE "CatalogItem"
    SET "trade" = CASE
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%hausmeister%' THEN 'Hausmeisterservice'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%grün%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%gruen%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%garten%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%rasen%' THEN 'Grünflächen- und Gartenpflege'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%dach%' THEN 'Dachreinigung'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%fassade%' THEN 'Fassadenreinigung'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%glas%' THEN 'Glasreinigung'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%unterhaltsreinigung%' THEN 'Unterhaltsreinigung'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%winter%' THEN 'Winterdienst'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%arbeitssicherheit%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%brandschutz%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%leiterprüfung%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%lärmmessung%' THEN 'Arbeitssicherheit'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%marketing%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%social%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%homepage%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%content%' THEN 'Marketing'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%hr%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%azubi%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%karriere%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%talent%'
        OR LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%sourcing%' THEN 'HR'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%objektbetreuung%' THEN 'Objektbetreuung'
      WHEN LOWER(COALESCE("name", '') || ' ' || COALESCE("category", '')) LIKE '%trockeneis%' THEN 'Trockeneisstrahlen'
      ELSE "trade"
    END
    WHERE "type" = 'service'
      AND COALESCE("trade", '') = ''
      AND NOT EXISTS (
        SELECT 1 FROM "SchemaDataPatch" WHERE "key" = 'catalog-items-trade-backfill-v1'
      )
  `;

  await prisma.$executeRaw`
    INSERT INTO "SchemaDataPatch" ("key")
    VALUES ('catalog-items-trade-backfill-v1')
    ON CONFLICT ("key") DO NOTHING
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "CatalogItem_organizationId_number_key"
    ON "CatalogItem" ("organizationId", "number")
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "CatalogItem_winter_service_dedupe_key"
    ON "CatalogItem" ("organizationId", "matchcode")
    WHERE "matchcode" LIKE 'WINTER:%'
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

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CatalogPackageItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "packageId" TEXT NOT NULL,
      "componentItemId" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
      "position" INTEGER NOT NULL DEFAULT 0,
      "descriptionOverride" TEXT,
      "priceOverride" DOUBLE PRECISION,
      "purchasePriceSnapshot" DOUBLE PRECISION,
      "salesPriceSnapshot" DOUBLE PRECISION,
      "planningMinutesOverride" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CatalogPackageItem"
    ADD COLUMN IF NOT EXISTS "purchasePriceSnapshot" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "salesPriceSnapshot" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "planningMinutesOverride" INTEGER
  `;

  await prisma.$executeRaw`
    UPDATE "CatalogPackageItem" pi
    SET
      "purchasePriceSnapshot" = COALESCE(pi."purchasePriceSnapshot", ci."purchasePrice"),
      "salesPriceSnapshot" = COALESCE(pi."salesPriceSnapshot", ci."salesPrice"),
      "planningMinutesOverride" = COALESCE(
        pi."planningMinutesOverride",
        CASE
          WHEN ci."type" = 'service'
          THEN GREATEST(0, ROUND(ci."planningMinutesPerUnit" * pi."quantity")::int)
          ELSE ci."planningMinutesPerUnit"
        END
      )
    FROM "CatalogItem" ci
    WHERE ci."id" = pi."componentItemId"
      AND (
        pi."purchasePriceSnapshot" IS NULL
        OR pi."salesPriceSnapshot" IS NULL
        OR pi."planningMinutesOverride" IS NULL
      )
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getActorName(actor: User) {
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

function forbiddenCatalogManagementResponse() {
  return NextResponse.json(
    { error: "Nur Admins und Geschaeftsfuehrung duerfen Katalog-Stammdaten verwalten." },
    { status: 403 }
  );
}

function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown } };
  return candidate.code === "P2002" || (candidate.code === "P2010" && candidate.meta?.code === "23505");
}

function nullableString(value: unknown) {
  const valueAsString = cleanString(value);
  return valueAsString || null;
}

function parseNumber(value: unknown, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensureCatalogTables() {
  if (!catalogTablesReady) {
    catalogTablesReady = initializeCatalogTables().catch((error) => {
      catalogTablesReady = null;
      throw error;
    });
  }
  await catalogTablesReady;
}

function parseNullableDate(value: unknown) {
  const valueAsString = cleanString(value);
  if (!valueAsString) return null;
  const parsed = valueAsString.includes("T") ? new Date(valueAsString) : new Date(`${valueAsString}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateScheduledSalesPrice(body: Record<string, unknown>) {
  const scheduledSalesPrice = parseNullableNumber(body.scheduledSalesPrice);
  const scheduledSalesPriceValidFrom = parseNullableDate(body.scheduledSalesPriceValidFrom);
  if (scheduledSalesPrice === null && scheduledSalesPriceValidFrom === null) {
    return { ok: true as const, scheduledSalesPrice, scheduledSalesPriceValidFrom };
  }
  if (scheduledSalesPrice === null || scheduledSalesPrice <= 0) {
    return { ok: false as const, error: "Bitte einen neuen Verkaufspreis groesser 0 angeben." };
  }
  if (!scheduledSalesPriceValidFrom) {
    return { ok: false as const, error: "Bitte ein gueltiges Wirksamkeitsdatum fuer den neuen Verkaufspreis angeben." };
  }
  return { ok: true as const, scheduledSalesPrice, scheduledSalesPriceValidFrom };
}

function parseInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function parseNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function cleanType(value: unknown) {
  const valueAsString = cleanString(value);
  if (valueAsString === "service" || valueAsString === "package") return valueAsString;
  return "article";
}

function normalizeUnit(value: unknown) {
  const unit = cleanString(value);
  const aliases: Record<string, string> = {
    h: "Std",
    std: "Std",
    stunde: "Std",
    stunden: "Std",
    stk: "Stk",
    stück: "Stk",
    stueck: "Stk",
    pauschale: "Pauschal",
    pauschal: "Pauschal",
    liter: "L",
    ltr: "L",
  };
  return aliases[unit.toLowerCase()] ?? unit;
}

function formatPackageItem(item: CatalogPackageItemRow) {
  return {
    id: item.id,
    packageId: item.packageId,
    componentItemId: item.componentItemId,
    quantity: item.quantity,
    position: item.position,
    descriptionOverride: item.descriptionOverride ?? "",
    priceOverride: item.priceOverride,
    purchasePriceSnapshot: item.purchasePriceSnapshot,
    salesPriceSnapshot: item.salesPriceSnapshot,
    planningMinutesOverride: item.planningMinutesOverride,
    componentNumber: item.componentNumber,
    componentName: item.componentName,
    componentType: item.componentType === "service" ? "service" : item.componentType === "package" ? "package" : "article",
    componentUnit: item.componentUnit,
    componentPurchasePrice: item.purchasePriceSnapshot ?? item.componentPurchasePrice,
    componentSalesPrice: item.salesPriceSnapshot ?? item.componentSalesPrice,
    componentPlanningMinutesPerUnit: item.planningMinutesOverride ?? item.componentPlanningMinutesPerUnit,
    currentComponentPurchasePrice: item.componentPurchasePrice,
    currentComponentSalesPrice: item.componentSalesPrice,
    currentComponentPlanningMinutesPerUnit: item.componentPlanningMinutesPerUnit,
    componentIsActive: item.componentIsActive,
  };
}

function formatCatalogItem(
  item: CatalogItemRow,
  history: CatalogHistoryRow[] = [],
  packageItems: CatalogPackageItemRow[] = []
) {
  return {
    id: item.id,
    type: item.type === "service" ? "service" : item.type === "package" ? "package" : "article",
    number: item.number,
    name: item.name,
    category: item.category ?? "",
    trade: item.trade ?? "",
    unit: item.unit,
    description: item.description ?? "",
    matchcode: item.matchcode ?? "",
    ean: item.ean ?? "",
    costCenter: item.costCenter ?? "",
    supplierName: item.supplierName ?? "",
    supplierNumber: item.supplierNumber ?? "",
    manufacturer: item.manufacturer ?? "",
    manufacturerNumber: item.manufacturerNumber ?? "",
    manufacturerTypeName: item.manufacturerTypeName ?? "",
    minimumOrderQuantity: item.minimumOrderQuantity,
    quantityScale: item.quantityScale ?? "",
    priceUnit: item.priceUnit ?? "",
    deliveryTime: item.deliveryTime ?? "",
    stockQuantity: item.stockQuantity,
    purchasePrice: item.purchasePrice,
    laborCostRateKey: item.laborCostRateKey ?? "",
    listPrice: item.listPrice,
    salesPrice: item.salesPrice,
    scheduledSalesPrice: item.scheduledSalesPrice,
    scheduledSalesPriceValidFrom: item.scheduledSalesPriceValidFrom?.toISOString() ?? "",
    scheduledSalesPriceCreatedAt: item.scheduledSalesPriceCreatedAt?.toISOString() ?? "",
    scheduledSalesPriceUpdatePackages: item.scheduledSalesPriceUpdatePackages,
    lastSalesPriceChangedAt: item.lastSalesPriceChangedAt?.toISOString() ?? "",
    lastSalesPriceOldValue: item.lastSalesPriceOldValue,
    lastSalesPriceNewValue: item.lastSalesPriceNewValue,
    vatRate: item.vatRate,
    isLaborPosition: item.isLaborPosition,
    isPlanningRelevant: item.isPlanningRelevant,
    planningMinutesPerUnit: item.planningMinutesPerUnit,
    defaultPlanningBoard: item.defaultPlanningBoard ?? "",
    defaultPlanningGroup: item.defaultPlanningGroup ?? "",
    reviewStatus: normalizeCatalogReviewStatus(item.reviewStatus),
    reviewedAt: item.reviewedAt?.toISOString() ?? "",
    reviewedByUserId: item.reviewedByUserId ?? "",
    reviewedByName: item.reviewedByName ?? "",
    reviewNote: item.reviewNote ?? "",
    isActive: item.isActive,
    usedCount: item.usedCount,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    history: history.map((entry) => ({
      id: entry.id,
      catalogItemId: entry.catalogItemId,
      eventType: entry.eventType,
      fieldName: entry.fieldName ?? "",
      oldValue: entry.oldValue ?? "",
      newValue: entry.newValue ?? "",
      actorUserId: entry.actorUserId ?? "",
      actorName: entry.actorName ?? "",
      note: entry.note ?? "",
      createdAt: entry.createdAt.toISOString(),
    })),
    packageItems: packageItems.map(formatPackageItem),
  };
}

async function getNextCatalogNumber(organizationId: string, type: string) {
  const prefix = type === "service" ? "L" : type === "package" ? "P" : "A";
  const rows = await prisma.$queryRaw<Array<{ number: string }>>`
    SELECT "number"
    FROM "CatalogItem"
    WHERE "organizationId" = ${organizationId}
      AND "number" LIKE ${`${prefix}%`}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const current = Number((rows[0]?.number ?? `${prefix}1000`).replace(/\D/g, ""));
  return `${prefix}${String(Number.isFinite(current) ? current + 1 : 1001).padStart(4, "0")}`;
}

async function getNextWinterServiceCatalogNumber(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ number: string }>>`
    SELECT "number"
    FROM "CatalogItem"
    WHERE "organizationId" = ${organizationId}
      AND "number" LIKE 'OKI%'
  `;
  return selectNextWinterServiceCatalogNumber(rows.map((row) => row.number));
}

async function findExistingWinterServicePackage(input: {
  organizationId: string;
  projectNumber: string;
  customerLabel: string;
  serviceNumber: string;
}) {
  if (!input.serviceNumber || (!input.projectNumber && !input.customerLabel)) return null;
  const projectMarker = input.projectNumber
    ? `projekt ${input.projectNumber.toLocaleLowerCase("de")}.`
    : "";
  const customerMarker = input.customerLabel.toLocaleLowerCase("de");
  const rows = await prisma.$queryRaw<CatalogItemRow[]>`
    SELECT DISTINCT catalog_package.*
    FROM "CatalogItem" catalog_package
    INNER JOIN "CatalogPackageItem" package_item
      ON package_item."packageId" = catalog_package."id"
    INNER JOIN "CatalogItem" component
      ON component."id" = package_item."componentItemId"
    WHERE catalog_package."organizationId" = ${input.organizationId}
      AND catalog_package."type" = 'package'
      AND catalog_package."isActive" = true
      AND component."number" = ${input.serviceNumber}
      AND (
        (${projectMarker} <> '' AND POSITION(${projectMarker} IN LOWER(COALESCE(catalog_package."description", ''))) > 0)
        OR
        (${customerMarker} <> '' AND POSITION(${customerMarker} IN LOWER(catalog_package."name")) > 0)
      )
    ORDER BY catalog_package."createdAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function replacePackageItems(input: {
  organizationId: string;
  packageId: string;
  components: unknown;
}) {
  await prisma.$executeRaw`
    DELETE FROM "CatalogPackageItem"
    WHERE "organizationId" = ${input.organizationId}
      AND "packageId" = ${input.packageId}
  `;

  if (!Array.isArray(input.components)) return;

  for (const [index, component] of input.components.entries()) {
    if (!component || typeof component !== "object") continue;
    const componentRecord = component as Record<string, unknown>;
    const componentItemId = cleanString(componentRecord.componentItemId);
    if (!componentItemId) continue;
    const quantity = parseNumber(componentRecord.quantity, 1);
    const planningMinutesOverride = parseNullableInteger(componentRecord.planningMinutesOverride);

    await prisma.$executeRaw`
      INSERT INTO "CatalogPackageItem" (
        "id", "organizationId", "packageId", "componentItemId", "quantity",
        "position", "descriptionOverride", "priceOverride", "purchasePriceSnapshot",
        "salesPriceSnapshot", "planningMinutesOverride", "createdAt", "updatedAt"
      )
      SELECT
        ${randomUUID()}, ${input.organizationId}, ${input.packageId}, ${componentItemId},
        ${quantity}, ${parseInteger(componentRecord.position, index)},
        ${nullableString(componentRecord.descriptionOverride)}, ${parseNullableNumber(componentRecord.priceOverride)},
        COALESCE(${parseNullableNumber(componentRecord.purchasePriceSnapshot)}, ci."purchasePrice"),
        COALESCE(${parseNullableNumber(componentRecord.salesPriceSnapshot)}, ci."salesPrice"),
        COALESCE(
          ${planningMinutesOverride},
          CASE
            WHEN ci."type" = 'service'
            THEN GREATEST(0, ROUND(ci."planningMinutesPerUnit" * ${quantity})::int)
            ELSE ci."planningMinutesPerUnit"
          END
        ),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM "CatalogItem" ci
      WHERE ci."id" = ${componentItemId}
        AND ci."organizationId" = ${input.organizationId}
    `;
  }
}

async function createHistory(input: {
  organizationId: string;
  catalogItemId: string;
  eventType: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  actorUserId?: string;
  actorName?: string;
  note?: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "CatalogItemHistory" (
      "id", "organizationId", "catalogItemId", "eventType", "fieldName",
      "oldValue", "newValue", "actorUserId", "actorName", "note", "createdAt"
    )
    VALUES (
      ${randomUUID()}, ${input.organizationId}, ${input.catalogItemId}, ${input.eventType},
      ${input.fieldName || null}, ${input.oldValue || null}, ${input.newValue || null},
      ${input.actorUserId || null}, ${input.actorName || null}, ${input.note || null},
      CURRENT_TIMESTAMP
    )
  `;
}

function comparableValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

async function writeChangeHistory(
  organizationId: string,
  before: CatalogItemRow,
  after: CatalogItemRow,
  actorUserId: string,
  actorName: string
) {
  const fields: Array<[keyof CatalogItemRow, string]> = [
    ["type", "Typ"],
    ["number", "Nummer"],
    ["name", "Name"],
    ["category", "Kategorie"],
    ["trade", "Gewerk"],
    ["unit", "Einheit"],
    ["description", "Beschreibung"],
    ["purchasePrice", "Einkaufspreis"],
    ["laborCostRateKey", "LK-Satz"],
    ["salesPrice", "Verkaufspreis"],
    ["scheduledSalesPrice", "Geplanter Verkaufspreis"],
    ["scheduledSalesPriceValidFrom", "Neuer Verkaufspreis ab"],
    ["scheduledSalesPriceUpdatePackages", "Paketpreise mit aktualisieren"],
    ["vatRate", "MwSt."],
    ["isLaborPosition", "Arbeitsposition"],
    ["isPlanningRelevant", "Planungsrelevant"],
    ["planningMinutesPerUnit", "Planungszeit je Einheit"],
    ["reviewStatus", "Prüfstatus"],
    ["isActive", "Status"],
  ];

  for (const [key, label] of fields) {
    if (comparableValue(before[key]) === comparableValue(after[key])) continue;
    await createHistory({
      organizationId,
      catalogItemId: after.id,
      eventType: "updated",
      fieldName: label,
      oldValue: comparableValue(before[key]),
      newValue: comparableValue(after[key]),
      actorUserId,
      actorName,
    });
  }
}

async function getCatalogItemsResponse(organizationId: string) {
  await ensureCatalogTables();

  const items = await prisma.$queryRaw<CatalogItemRow[]>`
    SELECT *
    FROM "CatalogItem"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
  `;
  const histories = await prisma.$queryRaw<CatalogHistoryRow[]>`
    SELECT *
    FROM "CatalogItemHistory"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
  `;
  const packageItems = await prisma.$queryRaw<CatalogPackageItemRow[]>`
    SELECT
      pi.*,
      ci."number" AS "componentNumber",
      ci."name" AS "componentName",
      ci."type" AS "componentType",
      ci."unit" AS "componentUnit",
      ci."purchasePrice" AS "componentPurchasePrice",
      ci."salesPrice" AS "componentSalesPrice",
      ci."planningMinutesPerUnit" AS "componentPlanningMinutesPerUnit",
      ci."isActive" AS "componentIsActive"
    FROM "CatalogPackageItem" pi
    JOIN "CatalogItem" ci ON ci."id" = pi."componentItemId"
    WHERE pi."organizationId" = ${organizationId}
    ORDER BY pi."position" ASC, pi."createdAt" ASC
  `;
  const historyByItemId = new Map<string, CatalogHistoryRow[]>();
  for (const entry of histories) {
    historyByItemId.set(entry.catalogItemId, [
      ...(historyByItemId.get(entry.catalogItemId) ?? []),
      entry,
    ]);
  }
  const packageItemsByPackageId = new Map<string, CatalogPackageItemRow[]>();
  for (const item of packageItems) {
    packageItemsByPackageId.set(item.packageId, [
      ...(packageItemsByPackageId.get(item.packageId) ?? []),
      item,
    ]);
  }

  return NextResponse.json(
    items.map((item) =>
      formatCatalogItem(
        item,
        historyByItemId.get(item.id) ?? [],
        packageItemsByPackageId.get(item.id) ?? []
      )
    )
  );
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const requestedActorId = searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  return getCatalogItemsResponse(organization.id);
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureCatalogTables();

  const body = await req.json();
  const actorResult = await getSessionBoundActor(req, users, body.actorId ?? body.actorUserId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageCatalogItems(actor)) {
    return forbiddenCatalogManagementResponse();
  }
  const actorName = getActorName(actor);
  const type = cleanType(body.type);
  const isWinterServicePackage = type === "package" && body.numberSeries === "winter-service";
  const winterServiceCustomerId = cleanString(body.winterServiceCustomerId);
  const winterServiceServiceNumber = cleanString(body.winterServiceServiceNumber);
  const winterServiceDedupeKey =
    isWinterServicePackage && winterServiceCustomerId && winterServiceServiceNumber
      ? `WINTER:${winterServiceCustomerId}:${winterServiceServiceNumber}`
      : "";
  if (isWinterServicePackage) {
    const existingPackage = await findExistingWinterServicePackage({
      organizationId: organization.id,
      projectNumber: cleanString(body.winterServiceProjectNumber),
      customerLabel: cleanString(body.winterServiceCustomerLabel),
      serviceNumber: winterServiceServiceNumber,
    });
    if (existingPackage) {
      return NextResponse.json(
        { ...formatCatalogItem(existingPackage), reused: true },
        { status: 200 }
      );
    }
  }
  const id = randomUUID();
  const number =
    cleanString(body.number) ||
    (body.numberSeries === "winter-service"
      ? await getNextWinterServiceCatalogNumber(organization.id)
      : await getNextCatalogNumber(organization.id, type));
  const name = cleanString(body.name);
  const isLaborPosition =
    Object.prototype.hasOwnProperty.call(body, "isLaborPosition")
      ? Boolean(body.isLaborPosition)
      : type === "service";
  const scheduledPriceResult = validateScheduledSalesPrice(body);

  if (!name) {
    return NextResponse.json({ error: "Bitte einen Namen angeben." }, { status: 400 });
  }
  if (!scheduledPriceResult.ok) {
    return NextResponse.json({ error: scheduledPriceResult.error }, { status: 400 });
  }
  if (isWinterServicePackage) {
    const duplicateName = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "CatalogItem"
      WHERE "organizationId" = ${organization.id}
        AND "type" = 'package'
        AND LOWER(TRIM("name")) = LOWER(TRIM(${name}))
      LIMIT 1
    `;
    if (duplicateName.length > 0) {
      return NextResponse.json(
        { error: "Diese Paketbezeichnung existiert bereits. Bitte eindeutig anders benennen." },
        { status: 409 }
      );
    }
  }

  let rows: CatalogItemRow[];
  try {
    rows = await prisma.$queryRaw<CatalogItemRow[]>`
      INSERT INTO "CatalogItem" (
        "id", "organizationId", "type", "number", "name", "category", "trade", "unit",
        "description", "matchcode", "ean", "costCenter", "supplierName", "supplierNumber",
        "manufacturer", "manufacturerNumber", "manufacturerTypeName", "minimumOrderQuantity",
        "quantityScale", "priceUnit", "deliveryTime", "stockQuantity", "purchasePrice", "laborCostRateKey",
        "listPrice", "salesPrice", "scheduledSalesPrice", "scheduledSalesPriceValidFrom", "scheduledSalesPriceCreatedAt",
        "scheduledSalesPriceUpdatePackages",
        "vatRate", "isLaborPosition", "isPlanningRelevant", "planningMinutesPerUnit",
        "defaultPlanningBoard", "defaultPlanningGroup", "isActive", "updatedAt"
      )
      VALUES (
        ${id}, ${organization.id}, ${type}, ${number}, ${name}, ${nullableString(body.category)}, ${cleanString(body.trade)}, ${normalizeUnit(body.unit) || "Stk"},
        ${nullableString(body.description)}, ${nullableString(winterServiceDedupeKey || body.matchcode)}, ${nullableString(body.ean)}, ${nullableString(body.costCenter)},
        ${nullableString(body.supplierName)}, ${nullableString(body.supplierNumber)}, ${nullableString(body.manufacturer)},
        ${nullableString(body.manufacturerNumber)}, ${nullableString(body.manufacturerTypeName)}, ${parseNullableNumber(body.minimumOrderQuantity)},
        ${nullableString(body.quantityScale)}, ${nullableString(body.priceUnit)}, ${nullableString(body.deliveryTime)}, ${parseNullableNumber(body.stockQuantity)},
        ${parseNumber(body.purchasePrice)}, ${cleanString(body.laborCostRateKey)}, 0, ${parseNumber(body.salesPrice)},
        ${scheduledPriceResult.scheduledSalesPrice}, ${scheduledPriceResult.scheduledSalesPriceValidFrom},
        ${scheduledPriceResult.scheduledSalesPrice ? new Date() : null}, ${Boolean(body.scheduledSalesPriceUpdatePackages)}, ${parseNumber(body.vatRate, 19)},
        ${isLaborPosition}, ${Boolean(body.isPlanningRelevant)}, ${parseInteger(body.planningMinutesPerUnit)}, ${nullableString(body.defaultPlanningBoard)},
        ${nullableString(body.defaultPlanningGroup)}, ${body.isActive !== false}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
  } catch (error) {
    if (winterServiceDedupeKey && isUniqueConstraintError(error)) {
      const existingRows = await prisma.$queryRaw<CatalogItemRow[]>`
        SELECT *
        FROM "CatalogItem"
        WHERE "organizationId" = ${organization.id}
          AND "matchcode" = ${winterServiceDedupeKey}
        LIMIT 1
      `;
      if (existingRows[0]) {
        return NextResponse.json(
          { ...formatCatalogItem(existingRows[0]), reused: true },
          { status: 200 }
        );
      }
    }
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    return NextResponse.json(
      { error: "Eine Position mit dieser Nummer ist bereits vorhanden." },
      { status: 409 }
    );
  }

  await createHistory({
    organizationId: organization.id,
    catalogItemId: id,
    eventType: "created",
    actorUserId: actor.id,
    actorName,
    note: "Stammdatensatz angelegt",
  });
  if (type === "package") {
    await replacePackageItems({
      organizationId: organization.id,
      packageId: id,
      components: body.packageItems,
    });
  }

  return NextResponse.json(formatCatalogItem(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureCatalogTables();

  const body = await req.json();
  const actorResult = await getSessionBoundActor(req, users, body.actorId ?? body.actorUserId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageCatalogItems(actor)) {
    return forbiddenCatalogManagementResponse();
  }
  const actorName = getActorName(actor);
  const id = cleanString(body.id);
  if (!id) {
    return NextResponse.json({ error: "Artikel/Leistung fehlt." }, { status: 400 });
  }

  const beforeRows = await prisma.$queryRaw<CatalogItemRow[]>`
    SELECT *
    FROM "CatalogItem"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const before = beforeRows[0];
  if (!before) {
    return NextResponse.json({ error: "Artikel/Leistung wurde nicht gefunden." }, { status: 404 });
  }

  if (body.action === "set-review-status") {
    const reviewStatus = normalizeCatalogReviewStatus(body.reviewStatus);
    const reviewNote = nullableString(body.reviewNote);
    const reviewedAt = reviewStatus === "approved" ? new Date() : null;
    const reviewedByUserId = reviewStatus === "approved" ? actor.id : null;
    const reviewedByName = reviewStatus === "approved" ? actorName : null;
    const rows = await prisma.$queryRaw<CatalogItemRow[]>`
      UPDATE "CatalogItem"
      SET
        "reviewStatus" = ${reviewStatus},
        "reviewedAt" = ${reviewedAt},
        "reviewedByUserId" = ${reviewedByUserId},
        "reviewedByName" = ${reviewedByName},
        "reviewNote" = ${reviewNote},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
      RETURNING *
    `;
    const updated = rows[0];
    await createHistory({
      organizationId: organization.id,
      catalogItemId: id,
      eventType: reviewStatus === "approved" ? "review_approved" : "review_status_changed",
      fieldName: "Prüfstatus",
      oldValue: normalizeCatalogReviewStatus(before.reviewStatus),
      newValue: reviewStatus,
      actorUserId: actor.id,
      actorName,
      note:
        reviewStatus === "approved"
          ? "Stammdatensatz fachlich freigegeben"
          : reviewStatus === "needs_review"
            ? "Stammdatensatz zur Prüfung markiert"
            : "Stammdatensatz als ungeprüft markiert",
    });
    return NextResponse.json(formatCatalogItem(updated));
  }

  const type = cleanType(body.type);
  const name = cleanString(body.name);
  const isLaborPosition =
    Object.prototype.hasOwnProperty.call(body, "isLaborPosition")
      ? Boolean(body.isLaborPosition)
      : type === "service";
  const scheduledPriceResult = validateScheduledSalesPrice(body);
  if (!name) {
    return NextResponse.json({ error: "Bitte einen Namen angeben." }, { status: 400 });
  }
  if (!scheduledPriceResult.ok) {
    return NextResponse.json({ error: scheduledPriceResult.error }, { status: 400 });
  }
  const nextSalesPrice = parseNumber(body.salesPrice);
  const nextPurchasePrice = parseNumber(body.purchasePrice);
  const nextPlanningMinutes = parseInteger(body.planningMinutesPerUnit);
  const salesPriceChanged = comparableValue(before.salesPrice) !== comparableValue(nextSalesPrice);
  const existingPackageItems =
    before.type === "package" || type === "package"
      ? await prisma.$queryRaw<Array<{
          componentItemId: string;
          quantity: number;
          position: number;
          descriptionOverride: string | null;
          priceOverride: number | null;
          purchasePriceSnapshot: number | null;
          salesPriceSnapshot: number | null;
          planningMinutesOverride: number | null;
        }>>`
          SELECT
            "componentItemId", "quantity", "position", "descriptionOverride",
            "priceOverride", "purchasePriceSnapshot", "salesPriceSnapshot",
            "planningMinutesOverride"
          FROM "CatalogPackageItem"
          WHERE "organizationId" = ${organization.id}
            AND "packageId" = ${id}
          ORDER BY "position" ASC, "componentItemId" ASC
        `
      : [];
  const packageItemsChanged =
    (before.type === "package" || type === "package") &&
    hasCatalogPackageReviewRelevantChange(
      existingPackageItems,
      body.packageItems
    );
  const reviewCandidate: Record<string, unknown> = {
    ...before,
    type,
    number: cleanString(body.number) || before.number,
    name,
    category: nullableString(body.category),
    trade: cleanString(body.trade),
    unit: normalizeUnit(body.unit) || "Stk",
    description: nullableString(body.description),
    matchcode: nullableString(body.matchcode),
    ean: nullableString(body.ean),
    costCenter: nullableString(body.costCenter),
    supplierName: nullableString(body.supplierName),
    supplierNumber: nullableString(body.supplierNumber),
    manufacturer: nullableString(body.manufacturer),
    manufacturerNumber: nullableString(body.manufacturerNumber),
    manufacturerTypeName: nullableString(body.manufacturerTypeName),
    minimumOrderQuantity: parseNullableNumber(body.minimumOrderQuantity),
    quantityScale: nullableString(body.quantityScale),
    priceUnit: nullableString(body.priceUnit),
    deliveryTime: nullableString(body.deliveryTime),
    purchasePrice: nextPurchasePrice,
    laborCostRateKey: cleanString(body.laborCostRateKey),
    salesPrice: nextSalesPrice,
    scheduledSalesPrice: scheduledPriceResult.scheduledSalesPrice,
    scheduledSalesPriceValidFrom:
      scheduledPriceResult.scheduledSalesPriceValidFrom,
    scheduledSalesPriceUpdatePackages: Boolean(
      body.scheduledSalesPriceUpdatePackages
    ),
    vatRate: parseNumber(body.vatRate, 19),
    isLaborPosition,
    isPlanningRelevant: Boolean(body.isPlanningRelevant),
    planningMinutesPerUnit: nextPlanningMinutes,
    defaultPlanningBoard: nullableString(body.defaultPlanningBoard),
    defaultPlanningGroup: nullableString(body.defaultPlanningGroup),
    isActive: body.isActive !== false,
  };
  const reviewStatus = getCatalogReviewStatusAfterEdit({
    previousStatus: before.reviewStatus,
    hasRelevantChange: hasCatalogReviewRelevantChange(
      before as unknown as Record<string, unknown>,
      reviewCandidate
    ) || packageItemsChanged,
  });
  const reviewWasInvalidated =
    normalizeCatalogReviewStatus(before.reviewStatus) === "approved" &&
    reviewStatus === "needs_review";

  let rows: CatalogItemRow[];
  try {
    rows = await prisma.$queryRaw<CatalogItemRow[]>`
      UPDATE "CatalogItem"
      SET
        "type" = ${type},
        "number" = ${cleanString(body.number) || before.number},
        "name" = ${name},
        "category" = ${nullableString(body.category)},
        "trade" = ${cleanString(body.trade)},
        "unit" = ${normalizeUnit(body.unit) || "Stk"},
        "description" = ${nullableString(body.description)},
        "matchcode" = ${nullableString(body.matchcode)},
        "ean" = ${nullableString(body.ean)},
        "costCenter" = ${nullableString(body.costCenter)},
        "supplierName" = ${nullableString(body.supplierName)},
        "supplierNumber" = ${nullableString(body.supplierNumber)},
        "manufacturer" = ${nullableString(body.manufacturer)},
        "manufacturerNumber" = ${nullableString(body.manufacturerNumber)},
        "manufacturerTypeName" = ${nullableString(body.manufacturerTypeName)},
        "minimumOrderQuantity" = ${parseNullableNumber(body.minimumOrderQuantity)},
        "quantityScale" = ${nullableString(body.quantityScale)},
        "priceUnit" = ${nullableString(body.priceUnit)},
        "deliveryTime" = ${nullableString(body.deliveryTime)},
        "stockQuantity" = ${parseNullableNumber(body.stockQuantity)},
        "purchasePrice" = ${nextPurchasePrice},
        "laborCostRateKey" = ${cleanString(body.laborCostRateKey)},
        "listPrice" = 0,
        "salesPrice" = ${nextSalesPrice},
        "scheduledSalesPrice" = ${scheduledPriceResult.scheduledSalesPrice},
        "scheduledSalesPriceValidFrom" = ${scheduledPriceResult.scheduledSalesPriceValidFrom},
        "scheduledSalesPriceCreatedAt" = ${
          scheduledPriceResult.scheduledSalesPrice &&
          (before.scheduledSalesPrice !== scheduledPriceResult.scheduledSalesPrice ||
            comparableValue(before.scheduledSalesPriceValidFrom) !== comparableValue(scheduledPriceResult.scheduledSalesPriceValidFrom))
            ? new Date()
            : before.scheduledSalesPriceCreatedAt
        },
        "scheduledSalesPriceUpdatePackages" = ${Boolean(body.scheduledSalesPriceUpdatePackages)},
        "lastSalesPriceChangedAt" = ${salesPriceChanged ? new Date() : before.lastSalesPriceChangedAt},
        "lastSalesPriceOldValue" = ${salesPriceChanged ? before.salesPrice : before.lastSalesPriceOldValue},
        "lastSalesPriceNewValue" = ${salesPriceChanged ? nextSalesPrice : before.lastSalesPriceNewValue},
        "vatRate" = ${parseNumber(body.vatRate, 19)},
        "isLaborPosition" = ${isLaborPosition},
        "isPlanningRelevant" = ${Boolean(body.isPlanningRelevant)},
        "planningMinutesPerUnit" = ${nextPlanningMinutes},
        "defaultPlanningBoard" = ${nullableString(body.defaultPlanningBoard)},
        "defaultPlanningGroup" = ${nullableString(body.defaultPlanningGroup)},
        "reviewStatus" = ${reviewStatus},
        "reviewedAt" = ${reviewWasInvalidated ? null : before.reviewedAt},
        "reviewedByUserId" = ${reviewWasInvalidated ? null : before.reviewedByUserId},
        "reviewedByName" = ${reviewWasInvalidated ? null : before.reviewedByName},
        "isActive" = ${body.isActive !== false},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
      RETURNING *
    `;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    return NextResponse.json(
      { error: "Eine Position mit dieser Nummer ist bereits vorhanden." },
      { status: 409 }
    );
  }
  const after = rows[0];
  const shouldUpdatePackageSnapshots = type !== "package" && Boolean(body.updatePackageSnapshots);
  if (shouldUpdatePackageSnapshots) {
    await prisma.$executeRaw`
      UPDATE "CatalogPackageItem"
      SET
        "purchasePriceSnapshot" = ${nextPurchasePrice},
        "salesPriceSnapshot" = ${nextSalesPrice},
        "planningMinutesOverride" = CASE
          WHEN ${type} = 'service' THEN ${nextPlanningMinutes}
          ELSE "planningMinutesOverride"
        END,
        "priceOverride" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id}
        AND "componentItemId" = ${id}
    `;
  }
  if (type === "package") {
    await replacePackageItems({
      organizationId: organization.id,
      packageId: after.id,
      components: body.packageItems,
    });
  }
  await writeChangeHistory(
    organization.id,
    before,
    after,
    actor.id,
    actorName
  );

  if (type === "package") {
    await createHistory({
      organizationId: organization.id,
      catalogItemId: after.id,
      eventType: "package_items_updated",
      fieldName: "Bestandteile",
      actorUserId: actor.id,
      actorName,
      note: "Paketbestandteile aktualisiert",
    });
  }

  return NextResponse.json(formatCatalogItem(after));
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = cleanString(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Artikel/Leistung fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId") ?? searchParams.get("actorUserId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageCatalogItems(actor)) {
    return forbiddenCatalogManagementResponse();
  }
  const actorName = getActorName(actor);
  await ensureCatalogTables();

  const rows = await prisma.$queryRaw<CatalogItemRow[]>`
    UPDATE "CatalogItem"
    SET "isActive" = false,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await createHistory({
    organizationId: organization.id,
    catalogItemId: id,
    eventType: "deactivated",
    fieldName: "Status",
    oldValue: "aktiv",
    newValue: "inaktiv",
    actorUserId: actor.id,
    actorName,
    note: "Stammdatensatz deaktiviert",
  });

  return NextResponse.json({ ok: true });
}
