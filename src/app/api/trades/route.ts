import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

const defaultBusinessAreas = ["Marketing", "Arbeitssicherheit", "HR", "immocare", "interne Arbeiten"];

const defaultTrades = [
  { name: "Wartung", projectPrefix: "WAR", businessAreaName: "immocare" },
  { name: "Malerarbeiten", projectPrefix: "MAR", businessAreaName: "immocare" },
  { name: "Glasreinigung", projectPrefix: "GLR", businessAreaName: "immocare" },
  { name: "Unterhaltsreinigung", projectPrefix: "UHR", businessAreaName: "immocare" },
  { name: "Grünflächen- und Gartenpflege", projectPrefix: "GPFL", businessAreaName: "immocare" },
  { name: "Hausmeisterservice", projectPrefix: "HAS", businessAreaName: "immocare" },
  { name: "Hausverwaltung", projectPrefix: "HVW", businessAreaName: "immocare" },
  { name: "Fassadenreinigung", projectPrefix: "FAR", businessAreaName: "immocare" },
  { name: "Dachreinigung", projectPrefix: "DAR", businessAreaName: "immocare" },
  { name: "Umzug Service", projectPrefix: "UMZ", businessAreaName: "immocare" },
  { name: "Intern", projectPrefix: "INT", businessAreaName: "interne Arbeiten" },
  { name: "Trockeneisstrahlen", projectPrefix: "TREI", businessAreaName: "immocare" },
  { name: "Reparaturarbeiten", projectPrefix: "REP", businessAreaName: "immocare" },
  { name: "Reinigung", projectPrefix: "REI", businessAreaName: "immocare" },
  { name: "Objektbetreuung", projectPrefix: "OBJ", businessAreaName: "immocare" },
  { name: "Photovoltaikanlagenreinigung", projectPrefix: "PAR", businessAreaName: "immocare" },
  { name: "Materialverkauf", projectPrefix: "MAT", businessAreaName: "immocare" },
  { name: "Arbeitssicherheit", projectPrefix: "ASS", businessAreaName: "Arbeitssicherheit" },
  { name: "HR", projectPrefix: "HR", businessAreaName: "HR" },
  { name: "Marketing", projectPrefix: "MKG", businessAreaName: "Marketing" },
  { name: "Winterdienst", projectPrefix: "WID", businessAreaName: "immocare" },
];

type BusinessAreaRow = {
  id: string;
  name: string;
};

type TradeRow = {
  id: string;
  name: string;
  projectPrefix: string | null;
  businessAreaId: string | null;
  businessAreaName: string | null;
};

