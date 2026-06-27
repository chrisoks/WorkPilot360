import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureDefaultStatusEscalationRules, ensureStatusTrackingTables } from "@/lib/status-tracking";

type StatusRuleRow = {
  id: string;
  entityType: string;
  status: string;
  name: string;
  thresholdHours: number;
  notifyResponsible: boolean;
  notifyProjectOwner: boolean;
  notifyManagement: boolean;
  notificationEnabled: boolean;
  dailyReportEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function canManageStatusRules(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanString(actorId);
  if (!requestedActorId) {
    return null;
  }

  return users.find((candidate) => candidate.id === requestedActorId && candidate.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEntityType(value: unknown) {
  const entityType = cleanString(value);
  return ["project", "task", "potential", "sales_target"].includes(entityType) ? entityType : "project";
}

function cleanHours(value: unknown) {
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 1 ? Math.round(hours) : 24;
}

function formatRule(row: StatusRuleRow) {
  return {
    id: row.id,
    entityType: row.entityType,
    status: row.status,
    name: row.name,
    thresholdHours: row.thresholdHours,
    notifyResponsible: Boolean(row.notifyResponsible),
    notifyProjectOwner: Boolean(row.notifyProjectOwner),
    notifyManagement: Boolean(row.notifyManagement),
    notificationEnabled: Boolean(row.notificationEnabled),
    dailyReportEnabled: Boolean(row.dailyReportEnabled),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureDefaultStatusEscalationRules(organization.id);

  const rows = await prisma.$queryRaw<StatusRuleRow[]>`
    SELECT *
    FROM "StatusEscalationRule"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "entityType" ASC, "status" ASC, "thresholdHours" ASC
  `;

  return NextResponse.json(rows.map(formatRule));
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  if (!canManageStatusRules(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Status-Regeln verwalten." },
      { status: 403 }
    );
  }

  await ensureStatusTrackingTables();
  const entityType = cleanEntityType(body.entityType);
  const status = cleanString(body.status);
  const name = cleanString(body.name) || `${entityType} · ${status}`;
  const now = new Date();

  if (!status) {
    return NextResponse.json({ error: "Bitte einen Status angeben." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<StatusRuleRow[]>`
    INSERT INTO "StatusEscalationRule" (
      "id",
      "organizationId",
      "entityType",
      "status",
      "name",
      "thresholdHours",
      "notifyResponsible",
      "notifyProjectOwner",
      "notifyManagement",
      "notificationEnabled",
      "dailyReportEnabled",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${entityType},
      ${status},
      ${name},
      ${cleanHours(body.thresholdHours)},
      ${body.notifyResponsible !== false},
      ${Boolean(body.notifyProjectOwner)},
      ${body.notifyManagement !== false},
      ${body.notificationEnabled !== false},
      ${body.dailyReportEnabled !== false},
      ${body.isActive !== false},
      ${now},
      ${now}
    )
    RETURNING *
  `;

  return NextResponse.json(formatRule(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  if (!canManageStatusRules(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Status-Regeln verwalten." },
      { status: 403 }
    );
  }

  await ensureStatusTrackingTables();
  const id = cleanString(body.id);
  const status = cleanString(body.status);
  if (!id || !status) {
    return NextResponse.json({ error: "Regel und Status sind erforderlich." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<StatusRuleRow[]>`
    UPDATE "StatusEscalationRule"
    SET
      "entityType" = ${cleanEntityType(body.entityType)},
      "status" = ${status},
      "name" = ${cleanString(body.name) || status},
      "thresholdHours" = ${cleanHours(body.thresholdHours)},
      "notifyResponsible" = ${body.notifyResponsible !== false},
      "notifyProjectOwner" = ${Boolean(body.notifyProjectOwner)},
      "notifyManagement" = ${body.notifyManagement !== false},
      "notificationEnabled" = ${body.notificationEnabled !== false},
      "dailyReportEnabled" = ${body.dailyReportEnabled !== false},
      "isActive" = ${body.isActive !== false},
      "updatedAt" = ${new Date()}
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Status-Regel wurde nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(formatRule(rows[0]));
}

export async function DELETE(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  if (!canManageStatusRules(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Status-Regeln verwalten." },
      { status: 403 }
    );
  }

  await ensureStatusTrackingTables();
  const id = cleanString(body.id);

  await prisma.$executeRaw`
    DELETE FROM "StatusEscalationRule"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  return NextResponse.json({ success: true });
}
