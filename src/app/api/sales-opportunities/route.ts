import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionUserActor } from "@/lib/auth/actor";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";
import { canAssignSalesItemsToOthers, canManageOwnedSalesItem, canManageSalesPipeline } from "@/lib/permissions";

type OpportunityRow = {
  id: string;
  title: string;
  customerName: string;
  contactId: string | null;
  projectId: string | null;
  offerId: string | null;
  ownerUserId: string | null;
  ownerName: string;
  stage: string;
  estimatedValue: number;
  probability: number;
  nextAction: string;
  nextActionAt: Date | null;
  source: string;
  notes: string;
  history: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ActivityRow = {
  id: string;
  opportunityId: string;
  type: string;
  body: string;
  actorName: string;
  createdAt: Date;
};

const allowedStages = ["lead", "qualified", "first_contact", "offer", "negotiation", "won", "lost"];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanStage(value: unknown) {
  const stage = cleanString(value);
  return allowedStages.includes(stage) ? stage : "lead";
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
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

function forbiddenSalesResponse() {
  return NextResponse.json(
    { error: "Du darfst diese Vertriebsdaten nicht bearbeiten." },
    { status: 403 }
  );
}

function formatOpportunity(row: OpportunityRow, activities: ActivityRow[]) {
  return {
    id: row.id,
    title: row.title,
    customerName: row.customerName,
    contactId: row.contactId ?? "",
    projectId: row.projectId ?? "",
    offerId: row.offerId ?? "",
    ownerUserId: row.ownerUserId ?? "",
    ownerName: row.ownerName,
    stage: row.stage,
    estimatedValue: row.estimatedValue,
    probability: row.probability,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt?.toISOString() ?? "",
    source: row.source,
    notes: row.notes,
    history: Array.isArray(row.history) ? row.history : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    activities: activities
      .filter((activity) => activity.opportunityId === row.id)
      .map((activity) => ({
        id: activity.id,
        opportunityId: activity.opportunityId,
        type: activity.type,
        body: activity.body,
        actorName: activity.actorName,
        createdAt: activity.createdAt.toISOString(),
      })),
  };
}

export async function GET(req: Request) {
  await ensureSalesHubTables();
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const requestedActorId = url.searchParams.get("actorId");
  const actor =
    getRequestActor(users, requestedActorId) ??
    (!cleanString(requestedActorId) ? await getSessionUserActor(req, users) : null);
  if (!actor) {
    return cleanString(requestedActorId) ? unauthorizedActorResponse() : NextResponse.json([]);
  }

  const rows = await prisma.$queryRaw<OpportunityRow[]>`
    SELECT *
    FROM "SalesOpportunity"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "updatedAt" DESC
  `;
  const ids = rows.map((row) => row.id);
  const activities = ids.length
    ? await prisma.$queryRaw<ActivityRow[]>`
        SELECT id, "opportunityId", type, body, "actorName", "createdAt"
        FROM "SalesActivity"
        WHERE "organizationId" = ${organization.id}
          AND "opportunityId" IN (${Prisma.join(ids)})
        ORDER BY "createdAt" DESC
      `
    : [];
  return NextResponse.json(rows.map((row) => formatOpportunity(row, activities)));
}

export async function POST(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canManageSalesPipeline(actor)) {
    return forbiddenSalesResponse();
  }

  const requestedOwner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId) && candidate.isActive);
  const owner = requestedOwner && canAssignSalesItemsToOthers(actor) ? requestedOwner : actor;
  const title = cleanString(body.title);

  if (!title) {
    return NextResponse.json({ error: "Bitte einen Titel fuer die Chance angeben." }, { status: 400 });
  }

  const id = randomUUID();
  const history = [
    {
      at: new Date().toISOString(),
      actor: getUserName(actor),
      action: "created",
      note: "Chance angelegt",
    },
  ];

  await prisma.$executeRaw`
    INSERT INTO "SalesOpportunity" (
      "id", "organizationId", "title", "customerName", "contactId", "projectId", "offerId",
      "ownerUserId", "ownerName", "stage", "estimatedValue", "probability",
      "nextAction", "nextActionAt", "source", "notes", "history"
    ) VALUES (
      ${id}, ${organization.id}, ${title}, ${cleanString(body.customerName)}, ${cleanString(body.contactId) || null},
      ${cleanString(body.projectId) || null}, ${cleanString(body.offerId) || null},
      ${owner.id}, ${getUserName(owner)},
      ${cleanStage(body.stage)}, ${cleanNumber(body.estimatedValue)}, ${Math.max(0, Math.min(100, Math.round(cleanNumber(body.probability))))},
      ${cleanString(body.nextAction)}, ${cleanString(body.nextActionAt) ? new Date(cleanString(body.nextActionAt)) : null},
      ${cleanString(body.source)}, ${cleanString(body.notes)}, ${JSON.stringify(history)}::jsonb
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "SalesActivity" ("id", "organizationId", "opportunityId", "type", "body", "actorUserId", "actorName")
    VALUES (${randomUUID()}, ${organization.id}, ${id}, 'created', 'Chance angelegt', ${actor.id}, ${getUserName(actor)})
  `;

  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canManageSalesPipeline(actor)) {
    return forbiddenSalesResponse();
  }

  const id = cleanString(body.id);
  const title = cleanString(body.title);

  if (!id || !title) {
    return NextResponse.json({ error: "Bitte Chance und Titel angeben." }, { status: 400 });
  }

  const currentRows = await prisma.$queryRaw<OpportunityRow[]>`
    SELECT *
    FROM "SalesOpportunity"
    WHERE "organizationId" = ${organization.id}
      AND id = ${id}
    LIMIT 1
  `;
  const current = currentRows[0];
  if (!current) {
    return NextResponse.json({ error: "Chance wurde nicht gefunden." }, { status: 404 });
  }
  if (!canManageOwnedSalesItem(actor, current)) {
    return forbiddenSalesResponse();
  }

  const requestedOwner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId) && candidate.isActive);
  const owner = requestedOwner && canAssignSalesItemsToOthers(actor) ? requestedOwner : null;

  await prisma.$executeRaw`
    UPDATE "SalesOpportunity"
    SET
      "title" = ${title},
      "customerName" = ${cleanString(body.customerName)},
      "contactId" = ${cleanString(body.contactId) || null},
      "projectId" = ${cleanString(body.projectId) || null},
      "offerId" = ${cleanString(body.offerId) || null},
      "ownerUserId" = ${owner?.id ?? current.ownerUserId},
      "ownerName" = ${owner ? getUserName(owner) : current.ownerName},
      "stage" = ${cleanStage(body.stage)},
      "estimatedValue" = ${cleanNumber(body.estimatedValue)},
      "probability" = ${Math.max(0, Math.min(100, Math.round(cleanNumber(body.probability))))},
      "nextAction" = ${cleanString(body.nextAction)},
      "nextActionAt" = ${cleanString(body.nextActionAt) ? new Date(cleanString(body.nextActionAt)) : null},
      "source" = ${cleanString(body.source)},
      "notes" = ${cleanString(body.notes)},
      "updatedAt" = CURRENT_TIMESTAMP,
      "history" = COALESCE("history", '[]'::jsonb) || ${JSON.stringify([
        { at: new Date().toISOString(), actor: getUserName(actor), action: "updated", note: "Chance aktualisiert" },
      ])}::jsonb
    WHERE "organizationId" = ${organization.id}
      AND id = ${id}
  `;

  await prisma.$executeRaw`
    INSERT INTO "SalesActivity" ("id", "organizationId", "opportunityId", "type", "body", "actorUserId", "actorName")
    VALUES (${randomUUID()}, ${organization.id}, ${id}, 'updated', 'Chance aktualisiert', ${actor.id}, ${getUserName(actor)})
  `;

  return NextResponse.json({ success: true });
}
