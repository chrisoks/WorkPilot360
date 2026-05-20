import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type UnitRow = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const defaultUnits = ["Std", "Stk", "Pauschal", "Paket", "m", "m²", "m³", "km", "kg", "L", "Tag", "Monat"];

function canManageUnits(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

function normalizeUnitName(value: unknown) {
  const normalized = String(value ?? "").trim();
  const lower = normalized.toLowerCase();
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
  return aliases[lower] ?? normalized;
}

function formatUnit(row: UnitRow) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sortOrder ?? 0),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureUnitTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "UnitOption" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "UnitOption_organizationId_name_key"
    ON "UnitOption" ("organizationId", "name")
  `;
}

async function ensureDefaultUnits(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT "name"
    FROM "UnitOption"
    WHERE "organizationId" = ${organizationId}
  `;
  const existing = new Set(rows.map((row) => row.name.toLowerCase()));
  const missing = defaultUnits.filter((unit) => !existing.has(unit.toLowerCase()));

  for (const [index, unit] of missing.entries()) {
    await prisma.$executeRaw`
      INSERT INTO "UnitOption" ("id", "organizationId", "name", "sortOrder")
      VALUES (${randomUUID()}, ${organizationId}, ${unit}, ${rows.length + index + 1})
      ON CONFLICT ("organizationId", "name") DO NOTHING
    `;
  }
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureUnitTables();
  await ensureDefaultUnits(organization.id);

  const rows = await prisma.$queryRaw<UnitRow[]>`
    SELECT "id", "name", "sortOrder", "isActive", "createdAt", "updatedAt"
    FROM "UnitOption"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "isActive" DESC, "sortOrder" ASC, "name" ASC
  `;

  return NextResponse.json(rows.map(formatUnit));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  await ensureUnitTables();

  if (!canManageUnits(actor.role)) {
    return NextResponse.json({ error: "Nur Admins und Geschäftsführung dürfen Einheiten verwalten." }, { status: 403 });
  }

  const name = normalizeUnitName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Bitte eine Einheit angeben." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<UnitRow[]>`
    INSERT INTO "UnitOption" ("id", "organizationId", "name", "sortOrder", "updatedAt")
    VALUES (${randomUUID()}, ${organization.id}, ${name}, ${Number(body.sortOrder ?? 999)}, CURRENT_TIMESTAMP)
    ON CONFLICT ("organizationId", "name") DO UPDATE
      SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "name", "sortOrder", "isActive", "createdAt", "updatedAt"
  `;

  return NextResponse.json(formatUnit(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  await ensureUnitTables();

  if (!canManageUnits(actor.role)) {
    return NextResponse.json({ error: "Nur Admins und Geschäftsführung dürfen Einheiten verwalten." }, { status: 403 });
  }

  const id = String(body.id ?? "").trim();
  const name = normalizeUnitName(body.name);
  if (!id || !name) {
    return NextResponse.json({ error: "Bitte eine Einheit angeben." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<UnitRow[]>`
    UPDATE "UnitOption"
    SET "name" = ${name}, "sortOrder" = ${Number(body.sortOrder ?? 999)}, "isActive" = ${body.isActive !== false}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "organizationId" = ${organization.id}
    RETURNING "id", "name", "sortOrder", "isActive", "createdAt", "updatedAt"
  `;
  const unit = rows[0];
  if (!unit) {
    return NextResponse.json({ error: "Einheit wurde nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(formatUnit(unit));
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  await ensureUnitTables();

  if (!canManageUnits(actor.role)) {
    return NextResponse.json({ error: "Nur Admins und Geschäftsführung dürfen Einheiten verwalten." }, { status: 403 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Einheit fehlt." }, { status: 400 });
  }

  await prisma.$executeRaw`
    UPDATE "UnitOption"
    SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "organizationId" = ${organization.id}
  `;

  return NextResponse.json({ ok: true });
}
