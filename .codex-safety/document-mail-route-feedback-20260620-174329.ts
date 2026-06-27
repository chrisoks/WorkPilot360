import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getStoredMailAccount, refreshMicrosoftAccessToken } from "@/lib/mail/microsoft";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";
import { canSendDocumentMails, canSendInvoiceDocuments, canSendOfferDocuments } from "@/lib/permissions";

type MailAccount = {
  provider?: string;
  status?: string;
  email?: string;
  displayName?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanText(actorId);
  if (!requestedActorId) {
    return null;
  }

  return users.find((demoUser) => demoUser.id === requestedActorId && demoUser.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

function forbiddenDocumentMailResponse() {
  return NextResponse.json(
    { error: "Du darfst dieses Dokument nicht per E-Mail versenden." },
    { status: 403 }
  );
}

function canSendDocumentKind(actor: User, kind: string) {
  if (kind === "offer") return canSendOfferDocuments(actor);
  if (kind === "invoice" || kind === "cancellation" || kind === "reminder") {
    return canSendInvoiceDocuments(actor);
  }
  return canSendDocumentMails(actor);
}

function parseRecipients(value: unknown) {
  return cleanText(value)
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getDocumentKindLabel(kind: string) {
  if (kind === "offer") return "Angebot";
  if (kind === "invoice") return "Rechnung";
  if (kind === "cancellation") return "Stornorechnung";
  if (kind === "reminder") return "Mahnung";
  if (kind === "activityReport") return "Tätigkeitsbericht";
  return "Dokument";
}

function getReminderInvoiceNumber(documentNumber: string) {
  const normalized = documentNumber.replace(/\.pdf$/i, "");
  return normalized.match(/^MA-(.+)-\d+$/i)?.[1] ?? "";
}

function getDataUrlAttachment(name: string, dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/);
  if (!match) return null;

  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: name || "Dokument.pdf",
    contentType: match[1] || "application/octet-stream",
    contentBytes: match[2],
  };
}

function getAdditionalDataUrlAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((item) => getDataUrlAttachment(cleanText(item?.name), cleanText(item?.dataUrl)))
    .filter((item): item is NonNullable<ReturnType<typeof getDataUrlAttachment>> => Boolean(item));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value: string) {
  return escapeHtml(value.trimEnd())
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\r?\n/g, "<br>"))
    .map((paragraph) => `<p>${paragraph || "&nbsp;"}</p>`)
    .join("");
}

function stripTrailingClosing(value: string) {
  return value.replace(/\n{2,}Mit freundlichen Gr(?:ü|ue|\u00c3\u00bc)ßen\s*\n+[^\n]+\s*$/i, "");
}

function stripTrailingMailClosing(value: string) {
  return value
    .replace(/\s*(?:\r?\n){1,}Mit freundlichen Gr(?:\u00fc|ue)(?:\u00df|ss)en\s*(?:\r?\n)+[^\r\n]+\s*$/i, "")
    .trimEnd();
}

function getFeedbackMailBlockHtml(link: string) {
  const safeLink = escapeHtml(link);
  return [
    '<div style="margin:22px 0 18px;padding:16px 18px;border:1px solid #cbd8e6;border-radius:14px;background:#f8fbff;max-width:520px;">',
    '<p style="margin:0 0 8px;color:#0f172a;font-weight:800;">Wie zufrieden waren Sie mit unserer Leistung?</p>',
    '<div style="color:#f5b800;font-size:24px;letter-spacing:2px;line-height:1;margin:0 0 12px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>',
    `<a href="${safeLink}" target="_blank" rel="noreferrer" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:800;border-radius:10px;padding:10px 16px;">Jetzt bewerten</a>`,
    '<p style="margin:10px 0 0;color:#64748b;font-size:12px;line-height:1.4;">Ihre Rückmeldung hilft uns, unseren Service weiter zu verbessern.</p>',
    "</div>",
  ].join("");
}

function sanitizeSignatureHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function normalizeSignatureHtml(value: string) {
  const signature = cleanText(value);
  if (!signature) return "";
  return /<\/?[a-z][\s\S]*>/i.test(signature) ? sanitizeSignatureHtml(signature) : textToHtml(signature);
}

