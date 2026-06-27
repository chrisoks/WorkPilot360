import { randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
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
  const { organization } = await getDemoContext();
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
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
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
  const salesUser = requestedUserId ? users.find((candidate) => candidate.id === requestedUserId) ?? user : null;
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
