import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { isInternalAutomationRequest } from "@/lib/auth/internal-automation";
import {
  getStoredMailAccount,
  refreshMicrosoftAccessToken,
  sendMicrosoftGraphMail,
  type MicrosoftGraphMailAttachment,
} from "@/lib/mail/microsoft";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";
import { canSendDocumentMails, canSendInvoiceDocuments, canSendOfferDocuments } from "@/lib/permissions";
import { generateXRechnungXml, type XRechnungSeller } from "@/lib/e-invoice/xrechnung";
import { validateXRechnungPayload } from "@/lib/e-invoice/xrechnung-validation";
import { validateXRechnungWithKosit } from "@/lib/e-invoice/kosit-validator";
import { buildValidatedZugferdPdf } from "@/lib/e-invoice/zugferd-pdf";
import { getPublicAppOrigin } from "@/lib/http/public-app-origin";
import {
  createAcceptanceId,
  createAcceptanceToken,
  createWithdrawalNotice,
  ensureOfferAcceptanceTable,
  hashAcceptanceValue,
} from "@/lib/offer-acceptance/core";
import {
  claimDocumentMailDispatch,
  InvoiceDeliveryServiceError,
} from "@/lib/invoices/invoice-delivery-service";

type MailAccount = {
  provider?: string;
  status?: string;
  email?: string;
  displayName?: string;
};

type EInvoiceFormat = "pdf" | "xrechnung" | "zugferd" | "pdf-xrechnung";

type InvoiceMailRow = {
  id: string;
  projectId: string;
  projectNumber: string;
  invoiceNumber: string;
  status: string;
  customerName: string;
  customerStreet: string;
  customerCity: string;
  contactName: string;
  serviceDate: string;
  dueDate: string;
  netTotal: number;
  vatRate: number;
  grossTotal: number;
  paymentTermDays: number;
  createdAt: Date;
};