function canManageTrades(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

function normalizeProjectPrefix(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function formatTrade(trade: TradeRow) {
  return {
    id: trade.id,
    name: trade.name,
    projectPrefix: trade.projectPrefix ?? "",
    businessAreaId: trade.businessAreaId ?? "",
    businessAreaName: trade.businessAreaName ?? "",
  };
}

async function ensureBusinessAreaSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BusinessArea" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BusinessArea_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "BusinessArea_organizationId_name_key" UNIQUE ("organizationId", "name"),
      CONSTRAINT "BusinessArea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "businessAreaId" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BusinessArea_organizationId_idx" ON "BusinessArea"("organizationId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Category_organizationId_businessAreaId_idx" ON "Category"("organizationId", "businessAreaId")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Category_businessAreaId_fkey'
      ) THEN
        ALTER TABLE "Category"
          ADD CONSTRAINT "Category_businessAreaId_fkey"
          FOREIGN KEY ("businessAreaId") REFERENCES "BusinessArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}

async function ensureDefaultBusinessAreas(organizationId: string) {
  await ensureBusinessAreaSchema();

  const existing = await prisma.$queryRaw<BusinessAreaRow[]>`
    SELECT "id", "name"
    FROM "BusinessArea"
    WHERE "organizationId" = ${organizationId}
  `;
  const existingNames = new Set(existing.map((area) => area.name.toLowerCase()));
  const missing = defaultBusinessAreas.filter((name) => !existingNames.has(name.toLowerCase()));

  for (const name of missing) {
    await prisma.$executeRaw`
      INSERT INTO "BusinessArea" ("id", "organizationId", "name", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${organizationId}, ${name}, NOW(), NOW())
      ON CONFLICT ("organizationId", "name") DO NOTHING
    `;
  }

  return prisma.$queryRaw<BusinessAreaRow[]>`
    SELECT "id", "name"
    FROM "BusinessArea"
    WHERE "organizationId" = ${organizationId}
    ORDER BY
      CASE "name"
        WHEN 'Marketing' THEN 1
        WHEN 'Arbeitssicherheit' THEN 2
        WHEN 'HR' THEN 3
        WHEN 'immocare' THEN 4
        WHEN 'interne Arbeiten' THEN 5
        ELSE 99
      END,
      "name" ASC
  `;
}

async function resolveBusinessAreaId(organizationId: string, businessAreaId: unknown) {
  const normalizedId = String(businessAreaId ?? "").trim();
  if (!normalizedId) return null;

  const [area] = await prisma.$queryRaw<BusinessAreaRow[]>`
    SELECT "id", "name"
    FROM "BusinessArea"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${normalizedId}
    LIMIT 1
  `;

  return area?.id ?? undefined;
}

async function getTrades(organizationId: string) {
  return prisma.$queryRaw<TradeRow[]>`
    SELECT
      c."id",
      c."name",
      c."projectPrefix",
      c."businessAreaId",
      b."name" AS "businessAreaName"
    FROM "Category" c
    LEFT JOIN "BusinessArea" b ON b."id" = c."businessAreaId"
    WHERE c."organizationId" = ${organizationId}
      AND NOT (
        c."name" = 'Gruenflaechen- und Gartenpflege'
        AND EXISTS (
          SELECT 1
          FROM "Category" normalized
          WHERE normalized."organizationId" = ${organizationId}
            AND normalized."name" = 'Grünflächen- und Gartenpflege'
        )
      )
    ORDER BY c."name" ASC
  `;
}

async function getTradeById(organizationId: string, tradeId: string) {
  const [trade] = await prisma.$queryRaw<TradeRow[]>`
    SELECT
      c."id",
      c."name",
      c."projectPrefix",
      c."businessAreaId",
      b."name" AS "businessAreaName"
    FROM "Category" c
    LEFT JOIN "BusinessArea" b ON b."id" = c."businessAreaId"
    WHERE c."organizationId" = ${organizationId}
      AND c."id" = ${tradeId}
    LIMIT 1
  `;

  return trade;
}

async function ensureDefaultTrades(organizationId: string) {
  const businessAreas = await ensureDefaultBusinessAreas(organizationId);
  const businessAreaByName = new Map(
    businessAreas.map((area) => [area.name.toLowerCase(), area.id])
  );
  const existingTrades = await prisma.category.findMany({
    where: { organizationId },
    select: { id: true, name: true, projectPrefix: true },
  });
  const existingNames = new Set(existingTrades.map((trade) => trade.name.toLowerCase()));
  const missingTrades = defaultTrades.filter(
    (trade) => !existingNames.has(trade.name.toLowerCase())
  );

  if (missingTrades.length > 0) {
    await prisma.category.createMany({
      data: missingTrades.map((trade) => ({
        organizationId,
        name: trade.name,
        projectPrefix: trade.projectPrefix,
      })),
    });
  }

  await Promise.all(
    existingTrades
      .map((trade) => {
        if (trade.projectPrefix) return null;
        const defaultTrade = defaultTrades.find(
          (item) => item.name.toLowerCase() === trade.name.toLowerCase()
        );
        if (!defaultTrade) return null;

        return prisma.category.update({
          where: { id: trade.id },
          data: { projectPrefix: defaultTrade.projectPrefix },
        });
      })
      .filter((update): update is NonNullable<typeof update> => Boolean(update))
  );

  const allTrades = await prisma.category.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });

  for (const trade of allTrades) {
    const defaultTrade = defaultTrades.find(
      (item) => item.name.toLowerCase() === trade.name.toLowerCase()
    );
    if (!defaultTrade?.businessAreaName) continue;
    const businessAreaId = businessAreaByName.get(defaultTrade.businessAreaName.toLowerCase());
    if (!businessAreaId) continue;

    await prisma.$executeRaw`
      UPDATE "Category"
      SET "businessAreaId" = COALESCE("businessAreaId", ${businessAreaId})
      WHERE "id" = ${trade.id}
        AND "organizationId" = ${organizationId}
    `;
  }
}

