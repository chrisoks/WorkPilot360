import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getStoredMailAccount, refreshMicrosoftAccessToken } from "@/lib/mail/microsoft";
import { getUserMailSignatureHtml } from "@/lib/mail/signature";
import {
  EARLY_PERFORMANCE_LOSS_ACKNOWLEDGEMENT,
  EARLY_PERFORMANCE_REQUEST,
  OFFER_ACCEPTANCE_CONSENT,
  WITHDRAWAL_NOTICE_ACKNOWLEDGEMENT,
  cleanAcceptanceText,
  createAcceptanceCertificate,
  createWithdrawalReceipt,
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
  consumerFlow: boolean; withdrawalNoticePdfData: string | null; withdrawalNoticeAcknowledgedAt: Date | null;
  earlyPerformanceRequested: boolean; earlyPerformanceConsentText: string; withdrawalDeadline: Date | null;
  withdrawnAt: Date | null; withdrawnByName: string; withdrawnByEmail: string;
  withdrawalReceiptPdfData: string | null;
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
  const expired = row.expiresAt.getTime() < Date.now() && !["accepted", "withdrawn"].includes(row.status);
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
    consumerFlow: row.consumerFlow,
    withdrawalNoticeText: WITHDRAWAL_NOTICE_ACKNOWLEDGEMENT,
    earlyPerformanceRequestText: EARLY_PERFORMANCE_REQUEST,
    earlyPerformanceLossText: EARLY_PERFORMANCE_LOSS_ACKNOWLEDGEMENT,
    earlyPerformanceRequested: row.earlyPerformanceRequested,
    withdrawalDeadline: row.withdrawalDeadline?.toISOString() ?? null,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    withdrawnByName: row.withdrawnByName,
    offerPdfDataUrl: `data:application/pdf;base64,${row.offerPdfData}`,
    acceptancePdfDataUrl: row.acceptancePdfData ? `data:application/pdf;base64,${row.acceptancePdfData}` : null,
    withdrawalNoticePdfDataUrl: row.withdrawalNoticePdfData ? `data:application/pdf;base64,${row.withdrawalNoticePdfData}` : null,
    withdrawalReceiptPdfDataUrl: row.withdrawalReceiptPdfData ? `data:application/pdf;base64,${row.withdrawalReceiptPdfData}` : null,
  };
}

function escapeAcceptanceHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

async function createOfferNotification(
  db: AcceptanceDb,
  row: AcceptanceRow,
  subject: string,
  body: string
) {
  await db.notification.create({
    data: {
      organizationId: row.organizationId,
      userId: row.senderUserId,
      channel: "app",
      subject,
      body,
      linkTarget: "offer-acceptance",
      linkTargetId: row.projectId,
      linkLabel: "Freigabe öffnen",
    },
  });
}

async function sendConfirmation(req: Request, row: AcceptanceRow, certificate: string, offerPageUrl: string) {
  const account = await refreshMicrosoftAccessToken(row.senderUserId, await getStoredMailAccount(row.senderUserId), req);
  if (account.status !== "connected" || !account.accessToken) throw new Error("Das Microsoft-Postfach des Absenders ist nicht verbunden.");
  const acceptedAt = row.acceptedAt ?? new Date();
  const consumerParagraph = row.consumerFlow
    ? `<p>Die Widerrufsbelehrung mit Muster-Widerrufsformular ist ebenfalls beigefügt. Ihre Widerrufsfrist läuft bis ${row.withdrawalDeadline?.toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) ?? "zum gesetzlichen Fristende"}. Während dieser Frist können Sie den Vertrag auch direkt über <a href="${escapeAcceptanceHtml(offerPageUrl)}">Ihre Angebotsseite</a> widerrufen.</p>`
    : "";
  const signatureHtml = await getUserMailSignatureHtml(row.senderUserId);
  const closingHtml = signatureHtml || `<p>Mit freundlichen Grüßen<br>${escapeAcceptanceHtml(row.senderName)}</p>`;
  const content = `<p>Guten Tag ${escapeAcceptanceHtml(row.acceptedByName)},</p><p>vielen Dank für Ihren Auftrag. Das Angebot <strong>${escapeAcceptanceHtml(row.offerNumber)}</strong> wurde am ${acceptedAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} verbindlich angenommen.</p><p>Im Anhang finden Sie das angenommene Angebot und das Freigabeprotokoll.</p>${consumerParagraph}${closingHtml}`;
  const attachments = [
    { "@odata.type": "#microsoft.graph.fileAttachment", name: `${row.offerNumber}.pdf`, contentType: "application/pdf", contentBytes: row.offerPdfData },
    { "@odata.type": "#microsoft.graph.fileAttachment", name: `Freigabe-${row.offerNumber}.pdf`, contentType: "application/pdf", contentBytes: certificate },
    ...(row.consumerFlow && row.withdrawalNoticePdfData
      ? [{ "@odata.type": "#microsoft.graph.fileAttachment", name: `Widerrufsbelehrung-${row.offerNumber}.pdf`, contentType: "application/pdf", contentBytes: row.withdrawalNoticePdfData }]
      : []),
  ];
  await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      subject: `Bestätigung Ihrer Annahme – Angebot ${row.offerNumber}`,
      body: { contentType: "HTML", content },
      toRecipients: [{ emailAddress: { address: row.recipientEmail } }],
      attachments,
    }, saveToSentItems: true }),
  }).then(async (response) => { if (!response.ok) throw new Error(await response.text()); });
}