type InvoiceMailLineRow = {
  position: number;
  quantity: number;
  unit: string;
  title: string;
  description: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  totalNet: number;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDateKey(value: unknown) {
  const normalized = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function cleanPaymentTermDays(value: unknown) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 14;
  return Math.min(Math.max(parsed, 0), 365);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const cleanDate = cleanDateKey(dateKey);
  if (!cleanDate) return "";
  const [year, month, day] = cleanDate.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  date.setDate(date.getDate() + cleanPaymentTermDays(days));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isInvoiceBlockedForXRechnung(status: unknown) {
  return ["Storniert", "Stornorechnung", "Gelöscht", "Gel\u00c3\u00b6scht"].includes(cleanText(status));
}

function cleanInvoiceLineTitle(value: unknown) {
  return cleanText(value).replace(/\s*\(\s*\d+(?:[,.]\d+)?\s*€\s*\/\s*Std\.\s*\)\s*$/i, "");
}

function parseBoundedPositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
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

function getTargetedDataUrlAttachments(value: unknown, target: "invoice" | "activityReport") {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .filter((item) => {
      const itemTarget = cleanText(item?.target) || "both";
      return itemTarget === "both" || itemTarget === target;
    })
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

type PreparedFeedbackRequest = {
  id: string;
  url: string;
  recipientEmail: string;
  created: boolean;
};

async function prepareFeedbackRequestLink(req: Request, body: Record<string, unknown>): Promise<PreparedFeedbackRequest | null> {
  if (cleanText(body.kind) !== "invoice") return null;
  if (body.includeFeedbackLink === false) return null;
  const invoiceId = cleanText(body.documentId);
  if (!invoiceId) return null;
  const organizationId = cleanText(body.organizationId);
  if (!organizationId) return null;
  const recipientEmail = parseRecipients(body.to)[0] ?? "";

  await ensureSalesHubTables();
  const existing = await prisma.$queryRaw<Array<{ id: string; token: string }>>`
    SELECT id, token
    FROM "CustomerFeedbackRequest"
    WHERE "organizationId" = ${organizationId}
      AND "invoiceId" = ${invoiceId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  if (existing[0]?.token) {
    return {
      id: existing[0].id,
      url: `${getPublicAppOrigin(req)}/feedback/${existing[0].token}`,
      recipientEmail,
      created: false,
    };
  }

  const token = randomUUID().replaceAll("-", "");
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "CustomerFeedbackRequest" (
      "id", "organizationId", "token", "invoiceId", "invoiceNumber", "projectId",
      "customerName", "recipientEmail", "salesUserId", "salesUserName", "status", "sentAt"
    ) VALUES (
      ${id}, ${organizationId}, ${token},
      ${invoiceId}, ${cleanText(body.documentNumber)}, ${cleanText(body.projectId) || null},
      ${cleanText(body.customerName)}, ${recipientEmail},
      ${null}, ${"WorkPilot"}, 'open', NULL
    )
  `;
  return { id, url: `${getPublicAppOrigin(req)}/feedback/${token}`, recipientEmail, created: true };
}

function getOfferAcceptanceMailBlockHtml(link: string, consumerFlow = false) {
  const safeLink = escapeHtml(link);
  return [
    '<div style="margin:22px 0 18px;padding:18px;border:1px solid #bcd7da;border-radius:14px;background:#f4f9f9;max-width:520px;">',
    '<p style="margin:0 0 8px;color:#0f172a;font-weight:800;">Angebot digital prüfen und freigeben</p>',
    '<p style="margin:0 0 14px;color:#52666b;font-size:13px;line-height:1.5;">Über den folgenden Link können Sie das Angebot ansehen, herunterladen und verbindlich annehmen.</p>',
    `<a href="${safeLink}" target="_blank" rel="noreferrer" style="display:inline-block;background:#075c63;color:#ffffff;text-decoration:none;font-weight:800;border-radius:10px;padding:11px 17px;">Angebot prüfen und annehmen</a>`,
    '<p style="margin:10px 0 0;color:#64748b;font-size:12px;line-height:1.4;">Die Annahme erfolgt erst nach Ihrer ausdrücklichen Bestätigung auf der Folgeseite.</p>',
    '<p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.4;">Falls sich der Button nicht öffnen lässt, antworten Sie bitte auf diese E-Mail. Wir helfen Ihnen gerne weiter.</p>',
    consumerFlow
      ? '<p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.4;">Ihre Widerrufsbelehrung und das Muster-Widerrufsformular finden Sie im Anhang und auf der Angebotsseite.</p>'
      : '',
    "</div>",
  ].join("");
}

type PreparedOfferAcceptance = {
  id: string;
  url: string;
  consumerFlow: boolean;
  withdrawalNoticePdfData: string | null;
  offerNumber: string;
};

async function prepareOfferAcceptance(req: Request, organizationId: string, body: Record<string, unknown>, actor: User, actorName: string, senderEmail: string, recipientEmail: string): Promise<PreparedOfferAcceptance | null> {
  if (cleanText(body.kind) !== "offer" || body.includeAcceptanceLink === false) return null;
  const offerId = cleanText(body.documentId);
  if (!offerId || !recipientEmail) return null;
  await ensureOfferAcceptanceTable();
  const offers = await prisma.$queryRaw<Array<{ id: string; offerNumber: string; projectId: string; pdfData: string | null }>>`
    SELECT id, "offerNumber", "projectId", "pdfData" FROM "Offer"
    WHERE id = ${offerId} AND "organizationId" = ${organizationId} LIMIT 1
  `;
  const offer = offers[0];
  if (!offer?.pdfData) return null;
  const projects = await prisma.$queryRaw<Array<{ contactId: string | null }>>`
    SELECT "contactId" FROM "WorkPilotProject" WHERE id = ${offer.projectId} AND "organizationId" = ${organizationId} LIMIT 1
  `;
  const customerId = projects[0]?.contactId ?? "";
  const contacts = customerId
    ? await prisma.$queryRaw<Array<{ type: string; category: string }>>`
        SELECT "type", "category" FROM "Contact"
        WHERE id = ${customerId} AND "organizationId" = ${organizationId}
        LIMIT 1
      `
    : [];
  const consumerFlow = contacts[0]?.type === "private" || contacts[0]?.category === "Privatkunde";
  const token = createAcceptanceToken();
  const id = createAcceptanceId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const acceptanceUrl = `${getPublicAppOrigin(req)}/angebot/${token}`;
  const withdrawalNotice = consumerFlow
    ? await createWithdrawalNotice({
        seller: {
          name: "OK solutions GmbH",
          street: "Im Krötenteich 3/4",
          postalCode: "74722",
          city: "Buchen",
          country: "Deutschland",
          phone: "+49 6281 3263110",
          email: senderEmail,
        },
        offerNumber: offer.offerNumber,
        withdrawalUrl: acceptanceUrl,
      })
    : null;
  await prisma.$executeRaw`
    INSERT INTO "OfferAcceptanceRequest" (
      "id", "organizationId", "offerId", "projectId", "customerId", "tokenHash", "offerNumber",
      "offerVersionHash", "offerPdfData", "recipientEmail", "recipientName", "senderUserId",
      "senderName", "senderEmail", "status", "expiresAt", "consumerFlow",
      "withdrawalNoticePdfData", "withdrawalNoticePdfHash"
    ) VALUES (
      ${id}, ${organizationId}, ${offerId}, ${offer.projectId}, ${customerId}, ${hashAcceptanceValue(token)}, ${offer.offerNumber},
      ${hashAcceptanceValue(offer.pdfData)}, ${offer.pdfData}, ${recipientEmail}, ${cleanText(body.customerName)}, ${actor.id},
      ${actorName}, ${senderEmail}, 'prepared', ${expiresAt}, ${consumerFlow},
      ${withdrawalNotice?.base64 ?? null}, ${withdrawalNotice?.hash ?? ""}
    )
  `;
  return {
    id,
    url: acceptanceUrl,
    consumerFlow,
    withdrawalNoticePdfData: withdrawalNotice?.base64 ?? null,
    offerNumber: offer.offerNumber,
  };
}

async function markFeedbackRequestAsSent(organizationId: string, request: PreparedFeedbackRequest | null) {
  if (!request) return;
  await prisma.$executeRaw`
    UPDATE "CustomerFeedbackRequest"
    SET "recipientEmail" = ${request.recipientEmail},
        "status" = CASE WHEN "status" = 'answered' THEN "status" ELSE 'sent' END,
        "sentAt" = COALESCE("sentAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${request.id}
      AND "organizationId" = ${organizationId}
  `;
}

async function discardUnsentFeedbackRequest(organizationId: string, request: PreparedFeedbackRequest | null) {
  if (!request?.created) return;
  await prisma.$executeRaw`
    DELETE FROM "CustomerFeedbackRequest"
    WHERE id = ${request.id}
      AND "organizationId" = ${organizationId}
      AND status = 'open'
      AND "sentAt" IS NULL
  `;
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

    const legacyLogbookEntryId = documentId.replace(/-\d+$/, "");
    const logbookEntries = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ProjectLogbookEntry"
      WHERE "organizationId" = ${organizationId}
        AND (id = ${documentId} OR id = ${legacyLogbookEntryId})
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

    const legacyLogbookEntryId = documentId.replace(/-\d+$/, "");
    const logbookRows = await prisma.$queryRaw<Array<{ attachments: unknown }>>`
      SELECT "attachments" FROM "ProjectLogbookEntry"
      WHERE id = ${documentId} OR id = ${legacyLogbookEntryId}
      LIMIT 1
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

async function getInvoicePdfBase64(documentId: string) {
  const rows = await prisma.$queryRaw<Array<{ pdfData: string | null }>>`
    SELECT "pdfData" FROM "Invoice" WHERE id = ${documentId} LIMIT 1
  `;
  return rows[0]?.pdfData || "";
}

function getXRechnungSellerProfile(): XRechnungSeller {
  return {
    name: "OK solutions GmbH",
    street: "Im Krötenteich 3/4",
    postalCode: "74722",
    city: "Buchen",
    country: "DE",
    endpoint: "rechnung@ok-solutions.com",
    vatId: "DE367346374",
    iban: "DE85674500480004369971",
    bic: "SOLADES1MOS",
    bankName: "Sparkasse Neckartal-Odenwald",
    contactName: "OK solutions GmbH",
    contactPhone: "+49 6281 5649990",
    contactEmail: "rechnung@ok-solutions.com",
  };
}

async function getInvoiceBuyerReference(organizationId: string, projectId: string, fallbackReference = "") {
  if (!projectId) return cleanText(fallbackReference);
  const rows = await prisma.$queryRaw<Array<{ leitwegId: string | null }>>`
    SELECT c."leitwegId"
    FROM "WorkPilotProject" p
    JOIN "Contact" c
      ON c."organizationId" = p."organizationId"
     AND (
       c."id" = p."contactId"
       OR c."id" = p."contactPersonId"
       OR c."id" = p."addressContactId"
       OR c."parentCompanyId" = p."contactId"
     )
    WHERE p."organizationId" = ${organizationId}
      AND p."id" = ${projectId}
      AND COALESCE(c."leitwegId", '') <> ''
    ORDER BY c."isInvoiceRecipient" DESC, c."isMainContact" DESC, c."updatedAt" DESC
    LIMIT 1
  `;
  return cleanText(rows[0]?.leitwegId) || cleanText(fallbackReference);
}

async function getXRechnungAttachment(organizationId: string, invoiceId: string, documentNumber: string) {
  const invoiceRows = await prisma.$queryRaw<InvoiceMailRow[]>`
    SELECT "id", "projectId", "projectNumber", "invoiceNumber", "status", "customerName", "customerStreet", "customerCity",
           "contactName", "serviceDate", "dueDate", "netTotal", "vatRate", "grossTotal",
           "paymentTermDays", "createdAt"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${invoiceId}
    LIMIT 1
  `;
  const invoice = invoiceRows[0];
  if (!invoice) {
    throw new Error("XRechnung konnte nicht erzeugt werden: Rechnung wurde nicht gefunden.");
  }
  if (isInvoiceBlockedForXRechnung(invoice.status)) {
    throw new Error("XRechnung kann fuer geloeschte oder stornierte Rechnungen nicht erzeugt werden.");
  }

  const lineRows = await prisma.$queryRaw<InvoiceMailLineRow[]>`
    SELECT "position", "quantity", "unit", "title", "description", "unitPrice",
           "discountPercent", "vatRate", "totalNet"
    FROM "InvoiceLine"
    WHERE "organizationId" = ${organizationId}
      AND "invoiceId" = ${invoiceId}
    ORDER BY "position" ASC, "createdAt" ASC
  `;
  if (!lineRows.length) {
    throw new Error("XRechnung konnte nicht erzeugt werden: Rechnungspositionen fehlen.");
  }

  const paymentTermDays = cleanPaymentTermDays(invoice.paymentTermDays);
  const serviceDate = cleanDateKey(invoice.serviceDate);
  const dueDate = cleanDateKey(invoice.dueDate) || addDaysToDateKey(serviceDate, paymentTermDays);
  const xrechnungInvoice = {
    invoiceNumber: invoice.invoiceNumber || documentNumber,
    issueDate: invoice.createdAt?.toISOString?.().slice(0, 10) || new Date().toISOString().slice(0, 10),
    serviceDate,
    dueDate,
    seller: getXRechnungSellerProfile(),
    customerName: invoice.customerName,
    customerStreet: invoice.customerStreet,
    customerCity: invoice.customerCity,
    contactName: invoice.contactName,
    netTotal: Number(invoice.netTotal ?? 0),
    vatRate: Number(invoice.vatRate ?? 19),
    grossTotal: Number(invoice.grossTotal ?? 0),
    paymentTermDays,
    buyerReference: await getInvoiceBuyerReference(
      organizationId,
      invoice.projectId,
      invoice.projectNumber || invoice.invoiceNumber || documentNumber
    ),
  };
  const xrechnungLines = lineRows.map((line, index) => ({
    position: Number(line.position ?? index + 1),
    quantity: Number(line.quantity ?? 0),
    unit: line.unit || "Stk",
    title: cleanInvoiceLineTitle(line.title) || "Position",
    description: line.description || "",
    unitPrice: Number(line.unitPrice ?? 0),
    discountPercent: Number(line.discountPercent ?? 0),
    vatRate: Number(line.vatRate ?? invoice.vatRate ?? 19),
    totalNet: Number(line.totalNet ?? 0),
  }));
  const validation = validateXRechnungPayload(xrechnungInvoice, xrechnungLines);
  if (!validation.valid) {
    const message = validation.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message)
      .join(" ");
    throw new Error(`XRechnung konnte nicht erzeugt werden: ${message || "Validierungsfehler gefunden."}`);
  }

  const xml = generateXRechnungXml(xrechnungInvoice, xrechnungLines);
  const kositValidation = await validateXRechnungWithKosit(xml);
  if (kositValidation.available && !kositValidation.valid) {
    throw new Error(`XRechnung wurde vom KoSIT-Validator abgelehnt: ${kositValidation.message}`);
  }

  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: `${invoice.invoiceNumber || documentNumber}-xrechnung.xml`,
    contentType: "application/xml",
    contentBytes: Buffer.from(xml, "utf8").toString("base64"),
  };
}

async function getZugferdAttachment(organizationId: string, invoiceId: string, documentNumber: string) {
  const xrechnungAttachment = await getXRechnungAttachment(organizationId, invoiceId, documentNumber);
  const pdfData = await getInvoicePdfBase64(invoiceId);
  if (!pdfData) {
    throw new Error("ZUGFeRD konnte nicht erzeugt werden: Rechnungs-PDF fehlt.");
  }

  const zugferd = await buildValidatedZugferdPdf({
    invoicePdfBytes: Buffer.from(pdfData, "base64"),
    xrechnungXml: Buffer.from(String(xrechnungAttachment.contentBytes || ""), "base64"),
  });
  if (!zugferd.conversion.available) {
    throw new Error("ZUGFeRD konnte nicht erzeugt werden: PDF/A-3-Konverter ist nicht konfiguriert.");
  }
  if (!zugferd.conversion.converted) {
    throw new Error(`ZUGFeRD konnte nicht erzeugt werden: ${zugferd.conversion.message}`);
  }
  if (!zugferd.validation?.available) {
    throw new Error("ZUGFeRD konnte nicht erzeugt werden: PDF/A-3-Validator ist nicht konfiguriert.");
  }
  if (!zugferd.validation.valid || !zugferd.pdfBytes) {
    const issueText = zugferd.validation.issues.map((issue) => issue.message).filter(Boolean).slice(0, 3).join(" ");
    throw new Error(
      `ZUGFeRD wurde vom PDF/A-3-Validator abgelehnt: ${issueText || zugferd.validation.message}`
    );
  }

  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: `${documentNumber}-zugferd.pdf`,
    contentType: "application/pdf",
    contentBytes: zugferd.pdfBytes.toString("base64"),
  };
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
  await sendMicrosoftGraphMail({
    accessToken: input.accessToken,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    htmlBody: input.body,
    attachments:
      input.attachments as unknown as MicrosoftGraphMailAttachment[],
  });
}

export async function POST(req: Request) {
  await ensureDocumentMailTables();
  const body = (await req.json()) as Record<string, unknown>;
  const { organization, users } = await getDemoContext();
  const internalRequest = isInternalAutomationRequest(req);
  const actorResult = internalRequest ? null : await getSessionBoundActor(req, users, body.actorId);
  if (actorResult && !actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = internalRequest
    ? users.find((candidate) => candidate.id === cleanText(body.actorId) && candidate.isActive)
    : actorResult?.actor;
  if (!actor) {
    return NextResponse.json({ error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." }, { status: 401 });
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

  const eInvoiceFormat = cleanText(body.eInvoiceFormat) as EInvoiceFormat;

  const shouldAttachStoredPdf =
    (Boolean(body.attachPdf) && eInvoiceFormat !== "zugferd") ||
    (kind === "invoice" && eInvoiceFormat === "pdf-xrechnung");
  const storedAttachments = shouldAttachStoredPdf
    ? await getPdfAttachment(kind, cleanText(body.documentId), cleanText(body.documentNumber))
    : [];
  const uploadedAttachment =
    shouldAttachStoredPdf && cleanText(body.attachmentDataUrl)
      ? getDataUrlAttachment(
          cleanText(body.attachmentName) || `${cleanText(body.documentNumber)}.pdf`,
          cleanText(body.attachmentDataUrl)
        )
      : null;
  let xrechnungAttachment: Record<string, unknown> | null = null;
  let zugferdAttachment: Record<string, unknown> | null = null;
  if (kind === "invoice" && ["xrechnung", "pdf-xrechnung"].includes(eInvoiceFormat)) {
    try {
      xrechnungAttachment = await getXRechnungAttachment(organization.id, documentId, documentNumber);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "XRechnung konnte nicht erzeugt werden." },
        { status: 400 }
      );
    }
  }
  if (kind === "invoice" && eInvoiceFormat === "zugferd") {
    try {
      zugferdAttachment = await getZugferdAttachment(organization.id, documentId, documentNumber);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "ZUGFeRD konnte nicht erzeugt werden." },
        { status: 400 }
      );
    }
  }
  const separateActivityReportRecipients =
    kind === "invoice" && parseRecipients(body.activityReportTo).length > 0;
  const activityReportRecipients = parseRecipients(body.activityReportTo);
  const additionalAttachments = Boolean(body.attachActivityReports)
    ? getAdditionalDataUrlAttachments(body.additionalAttachments)
    : [];
  const invoiceManualAttachments = separateActivityReportRecipients
    ? getTargetedDataUrlAttachments(body.manualAttachments, "invoice")
    : getAdditionalDataUrlAttachments(body.manualAttachments);
  const activityReportManualAttachments = separateActivityReportRecipients
    ? getTargetedDataUrlAttachments(body.manualAttachments, "activityReport")
    : [];
  const shouldSendSeparateActivityReport =
    separateActivityReportRecipients && (additionalAttachments.length > 0 || activityReportManualAttachments.length > 0);
  const attachments = [
    ...storedAttachments,
    ...(uploadedAttachment ? [uploadedAttachment] : []),
    ...(xrechnungAttachment ? [xrechnungAttachment] : []),
    ...(zugferdAttachment ? [zugferdAttachment] : []),
    ...(shouldSendSeparateActivityReport ? [] : additionalAttachments),
    ...invoiceManualAttachments,
  ];
  const requestedDispatchKey = cleanText(body.dispatchKey);
  if (
    requestedDispatchKey &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestedDispatchKey
    )
  ) {
    return NextResponse.json(
      { error: "Der Versandauftrag ist ungültig." },
      { status: 400 }
    );
  }
  const id = requestedDispatchKey || randomUUID();
  const existingDispatch = await prisma.documentMailDispatch.findUnique({
    where: { id },
  });
  if (existingDispatch) {
    const sameRequest =
      existingDispatch.organizationId === organization.id &&
      existingDispatch.documentKind === kind &&
      existingDispatch.documentId === documentId &&
      existingDispatch.senderUserId === actor.id;
    if (!sameRequest) {
      return NextResponse.json(
        { error: "Der Versandauftrag kollidiert mit einem anderen Vorgang." },
        { status: 409 }
      );
    }
    if (existingDispatch.status === "sent") {
      return NextResponse.json({
        id,
        status: "sent",
        provider: existingDispatch.provider,
        senderEmail: existingDispatch.senderEmail,
        recipients,
        replayed: true,
      });
    }
    return NextResponse.json(
      {
        error:
          existingDispatch.status === "sending"
            ? "Der Versand wurde bereits gestartet. Prüfe den Versandstatus, bevor du erneut handelst."
            : "Dieser Versandauftrag ist fehlgeschlagen oder unklar und wird aus Sicherheitsgründen nicht automatisch wiederholt.",
      },
      { status: 409 }
    );
  }
  const preparedFeedbackRequest = await prepareFeedbackRequestLink(req, { ...body, organizationId: organization.id });
  const preparedOfferAcceptance = await prepareOfferAcceptance(
    req,
    organization.id,
    body,
    actor,
    actorName,
    senderEmail,
    recipients[0] ?? ""
  );
  const acceptanceAttachments = preparedOfferAcceptance?.withdrawalNoticePdfData
    ? [{
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `Widerrufsbelehrung-${preparedOfferAcceptance.offerNumber}.pdf`,
        contentType: "application/pdf",
        contentBytes: preparedOfferAcceptance.withdrawalNoticePdfData,
      }]
    : [];
  const feedbackLink = preparedFeedbackRequest?.url ?? "";
  const acceptanceLink = preparedOfferAcceptance?.url ?? "";
  const signatureHtml = await getSenderSignature(actor.id);
  const rawMessageBody = cleanText(body.body);
  const messageBody = signatureHtml ? stripTrailingMailClosing(rawMessageBody) : rawMessageBody;
  const feedbackHtml = feedbackLink ? getFeedbackMailBlockHtml(feedbackLink) : "";
  const acceptanceHtml = acceptanceLink
    ? getOfferAcceptanceMailBlockHtml(acceptanceLink, preparedOfferAcceptance?.consumerFlow)
    : "";
  const feedbackText = feedbackLink
    ? `\n\nWie zufrieden waren Sie mit unserer Leistung? Jetzt bewerten: ${feedbackLink}`
    : "";
  const acceptanceText = acceptanceLink
    ? `\n\nAngebot prüfen und annehmen: ${acceptanceLink}\nFalls sich der Link nicht öffnen lässt, antworten Sie bitte auf diese E-Mail. Wir helfen Ihnen gerne weiter.`
    : "";
  const messageHtml = `${textToHtml(messageBody)}${acceptanceHtml}${feedbackHtml}${signatureHtml ? signatureHtml : ""}`;

  try {
    const claim = await claimDocumentMailDispatch({
      id,
      organizationId: organization.id,
      documentKind: kind,
      documentId,
      documentNumber,
      projectId,
      projectNumber: cleanText(body.projectNumber),
      projectTitle: cleanText(body.projectTitle),
      customerName: cleanText(body.customerName),
      senderUserId: actor.id,
      senderName: actorName,
      senderEmail,
      toRecipients: recipients.join(", "),
      ccRecipients: ccRecipients.join(", "),
      bccRecipients: bccRecipients.join(", "),
      subject: cleanText(body.subject),
      body: `${messageBody}${acceptanceText}${feedbackText}`,
      attachPdf: Boolean(body.attachPdf),
    });
    if (claim.replay) {
      return NextResponse.json({
        id,
        status: "sent",
        provider: claim.dispatch.provider,
        senderEmail: claim.dispatch.senderEmail,
        recipients,
        replayed: true,
      });
    }
  } catch (error) {
    if (error instanceof InvoiceDeliveryServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 }
      );
    }
    throw error;
  }

  let primaryMailDelivered = false;
  let preparedActivityFeedbackRequest: PreparedFeedbackRequest | null = null;
  let activityMailDelivered = false;
  try {
    await sendViaMicrosoftGraph({
      accessToken: mailAccount.accessToken,
      to: recipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      subject: cleanText(body.subject),
      body: messageHtml,
      attachments: [...attachments, ...acceptanceAttachments],
    });
    primaryMailDelivered = true;
    await prisma.documentMailDispatch.update({
      where: { id },
      data: {
        status: "sent",
        providerMessageId: `ms365-${id}`,
        errorMessage: "",
      },
    });
    await markFeedbackRequestAsSent(organization.id, preparedFeedbackRequest);
    if (preparedOfferAcceptance) {
      await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "status" = 'sent', "sentAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${preparedOfferAcceptance.id}`;
      await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "status" = 'revoked', "revokedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "organizationId" = ${organization.id} AND "offerId" = ${documentId} AND id <> ${preparedOfferAcceptance.id} AND "acceptedAt" IS NULL AND "revokedAt" IS NULL`;
    }
    if (shouldSendSeparateActivityReport) {
      const activityReportRawBody = cleanText(body.activityReportBody) || rawMessageBody;
      const activityReportBody = signatureHtml ? stripTrailingMailClosing(activityReportRawBody) : activityReportRawBody;
      preparedActivityFeedbackRequest = await prepareFeedbackRequestLink(
        req,
        {
          ...body,
          organizationId: organization.id,
          documentId: `${documentId}:activity-report`,
          documentNumber: `${documentNumber} Tätigkeitsbericht`,
          to: cleanText(body.activityReportTo),
          includeFeedbackLink: body.includeActivityReportFeedbackLink !== false,
        }
      );
      const activityReportFeedbackLink = preparedActivityFeedbackRequest?.url ?? "";
      const activityReportFeedbackHtml = activityReportFeedbackLink ? getFeedbackMailBlockHtml(activityReportFeedbackLink) : "";
      const activityReportHtml = `${textToHtml(activityReportBody)}${activityReportFeedbackHtml}${signatureHtml ? signatureHtml : ""}`;
      await sendViaMicrosoftGraph({
        accessToken: mailAccount.accessToken,
        to: activityReportRecipients,
        cc: [],
        bcc: bccRecipients,
        subject: cleanText(body.activityReportSubject) || cleanText(body.subject),
        body: activityReportHtml,
        attachments: [...additionalAttachments, ...activityReportManualAttachments],
      });
      activityMailDelivered = true;
      await markFeedbackRequestAsSent(organization.id, preparedActivityFeedbackRequest);
    }
  } catch (error) {
    if (!primaryMailDelivered) {
      await prisma.documentMailDispatch
        .update({
          where: { id },
          data: {
            status: "failed",
            errorMessage:
              error instanceof Error
                ? error.message.slice(0, 2_000)
                : "Microsoft 365 Versand fehlgeschlagen.",
          },
        })
        .catch(() => undefined);
    }
    if (!primaryMailDelivered) {
      await discardUnsentFeedbackRequest(organization.id, preparedFeedbackRequest).catch(() => undefined);
      if (preparedOfferAcceptance) {
        await prisma.$executeRaw`DELETE FROM "OfferAcceptanceRequest" WHERE id = ${preparedOfferAcceptance.id} AND status = 'prepared'`.catch(() => undefined);
      }
    }
    if (!activityMailDelivered) {
      await discardUnsentFeedbackRequest(organization.id, preparedActivityFeedbackRequest).catch(() => undefined);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Microsoft 365 Versand fehlgeschlagen." },
      { status: 502 }
    );
  }

  if (kind === "invoice" && Boolean(body.attachActivityReports)) {
    const activityReportAttachments = getAdditionalDataUrlAttachments(body.additionalAttachments);
    const reportHistoryRecipients = shouldSendSeparateActivityReport ? activityReportRecipients : recipients;
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
          ${reportHistoryRecipients.join(", ")}, ${shouldSendSeparateActivityReport ? "" : ccRecipients.join(", ")}, ${bccRecipients.join(", ")},
          ${shouldSendSeparateActivityReport ? cleanText(body.activityReportSubject) || cleanText(body.subject) : cleanText(body.subject)}, ${shouldSendSeparateActivityReport ? "Separat als Tätigkeitsbericht-Mail versendet." : `Als Anhang mit Rechnung ${cleanText(body.documentNumber)} versendet.`}, ${true},
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
  const overviewLimit = parseBoundedPositiveInt(searchParams.get("limit"), 500, 1000);
  const { organization, users } = await getDemoContext();
  const requestedActorId = searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    if (actorResult.status === 401 && !cleanText(requestedActorId)) {
      return NextResponse.json([]);
    }
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canSendDocumentMails(actor)) {
    return forbiddenDocumentMailResponse();
  }

  const allowedKinds = [
    ...(canSendOfferDocuments(actor) ? ["offer"] : []),
    ...(canSendInvoiceDocuments(actor) ? ["invoice", "cancellation", "reminder"] : []),
    "activityReport",
    "document",
  ];

  const rows = projectId
    ? await prisma.$queryRaw<Array<Parameters<typeof formatDispatch>[0]>>`
        SELECT "id", "documentKind", "documentId", "documentNumber", "projectId", "projectNumber",
               "projectTitle", "customerName", "toRecipients", "subject", "body", "attachPdf", "status", "createdAt"
        FROM "DocumentMailDispatch"
        WHERE "organizationId" = ${organization.id}
          AND "projectId" = ${projectId}
          AND "documentKind" IN (${Prisma.join(allowedKinds)})
        ORDER BY "createdAt" DESC
      `
    : await prisma.$queryRaw<Array<Parameters<typeof formatDispatch>[0]>>`
        SELECT "id", "documentKind", "documentId", "documentNumber", "projectId", "projectNumber",
               "projectTitle", "customerName", "toRecipients", "subject", "body", "attachPdf", "status", "createdAt"
        FROM "DocumentMailDispatch"
        WHERE "organizationId" = ${organization.id}
          AND "documentKind" IN (${Prisma.join(allowedKinds)})
        ORDER BY "createdAt" DESC
        LIMIT ${overviewLimit}
      `;

  return NextResponse.json(rows.map(formatDispatch));
}
