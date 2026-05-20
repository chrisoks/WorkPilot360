import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type PotentialRow = {
  id: string;
  organizationId: string;
  contactId: string | null;
  customerName: string | null;
  projectId: string;
  projectLabel: string | null;
  description: string;
  status: string;
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

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  return ["open", "follow_up", "offered", "lost"].includes(status) ? status : "open";
}

function cleanHistory(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

async function ensurePotentialTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectPotential" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "contactId" TEXT,
      "customerName" TEXT,
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "description" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'open',
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
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerName" TEXT,
    ADD COLUMN IF NOT EXISTS "projectLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS "taskId" TEXT,
    ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "offeredAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;
}

function formatPotential(row: PotentialRow) {
  return {
    id: row.id,
    contactId: row.contactId ?? "",
    customerName: row.customerName ?? "",
    projectId: row.projectId,
    projectLabel: row.projectLabel ?? "",
    description: row.description,
    status: cleanStatus(row.status),
    taskId: row.taskId ?? "",
    followUpAt: row.followUpAt?.toISOString() ?? "",
    offeredAt: row.offeredAt?.toISOString() ?? "",
    closedAt: row.closedAt?.toISOString() ?? "",
    history: cleanHistory(row.history),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensurePotentialTable();

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
        ${JSON.stringify(history)}::jsonb,
        ${legacy.createdAt},
        CURRENT_TIMESTAMP
      )
    `;
  }

  const rows = await prisma.$queryRaw<PotentialRow[]>`
    SELECT *
    FROM "ProjectPotential"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  `;

  return NextResponse.json(rows.map(formatPotential));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, user } = await getDemoContext();
  await ensurePotentialTable();

  const projectId = cleanString(body.projectId);
  const description = cleanString(body.description);
  if (!projectId || !description) {
    return NextResponse.json({ error: "Projekt und Potenzialbeschreibung sind erforderlich." }, { status: 400 });
  }

  const history = [
    {
      at: new Date().toISOString(),
      actor: cleanString(body.actorName) || getUserName(user),
      action: "created",
      note: "Potenzial erkannt.",
    },
  ];

  const rows = await prisma.$queryRaw<PotentialRow[]>`
    INSERT INTO "ProjectPotential" (
      "id",
      "organizationId",
      "contactId",
      "customerName",
      "projectId",
      "projectLabel",
      "description",
      "status",
      "history"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${cleanString(body.contactId) || null},
      ${cleanString(body.customerName) || null},
      ${projectId},
      ${cleanString(body.projectLabel) || null},
      ${description},
      'open',
      ${JSON.stringify(history)}::jsonb
    )
    RETURNING *
  `;

  return NextResponse.json(formatPotential(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, user } = await getDemoContext();
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

  const nextStatus = cleanStatus(body.status || current.status);
  const note = cleanString(body.note);
  const actor = cleanString(body.actorName) || getUserName(user);
  const now = new Date();
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
      "taskId" = COALESCE(${cleanString(body.taskId) || null}, "taskId"),
      "followUpAt" = CASE
        WHEN ${nextStatus} = 'follow_up' THEN ${cleanString(body.followUpAt) ? new Date(cleanString(body.followUpAt)) : null}
        ELSE "followUpAt"
      END,
      "offeredAt" = CASE WHEN ${nextStatus} = 'offered' THEN ${now} ELSE "offeredAt" END,
      "closedAt" = CASE WHEN ${nextStatus} IN ('offered', 'lost') THEN ${now} ELSE "closedAt" END,
      "history" = ${JSON.stringify(history)}::jsonb,
      "updatedAt" = ${now}
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;

  return NextResponse.json(formatPotential(rows[0]));
}