async function sendWithdrawalConfirmation(req: Request, row: AcceptanceRow, receipt: string) {
  const account = await refreshMicrosoftAccessToken(row.senderUserId, await getStoredMailAccount(row.senderUserId), req);
  if (account.status !== "connected" || !account.accessToken) throw new Error("Das Microsoft-Postfach des Absenders ist nicht verbunden.");
  const signatureHtml = await getUserMailSignatureHtml(row.senderUserId);
  const closingHtml = signatureHtml || `<p>Mit freundlichen Grüßen<br>${escapeAcceptanceHtml(row.senderName)}</p>`;
  const content = `<p>Guten Tag ${escapeAcceptanceHtml(row.withdrawnByName)},</p><p>der Widerruf zum Angebot <strong>${escapeAcceptanceHtml(row.offerNumber)}</strong> ist am ${(row.withdrawnAt ?? new Date()).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} bei uns eingegangen.</p><p>Die Bestätigung des Widerrufs finden Sie im Anhang.</p>${closingHtml}`;
  await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      subject: `Bestätigung Ihres Widerrufs – Angebot ${row.offerNumber}`,
      body: { contentType: "HTML", content },
      toRecipients: [{ emailAddress: { address: row.withdrawnByEmail || row.recipientEmail } }],
      attachments: [
        { "@odata.type": "#microsoft.graph.fileAttachment", name: `Widerruf-${row.offerNumber}.pdf`, contentType: "application/pdf", contentBytes: receipt },
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
    const firstView = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "OfferAcceptanceRequest"
      SET "firstViewedAt" = CURRENT_TIMESTAMP, "lastViewedAt" = CURRENT_TIMESTAMP,
          "viewCount" = "viewCount" + 1,
          "status" = CASE WHEN "status" = 'sent' THEN 'viewed' ELSE "status" END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${row.id} AND "acceptedAt" IS NULL AND "firstViewedAt" IS NULL
      RETURNING id
    `;
    if (firstView.length > 0) {
      await createOfferNotification(
        prisma,
        row,
        `Angebot ${row.offerNumber} wurde angesehen`,
        `Die digitale Angebotsseite für ${row.customerName} wurde zum ersten Mal geöffnet.`
      ).catch(() => undefined);
    } else {
      await prisma.$executeRaw`
        UPDATE "OfferAcceptanceRequest"
        SET "lastViewedAt" = CURRENT_TIMESTAMP, "viewCount" = "viewCount" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${row.id} AND "acceptedAt" IS NULL
      `;
    }
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
  const earlyPerformanceRequested = body.earlyPerformanceRequested === true;
  if (acceptedByName.length < 3 || body.authorized !== true || body.accepted !== true) {
    return NextResponse.json({ error: "Bitte Namen, Berechtigung und verbindliche Annahme bestätigen." }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    const row = await getAcceptance(token, tx, true);
    if (!row) return { kind: "not-found" } as const;
    if (row.acceptedAt || row.status === "accepted") return { kind: "accepted" } as const;
    if (row.revokedAt || row.expiresAt.getTime() < Date.now()) return { kind: "expired" } as const;
    if (row.consumerFlow && body.withdrawalAcknowledged !== true) {
      return { kind: "consumer-consent-missing" } as const;
    }
    if (row.consumerFlow && earlyPerformanceRequested && body.earlyPerformanceLossAcknowledged !== true) {
      return { kind: "early-performance-consent-missing" } as const;
    }
    const acceptedAt = new Date();
    const withdrawalDeadline = row.consumerFlow
      ? new Date(acceptedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
      : null;
    const earlyPerformanceConsentText = row.consumerFlow && earlyPerformanceRequested
      ? `${EARLY_PERFORMANCE_REQUEST} ${EARLY_PERFORMANCE_LOSS_ACKNOWLEDGEMENT}`
      : "";
    const certificate = await createAcceptanceCertificate({
      offerNumber: row.offerNumber, customerName: row.customerName, projectNumber: row.projectNumber,
      projectTitle: row.projectTitle, grossTotal: row.grossTotal, acceptedByName, acceptedByRole,
      acceptedByEmail: row.recipientEmail, acceptedAt, offerVersionHash: row.offerVersionHash,
      acceptanceId: row.id, consentText: OFFER_ACCEPTANCE_CONSENT,
      consumerFlow: row.consumerFlow,
      earlyPerformanceRequested: row.consumerFlow && earlyPerformanceRequested,
      earlyPerformanceConsentText,
      withdrawalDeadline: withdrawalDeadline ?? undefined,
    });
    await tx.$executeRaw`
      UPDATE "OfferAcceptanceRequest" SET "status" = 'accepted', "acceptedAt" = ${acceptedAt},
        "acceptedByName" = ${acceptedByName}, "acceptedByRole" = ${acceptedByRole},
        "acceptedByEmail" = ${row.recipientEmail}, "acceptedIp" = ${getAcceptanceClientIp(req)},
        "acceptedUserAgent" = ${cleanAcceptanceText(req.headers.get("user-agent"))},
        "consentText" = ${OFFER_ACCEPTANCE_CONSENT}, "acceptancePdfData" = ${certificate.base64},
        "acceptancePdfHash" = ${certificate.hash},
        "withdrawalNoticeAcknowledgedAt" = ${row.consumerFlow ? acceptedAt : null},
        "earlyPerformanceRequested" = ${row.consumerFlow && earlyPerformanceRequested},
        "earlyPerformanceConsentText" = ${earlyPerformanceConsentText},
        "withdrawalDeadline" = ${withdrawalDeadline}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${row.id} AND "acceptedAt" IS NULL
    `;
    await tx.$executeRaw`UPDATE "Offer" SET "wonAt" = COALESCE("wonAt", ${acceptedAt}), "wonByName" = ${acceptedByName}, "wonReason" = 'Digital durch den Kunden angenommen', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.offerId} AND "organizationId" = ${row.organizationId}`;
    await tx.$executeRaw`INSERT INTO "OfferHistory" ("id", "organizationId", "offerId", "projectId", "offerNumber", "eventType", "title", "note", "actorName") VALUES (${randomUUID()}, ${row.organizationId}, ${row.offerId}, ${row.projectId}, ${row.offerNumber}, 'customer_accepted', 'Angebot digital angenommen', ${`${acceptedByName}${acceptedByRole ? ` (${acceptedByRole})` : ""} hat das Angebot verbindlich angenommen.`}, ${acceptedByName})`;
    await createOfferNotification(
      tx,
      row,
      `Angebot ${row.offerNumber} wurde angenommen`,
      `${acceptedByName} hat das Angebot für ${row.customerName} verbindlich angenommen.`
    ).catch(() => undefined);
    return {
      kind: "created",
      row: {
        ...row,
        acceptedAt,
        acceptedByName,
        acceptedByRole,
        earlyPerformanceRequested: row.consumerFlow && earlyPerformanceRequested,
        earlyPerformanceConsentText,
        withdrawalDeadline,
      },
      certificate: certificate.base64,
    } as const;
  });
  if (result.kind === "not-found") return NextResponse.json({ error: "Freigabelink nicht gefunden." }, { status: 404 });
  if (result.kind === "expired") return NextResponse.json({ error: "Dieser Freigabelink ist abgelaufen oder wurde ersetzt." }, { status: 410 });
  if (result.kind === "accepted") return NextResponse.json({ error: "Dieses Angebot wurde bereits angenommen." }, { status: 409 });
  if (result.kind === "consumer-consent-missing") {
    return NextResponse.json({ error: "Bitte bestätigen Sie den Erhalt der Widerrufsbelehrung." }, { status: 400 });
  }
  if (result.kind === "early-performance-consent-missing") {
    return NextResponse.json({ error: "Bitte bestätigen Sie den Hinweis zum vorzeitigen Leistungsbeginn." }, { status: 400 });
  }
  const offerPageUrl = new URL(`/angebot/${token}`, req.url).toString();
  try {
    await sendConfirmation(req, result.row, result.certificate, offerPageUrl);
    await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "confirmationSentAt" = CURRENT_TIMESTAMP, "confirmationError" = '', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${result.row.id}`;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Bestätigungs-E-Mail konnte nicht gesendet werden.";
    await prisma.$executeRaw`UPDATE "OfferAcceptanceRequest" SET "confirmationError" = ${message}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${result.row.id}`;
  }
  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  await ensureOfferAcceptanceTable();
  const token = cleanAcceptanceText((await params).token);
  const body = await req.json().catch(() => ({}));
  const withdrawnByName = cleanAcceptanceText(body.name);
  const withdrawnByEmail = cleanAcceptanceText(body.email).toLowerCase();
  if (withdrawnByName.length < 3 || body.confirmed !== true) {
    return NextResponse.json({ error: "Bitte Namen und Widerruf bestätigen." }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    const row = await getAcceptance(token, tx, true);
    if (!row) return { kind: "not-found" } as const;
    if (!row.consumerFlow || !row.acceptedAt || !row.withdrawalDeadline) return { kind: "not-available" } as const;
    if (row.withdrawnAt || row.status === "withdrawn") return { kind: "already-withdrawn" } as const;
    if (row.withdrawalDeadline.getTime() < Date.now()) return { kind: "deadline-passed" } as const;
    if (withdrawnByEmail !== row.recipientEmail.trim().toLowerCase()) return { kind: "email-mismatch" } as const;
    const withdrawnAt = new Date();
    const receipt = await createWithdrawalReceipt({
      offerNumber: row.offerNumber,
      customerName: row.customerName,
      projectNumber: row.projectNumber,
      withdrawnByName,
      withdrawnByEmail,
      withdrawnAt,
      acceptanceId: row.id,
      offerVersionHash: row.offerVersionHash,
    });
    await tx.$executeRaw`
      UPDATE "OfferAcceptanceRequest"
      SET "status" = 'withdrawn', "withdrawnAt" = ${withdrawnAt},
          "withdrawnByName" = ${withdrawnByName}, "withdrawnByEmail" = ${withdrawnByEmail},
          "withdrawnIp" = ${getAcceptanceClientIp(req)},
          "withdrawnUserAgent" = ${cleanAcceptanceText(req.headers.get("user-agent"))},
          "withdrawalReceiptPdfData" = ${receipt.base64},
          "withdrawalReceiptPdfHash" = ${receipt.hash}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${row.id} AND "withdrawnAt" IS NULL
    `;
    await tx.$executeRaw`
      UPDATE "Offer"
      SET "wonAt" = NULL, "wonByName" = '',
          "wonReason" = ${`Digital widerrufen am ${withdrawnAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${row.offerId} AND "organizationId" = ${row.organizationId}
        AND "wonReason" = 'Digital durch den Kunden angenommen'
    `;
    await tx.$executeRaw`
      INSERT INTO "OfferHistory" ("id", "organizationId", "offerId", "projectId", "offerNumber", "eventType", "title", "note", "actorName")
      VALUES (${randomUUID()}, ${row.organizationId}, ${row.offerId}, ${row.projectId}, ${row.offerNumber},
        'customer_withdrawn', 'Angebot digital widerrufen',
        ${`${withdrawnByName} hat die digitale Angebotsannahme widerrufen.`}, ${withdrawnByName})
    `;
    await createOfferNotification(
      tx,
      row,
      `Angebot ${row.offerNumber} wurde widerrufen`,
      `${withdrawnByName} hat die digitale Annahme für ${row.customerName} widerrufen.`
    ).catch(() => undefined);
    return {
      kind: "withdrawn",
      row: { ...row, status: "withdrawn", withdrawnAt, withdrawnByName, withdrawnByEmail },
      receipt: receipt.base64,
    } as const;
  });
  if (result.kind === "not-found") return NextResponse.json({ error: "Freigabelink nicht gefunden." }, { status: 404 });
  if (result.kind === "not-available") return NextResponse.json({ error: "Für diesen Vorgang ist kein Online-Widerruf verfügbar." }, { status: 400 });
  if (result.kind === "already-withdrawn") return NextResponse.json({ error: "Dieser Vertrag wurde bereits widerrufen." }, { status: 409 });
  if (result.kind === "deadline-passed") return NextResponse.json({ error: "Die hinterlegte Widerrufsfrist ist abgelaufen." }, { status: 410 });
  if (result.kind === "email-mismatch") return NextResponse.json({ error: "Die E-Mail-Adresse stimmt nicht mit dem Angebotsempfänger überein." }, { status: 400 });
  try {
    await sendWithdrawalConfirmation(req, result.row, result.receipt);
    await prisma.$executeRaw`
      UPDATE "OfferAcceptanceRequest"
      SET "withdrawalConfirmationSentAt" = CURRENT_TIMESTAMP,
          "withdrawalConfirmationError" = '', "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${result.row.id}
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Widerrufsbestätigung konnte nicht gesendet werden.";
    await prisma.$executeRaw`
      UPDATE "OfferAcceptanceRequest"
      SET "withdrawalConfirmationError" = ${message}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${result.row.id}
    `;
  }
  return NextResponse.json({ success: true });
}
