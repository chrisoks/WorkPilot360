import { randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";

type FeedbackRequestRow = {
  id: string;
  token: string;
  invoiceId: string | null;
  invoiceNumber: string;
  projectId: string | null;
  contactId: string | null;
  customerName: string;
  recipientEmail: string;
  salesUserId: string | null;
  salesUserName: string;
  status: string;
  sentAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
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

function formatRequest(row: FeedbackRequestRow, req: Request) {
  return {
    id: row.id,
    token: row.token,
    url: `${getBaseUrl(req)}/feedback/${row.token}`,
    invoiceId: row.invoiceId ?? "",
    invoiceNumber: row.invoiceNumber,
    projectId: row.projectId ?? "",
    contactId: row.contactId ?? "",
    customerName: row.customerName,
    recipientEmail: row.recipientEmail,
    salesUserId: row.salesUserId ?? "",
    salesUserName: row.salesUserName,
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? "",
    respondedAt: row.respondedAt?.toISOString() ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  await ensureSalesHubTables();
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, url.searchParams.get("actorId"));
  if (!actor) {
    return unauthorizedActorResponse();
  }

  const rows = await prisma.$queryRaw<FeedbackRequestRow[]>`
    SELECT *
    FROM "CustomerFeedbackRequest"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;
  return NextResponse.json(rows.map((row) => formatRequest(row, req)));
}

export async function POST(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  const invoiceId = cleanString(body.invoiceId);
  if (invoiceId) {
    const existing = await prisma.$queryRaw<FeedbackRequestRow[]>`
      SELECT *
      FROM "CustomerFeedbackRequest"
      WHERE "organizationId" = ${organization.id}
        AND "invoiceId" = ${invoiceId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (existing[0]) {
      return NextResponse.json(formatRequest(existing[0], req));
    }
  }
  const requestedUserId = cleanString(body.salesUserId);
  const salesUser = requestedUserId ? users.find((candidate) => candidate.id === requestedUserId) ?? actor : null;
  const interviewerName = salesUser ? getUserName(salesUser) : "WorkPilot";
  const token = randomBytes(18).toString("hex");
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "CustomerFeedbackRequest" (
      "id", "organizationId", "token", "invoiceId", "invoiceNumber", "projectId",
      "contactId", "customerName", "recipientEmail", "salesUserId", "salesUserName",
      "status", "sentAt"
    ) VALUES (
      ${id}, ${organization.id}, ${token}, ${invoiceId || null},
      ${cleanString(body.invoiceNumber)}, ${cleanString(body.projectId) || null},
      ${cleanString(body.contactId) || null}, ${cleanString(body.customerName)},
      ${cleanString(body.recipientEmail)}, ${salesUser?.id ?? null}, ${interviewerName},
      ${Boolean(body.markSent) ? "sent" : "open"}, ${Boolean(body.markSent) ? new Date() : null}
    )
  `;

  const rows = await prisma.$queryRaw<FeedbackRequestRow[]>`
    SELECT *
    FROM "CustomerFeedbackRequest"
    WHERE id = ${id}
    LIMIT 1
  `;

  return NextResponse.json(formatRequest(rows[0], req), { status: 201 });
}