export async function GET(req: Request) {
  const { organization } = await getDemoContext();
  await ensureDefaultTrades(organization.id);

  const url = new URL(req.url);
  if (url.searchParams.get("businessAreas") === "1") {
    return NextResponse.json(await ensureDefaultBusinessAreas(organization.id));
  }

  const trades = await getTrades(organization.id);
  return NextResponse.json(trades.map(formatTrade));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTrades(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschaeftsfuehrung duerfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Bitte einen Gewerknamen angeben." }, { status: 400 });
  }

  const name = body.name.trim();
  const projectPrefix = normalizeProjectPrefix(body.projectPrefix);
  await ensureDefaultBusinessAreas(organization.id);
  const businessAreaId = await resolveBusinessAreaId(organization.id, body.businessAreaId);
  if (businessAreaId === undefined) {
    return NextResponse.json({ error: "Geschaeftsbereich wurde nicht gefunden." }, { status: 400 });
  }
  if (body.projectPrefix && !projectPrefix) {
    return NextResponse.json({ error: "Bitte ein gueltiges Projektkuerzel angeben." }, { status: 400 });
  }

  const existingTrade = await prisma.category.findFirst({
    where: {
      organizationId: organization.id,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (existingTrade) {
    return NextResponse.json(
      { error: "Dieses Gewerk ist bereits vorhanden." },
      { status: 409 }
    );
  }

  const trade = await prisma.category.create({
    data: {
      organizationId: organization.id,
      name,
      projectPrefix: projectPrefix || null,
    },
  });

  if (businessAreaId) {
    await prisma.$executeRaw`
      UPDATE "Category"
      SET "businessAreaId" = ${businessAreaId}
      WHERE "id" = ${trade.id}
        AND "organizationId" = ${organization.id}
    `;
  }

  const formatted = await getTradeById(organization.id, trade.id);
  return NextResponse.json(formatTrade(formatted), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTrades(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschaeftsfuehrung duerfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Bitte einen Gewerknamen angeben." }, { status: 400 });
  }
  const projectPrefix = normalizeProjectPrefix(body.projectPrefix);
  await ensureDefaultBusinessAreas(organization.id);
  const businessAreaId = await resolveBusinessAreaId(organization.id, body.businessAreaId);
  if (businessAreaId === undefined) {
    return NextResponse.json({ error: "Geschaeftsbereich wurde nicht gefunden." }, { status: 400 });
  }
  if (body.projectPrefix && !projectPrefix) {
    return NextResponse.json({ error: "Bitte ein gueltiges Projektkuerzel angeben." }, { status: 400 });
  }

  const trade = await prisma.category.findFirst({
    where: {
      id: body.tradeId,
      organizationId: organization.id,
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Gewerk wurde nicht gefunden." }, { status: 404 });
  }

  await prisma.category.update({
    where: {
      id: trade.id,
    },
    data: {
      name: body.name.trim(),
      projectPrefix: projectPrefix || null,
    },
  });

  if (businessAreaId) {
    await prisma.$executeRaw`
      UPDATE "Category"
      SET "businessAreaId" = ${businessAreaId}
      WHERE "id" = ${trade.id}
        AND "organizationId" = ${organization.id}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "Category"
      SET "businessAreaId" = NULL
      WHERE "id" = ${trade.id}
        AND "organizationId" = ${organization.id}
    `;
  }

  const updated = await getTradeById(organization.id, trade.id);
  return NextResponse.json(formatTrade(updated));
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTrades(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschaeftsfuehrung duerfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  const trade = await prisma.category.findFirst({
    where: {
      id: body.tradeId,
      organizationId: organization.id,
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Gewerk wurde nicht gefunden." }, { status: 404 });
  }

  await prisma.task.updateMany({
    where: {
      categoryId: trade.id,
    },
    data: {
      categoryId: null,
    },
  });

  await prisma.category.delete({
    where: {
      id: trade.id,
    },
  });

  return NextResponse.json({ success: true });
}
