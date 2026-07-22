import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getStoredMailAccount, refreshMicrosoftAccessToken } from "@/lib/mail/microsoft";
import {
  OFFER_ACCEPTANCE_CONSENT,
  cleanAcceptanceText,
  createAcceptanceCertificate,
  ensureOfferAcceptanceTable,
  getAcceptanceClientIp,
  hashAcceptanceValue,
} from "@/lib/offer-acceptance/core";

type AcceptanceRow = {
  id: string; organizationId: string; offerId: string; projectId: string; customerId: string;
  offerNumber: string; offerVersionHash: string; offerPdfData: string; recipientEmail: string;
  senderUserId: string; senderName: string; senderEmail: string; status: string; sentAt: Date | null;
  expiresAt: Date; firstAccessedAt: Date | null; firstViewedAt: Date | null; lastViewedAt: Date | null;
  viewCount: number; acceptanceStartedAt: Date | null; acceptedAt: Date | null; acceptedByName: string;
  acceptedByRole: string; acceptedByEmail: string; consentText: string; acceptancePdfData: string | null;
  revokedAt: Date | null;
  customerName: string; projectNumber: string; projectTitle: string; netTotal: number; vatRate: number; grossTotal: number;
};

type AcceptanceDb = typeof prisma | Prisma.TransactionClient;

async function getAcceptance(token: string, db: AcceptanceDb = prisma, lock = false) {
  const hash = hashAcceptanceValue(token);
  return db.$queryRawUnsafe<AcceptanceRow[]>(`
    SELECT r.*, o."customerName", o."projectNumber", o."projectTitle", o."netTotal", o."vatRate", o."grossTotal"
    FROM "OfferAcceptanceRequest" r
    INNER JOIN "Offer" o ON o.id = r."offerId" AND o."organizationId" = r."organizationId"
    WHERE r."tokenHash" = $1
    LIMIT 1${lock ? " FOR UPDATE" : ""}
  `, hash).then((rows) => rows[0] ?? null);
}

function publicPayload(row: AcceptanceRow) {
  const expired = row.expiresAt.getTime() < Date.now() && row.status !== "accepted";
  return {
    offerNumber: row.offerNumber,
    customerName: row.customerName,
    projectNumber: row.projectNumber,
    projectTitle: row.projectTitle,
    netTotal: row.netTotal,
    vatRate: row.vatRate,
    grossTotal: row.grossTotal,
    recipientEmail: row.recipientEmail,
    senderName: row.senderName,
    status: expired ? "expired" : row.status,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    acceptedByName: row.acceptedByName,
    acceptedByRole: row.acceptedByRole,
    consentText: OFFER_ACCEPTANCE_CONSENT,
    offerPdfDataUrl: `data:application/pdf;base64,${row.offerPdfData}`,
    acceptancePdfDataUrl: row.acceptancePdfData ? `data:application/pdf;base64,${row.acceptancePdfData}` : null,
  };
}

function escapeAcceptanceHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

