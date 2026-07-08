import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { canManageSalesPipeline } from "@/lib/permissions";

type RecurringProjectReviewRow = {
  id: string;
  organizationId: string;
  projectId: string;
  projectNumber: string | null;
  projectTitle: string | null;
  customerName: string | null;
  reviewedAt: Date;
  reviewedById: string | null;
  reviewedByName: string;
  result: string;
  nextReviewAt: Date | null;
  note: string;
  signals: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectReferenceRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  projectKind: string | null;
  status: string | null;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanResult(value: unknown) {
  const result = cleanString(value);
  return ["no_action", "price_increase", "budget_change", "addendum_needed", "follow_up"].includes(result)
    ? result
    : "no_action";
}

function cleanSignals(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean).slice(0, 20);
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function isRecurringProjectKind(value: string | null) {
  const normalized = cleanString(value).toLowerCase();
  return normalized.includes("dauer") || normalized.includes("wiederkehr");
}

function serializeReview(row: RecurringProjectReviewRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectNumber: row.projectNumber ?? "",
    projectTitle: row.projectTitle ?? "",
    customerName: row.customerName ?? "",
    reviewedAt: row.reviewedAt.toISOString(),
    reviewedById: row.reviewedById ?? "",
    reviewedByName: row.reviewedByName,
    result: row.result,
    nextReviewAt: row.nextReviewAt?.toISOString() ?? "",
    note: row.note ?? "",
    signals: Array.isArray(row.signals) ? row.signals : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureRecurringProjectReviewTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "RecurringProjectReview" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "projectNumber" TEXT,
      "projectTitle" TEXT,
      "customerName" TEXT,
      "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reviewedById" TEXT,
      "reviewedByName" TEXT NOT NULL,
      "result" TEXT NOT NULL DEFAULT 'no_action',
      "nextReviewAt" TIMESTAMP(3),
      "note" TEXT NOT NULL DEFAULT '',
      "signals" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "RecurringProjectReview_organization_project_reviewed_idx"
    ON "RecurringProjectReview" ("organizationId", "projectId", "reviewedAt")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "RecurringProjectReview_organization_nextReview_idx"
    ON "RecurringProjectReview" ("organizationId", "nextReviewAt")
  `;
}

async function getProjectReference(organizationId: string, projectId: string) {
  const rows = await prisma.$queryRaw<ProjectReferenceRow[]>`
    SELECT "id", "projectNumber", "title", "customer", "projectKind", "status"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(req: Request) {
  await ensureRecurringProjectReviewTable();
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, url.searchParams.get("actorId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const projectId = cleanString(url.searchParams.get("projectId"));
  const rows = projectId
    ? await prisma.$queryRaw<RecurringProjectReviewRow[]>`
        SELECT *
        FROM "RecurringProjectReview"
        WHERE "organizationId" = ${organization.id}
          AND "projectId" = ${projectId}
        ORDER BY "reviewedAt" DESC, "createdAt" DESC
      `
    : await prisma.$queryRaw<RecurringProjectReviewRow[]>`
        SELECT *
        FROM "RecurringProjectReview"
        WHERE "organizationId" = ${organization.id}
        ORDER BY "reviewedAt" DESC, "createdAt" DESC
      `;

  return NextResponse.json(rows.map(serializeReview));
}

export async function POST(req: Request) {
  await ensureRecurringProjectReviewTable();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageSalesPipeline(actor)) {
    return NextResponse.json({ error: "Du darfst Dauerlaeufer-Pruefungen nicht dokumentieren." }, { status: 403 });
  }

  const projectId = cleanString(body.projectId);
  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  const project = await getProjectReference(organization.id, projectId);
  if (!project) {
    return NextResponse.json({ error: "Projekt wurde nicht gefunden." }, { status: 404 });
  }
  if (!isRecurringProjectKind(project.projectKind)) {
    return NextResponse.json({ error: "Pruefungen sind nur fuer Dauerlaeufer vorgesehen." }, { status: 400 });
  }

  const now = new Date();
  const nextReviewAt = cleanString(body.nextReviewAt) ? new Date(cleanString(body.nextReviewAt)) : null;
  const rows = await prisma.$queryRaw<RecurringProjectReviewRow[]>`
    INSERT INTO "RecurringProjectReview" (
      "id",
      "organizationId",
      "projectId",
      "projectNumber",
      "projectTitle",
      "customerName",
      "reviewedAt",
      "reviewedById",
      "reviewedByName",
      "result",
      "nextReviewAt",
      "note",
      "signals",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${project.id},
      ${project.projectNumber},
      ${project.title},
      ${project.customer},
      ${now},
      ${actor.id},
      ${getUserName(actor)},
      ${cleanResult(body.result)},
      ${nextReviewAt && Number.isFinite(nextReviewAt.getTime()) ? nextReviewAt : null},
      ${cleanString(body.note)},
      ${JSON.stringify(cleanSignals(body.signals))}::jsonb,
      ${now},
      ${now}
    )
    RETURNING *
  `;

  return NextResponse.json(serializeReview(rows[0]), { status: 201 });
}
