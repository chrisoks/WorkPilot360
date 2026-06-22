import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { canManageProjectMarketingQuotas } from "@/lib/permissions";

type MarketingQuotaItemRow = {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  itemType: string | null;
  quantityPerMonth: number;
  description: string | null;
  zohoLink: string | null;
  isActive: boolean;
  startMonth: string | null;
  endMonth: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MarketingQuotaCompletionRow = {
  id: string;
  organizationId: string;
  projectId: string;
  itemId: string;
  month: string;
  completedByUserId: string | null;
  completedByName: string | null;
  completedAt: Date;
  note: string | null;
  revertedAt: Date | null;
  revertedByUserId: string | null;
  revertedByName: string | null;
};

async function ensureMarketingQuotaTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectMarketingQuotaItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "itemType" TEXT,
      "quantityPerMonth" INTEGER NOT NULL DEFAULT 0,
      "description" TEXT,
      "zohoLink" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "startMonth" TEXT,
      "endMonth" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectMarketingQuotaItem"
    ADD COLUMN IF NOT EXISTS "itemType" TEXT
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectMarketingQuotaCompletion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "month" TEXT NOT NULL,
      "completedByUserId" TEXT,
      "completedByName" TEXT,
      "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "note" TEXT,
      "revertedAt" TIMESTAMP(3),
      "revertedByUserId" TEXT,
      "revertedByName" TEXT
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ProjectMarketingQuotaItem_org_project_idx"
    ON "ProjectMarketingQuotaItem" ("organizationId", "projectId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ProjectMarketingQuotaCompletion_org_project_month_idx"
    ON "ProjectMarketingQuotaCompletion" ("organizationId", "projectId", "month")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ProjectMarketingQuotaCompletion_org_item_idx"
    ON "ProjectMarketingQuotaCompletion" ("organizationId", "itemId")
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanString(actorId);
  if (!requestedActorId) return null;

  return users.find((candidate) => candidate.id === requestedActorId && candidate.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

function forbiddenQuotaManagementResponse() {
  return NextResponse.json(
    { error: "Nur Admins und Geschaeftsfuehrung duerfen Marketing-Kontingente konfigurieren." },
    { status: 403 }
  );
}

function cleanMonth(value: unknown) {
  const month = cleanString(value);
  return /^\d{4}-\d{2}$/.test(month) ? month : "";
}

function cleanQuantity(value: unknown) {
  const quantity = Math.round(Number(value));
  return Number.isFinite(quantity) && quantity > 0 ? Math.min(quantity, 999) : 0;
}

function formatDateTime(value: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function formatItem(row: MarketingQuotaItemRow, completions: MarketingQuotaCompletionRow[]) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    itemType: row.itemType ?? "",
    quantityPerMonth: row.quantityPerMonth,
    description: row.description ?? "",
    zohoLink: row.zohoLink ?? "",
    isActive: row.isActive,
    startMonth: row.startMonth ?? "",
    endMonth: row.endMonth ?? "",
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
    completions: completions.map((completion) => ({
      id: completion.id,
      itemId: completion.itemId,
      projectId: completion.projectId,
      month: completion.month,
      completedByUserId: completion.completedByUserId ?? "",
      completedByName: completion.completedByName ?? "",
      completedAt: formatDateTime(completion.completedAt),
      note: completion.note ?? "",
      revertedAt: formatDateTime(completion.revertedAt),
      revertedByUserId: completion.revertedByUserId ?? "",
      revertedByName: completion.revertedByName ?? "",
    })),
  };
}

async function getProjectTrade(organizationId: string, projectId: string) {
  const rows = await prisma.$queryRaw<Array<{ trade: string | null }>>`
    SELECT "trade"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;

  return rows[0]?.trade ?? "";
}

async function getItems(organizationId: string, projectId: string) {
  const items = await prisma.$queryRaw<MarketingQuotaItemRow[]>`
    SELECT *
    FROM "ProjectMarketingQuotaItem"
    WHERE "organizationId" = ${organizationId}
      AND "projectId" = ${projectId}
    ORDER BY "isActive" DESC, "createdAt" ASC
  `;
  const completions = await prisma.$queryRaw<MarketingQuotaCompletionRow[]>`
    SELECT *
    FROM "ProjectMarketingQuotaCompletion"
    WHERE "organizationId" = ${organizationId}
      AND "projectId" = ${projectId}
    ORDER BY "completedAt" DESC
  `;

  return items.map((item) =>
    formatItem(
      item,
      completions.filter((completion) => completion.itemId === item.id)
    )
  );
}

async function insertLogbookEntry(input: {
  organizationId: string;
  projectId: string;
  title: string;
  body: string;
  actorUserId: string;
  actorName: string;
  month: string;
}) {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectLogbookEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "title" TEXT,
      "body" TEXT NOT NULL,
      "author" TEXT,
      "authorUserId" TEXT,
      "colleague" TEXT,
      "visibleFor" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "projectMonth" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "ProjectLogbookEntry" (
      "id",
      "organizationId",
      "projectId",
      "title",
      "body",
      "author",
      "authorUserId",
      "visibleFor",
      "attachments",
      "projectMonth"
    )
    VALUES (
      ${randomUUID()},
      ${input.organizationId},
      ${input.projectId},
      ${input.title},
      ${input.body},
      ${input.actorName || "System"},
      ${input.actorUserId || null},
      ${JSON.stringify(["Geschaeftsfuehrer", "Vertriebler", "Niederlassungsleiter", "Monteur", "Buchhaltung"])}::jsonb,
      ${JSON.stringify([])}::jsonb,
      ${input.month || null}
    )
  `;
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const url = new URL(req.url);
  const actor = getRequestActor(users, url.searchParams.get("actorId"));
  if (!actor) {
    return unauthorizedActorResponse();
  }

  await ensureMarketingQuotaTables();

  const projectId = cleanString(url.searchParams.get("projectId"));
  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  return NextResponse.json(await getItems(organization.id, projectId));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canManageProjectMarketingQuotas(actor)) {
    return forbiddenQuotaManagementResponse();
  }

  await ensureMarketingQuotaTables();

  const projectId = cleanString(body.projectId);
  const name = cleanString(body.name);
  const quantityPerMonth = cleanQuantity(body.quantityPerMonth);
  const id = cleanString(body.id) || randomUUID();

  if (!projectId) return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
  if (quantityPerMonth <= 0) return NextResponse.json({ error: "Menge pro Monat fehlt." }, { status: 400 });

  const trade = await getProjectTrade(organization.id, projectId);
  if (!trade.toLowerCase().includes("marketing")) {
    return NextResponse.json({ error: "Marketing-Kontingente sind nur fuer Marketing-Projekte verfuegbar." }, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO "ProjectMarketingQuotaItem" (
      "id",
      "organizationId",
      "projectId",
      "name",
      "itemType",
      "quantityPerMonth",
      "description",
      "zohoLink",
      "isActive",
      "startMonth",
      "endMonth"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${projectId},
      ${name},
      ${cleanString(body.itemType) || name},
      ${quantityPerMonth},
      ${cleanString(body.description) || null},
      ${cleanString(body.zohoLink) || null},
      ${body.isActive !== false},
      ${cleanMonth(body.startMonth) || null},
      ${cleanMonth(body.endMonth) || null}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "itemType" = EXCLUDED."itemType",
      "quantityPerMonth" = EXCLUDED."quantityPerMonth",
      "description" = EXCLUDED."description",
      "zohoLink" = EXCLUDED."zohoLink",
      "isActive" = EXCLUDED."isActive",
      "startMonth" = EXCLUDED."startMonth",
      "endMonth" = EXCLUDED."endMonth",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return NextResponse.json(await getItems(organization.id, projectId), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  await ensureMarketingQuotaTables();

  const action = cleanString(body.action);
  const projectId = cleanString(body.projectId);
  const itemId = cleanString(body.itemId);
  const month = cleanMonth(body.month);
  const actorUserId = actor.id;
  const actorName = getActorName(actor);

  if (action !== "complete" && action !== "revert-latest") {
    return NextResponse.json({ error: "Aktion nicht unterstuetzt." }, { status: 400 });
  }
  if (!projectId || !itemId || !month) {
    return NextResponse.json({ error: "Projekt, Marketingstueck oder Monat fehlt." }, { status: 400 });
  }

  const trade = await getProjectTrade(organization.id, projectId);
  if (!trade.toLowerCase().includes("marketing")) {
    return NextResponse.json({ error: "Marketing-Kontingente sind nur fuer Marketing-Projekte verfuegbar." }, { status: 400 });
  }

  const itemRows = await prisma.$queryRaw<MarketingQuotaItemRow[]>`
    SELECT *
    FROM "ProjectMarketingQuotaItem"
    WHERE "organizationId" = ${organization.id}
      AND "projectId" = ${projectId}
      AND "id" = ${itemId}
    LIMIT 1
  `;
  const item = itemRows[0];
  if (!item) {
    return NextResponse.json({ error: "Marketingstueck wurde nicht gefunden." }, { status: 404 });
  }

  if (action === "complete" && !item.isActive) {
    return NextResponse.json({ error: "Marketingstueck ist nicht aktiv." }, { status: 400 });
  }

  if (action === "revert-latest") {
    const completionRows = await prisma.$queryRaw<MarketingQuotaCompletionRow[]>`
      SELECT *
      FROM "ProjectMarketingQuotaCompletion"
      WHERE "organizationId" = ${organization.id}
        AND "projectId" = ${projectId}
        AND "itemId" = ${itemId}
        AND "month" = ${month}
        AND "revertedAt" IS NULL
      ORDER BY "completedAt" DESC
      LIMIT 1
    `;
    const completion = completionRows[0];
    if (!completion) {
      return NextResponse.json({ error: "Kein erledigter Eintrag zum Zuruecksetzen gefunden." }, { status: 404 });
    }

    await prisma.$executeRaw`
      UPDATE "ProjectMarketingQuotaCompletion"
      SET "revertedAt" = CURRENT_TIMESTAMP,
          "revertedByUserId" = ${actorUserId || null},
          "revertedByName" = ${actorName}
      WHERE "id" = ${completion.id}
        AND "organizationId" = ${organization.id}
    `;

    await insertLogbookEntry({
      organizationId: organization.id,
      projectId,
      title: "Marketing-Kontingent",
      body: `${item.name} zurueckgesetzt. Monat ${month}. Zurueckgesetzt von ${actorName}.`,
      actorUserId,
      actorName,
      month,
    });

    return NextResponse.json(await getItems(organization.id, projectId));
  }

  const activeCompletionRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "ProjectMarketingQuotaCompletion"
    WHERE "organizationId" = ${organization.id}
      AND "projectId" = ${projectId}
      AND "itemId" = ${itemId}
      AND "month" = ${month}
      AND "revertedAt" IS NULL
  `;
  const doneCount = Number(activeCompletionRows[0]?.count ?? 0);
  if (doneCount >= item.quantityPerMonth) {
    return NextResponse.json({ error: "Das Monatskontingent ist bereits erfuellt." }, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO "ProjectMarketingQuotaCompletion" (
      "id",
      "organizationId",
      "projectId",
      "itemId",
      "month",
      "completedByUserId",
      "completedByName",
      "note"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${projectId},
      ${itemId},
      ${month},
      ${actorUserId || null},
      ${actorName},
      ${cleanString(body.note) || null}
    )
  `;

  await insertLogbookEntry({
    organizationId: organization.id,
    projectId,
    title: "Marketing-Kontingent",
    body: `${item.name} erledigt. Stand ${month}: ${doneCount + 1}/${item.quantityPerMonth}. Erfasst von ${actorName}.`,
    actorUserId,
    actorName,
    month,
  });

  return NextResponse.json(await getItems(organization.id, projectId));
}