async function getSenderSignature(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ signature: string | null; signatureHidden: boolean | null }>>`
    SELECT "signature", "signatureHidden"
    FROM "User"
    WHERE id = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.signatureHidden) return "";
  return normalizeSignatureHtml(row.signature ?? "");
}

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function getOrCreateFeedbackRequestLink(req: Request, body: Record<string, unknown>, _actor: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null }) {
  if (cleanText(body.kind) !== "invoice") return "";
  if (body.includeFeedbackLink === false) return "";
  const invoiceId = cleanText(body.documentId);
  if (!invoiceId) return "";

  await ensureSalesHubTables();
  const existing = await prisma.$queryRaw<Array<{ token: string }>>`
    SELECT token
    FROM "CustomerFeedbackRequest"
    WHERE "invoiceId" = ${invoiceId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  if (existing[0]?.token) {
    await prisma.$executeRaw`
      UPDATE "CustomerFeedbackRequest"
      SET "recipientEmail" = ${parseRecipients(body.to)[0] ?? ""},
          "status" = CASE WHEN "status" = 'answered' THEN "status" ELSE 'sent' END,
          "sentAt" = COALESCE("sentAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE token = ${existing[0].token}
    `;
    return `${getBaseUrl(req)}/feedback/${existing[0].token}`;
  }

  const token = randomUUID().replaceAll("-", "");
  await prisma.$executeRaw`
    INSERT INTO "CustomerFeedbackRequest" (
      "id", "organizationId", "token", "invoiceId", "invoiceNumber", "projectId",
      "customerName", "recipientEmail", "salesUserId", "salesUserName", "status", "sentAt"
    ) VALUES (
      ${randomUUID()}, ${cleanText(body.organizationId) || (await getDemoContext()).organization.id}, ${token},
      ${invoiceId}, ${cleanText(body.documentNumber)}, ${cleanText(body.projectId) || null},
      ${cleanText(body.customerName)}, ${parseRecipients(body.to)[0] ?? ""},
      ${null}, ${"WorkPilot"}, 'sent', CURRENT_TIMESTAMP
    )
  `;
  return `${getBaseUrl(req)}/feedback/${token}`;
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

async function addDocumentMailHistory(
  organizationId: string,
  body: Record<string, unknown>,
  actorName: string,
  recipients: string[]
) {
  const kind = cleanText(body.kind);
  if (kind !== "offer" && kind !== "invoice" && kind !== "cancellation" && kind !== "reminder") return;

  if (kind === "invoice" || kind === "cancellation" || kind === "reminder") {
    const documentId = cleanText(body.documentId);
    const projectId = cleanText(body.projectId);
    const documentNumber = cleanText(body.documentNumber);
    const reminderInvoiceNumber = kind === "reminder" ? getReminderInvoiceNumber(documentNumber) : "";
    const rows = await prisma.$queryRaw<Array<{ id: string; organizationId: string; invoiceNumber: string }>>`
      SELECT "id", "organizationId", "invoiceNumber"
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId}
        AND (
          id = ${documentId}
          OR (
            ${kind === "reminder"}
            AND ${reminderInvoiceNumber} <> ''
            AND "projectId" = ${projectId}
            AND "invoiceNumber" = ${reminderInvoiceNumber}
          )
        )
      LIMIT 1
    `;
    const invoice = rows[0];
    if (!invoice) return;

    await prisma.$executeRaw`
      INSERT INTO "InvoiceHistory" (
        "id", "organizationId", "invoiceId", "projectId", "invoiceNumber",
        "eventType", "title", "note", "actorName"
      ) VALUES (
        ${randomUUID()}, ${invoice.organizationId}, ${invoice.id},
        ${projectId}, ${invoice.invoiceNumber},
        ${kind === "reminder" ? "reminder_email_sent" : "email_sent"}, ${`${getDocumentKindLabel(kind)} per E-Mail versendet`},
        ${`Gesendet an ${recipients.join(", ")}. Betreff: ${cleanText(body.subject)}${kind === "reminder" ? `. Dokument: ${documentNumber}` : ""}`},
        ${actorName}
      )
    `;
    return;
  }

  const rows = await prisma.$queryRaw<Array<{ organizationId: string }>>`
    SELECT "organizationId"
    FROM "Offer"
    WHERE id = ${cleanText(body.documentId)}
      AND "organizationId" = ${organizationId}
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

async function documentBelongsToOrganization(
  organizationId: string,
  kind: string,
  documentId: string,
  projectId: string,
  documentNumber: string
) {
  if (!documentId && !projectId) return false;

  if (kind === "offer") {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Offer"
      WHERE id = ${documentId}
        AND "organizationId" = ${organizationId}
      LIMIT 1
    `;
    return Boolean(rows[0]);
  }

  if (kind === "invoice" || kind === "cancellation" || kind === "reminder") {
    const reminderInvoiceNumber = kind === "reminder" ? getReminderInvoiceNumber(documentNumber) : "";
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Invoice"
      WHERE "organizationId" = ${organizationId}
        AND (
          id = ${documentId}
          OR (
            ${kind === "reminder"}
            AND ${reminderInvoiceNumber} <> ''
            AND "projectId" = ${projectId}
            AND "invoiceNumber" = ${reminderInvoiceNumber}
          )
        )
      LIMIT 1
    `;
    return Boolean(rows[0]);
  }

  if (kind === "activityReport") {
    const winterRuns = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WinterServiceRun"
      WHERE id = ${documentId}
        AND "organizationId" = ${organizationId}
      LIMIT 1
    `;
    if (winterRuns[0]) return true;

    const logbookEntryId = documentId.replace(/-\d+$/, "");
    const logbookEntries = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ProjectLogbookEntry"
      WHERE id = ${logbookEntryId}
        AND "organizationId" = ${organizationId}
      LIMIT 1
    `;
    return Boolean(logbookEntries[0]);
  }

  if (projectId) {
    const projects = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WorkPilotProject"
      WHERE id = ${projectId}
        AND "organizationId" = ${organizationId}
      LIMIT 1
    `;
    return Boolean(projects[0]);
  }

  return kind === "document";
}

