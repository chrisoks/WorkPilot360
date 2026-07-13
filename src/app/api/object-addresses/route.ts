import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { canManageContacts, canReadContacts } from "@/lib/permissions";

type ObjectAddressRow = {
  id: string;
  organizationId: string;
  customerId: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureObjectAddressTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ObjectAddress" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "customerId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "street" TEXT NOT NULL,
      "postalCode" TEXT NOT NULL,
      "city" TEXT NOT NULL,
      "country" TEXT NOT NULL DEFAULT 'Deutschland',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ObjectAddress_organizationId_customerId_idx"
    ON "ObjectAddress" ("organizationId", "customerId")
  `;
}

function formatObjectAddress(row: ObjectAddressRow) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function customerBelongsToOrganization(organizationId: string, customerId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${customerId}
    LIMIT 1
  `;
  return rows.length === 1;
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canReadContacts(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Objektadressen nicht anzeigen." }, { status: 403 });
  }

  await ensureObjectAddressTable();
  const customerId = cleanString(searchParams.get("customerId"));
  const rows = customerId
    ? await prisma.$queryRaw<ObjectAddressRow[]>`
        SELECT * FROM "ObjectAddress"
        WHERE "organizationId" = ${organization.id}
          AND "customerId" = ${customerId}
        ORDER BY "isActive" DESC, "name" ASC, "city" ASC
      `
    : await prisma.$queryRaw<ObjectAddressRow[]>`
        SELECT * FROM "ObjectAddress"
        WHERE "organizationId" = ${organization.id}
        ORDER BY "isActive" DESC, "name" ASC, "city" ASC
      `;

  return NextResponse.json(rows.map(formatObjectAddress));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageContacts(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Objektadressen nicht verwalten." }, { status: 403 });
  }

  const id = cleanString(body.id) || randomUUID();
  const customerId = cleanString(body.customerId);
  const name = cleanString(body.name);
  const street = cleanString(body.street);
  const postalCode = cleanString(body.postalCode);
  const city = cleanString(body.city);
  const country = cleanString(body.country) || "Deutschland";
  const isActive = body.isActive !== false;

  if (!customerId || !name || !street || !postalCode || !city) {
    return NextResponse.json(
      { error: "Bezeichnung, Straße, PLZ und Ort sind für eine Objektadresse Pflicht." },
      { status: 400 }
    );
  }
  if (!(await customerBelongsToOrganization(organization.id, customerId))) {
    return NextResponse.json({ error: "Der ausgewählte Kunde ist ungültig." }, { status: 400 });
  }

  await ensureObjectAddressTable();
  const rows = await prisma.$queryRaw<ObjectAddressRow[]>`
    INSERT INTO "ObjectAddress" (
      "id", "organizationId", "customerId", "name", "street", "postalCode", "city", "country", "isActive"
    ) VALUES (
      ${id}, ${organization.id}, ${customerId}, ${name}, ${street}, ${postalCode}, ${city}, ${country}, ${isActive}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "customerId" = EXCLUDED."customerId",
      "name" = EXCLUDED."name",
      "street" = EXCLUDED."street",
      "postalCode" = EXCLUDED."postalCode",
      "city" = EXCLUDED."city",
      "country" = EXCLUDED."country",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "ObjectAddress"."organizationId" = ${organization.id}
    RETURNING *
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: "Objektadresse wurde nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json(formatObjectAddress(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  return POST(req);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageContacts(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Objektadressen nicht verwalten." }, { status: 403 });
  }

  const id = cleanString(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Objektadresse fehlt." }, { status: 400 });
  await ensureObjectAddressTable();
  const rows = await prisma.$queryRaw<ObjectAddressRow[]>`
    UPDATE "ObjectAddress"
    SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organization.id}
      AND "id" = ${id}
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ error: "Objektadresse wurde nicht gefunden." }, { status: 404 });
  return NextResponse.json(formatObjectAddress(rows[0]));
}
