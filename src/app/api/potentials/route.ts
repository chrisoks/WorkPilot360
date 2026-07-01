import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { recordStatusTransition, seedCurrentStatusTimeline } from "@/lib/status-tracking";
import {
  canAssignSalesItemsToOthers,
  canCreateProjectPotentials,
  canManageOwnedSalesItem,
} from "@/lib/permissions";

type PotentialRow = {
  id: string;
  organizationId: string;
  number: string | null;
  contactId: string | null;
  customerName: string | null;
  projectId: string;
  projectLabel: string | null;
  description: string;
  status: string;
  ownerUserId: string | null;
  ownerName: string | null;
  estimatedValue: unknown;
  priority: string | null;
  nextStep: string | null;
  lostReason: string | null;
  sourceType: string | null;
  sourceLogbookEntryId: string | null;
  taskId: string | null;
  followUpAt: Date | null;
  offeredAt: Date | null;
  closedAt: Date | null;
  history: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isNoUpsellDescription(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  return (
    /^(nein|nein danke|keine|kein|keine verkaufschance|kein zusatzverkauf|nicht vorhanden)$/i.test(normalized) ||
    /^nein\b/i.test(normalized)
  );
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  return ["open", "follow_up", "offered", "lost", "completed"].includes(status) ? status : "open";
}

function cleanPriority(value: unknown) {
  const priority = cleanString(value);
  return ["low", "normal", "high"].includes(priority) ? priority : "normal";
}

function cleanDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
}

