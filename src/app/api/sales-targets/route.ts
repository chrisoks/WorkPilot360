import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";
import { recordStatusTransition, seedCurrentStatusTimeline } from "@/lib/status-tracking";
import { Role } from "@prisma/client";

type SalesTargetRow = {
  id: string;
  organizationId: string;
  contactId: string | null;
  projectId: string | null;
  customerName: string;
  projectLabel: string;
  title: string;
  description: string;
  ownerUserId: string | null;
  ownerName: string;
  priority: string;
  metricKey: string;
  targetValue: number;
  periodStart: string;
  periodEnd: string;
  targetMonth: string;
  followUpAt: Date | null;
  status: string;
  history: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  return ["open", "in_contact", "done", "discarded"].includes(status) ? status : "open";
}

function cleanPriority(value: unknown) {
  const priority = cleanString(value);
  return ["low", "normal", "high"].includes(priority) ? priority : "normal";
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function forbiddenSalesResponse() {
  return NextResponse.json(
    { error: "Du darfst diese Vertriebsziele nicht bearbeiten." },
    { status: 403 }
  );
}

function formatSalesTarget(row: SalesTargetRow) {
  return {
    id: row.id,
    contactId: row.contactId ?? "",
    projectId: row.projectId ?? "",
    customerName: row.customerName ?? "",
    projectLabel: row.projectLabel ?? "",
    title: row.title,
    description: row.description ?? "",
    ownerUserId: row.ownerUserId ?? "",
    ownerName: row.ownerName ?? "",
    priority: cleanPriority(row.priority),
    metricKey: row.metricKey ?? "",
    targetValue: Number(row.targetValue) || 0,
    periodStart: row.periodStart ?? "",
    periodEnd: row.periodEnd ?? "",
    targetMonth: row.targetMonth ?? "",
    followUpAt: row.followUpAt?.toISOString() ?? "",
    status: cleanStatus(row.status),
    history: Array.isArray(row.history) ? row.history : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  await ensureSalesHubTables();
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const requestedActorId = url.searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const rows = await prisma.$queryRaw<SalesTargetRow[]>`
    SELECT *
    FROM "SalesTarget"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `;

  const visibleOwnerIds = await getVisibleGoalOwnerIds(actorResult.actor, users);
  const visibleOwnerNames = new Set(
    users
      .filter((user) => visibleOwnerIds.has(user.id))
      .map((user) => getUserName(user).trim().toLocaleLowerCase("de-DE"))
  );
  return NextResponse.json(
    (canManageGoals(actorResult.actor)
      ? rows
      : rows.filter(
          (row) =>
            (row.ownerUserId && visibleOwnerIds.has(row.ownerUserId)) ||
            visibleOwnerNames.has(row.ownerName.trim().toLocaleLowerCase("de-DE"))
        )
    ).map(formatSalesTarget)
  );
}

export async function POST(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageGoals(actor)) {
    return forbiddenSalesResponse();
  }
  const requestedOwner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId) && candidate.isActive);
  const owner = requestedOwner ?? actor;
  const title = cleanString(body.title);
  const now = new Date();

  if (!title) {
    return NextResponse.json({ error: "Bitte ein Ziel angeben." }, { status: 400 });
  }

  const history = [
    {
      at: now.toISOString(),
      actor: getUserName(actor),
      action: "created",
      note: "Ziel angelegt.",
    },
  ];

  const rows = await prisma.$queryRaw<SalesTargetRow[]>`
    INSERT INTO "SalesTarget" (
      "id",
      "organizationId",
      "contactId",
      "projectId",
      "customerName",
      "projectLabel",
      "title",
      "description",
      "ownerUserId",
      "ownerName",
      "priority",
      "metricKey",
      "targetValue",
      "periodStart",
      "periodEnd",
      "targetMonth",
      "followUpAt",
      "status",
      "history"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${cleanString(body.contactId) || null},
      ${cleanString(body.projectId) || null},
      ${cleanString(body.customerName)},
      ${cleanString(body.projectLabel)},
      ${title},
      ${cleanString(body.description)},
      ${owner.id},
      ${getUserName(owner)},
      ${cleanPriority(body.priority)},
      ${cleanString(body.metricKey)},
      ${Math.max(0, Number(body.targetValue) || 0)},
      ${cleanString(body.periodStart)},
      ${cleanString(body.periodEnd)},
      ${cleanString(body.targetMonth)},
      ${cleanString(body.followUpAt) ? new Date(cleanString(body.followUpAt)) : null},
      ${cleanStatus(body.status)},
      ${JSON.stringify(history)}::jsonb
    )
    RETURNING *
  `;

  await seedCurrentStatusTimeline({
    organizationId: organization.id,
    entityType: "sales_target",
    entityId: rows[0].id,
    entityLabel: rows[0].title,
    status: rows[0].status,
    startedAt: rows[0].createdAt,
  });

  return NextResponse.json(formatSalesTarget(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageGoals(actor)) {
    return forbiddenSalesResponse();
  }
  const id = cleanString(body.id);
  const now = new Date();

  if (!id) {
    return NextResponse.json({ error: "Ziel fehlt." }, { status: 400 });
  }

  const currentRows = await prisma.$queryRaw<SalesTargetRow[]>`
    SELECT *
    FROM "SalesTarget"
    WHERE "organizationId" = ${organization.id}
      AND "id" = ${id}
    LIMIT 1
  `;
  const current = currentRows[0];
  if (!current) {
    return NextResponse.json({ error: "Ziel wurde nicht gefunden." }, { status: 404 });
  }
  const requestedOwner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId) && candidate.isActive);
  const owner = requestedOwner ?? null;
  const nextStatus = cleanStatus(body.status || current.status);
  const history = [
    ...(Array.isArray(current.history) ? current.history : []),
    {
      at: now.toISOString(),
      actor: getUserName(actor),
      action: nextStatus,
      note: cleanString(body.note) || "Ziel aktualisiert.",
    },
  ];

  const rows = await prisma.$queryRaw<SalesTargetRow[]>`
    UPDATE "SalesTarget"
    SET
      "contactId" = ${cleanString(body.contactId) || null},
      "projectId" = ${cleanString(body.projectId) || null},
      "customerName" = ${cleanString(body.customerName)},
      "projectLabel" = ${cleanString(body.projectLabel)},
      "title" = ${cleanString(body.title) || current.title},
      "description" = ${cleanString(body.description)},
      "ownerUserId" = ${owner?.id ?? current.ownerUserId},
      "ownerName" = ${owner ? getUserName(owner) : current.ownerName},
      "priority" = ${cleanPriority(body.priority)},
      "metricKey" = ${cleanString(body.metricKey)},
      "targetValue" = ${Math.max(0, Number(body.targetValue) || 0)},
      "periodStart" = ${cleanString(body.periodStart)},
      "periodEnd" = ${cleanString(body.periodEnd)},
      "targetMonth" = ${cleanString(body.targetMonth)},
      "followUpAt" = ${cleanString(body.followUpAt) ? new Date(cleanString(body.followUpAt)) : null},
      "status" = ${nextStatus},
      "history" = ${JSON.stringify(history)}::jsonb,
      "updatedAt" = ${now}
    WHERE "organizationId" = ${organization.id}
      AND "id" = ${id}
    RETURNING *
  `;

  await recordStatusTransition({
    organizationId: organization.id,
    entityType: "sales_target",
    entityId: current.id,
    entityLabel: current.title,
    fromStatus: current.status,
    toStatus: rows[0].status,
    actorUserId: actor.id,
    actorName: getUserName(actor),
    note: cleanString(body.note) || "Ziel aktualisiert.",
    at: now,
  });

  return NextResponse.json(formatSalesTarget(rows[0]));
}