async function sendConfirmation(req: Request, row: AcceptanceRow, certificate: string) {
  const account = await refreshMicrosoftAccessToken(row.senderUserId, await getStoredMailAccount(row.senderUserId), req);
  if (account.status !== "connected" || !account.accessToken) throw new Error("Das Microsoft-Postfach des Absenders ist nicht verbunden.");
  const acceptedAt = row.acceptedAt ?? new Date();
  const content = `<p>Guten Tag ${escapeAcceptanceHtml(row.acceptedByName)},</p><p>vielen Dank für Ihren Auftrag. Das Angebot <strong>${escapeAcceptanceHtml(row.offerNumber)}</strong> wurde am ${acceptedAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} verbindlich angenommen.</p><p>Im Anhang finden Sie das angenommene Angebot und das Freigabeprotokoll.</p><p>Mit freundlichen Grüßen<br>${escapeAcceptanceHtml(row.senderName)}</p>`;
  await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      subject: `Bestätigung Ihrer Annahme – Angebot ${row.offerNumber}`,
      body: { contentType: "HTML", content },
      toRecipients: [{ emailAddress: { address: row.recipientEmail } }],
      attachments: [
        { "@odata.type": "#microsoft.graph.fileAttachment", name: `${row.offerNumber}.pdf`, contentType: "application/pdf", contentBytes: row.offerPdfData },
        { "@odata.type": "#microsoft.graph.fileAttachment", name: `Freigabe-${row.offerNumber}.pdf`, contentType: "application/pdf", contentBytes: certificate },
      ],
    }, saveToSentItems: true }),
  }).then(async (response) => { if (!response.ok) throw new Error(await response.text()); });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  await ensureOfferAcceptanceTable();
  const token = cleanAcceptanceText((await params).token);
  const row = await getAcceptance(token);
  if (!row) return NextResponse.json({ error: "Freigabelink nicht gefunden." }, { status: 404 });
  await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "firstAccessedAt" = COALESCE("firstAccessedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}`;
  return NextResponse.json(publicPayload(row));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  await ensureOfferAcceptanceTable();
  const token = cleanAcceptanceText((await params).token);
  const body = await req.json().catch(() => ({}));
  const event = cleanAcceptanceText(body.event);
  const row = await getAcceptance(token);
  if (!row) return NextResponse.json({ error: "Freigabelink nicht gefunden." }, { status: 404 });
  if (event === "viewed") {
    await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "firstViewedAt" = COALESCE("firstViewedAt", CURRENT_TIMESTAMP), "lastViewedAt" = CURRENT_TIMESTAMP, "viewCount" = "viewCount" + 1, "status" = CASE WHEN "status" = 'sent' THEN 'viewed' ELSE "status" END, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id} AND "acceptedAt" IS NULL`;
  } else if (event === "started") {
    await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "acceptanceStartedAt" = COALESCE("acceptanceStartedAt", CURRENT_TIMESTAMP), "status" = CASE WHEN "acceptedAt" IS NULL THEN 'started' ELSE "status" END, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}`;
  }
  return NextResponse.json({ success: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  await ensureOfferAcceptanceTable();
  const token = cleanAcceptanceText((await params).token);
  const body = await req.json().catch(() => ({}));
  const acceptedByName = cleanAcceptanceText(body.name);
  const acceptedByRole = cleanAcceptanceText(body.role);
  if (acceptedByName.length < 3 || body.authorized !== true || body.accepted !== true) {
    return NextResponse.json({ error: "Bitte Namen, Berechtigung und verbindliche Annahme bestätigen." }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    const row = await getAcceptance(token, tx, true);
    if (!row) return { kind: "not-found" } as const;
    if (row.acceptedAt || row.status === "accepted") return { kind: "accepted" } as const;
    if (row.revokedAt || row.expiresAt.getTime() < Date.now()) return { kind: "expired" } as const;
    const acceptedAt = new Date();
    const certificate = await createAcceptanceCertificate({
      offerNumber: row.offerNumber, customerName: row.customerName, projectNumber: row.projectNumber,
      projectTitle: row.projectTitle, grossTotal: row.grossTotal, acceptedByName, acceptedByRole,
      acceptedByEmail: row.recipientEmail, acceptedAt, offerVersionHash: row.offerVersionHash,
      acceptanceId: row.id, consentText: OFFER_ACCEPTANCE_CONSENT,
    });
    await tx.$executeRaw`
      UPDATE "OfferAcceptanceRequest" SET "status" = 'accepted', "acceptedAt" = ${acceptedAt},
        "acceptedByName" = ${acceptedByName}, "acceptedByRole" = ${acceptedByRole},
        "acceptedByEmail" = ${row.recipientEmail}, "acceptedIp" = ${getAcceptanceClientIp(req)},
        "acceptedUserAgent" = ${cleanAcceptanceText(req.headers.get("user-agent"))},
        "consentText" = ${OFFER_ACCEPTANCE_CONSENT}, "acceptancePdfData" = ${certificate.base64},
        "acceptancePdfHash" = ${certificate.hash}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${row.id} AND "acceptedAt" IS NULL
    `;
    await tx.$executeRaw`UPDATE "Offer" SET "wonAt" = COALESCE("wonAt", ${acceptedAt}), "wonByName" = ${acceptedByName}, "wonReason" = 'Digital durch den Kunden angenommen', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.offerId} AND "organizationId" = ${row.organizationId}`;
    await tx.$executeRaw`INSERT INTO "OfferHistory" ("id", "organizationId", "offerId", "projectId", "offerNumber", "eventType", "title", "note", "actorName") VALUES (${randomUUID()}, ${row.organizationId}, ${row.offerId}, ${row.projectId}, ${row.offerNumber}, 'customer_accepted', 'Angebot digital angenommen', ${`${acceptedByName}${acceptedByRole ? ` (${acceptedByRole})` : ""} hat das Angebot verbindlich angenommen.`}, ${acceptedByName})`;
    return {
      kind: "created",
      row: { ...row, acceptedAt, acceptedByName, acceptedByRole },
      certificate: certificate.base64,
    } as const;
  });
  if (result.kind === "not-found") return NextResponse.json({ error: "Freigabelink nicht gefunden." }, { status: 404 });
  if (result.kind === "expired") return NextResponse.json({ error: "Dieser Freigabelink ist abgelaufen oder wurde ersetzt." }, { status: 410 });
  if (result.kind === "accepted") return NextResponse.json({ error: "Dieses Angebot wurde bereits angenommen." }, { status: 409 });
  try {
    await sendConfirmation(req, result.row, result.certificate);
    await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "confirmationSentAt" = CURRENT_TIMESTAMP, "confirmationError" = '', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${result.row.id}`;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Bestätigungs-E-Mail konnte nicht gesendet werden.";
    await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "confirmationError" = ${message}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${result.row.id}`;
  }
  return NextResponse.json({ success: true });
}
