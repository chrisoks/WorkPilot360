import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";
import { recordStatusTransition, seedCurrentStatusTimeline } from "@/lib/status-tracking";

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
    targetMonth: row.targetMonth ?? "",
    followUpAt: row.followUpAt?.toISOString() ?? "",
    status: cleanStatus(row.status),
    history: Array.isArray(row.history) ? row.history : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  await ensureSalesHubTables();
  const { organization } = await getDemoContext();

  const rows = await prisma.$queryRaw<SalesTargetRow[]>`
    SELECT *
    FROM "SalesTarget"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `;

  return NextResponse.json(rows.map(formatSalesTarget));
}

export async function POST(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const owner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId)) ?? user;
  const title = cleanString(body.title);
  const now = new Date();

  if (!title) {
    return NextResponse.json({ error: "Bitte ein Sales-Ziel angeben." }, { status: 400 });
  }

  const history = [
    {
      at: now.toISOString(),
      actor: getUserName(user),
      action: "created",
      note: "Sales-Ziel angelegt.",
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
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const id = cleanString(body.id);
  const now = new Date();

  if (!id) {
    return NextResponse.json({ error: "Sales-Ziel fehlt." }, { status: 400 });
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
    return NextResponse.json({ error: "Sales-Ziel wurde nicht gefunden." }, { status: 404 });
  }

  const owner = users.find((candidate) => candidate.id === cleanString(body.ownerUserId)) ?? null;
  const nextStatus = cleanStatus(body.status || current.status);
  const history = [
    ...(Array.isArray(current.history) ? current.history : []),
    {
      at: now.toISOString(),
      actor: getUserName(user),
      action: nextStatus,
      note: cleanString(body.note) || "Sales-Ziel aktualisiert.",
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
    actorUserId: user.id,
    actorName: getUserName(user),
    note: cleanString(body.note) || "Sales-Ziel aktualisiert.",
    at: now,
  });

  return NextResponse.json(formatSalesTarget(rows[0]));
}