function formatDispatch(row: {
  id: string;
  documentKind: string;
  documentId: string;
  documentNumber: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  customerName: string;
  toRecipients: string;
  subject: string;
  body: string;
  attachPdf: boolean;
  status: string;
  createdAt: Date;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
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

  if (kind === "activityReport") {
    try {
      const rows = await prisma.$queryRaw<Array<{ reportPdfData: string | null }>>`
        SELECT "reportPdfData" FROM "WinterServiceRun" WHERE id = ${documentId} LIMIT 1
      `;
      if (rows[0]?.reportPdfData) {
        return [{ "@odata.type": "#microsoft.graph.fileAttachment", name: `${documentNumber}.pdf`, contentType: "application/pdf", contentBytes: rows[0].reportPdfData }];
      }
    } catch {
      // Project activity reports are stored in the project logbook instead of WinterServiceRun.
    }

    const logbookEntryId = documentId.replace(/-\d+$/, "");
    const logbookRows = await prisma.$queryRaw<Array<{ attachments: unknown }>>`
      SELECT "attachments" FROM "ProjectLogbookEntry" WHERE id = ${logbookEntryId} LIMIT 1
    `;
    const attachments = Array.isArray(logbookRows[0]?.attachments) ? logbookRows[0].attachments : [];
    const reportAttachment = attachments
      .map((attachment) => (attachment && typeof attachment === "object" ? attachment as Record<string, unknown> : null))
      .filter(Boolean)
      .find((attachment) => {
        const name = cleanText(attachment?.name);
        const dataUrl = cleanText(attachment?.dataUrl);
        return name.toLowerCase().includes(documentNumber.toLowerCase()) && dataUrl.startsWith("data:application/pdf");
      });
    const dataUrlAttachment = reportAttachment
      ? getDataUrlAttachment(cleanText(reportAttachment.name) || `${documentNumber}.pdf`, cleanText(reportAttachment.dataUrl))
      : null;
    return dataUrlAttachment ? [dataUrlAttachment] : [];
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
          contentType: "HTML",
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
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  const actorName = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() || actor.email;
  let mailAccount = await getStoredMailAccount(actor.id);
  mailAccount = await refreshMicrosoftAccessToken(actor.id, mailAccount, req);
  const senderEmail = cleanText(mailAccount.email) || actor.email;
  const recipients = parseRecipients(body.to);
  const ccRecipients = parseRecipients(body.cc);
  const bccRecipients = parseRecipients(body.bcc);
  const kind = cleanText(body.kind);

  if (!["offer", "invoice", "cancellation", "reminder", "activityReport", "document"].includes(kind)) {
    return NextResponse.json({ error: "Dokumenttyp ist ungültig." }, { status: 400 });
  }

  if (!canSendDocumentKind(actor, kind)) {
    return forbiddenDocumentMailResponse();
  }

  const documentId = cleanText(body.documentId);
  const projectId = cleanText(body.projectId);
  const documentNumber = cleanText(body.documentNumber);
  if (!(await documentBelongsToOrganization(organization.id, kind, documentId, projectId, documentNumber))) {
    return NextResponse.json({ error: "Dokument wurde nicht gefunden." }, { status: 404 });
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

  const storedAttachments = Boolean(body.attachPdf)
    ? await getPdfAttachment(kind, cleanText(body.documentId), cleanText(body.documentNumber))
    : [];
  const uploadedAttachment =
    Boolean(body.attachPdf) && cleanText(body.attachmentDataUrl)
      ? getDataUrlAttachment(
          cleanText(body.attachmentName) || `${cleanText(body.documentNumber)}.pdf`,
          cleanText(body.attachmentDataUrl)
        )
      : null;
  const additionalAttachments = Boolean(body.attachActivityReports)
    ? getAdditionalDataUrlAttachments(body.additionalAttachments)
    : [];
  const manualAttachments = getAdditionalDataUrlAttachments(body.manualAttachments);
  const attachments = [
    ...storedAttachments,
    ...(uploadedAttachment ? [uploadedAttachment] : []),
    ...additionalAttachments,
    ...manualAttachments,
  ];
  const feedbackLink = await getOrCreateFeedbackRequestLink(req, { ...body, organizationId: organization.id }, actor);
  const signatureHtml = await getSenderSignature(actor.id);
  const rawMessageBody = cleanText(body.body);
  const messageBody = signatureHtml ? stripTrailingMailClosing(rawMessageBody) : rawMessageBody;
  const feedbackHtml = feedbackLink ? getFeedbackMailBlockHtml(feedbackLink) : "";
  const feedbackText = feedbackLink
    ? `\n\nWie zufrieden waren Sie mit unserer Leistung? Jetzt bewerten: ${feedbackLink}`
    : "";
  const messageHtml = `${textToHtml(messageBody)}${feedbackHtml}${signatureHtml ? signatureHtml : ""}`;

  try {
    await sendViaMicrosoftGraph({
      accessToken: mailAccount.accessToken,
      to: recipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      subject: cleanText(body.subject),
      body: messageHtml,
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
      ${cleanText(body.subject)}, ${`${messageBody}${feedbackText}`}, ${Boolean(body.attachPdf)},
      ${"microsoft365"}, ${"sent"}, ${`ms365-${id}`}
    )
  `;

  if (kind === "invoice" && Boolean(body.attachActivityReports)) {
    const activityReportAttachments = getAdditionalDataUrlAttachments(body.additionalAttachments);
    for (const attachment of activityReportAttachments) {
      const attachmentName = cleanText(attachment.name).replace(/\.pdf$/i, "");
      await prisma.$executeRaw`
        INSERT INTO "DocumentMailDispatch" (
          "id", "organizationId", "documentKind", "documentId", "documentNumber",
          "projectId", "projectNumber", "projectTitle", "customerName",
          "senderUserId", "senderName", "senderEmail", "toRecipients",
          "ccRecipients", "bccRecipients", "subject", "body", "attachPdf",
          "provider", "status", "providerMessageId"
        ) VALUES (
          ${randomUUID()}, ${organization.id}, ${"activityReport"}, ${`${cleanText(body.documentId)}:${cleanText(attachment.name)}`}, ${attachmentName || "Tätigkeitsbericht"},
          ${cleanText(body.projectId)}, ${cleanText(body.projectNumber)}, ${cleanText(body.projectTitle)},
          ${cleanText(body.customerName)}, ${actor.id}, ${actorName}, ${senderEmail},
          ${recipients.join(", ")}, ${ccRecipients.join(", ")}, ${bccRecipients.join(", ")},
          ${cleanText(body.subject)}, ${`Als Anhang mit Rechnung ${cleanText(body.documentNumber)} versendet.`}, ${true},
          ${"microsoft365"}, ${"sent"}, ${`ms365-${id}`}
        )
      `;
    }
  }

  await addDocumentMailHistory(organization.id, body, actorName, recipients);

  return NextResponse.json({
    id,
    status: "sent",
    provider: "microsoft365",
    senderEmail,
    recipients,
  });
}

export async function GET(req: Request) {
  await ensureDocumentMailTables();
  const { searchParams } = new URL(req.url);
  const projectId = cleanText(searchParams.get("projectId"));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, searchParams.get("actorId"));
  if (!actor) {
    return unauthorizedActorResponse();
  }

  const rows = projectId
    ? await prisma.$queryRaw<Array<Parameters<typeof formatDispatch>[0]>>`
        SELECT "id", "documentKind", "documentId", "documentNumber", "projectId", "projectNumber",
               "projectTitle", "customerName", "toRecipients", "subject", "body", "attachPdf", "status", "createdAt"
        FROM "DocumentMailDispatch"
        WHERE "organizationId" = ${organization.id}
          AND "projectId" = ${projectId}
        ORDER BY "createdAt" DESC
      `
    : await prisma.$queryRaw<Array<Parameters<typeof formatDispatch>[0]>>`
        SELECT "id", "documentKind", "documentId", "documentNumber", "projectId", "projectNumber",
               "projectTitle", "customerName", "toRecipients", "subject", "body", "attachPdf", "status", "createdAt"
        FROM "DocumentMailDispatch"
        WHERE "organizationId" = ${organization.id}
        ORDER BY "createdAt" DESC
      `;

  return NextResponse.json(rows.map(formatDispatch));
}
