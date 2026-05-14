import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getStoredMailAccount, refreshMicrosoftAccessToken } from "@/lib/mail/microsoft";

type MailAccount = {
  provider?: string;
  status?: string;
  email?: string;
  displayName?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseRecipients(value: unknown) {
  return cleanText(value)
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function ensureDocumentMailTables() {
  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "mailAccount" JSONB DEFAULT '{}'::jsonb
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "DocumentMailDispatch" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "documentKind" TEXT NOT NULL,
      "documentId" TEXT NOT NULL,
      "documentNumber" TEXT NOT NULL,
      "projectId" TEXT NOT NULL DEFAULT '',
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "projectTitle" TEXT NOT NULL DEFAULT '',
      "customerName" TEXT NOT NULL DEFAULT '',
      "senderUserId" TEXT NOT NULL,
      "senderName" TEXT NOT NULL,
      "senderEmail" TEXT NOT NULL,
      "toRecipients" TEXT NOT NULL,
      "ccRecipients" TEXT NOT NULL DEFAULT '',
      "bccRecipients" TEXT NOT NULL DEFAULT '',
      "subject" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "attachPdf" BOOLEAN NOT NULL DEFAULT true,
      "provider" TEXT NOT NULL DEFAULT 'microsoft365',
      "status" TEXT NOT NULL DEFAULT 'queued',
      "providerMessageId" TEXT NOT NULL DEFAULT '',
      "errorMessage" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function addDocumentMailHistory(body: Record<string, unknown>, actorName: string, recipients: string[]) {
  if (cleanText(body.kind) !== "offer") return;

  const rows = await prisma.$queryRaw<Array<{ organizationId: string }>>`
    SELECT "organizationId"
    FROM "Offer"
    WHERE id = ${cleanText(body.documentId)}
    LIMIT 1
  `;
  const offer = rows[0];
  if (!offer) return;

  await prisma.$executeRaw`
    INSERT INTO "OfferHistory" (
      "id", "organizationId", "offerId", "projectId", "offerNumber",
      "eventType", "title", "note", "actorName"
    ) VALUES (
      ${randomUUID()}, ${offer.organizationId}, ${cleanText(body.documentId)},
      ${cleanText(body.projectId)}, ${cleanText(body.documentNumber)},
      ${"email_sent"}, ${"Angebot per E-Mail versendet"},
      ${`Gesendet an ${recipients.join(", ")}. Betreff: ${cleanText(body.subject)}`},
      ${actorName}
    )
  `;
}

async function getPdfAttachment(kind: string, documentId: string, documentNumber: string) {
  if (kind === "offer") {
    const rows = await prisma.$queryRaw<Array<{ pdfData: string | null }>>`
      SELECT "pdfData" FROM "Offer" WHERE id = ${documentId} LIMIT 1
    `;
    return rows[0]?.pdfData
      ? [{ "@odata.type": "#microsoft.graph.fileAttachment", name: `${documentNumber}.pdf`, contentType: "application/pdf", contentBytes: rows[0].pdfData }]
      : [];
  }

  const rows = await prisma.$queryRaw<Array<{ pdfData: string | null }>>`
    SELECT "pdfData" FROM "Invoice" WHERE id = ${documentId} LIMIT 1
  `;
  return rows[0]?.pdfData
    ? [{ "@odata.type": "#microsoft.graph.fileAttachment", name: `${documentNumber}.pdf`, contentType: "application/pdf", contentBytes: rows[0].pdfData }]
    : [];
}

async function sendViaMicrosoftGraph(input: {
  accessToken: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachments: Array<Record<string, unknown>>;
}) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: {
          contentType: "Text",
          content: input.body,
        },
        toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
        ccRecipients: input.cc.map((address) => ({ emailAddress: { address } })),
        bccRecipients: input.bcc.map((address) => ({ emailAddress: { address } })),
        attachments: input.attachments,
      },
      saveToSentItems: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Microsoft Graph konnte die E-Mail nicht senden.");
  }
}

export async function POST(req: Request) {
  await ensureDocumentMailTables();
  const body = (await req.json()) as Record<string, unknown>;
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === cleanText(body.actorId)) ?? user;
  const actorName = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() || actor.email;
  let mailAccount = await getStoredMailAccount(actor.id);
  mailAccount = await refreshMicrosoftAccessToken(actor.id, mailAccount, req);
  const senderEmail = cleanText(mailAccount.email) || actor.email;
  const recipients = parseRecipients(body.to);
  const ccRecipients = parseRecipients(body.cc);
  const bccRecipients = parseRecipients(body.bcc);
  const kind = cleanText(body.kind);

  if (!["offer", "invoice"].includes(kind)) {
    return NextResponse.json({ error: "Dokumenttyp ist ungültig." }, { status: 400 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens einen Empfänger eintragen." }, { status: 400 });
  }

  if (mailAccount.status !== "connected" || !mailAccount.accessToken) {
    return NextResponse.json(
      { error: "Für diesen Mitarbeiter ist noch kein Microsoft 365 Konto verbunden." },
      { status: 409 }
    );
  }

  const attachments = Boolean(body.attachPdf)
    ? await getPdfAttachment(kind, cleanText(body.documentId), cleanText(body.documentNumber))
    : [];

  try {
    await sendViaMicrosoftGraph({
      accessToken: mailAccount.accessToken,
      to: recipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      subject: cleanText(body.subject),
      body: cleanText(body.body),
      attachments,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Microsoft 365 Versand fehlgeschlagen." },
      { status: 502 }
    );
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "DocumentMailDispatch" (
      "id", "organizationId", "documentKind", "documentId", "documentNumber",
      "projectId", "projectNumber", "projectTitle", "customerName",
      "senderUserId", "senderName", "senderEmail", "toRecipients",
      "ccRecipients", "bccRecipients", "subject", "body", "attachPdf",
      "provider", "status", "providerMessageId"
    ) VALUES (
      ${id}, ${organization.id}, ${kind}, ${cleanText(body.documentId)}, ${cleanText(body.documentNumber)},
      ${cleanText(body.projectId)}, ${cleanText(body.projectNumber)}, ${cleanText(body.projectTitle)},
      ${cleanText(body.customerName)}, ${actor.id}, ${actorName}, ${senderEmail},
      ${recipients.join(", ")}, ${ccRecipients.join(", ")}, ${bccRecipients.join(", ")},
      ${cleanText(body.subject)}, ${cleanText(body.body)}, ${Boolean(body.attachPdf)},
      ${"microsoft365"}, ${"sent"}, ${`ms365-${id}`}
    )
  `;

  await addDocumentMailHistory(body, actorName, recipients);

  return NextResponse.json({
    id,
    status: "sent",
    provider: "microsoft365",
    senderEmail,
    recipients,
  });
}