function canManageGoals(actor: { role: Role }) {
  return actor.role === Role.ADMIN || actor.role === Role.GESCHAEFTSFUEHRER;
}

async function getVisibleGoalOwnerIds(
  actor: { id: string; role: Role; teamId?: string | null },
  users: Array<{ id: string; teamId?: string | null }>
) {
  if (canManageGoals(actor)) return new Set(users.map((user) => user.id));
  if (actor.role !== Role.FUEHRUNGSKRAFT) return new Set([actor.id]);

  const memberships = await prisma.$queryRaw<Array<{ userId: string; teamId: string }>>`
    SELECT "userId", "teamId" FROM "UserTeamMembership"
  `;
  const actorTeamIds = new Set(
    memberships.filter((membership) => membership.userId === actor.id).map((membership) => membership.teamId)
  );
  if (actor.teamId) actorTeamIds.add(actor.teamId);

  return new Set(
    users
      .filter((user) =>
        user.id === actor.id ||
        Boolean(user.teamId && actorTeamIds.has(user.teamId)) ||
        memberships.some((membership) => membership.userId === user.id && actorTeamIds.has(membership.teamId))
      )
      .map((user) => user.id)
  );
}

export async function DELETE(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageGoals(actor)) {
    return forbiddenSalesResponse();
  }

  const id = cleanString(body.id);
  const now = new Date();

  if (!id) {
    return NextResponse.json({ error: "Ziel fehlt." }, { status: 400 });
  }

  const currentRows = await prisma.$queryRaw<SalesTargetRow[]>`
    SELECT *
    FROM "SalesTarget"
    WHERE "organizationId" = ${organization.id}
      AND "id" = ${id}
    LIMIT 1
  `;
  const current = currentRows[0];
  if (!current) {
    return NextResponse.json({ error: "Ziel wurde nicht gefunden." }, { status: 404 });
  }
  const history = [
    ...(Array.isArray(current.history) ? current.history : []),
    {
      at: now.toISOString(),
      actor: getUserName(actor),
      action: "discarded",
      note: "Ziel entfernt.",
    },
  ];

  const rows = await prisma.$queryRaw<SalesTargetRow[]>`
    UPDATE "SalesTarget"
    SET
      "status" = 'discarded',
      "history" = ${JSON.stringify(history)}::jsonb,
      "updatedAt" = ${now}
    WHERE "organizationId" = ${organization.id}
      AND "id" = ${id}
    RETURNING *
  `;

  await recordStatusTransition({
    organizationId: organization.id,
    entityType: "sales_target",
    entityId: current.id,
    entityLabel: current.title,
    fromStatus: current.status,
    toStatus: "discarded",
    actorUserId: actor.id,
    actorName: getUserName(actor),
    note: "Ziel entfernt.",
    at: now,
  });

  return NextResponse.json(formatSalesTarget(rows[0]));
}
