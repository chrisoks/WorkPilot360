import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type CatalogItemRow = {
  id: string;
  organizationId: string;
  type: string;
  number: string;
  name: string;
  category: string | null;
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
  listPrice: number;
  salesPrice: number;
  vatRate: number;
  isPlanningRelevant: boolean;
  planningMinutesPerUnit: number;
  defaultPlanningBoard: string | null;
  defaultPlanningGroup: string | null;
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

async function ensureCatalogTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CatalogItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'article',
      "number" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT,
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
      "listPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "salesPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "isPlanningRelevant" BOOLEAN NOT NULL DEFAULT false,
      "planningMinutesPerUnit" INTEGER NOT NULL DEFAULT 0,
      "defaultPlanningBoard" TEXT,
      "defaultPlanningGroup" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "usedCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "CatalogItem_organizationId_number_key"
    ON "CatalogItem" ("organizationId", "number")
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function parseInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function cleanType(value: unknown) {
  const valueAsString = cleanString(value);
  if (valueAsString === "service" || valueAsString === "package") return valueAsString;
  return "article";
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
    componentNumber: item.componentNumber,
    componentName: item.componentName,
    componentType: item.componentType === "service" ? "service" : item.componentType === "package" ? "package" : "article",
    componentUnit: item.componentUnit,
    componentPurchasePrice: item.componentPurchasePrice,
    componentSalesPrice: item.componentSalesPrice,
    componentPlanningMinutesPerUnit: item.componentPlanningMinutesPerUnit,
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
    listPrice: item.listPrice,
    salesPrice: item.salesPrice,
    vatRate: item.vatRate,
    isPlanningRelevant: item.isPlanningRelevant,
    planningMinutesPerUnit: item.planningMinutesPerUnit,
    defaultPlanningBoard: item.defaultPlanningBoard ?? "",
    defaultPlanningGroup: item.defaultPlanningGroup ?? "",
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

    await prisma.$executeRaw`
      INSERT INTO "CatalogPackageItem" (
        "id", "organizationId", "packageId", "componentItemId", "quantity",
        "position", "descriptionOverride", "priceOverride", "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${input.organizationId}, ${input.packageId}, ${componentItemId},
        ${parseNumber(componentRecord.quantity, 1)}, ${parseInteger(componentRecord.position, index)},
        ${nullableString(componentRecord.descriptionOverride)}, ${parseNullableNumber(componentRecord.priceOverride)},
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
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
    ["unit", "Einheit"],
    ["description", "Beschreibung"],
    ["purchasePrice", "Einkaufspreis"],
    ["salesPrice", "Verkaufspreis"],
    ["vatRate", "MwSt."],
    ["isPlanningRelevant", "Planungsrelevant"],
    ["planningMinutesPerUnit", "Planungszeit je Einheit"],
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

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureCatalogTables();

  const items = await prisma.$queryRaw<CatalogItemRow[]>`
    SELECT *
    FROM "CatalogItem"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;
  const histories = await prisma.$queryRaw<CatalogHistoryRow[]>`
    SELECT *
    FROM "CatalogItemHistory"
    WHERE "organizationId" = ${organization.id}
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
    WHERE pi."organizationId" = ${organization.id}
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

export async function POST(req: Request) {
  const { organization } = await getDemoContext();
  await ensureCatalogTables();

  const body = await req.json();
  const type = cleanType(body.type);
  const id = randomUUID();
  const number = cleanString(body.number) || (await getNextCatalogNumber(organization.id, type));
  const name = cleanString(body.name);

  if (!name) {
    return NextResponse.json({ error: "Bitte einen Namen angeben." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<CatalogItemRow[]>`
    INSERT INTO "CatalogItem" (
      "id", "organizationId", "type", "number", "name", "category", "unit",
      "description", "matchcode", "ean", "costCenter", "supplierName", "supplierNumber",
      "manufacturer", "manufacturerNumber", "manufacturerTypeName", "minimumOrderQuantity",
      "quantityScale", "priceUnit", "deliveryTime", "stockQuantity", "purchasePrice",
      "listPrice", "salesPrice", "vatRate", "isPlanningRelevant", "planningMinutesPerUnit",
      "defaultPlanningBoard", "defaultPlanningGroup", "isActive"
    )
    VALUES (
      ${id}, ${organization.id}, ${type}, ${number}, ${name}, ${nullableString(body.category)}, ${cleanString(body.unit) || "Stk"},
      ${nullableString(body.description)}, ${nullableString(body.matchcode)}, ${nullableString(body.ean)}, ${nullableString(body.costCenter)},
      ${nullableString(body.supplierName)}, ${nullableString(body.supplierNumber)}, ${nullableString(body.manufacturer)},
      ${nullableString(body.manufacturerNumber)}, ${nullableString(body.manufacturerTypeName)}, ${parseNullableNumber(body.minimumOrderQuantity)},
      ${nullableString(body.quantityScale)}, ${nullableString(body.priceUnit)}, ${nullableString(body.deliveryTime)}, ${parseNullableNumber(body.stockQuantity)},
      ${parseNumber(body.purchasePrice)}, 0, ${parseNumber(body.salesPrice)}, ${parseNumber(body.vatRate, 19)},
      ${Boolean(body.isPlanningRelevant)}, ${parseInteger(body.planningMinutesPerUnit)}, ${nullableString(body.defaultPlanningBoard)},
      ${nullableString(body.defaultPlanningGroup)}, ${body.isActive !== false}
    )
    RETURNING *
  `;

  await createHistory({
    organizationId: organization.id,
    catalogItemId: id,
    eventType: "created",
    actorUserId: cleanString(body.actorUserId),
    actorName: cleanString(body.actorName),
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
  const { organization } = await getDemoContext();
  await ensureCatalogTables();

  const body = await req.json();
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

  const type = cleanType(body.type);
  const name = cleanString(body.name);
  if (!name) {
    return NextResponse.json({ error: "Bitte einen Namen angeben." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<CatalogItemRow[]>`
    UPDATE "CatalogItem"
    SET
      "type" = ${type},
      "number" = ${cleanString(body.number) || before.number},
      "name" = ${name},
      "category" = ${nullableString(body.category)},
      "unit" = ${cleanString(body.unit) || "Stk"},
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
      "purchasePrice" = ${parseNumber(body.purchasePrice)},
      "listPrice" = 0,
      "salesPrice" = ${parseNumber(body.salesPrice)},
      "vatRate" = ${parseNumber(body.vatRate, 19)},
      "isPlanningRelevant" = ${Boolean(body.isPlanningRelevant)},
      "planningMinutesPerUnit" = ${parseInteger(body.planningMinutesPerUnit)},
      "defaultPlanningBoard" = ${nullableString(body.defaultPlanningBoard)},
      "defaultPlanningGroup" = ${nullableString(body.defaultPlanningGroup)},
      "isActive" = ${body.isActive !== false},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;
  const after = rows[0];
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
    cleanString(body.actorUserId),
    cleanString(body.actorName)
  );

  if (type === "package") {
    await createHistory({
      organizationId: organization.id,
      catalogItemId: after.id,
      eventType: "package_items_updated",
      fieldName: "Bestandteile",
      actorUserId: cleanString(body.actorUserId),
      actorName: cleanString(body.actorName),
      note: "Paketbestandteile aktualisiert",
    });
  }

  return NextResponse.json(formatCatalogItem(after));
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = cleanString(searchParams.get("id"));
  const actorUserId = cleanString(searchParams.get("actorUserId"));
  const actorName = cleanString(searchParams.get("actorName"));

  if (!id) {
    return NextResponse.json({ error: "Artikel/Leistung fehlt." }, { status: 400 });
  }

  const { organization } = await getDemoContext();
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
    actorUserId,
    actorName,
    note: "Stammdatensatz deaktiviert",
  });

  return NextResponse.json({ ok: true });
}
