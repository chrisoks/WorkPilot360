import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";

type RequestRow = {
  id: string;
  organizationId: string;
  token: string;
  invoiceId: string | null;
  invoiceNumber: string;
  projectId: string | null;
  contactId: string | null;
  customerName: string;
  salesUserId: string | null;
  salesUserName: string;
  status: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanRating(value: unknown) {
  const rating = Math.round(Number(value));
  return Math.max(1, Math.min(5, Number.isFinite(rating) ? rating : 5));
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
    const notificationId = randomUUID();
    const subject = "KuZu Hot-Alert";
    const notificationBody = `${input.customerName || "Ein Kunde"} hat ${input.rating} Sterne vergeben${input.wantsContact ? " und Kontakt gewünscht" : ""}.`;
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id", "organizationId", "userId", "taskId", "channel", "subject", "body",
        "linkTarget", "linkTargetId", "linkLabel", "sentAt", "createdAt"
      ) VALUES (
        ${notificationId}, ${input.organizationId}, ${recipient.id}, NULL, 'app',
        ${subject},
        ${notificationBody},
        'customer-feedback', ${input.feedbackId}, 'Bewertung ansehen', NULL, CURRENT_TIMESTAMP
      )
    `;
    await sendNotificationMailSafely({
      notificationId,
      userId: recipient.id,
      subject,
      body: notificationBody,
    });
  }
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  await ensureSalesHubTables();
  const rows = await prisma.$queryRaw<RequestRow[]>`
    SELECT *
    FROM "CustomerFeedbackRequest"
    WHERE token = ${params.token}
    LIMIT 1
  `;
  const request = rows[0];
  if (!request) {
    return NextResponse.json({ error: "Bewertungslink nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    token: request.token,
    invoiceNumber: request.invoiceNumber,
    customerName: request.customerName,
    status: request.status,
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const rows = await prisma.$queryRaw<RequestRow[]>`
    SELECT *
    FROM "CustomerFeedbackRequest"
    WHERE token = ${params.token}
    LIMIT 1
  `;
  const request = rows[0];
  if (!request) {
    return NextResponse.json({ error: "Bewertungslink nicht gefunden." }, { status: 404 });
  }
  if (request.status === "answered") {
    return NextResponse.json({ error: "Diese Bewertung wurde bereits abgegeben." }, { status: 409 });
  }

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
      ${id}, ${request.organizationId}, ${request.id}, ${request.invoiceId}, ${request.invoiceNumber},
      ${request.projectId}, ${request.contactId}, ${request.customerName}, ${rating},
      ${cleanString(body.comment)}, ${wantsContact}, 'public',
      ${request.salesUserId}, ${request.salesUserName}, ${hotAlert}
    )
  `;

  await prisma.$executeRaw`
    UPDATE "CustomerFeedbackRequest"
    SET "status" = 'answered', "respondedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${request.id}
  `;

  if (hotAlert) {
    await createHotAlert({
      organizationId: request.organizationId,
      feedbackId: id,
      customerName: request.customerName,
      rating,
      wantsContact,
      salesUserId: request.salesUserId,
    });
  }

  return NextResponse.json({ success: true });
}
