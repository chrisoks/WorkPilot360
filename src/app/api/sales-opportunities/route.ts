import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";

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

export async function GET() {
  await ensureSalesHubTables();
  const { organization } = await getDemoContext();
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
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((candidate) => candidate.id === cleanString(body.actorId)) ?? user;
  const owner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId));
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
      ${owner?.id ?? actor.id}, ${owner ? getUserName(owner) : getUserName(actor)},
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
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((candidate) => candidate.id === cleanString(body.actorId)) ?? user;
  const id = cleanString(body.id);
  const owner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId));
  const title = cleanString(body.title);

  if (!id || !title) {
    return NextResponse.json({ error: "Bitte Chance und Titel angeben." }, { status: 400 });
  }

  await prisma.$executeRaw`
    UPDATE "SalesOpportunity"
    SET
      "title" = ${title},
      "customerName" = ${cleanString(body.customerName)},
      "contactId" = ${cleanString(body.contactId) || null},
      "projectId" = ${cleanString(body.projectId) || null},
      "offerId" = ${cleanString(body.offerId) || null},
      "ownerUserId" = ${owner?.id ?? (cleanString(body.ownerUserId) || null)},
      "ownerName" = ${owner ? getUserName(owner) : cleanString(body.ownerName)},
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
