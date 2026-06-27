import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";

type FeedbackRow = {
  id: string;
  requestId: string | null;
  invoiceId: string | null;
  invoiceNumber: string;
  projectId: string | null;
  contactId: string | null;
  customerName: string;
  rating: number;
  comment: string;
  wantsContact: boolean;
  source: string;
  salesUserId: string | null;
  salesUserName: string;
  hotAlert: boolean;
  createdAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanRating(value: unknown) {
  const rating = Math.round(Number(value));
  return Math.max(1, Math.min(5, Number.isFinite(rating) ? rating : 5));
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

async function createHotAlert(input: {
  organizationId: string;
  feedbackId: string;
  customerName: string;
  rating: number;
  wantsContact: boolean;
  salesUserId?: string | null;
}) {
  const recipients = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "User"
    WHERE "organizationId" = ${input.organizationId}
      AND "isActive" = true
      AND (
        role IN ('ADMIN', 'GESCHAEFTSFUEHRER')
        OR id = ${input.salesUserId ?? ""}
      )
  `;

  for (const recipient of recipients) {
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id", "organizationId", "userId", "taskId", "channel", "subject", "body",
        "linkTarget", "linkTargetId", "linkLabel", "sentAt", "createdAt"
      ) VALUES (
        ${randomUUID()}, ${input.organizationId}, ${recipient.id}, NULL, 'app',
        'KuZu Hot-Alert',
        ${`${input.customerName || "Ein Kunde"} hat ${input.rating} Sterne vergeben${input.wantsContact ? " und Kontakt gewünscht" : ""}.`},
        'customer-feedback', ${input.feedbackId}, 'Bewertung ansehen', NULL, CURRENT_TIMESTAMP
      )
    `;
  }
}

function formatFeedback(row: FeedbackRow) {
  return {
    id: row.id,
    requestId: row.requestId ?? "",
    invoiceId: row.invoiceId ?? "",
    invoiceNumber: row.invoiceNumber,
    projectId: row.projectId ?? "",
    contactId: row.contactId ?? "",
    customerName: row.customerName,
    rating: row.rating,
    comment: row.comment,
    wantsContact: row.wantsContact,
    source: row.source,
    salesUserId: row.salesUserId ?? "",
    salesUserName: row.salesUserName,
    hotAlert: row.hotAlert,
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

  const rows = await prisma.$queryRaw<FeedbackRow[]>`
    SELECT *
    FROM "CustomerFeedback"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;
  return NextResponse.json(rows.map(formatFeedback));
}

export async function POST(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  const salesUser = users.find((candidate) => candidate.id === cleanString(body.salesUserId)) ?? actor;
  const rating = cleanRating(body.rating);
  const wantsContact = Boolean(body.wantsContact);
  const hotAlert = rating <= 4 || wantsContact;
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "CustomerFeedback" (
      "id", "organizationId", "requestId", "invoiceId", "invoiceNumber", "projectId",
      "contactId", "customerName", "rating", "comment", "wantsContact", "source",
      "salesUserId", "salesUserName", "hotAlert"
    ) VALUES (
      ${id}, ${organization.id}, ${cleanString(body.requestId) || null}, ${cleanString(body.invoiceId) || null},
      ${cleanString(body.invoiceNumber)}, ${cleanString(body.projectId) || null}, ${cleanString(body.contactId) || null},
      ${cleanString(body.customerName)}, ${rating}, ${cleanString(body.comment)}, ${wantsContact}, ${cleanString(body.source) || "manual"},
      ${salesUser.id}, ${getUserName(salesUser)}, ${hotAlert}
    )
  `;

  if (hotAlert) {
    await createHotAlert({
      organizationId: organization.id,
      feedbackId: id,
      customerName: cleanString(body.customerName),
      rating,
      wantsContact,
      salesUserId: salesUser.id,
    });
  }

  return NextResponse.json({ id }, { status: 201 });
}

export async function DELETE(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const id = cleanString(body.id);
  const actor = getRequestActor(users, body.actorId);

  if (!id) {
    return NextResponse.json({ error: "Bewertung fehlt." }, { status: 400 });
  }

  if (!actor) {
    return unauthorizedActorResponse();
  }

  if (actor?.role !== "GESCHAEFTSFUEHRER") {
    return NextResponse.json({ error: "Nur die Geschäftsführung darf Bewertungen löschen." }, { status: 403 });
  }

  const feedbackRows = await prisma.$queryRaw<Array<{ id: string; requestId: string | null }>>`
    SELECT id, "requestId"
    FROM "CustomerFeedback"
    WHERE id = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const feedback = feedbackRows[0];

  if (!feedback) {
    return NextResponse.json({ error: "Bewertung wurde nicht gefunden." }, { status: 404 });
  }

  await prisma.$executeRaw`
    DELETE FROM "Notification"
    WHERE "organizationId" = ${organization.id}
      AND "linkTarget" = 'customer-feedback'
      AND "linkTargetId" = ${id}
  `;

  await prisma.$executeRaw`
    DELETE FROM "CustomerFeedback"
    WHERE id = ${id}
      AND "organizationId" = ${organization.id}
  `;

  if (feedback.requestId) {
    await prisma.$executeRaw`
      UPDATE "CustomerFeedbackRequest"
      SET "status" = 'sent',
          "respondedAt" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${feedback.requestId}
        AND "organizationId" = ${organization.id}
    `;
  }

  return NextResponse.json({ success: true, id });
}