function cleanHistory(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function formatPotentialNumber(value: number) {
  return `VC-${String(value).padStart(4, "0")}`;
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function forbiddenPotentialResponse() {
  return NextResponse.json(
    { error: "Du darfst diesen Zusatzverkauf nicht bearbeiten." },
    { status: 403 }
  );
}

async function ensurePotentialTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectPotential" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "number" TEXT,
      "contactId" TEXT,
      "customerName" TEXT,
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "description" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'open',
      "ownerUserId" TEXT,
      "ownerName" TEXT,
      "estimatedValue" DECIMAL(12,2),
      "priority" TEXT NOT NULL DEFAULT 'normal',
      "nextStep" TEXT,
      "lostReason" TEXT,
      "sourceType" TEXT,
      "sourceLogbookEntryId" TEXT,
      "taskId" TEXT,
      "followUpAt" TIMESTAMP(3),
      "offeredAt" TIMESTAMP(3),
      "closedAt" TIMESTAMP(3),
      "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectPotential"
    ADD COLUMN IF NOT EXISTS "number" TEXT,
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerName" TEXT,
    ADD COLUMN IF NOT EXISTS "projectLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "ownerName" TEXT,
    ADD COLUMN IF NOT EXISTS "estimatedValue" DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS "nextStep" TEXT,
    ADD COLUMN IF NOT EXISTS "lostReason" TEXT,
    ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
    ADD COLUMN IF NOT EXISTS "sourceLogbookEntryId" TEXT,
    ADD COLUMN IF NOT EXISTS "taskId" TEXT,
    ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "offeredAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "ProjectPotential_organizationId_number_key"
    ON "ProjectPotential" ("organizationId", "number")
    WHERE "number" IS NOT NULL
  `;
}

async function getNextPotentialNumberValue(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ nextValue: number | bigint | null }>>`
    SELECT COALESCE(MAX((SUBSTRING("number" FROM 4))::int), 1000) + 1 AS "nextValue"
    FROM "ProjectPotential"
    WHERE "organizationId" = ${organizationId}
      AND "number" ~ '^VC-[0-9]+$'
  `;

  return Number(rows[0]?.nextValue ?? 1001);
}

async function ensurePotentialNumbers(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "ProjectPotential"
    WHERE "organizationId" = ${organizationId}
      AND ("number" IS NULL OR "number" = '')
    ORDER BY "createdAt" ASC, "id" ASC
  `;

  let nextValue = await getNextPotentialNumberValue(organizationId);

  for (const row of rows) {
    const nextNumber = formatPotentialNumber(nextValue);
    nextValue += 1;

    await prisma.$executeRaw`
      UPDATE "ProjectPotential"
      SET "number" = ${nextNumber}
      WHERE "id" = ${row.id}
        AND "organizationId" = ${organizationId}
        AND ("number" IS NULL OR "number" = '')
    `;
  }
}

function formatPotential(row: PotentialRow) {
  return {
    id: row.id,
    number: row.number ?? "",
    contactId: row.contactId ?? "",
    customerName: row.customerName ?? "",
    projectId: row.projectId,
    projectLabel: row.projectLabel ?? "",
    description: row.description,
    status: cleanStatus(row.status),
    ownerUserId: row.ownerUserId ?? "",
    ownerName: row.ownerName ?? "",
    estimatedValue: row.estimatedValue === null || row.estimatedValue === undefined ? "" : String(row.estimatedValue),
    priority: cleanPriority(row.priority),
    nextStep: row.nextStep ?? "",
    lostReason: row.lostReason ?? "",
    sourceType: row.sourceType ?? "",
    sourceLogbookEntryId: row.sourceLogbookEntryId ?? "",
    taskId: row.taskId ?? "",
    followUpAt: row.followUpAt?.toISOString() ?? "",
    offeredAt: row.offeredAt?.toISOString() ?? "",
    closedAt: row.closedAt?.toISOString() ?? "",
    history: cleanHistory(row.history),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const requestedActorId = url.searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  await ensurePotentialTable();
  await ensurePotentialNumbers(organization.id);

  const legacyRows = await prisma.$queryRaw<Array<{ projectId: string; body: string; author: string | null; createdAt: Date }>>`
    SELECT "projectId", "body", "author", "createdAt"
    FROM "ProjectLogbookEntry"
    WHERE "organizationId" = ${organization.id}
      AND "title" = 'Zusatzverkauf: Potenzial nachfassen'
      AND NOT EXISTS (
        SELECT 1
        FROM "ProjectPotential"
        WHERE "ProjectPotential"."organizationId" = ${organization.id}
          AND "ProjectPotential"."projectId" = "ProjectLogbookEntry"."projectId"
          AND "ProjectPotential"."status" IN ('open', 'follow_up')
      )
  `;

  for (const legacy of legacyRows) {
    const history = [
      {
        at: legacy.createdAt.toISOString(),
        actor: legacy.author || "System",
        action: "follow_up",
        note: legacy.body,
      },
    ];

    await prisma.$executeRaw`
      INSERT INTO "ProjectPotential" (
        "id",
        "organizationId",
      "projectId",
      "description",
      "status",
      "priority",
      "history",
      "createdAt",
      "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${legacy.projectId},
        ${legacy.body || "Zusatzverkaufspotenzial"},
        'follow_up',
        'normal',
        ${JSON.stringify(history)}::jsonb,
        ${legacy.createdAt},
        CURRENT_TIMESTAMP
      )
    `;
  }

  await ensurePotentialNumbers(organization.id);

  const rows = await prisma.$queryRaw<PotentialRow[]>`
    SELECT *
    FROM "ProjectPotential"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `;

  return NextResponse.json(rows.filter((row) => !isNoUpsellDescription(row.description)).map(formatPotential));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canCreateProjectPotentials(actor)) {
    return forbiddenPotentialResponse();
  }

  await ensurePotentialTable();

  const projectId = cleanString(body.projectId);
  const description = cleanString(body.description);
  if (!projectId || !description) {
    return NextResponse.json({ error: "Projekt und Potenzialbeschreibung sind erforderlich." }, { status: 400 });
  }
  if (isNoUpsellDescription(description)) {
    return NextResponse.json({ error: "Ohne echte Zusatzverkaufsmöglichkeit wird kein Zusatzverkauf angelegt." }, { status: 400 });
  }

  const history = [
    {
      at: new Date().toISOString(),
      actor: getUserName(actor),
      action: "created",
      note: "Potenzial erkannt.",
    },
  ];
  const estimatedValue = cleanDecimal(body.estimatedValue);
  const requestedOwner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId) && candidate.isActive);
  const owner = requestedOwner && canAssignSalesItemsToOthers(actor) ? requestedOwner : actor;
  await ensurePotentialNumbers(organization.id);
  const nextNumber = formatPotentialNumber(await getNextPotentialNumberValue(organization.id));

  const rows = await prisma.$queryRaw<PotentialRow[]>`
    INSERT INTO "ProjectPotential" (
      "id",
      "organizationId",
      "number",
      "contactId",
      "customerName",
      "projectId",
      "projectLabel",
      "description",
      "status",
      "ownerUserId",
      "ownerName",
      "estimatedValue",
      "priority",
      "nextStep",
      "sourceType",
      "sourceLogbookEntryId",
      "history"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${nextNumber},
      ${cleanString(body.contactId) || null},
      ${cleanString(body.customerName) || null},
      ${projectId},
      ${cleanString(body.projectLabel) || null},
      ${description},
      'open',
      ${owner.id},
      ${getUserName(owner)},
      ${estimatedValue},
      ${cleanPriority(body.priority)},
      ${cleanString(body.nextStep) || null},
      ${cleanString(body.sourceType) || "final_inspection"},
      ${cleanString(body.sourceLogbookEntryId) || null},
      ${JSON.stringify(history)}::jsonb
    )
    RETURNING *
  `;

  await seedCurrentStatusTimeline({
    organizationId: organization.id,
    entityType: "potential",
    entityId: rows[0].id,
    entityLabel: rows[0].description,
    status: rows[0].status,
    startedAt: rows[0].createdAt,
  });

  return NextResponse.json(formatPotential(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actorUser = actorResult.actor;

  await ensurePotentialTable();

  const id = cleanString(body.id);
  if (!id) {
    return NextResponse.json({ error: "Potenzial fehlt." }, { status: 400 });
  }

  const currentRows = await prisma.$queryRaw<PotentialRow[]>`
    SELECT *
    FROM "ProjectPotential"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const current = currentRows[0];
  if (!current) {
    return NextResponse.json({ error: "Potenzial wurde nicht gefunden." }, { status: 404 });
  }
  if (!canManageOwnedSalesItem(actorUser, current)) {
    return forbiddenPotentialResponse();
  }

  const nextStatus = cleanStatus(body.status || current.status);
  const note = cleanString(body.note);
  const actor = getUserName(actorUser);
  const now = new Date();
  const estimatedValue = cleanDecimal(body.estimatedValue);
  const hasEstimatedValueUpdate = Object.prototype.hasOwnProperty.call(body, "estimatedValue");
  const hasOwnerUserIdUpdate = Object.prototype.hasOwnProperty.call(body, "ownerUserId");
  const hasOwnerNameUpdate = Object.prototype.hasOwnProperty.call(body, "ownerName");
  const hasPriorityUpdate = Object.prototype.hasOwnProperty.call(body, "priority");
  const hasNextStepUpdate = Object.prototype.hasOwnProperty.call(body, "nextStep");
  const hasLostReasonUpdate = Object.prototype.hasOwnProperty.call(body, "lostReason");
  const hasDescriptionUpdate = Object.prototype.hasOwnProperty.call(body, "description");
  const requestedOwner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId) && candidate.isActive);
  const owner = requestedOwner && canAssignSalesItemsToOthers(actorUser) ? requestedOwner : null;
  const history = [
    ...cleanHistory(current.history),
    {
      at: now.toISOString(),
      actor,
      action: nextStatus,
      note,
    },
  ];

  const rows = await prisma.$queryRaw<PotentialRow[]>`
    UPDATE "ProjectPotential"
    SET
      "status" = ${nextStatus},
      "description" = CASE WHEN ${hasDescriptionUpdate} AND ${cleanString(body.description)} <> '' THEN ${cleanString(body.description)} ELSE "description" END,
      "ownerUserId" = CASE WHEN ${hasOwnerUserIdUpdate} AND ${canAssignSalesItemsToOthers(actorUser)} THEN ${owner?.id ?? null} ELSE "ownerUserId" END,
      "ownerName" = CASE WHEN ${hasOwnerNameUpdate} AND ${canAssignSalesItemsToOthers(actorUser)} THEN ${owner ? getUserName(owner) : null} ELSE "ownerName" END,
      "estimatedValue" = CASE WHEN ${hasEstimatedValueUpdate} THEN ${estimatedValue} ELSE "estimatedValue" END,
      "priority" = CASE WHEN ${hasPriorityUpdate} THEN ${cleanPriority(body.priority)} ELSE "priority" END,
      "nextStep" = CASE WHEN ${hasNextStepUpdate} THEN ${cleanString(body.nextStep) || null} ELSE "nextStep" END,
      "lostReason" = CASE
        WHEN ${nextStatus} = 'lost' AND ${hasLostReasonUpdate} THEN ${cleanString(body.lostReason) || null}
        WHEN ${nextStatus} = 'lost' AND ${note} <> '' THEN ${note}
        ELSE "lostReason"
      END,
      "taskId" = COALESCE(${cleanString(body.taskId) || null}, "taskId"),
      "followUpAt" = CASE
        WHEN ${nextStatus} = 'follow_up' THEN ${cleanString(body.followUpAt) ? new Date(cleanString(body.followUpAt)) : null}
        ELSE "followUpAt"
      END,
      "offeredAt" = CASE WHEN ${nextStatus} = 'offered' THEN ${now} ELSE "offeredAt" END,
      "closedAt" = CASE WHEN ${nextStatus} IN ('offered', 'lost', 'completed') THEN ${now} ELSE "closedAt" END,
      "history" = ${JSON.stringify(history)}::jsonb,
      "updatedAt" = ${now}
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;

  await recordStatusTransition({
    organizationId: organization.id,
    entityType: "potential",
    entityId: current.id,
    entityLabel: current.description,
    fromStatus: current.status,
    toStatus: rows[0].status,
    actorUserId: actorUser.id,
    actorName: actor,
    note,
    at: now,
  });

  return NextResponse.json(formatPotential(rows[0]));
}
