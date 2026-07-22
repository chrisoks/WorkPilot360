import { createHash, randomBytes, randomUUID } from "crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { prisma } from "@/lib/db/client";

export const OFFER_ACCEPTANCE_CONSENT =
  "Ich bestätige, dass ich zur Auftragserteilung berechtigt bin und das angezeigte Angebot verbindlich annehme.";

export const WITHDRAWAL_NOTICE_ACKNOWLEDGEMENT =
  "Ich habe die Widerrufsbelehrung und das Muster-Widerrufsformular erhalten und zur Kenntnis genommen.";

export const EARLY_PERFORMANCE_REQUEST =
  "Ich verlange ausdrücklich, dass vor Ablauf der 14-tägigen Widerrufsfrist mit der Dienstleistung begonnen wird.";

export const EARLY_PERFORMANCE_LOSS_ACKNOWLEDGEMENT =
  "Mir ist bekannt, dass mein Widerrufsrecht bei vollständiger Vertragserfüllung erlischt und ich bei einem vorherigen Widerruf Wertersatz für bereits erbrachte Leistungen schulden kann.";

export function cleanAcceptanceText(value: unknown) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 1000) : "";
}

export function hashAcceptanceValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createAcceptanceToken() {
  return randomBytes(32).toString("hex");
}

export function getAcceptanceClientIp(req: Request) {
  return cleanAcceptanceText(req.headers.get("x-forwarded-for")?.split(",")[0]) || cleanAcceptanceText(req.headers.get("x-real-ip"));
}

export async function ensureOfferAcceptanceTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OfferAcceptanceRequest" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "customerId" TEXT NOT NULL DEFAULT '',
      "tokenHash" TEXT NOT NULL UNIQUE,
      "offerNumber" TEXT NOT NULL,
      "offerVersionHash" TEXT NOT NULL,
      "offerPdfData" TEXT NOT NULL,
      "recipientEmail" TEXT NOT NULL,
      "recipientName" TEXT NOT NULL DEFAULT '',
      "senderUserId" TEXT NOT NULL,
      "senderName" TEXT NOT NULL,
      "senderEmail" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'prepared',
      "sentAt" TIMESTAMP(3),
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "firstAccessedAt" TIMESTAMP(3),
      "firstViewedAt" TIMESTAMP(3),
      "lastViewedAt" TIMESTAMP(3),
      "viewCount" INTEGER NOT NULL DEFAULT 0,
      "acceptanceStartedAt" TIMESTAMP(3),
      "acceptedAt" TIMESTAMP(3),
      "acceptedByName" TEXT NOT NULL DEFAULT '',
      "acceptedByRole" TEXT NOT NULL DEFAULT '',
      "acceptedByEmail" TEXT NOT NULL DEFAULT '',
      "acceptedIp" TEXT NOT NULL DEFAULT '',
      "acceptedUserAgent" TEXT NOT NULL DEFAULT '',
      "consentText" TEXT NOT NULL DEFAULT '',
      "acceptancePdfData" TEXT,
      "acceptancePdfHash" TEXT NOT NULL DEFAULT '',
      "confirmationSentAt" TIMESTAMP(3),
      "confirmationError" TEXT NOT NULL DEFAULT '',
      "consumerFlow" BOOLEAN NOT NULL DEFAULT FALSE,
      "withdrawalNoticePdfData" TEXT,
      "withdrawalNoticePdfHash" TEXT NOT NULL DEFAULT '',
      "withdrawalNoticeAcknowledgedAt" TIMESTAMP(3),
      "earlyPerformanceRequested" BOOLEAN NOT NULL DEFAULT FALSE,
      "earlyPerformanceConsentText" TEXT NOT NULL DEFAULT '',
      "withdrawalDeadline" TIMESTAMP(3),
      "withdrawnAt" TIMESTAMP(3),
      "withdrawnByName" TEXT NOT NULL DEFAULT '',
      "withdrawnByEmail" TEXT NOT NULL DEFAULT '',
      "withdrawnIp" TEXT NOT NULL DEFAULT '',
      "withdrawnUserAgent" TEXT NOT NULL DEFAULT '',
      "withdrawalReceiptPdfData" TEXT,
      "withdrawalReceiptPdfHash" TEXT NOT NULL DEFAULT '',
      "withdrawalConfirmationSentAt" TIMESTAMP(3),
      "withdrawalConfirmationError" TEXT NOT NULL DEFAULT '',
      "revokedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "confirmationError" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "consumerFlow" BOOLEAN NOT NULL DEFAULT FALSE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalNoticePdfData" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalNoticePdfHash" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalNoticeAcknowledgedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "earlyPerformanceRequested" BOOLEAN NOT NULL DEFAULT FALSE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "earlyPerformanceConsentText" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalDeadline" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawnByName" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawnByEmail" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawnIp" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawnUserAgent" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalReceiptPdfData" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalReceiptPdfHash" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalConfirmationSentAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "withdrawalConfirmationError" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OfferAcceptanceRequest_organizationId_projectId_createdAt_idx" ON "OfferAcceptanceRequest" ("organizationId", "projectId", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OfferAcceptanceRequest_organizationId_customerId_createdAt_idx" ON "OfferAcceptanceRequest" ("organizationId", "customerId", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OfferAcceptanceRequest_organizationId_offerId_createdAt_idx" ON "OfferAcceptanceRequest" ("organizationId", "offerId", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OfferAcceptanceRequest_organizationId_status_sentAt_idx" ON "OfferAcceptanceRequest" ("organizationId", "status", "sentAt")`);
}

function formatGermanDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/Berlin" }).format(value);
}

function safePdfText(value: string) {
  return value.normalize("NFC").replace(/[^\x20-\x7e\u00a0-\u00ff]/g, "?");
}

function drawWrappedText(input: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size?: number;
  lineHeight?: number;
  color?: RGB;
}) {
  const size = input.size ?? 9;
  const lineHeight = input.lineHeight ?? 13;
  const color = input.color ?? rgb(0.04, 0.12, 0.16);
  let y = input.y;
  for (const paragraph of input.text.split("\n")) {
    if (!paragraph.trim()) {
      y -= lineHeight;
      continue;
    }
    let line = "";
    const words = safePdfText(paragraph).split(/\s+/).flatMap((word) => {
      const pieces: string[] = [];
      let remaining = word;
      while (input.font.widthOfTextAtSize(remaining, size) > input.width) {
        let cut = remaining.length - 1;
        while (cut > 1 && input.font.widthOfTextAtSize(`${remaining.slice(0, cut)}-`, size) > input.width) cut -= 1;
        pieces.push(`${remaining.slice(0, cut)}-`);
        remaining = remaining.slice(cut);
      }
      if (remaining) pieces.push(remaining);
      return pieces;
    });
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (input.font.widthOfTextAtSize(candidate, size) > input.width && line) {
        input.page.drawText(line, { x: input.x, y, size, font: input.font, color });
        y -= lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      input.page.drawText(line, { x: input.x, y, size, font: input.font, color });
      y -= lineHeight;
    }
  }
  return y;
}

export type WithdrawalSeller = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
};

export async function createWithdrawalNotice(input: {
  seller: WithdrawalSeller;
  offerNumber: string;
  withdrawalUrl: string;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.04, 0.12, 0.16);
  const petrol = rgb(0.03, 0.36, 0.39);
  const page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  page.drawText(input.seller.name, { x: 48, y, size: 13, font: bold, color: petrol });
  y -= 46;
  page.drawText("Widerrufsbelehrung", { x: 48, y, size: 22, font: bold, color: ink });
  y -= 31;
  page.drawText("Widerrufsrecht", { x: 48, y, size: 11, font: bold, color: ink });
  y -= 19;
  y = drawWrappedText({
    page,
    text: `Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.\n\nUm Ihr Widerrufsrecht auszuüben, müssen Sie uns (${input.seller.name}, ${input.seller.street}, ${input.seller.postalCode} ${input.seller.city}, ${input.seller.country}, Telefon: ${input.seller.phone}, E-Mail: ${input.seller.email}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.\n\nSie können den Vertrag während der Widerrufsfrist auch online über die Angebotsseite widerrufen: ${input.withdrawalUrl}\n\nZur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.`,
    x: 48,
    y,
    width: 499,
    font: regular,
    color: ink,
  });
  y -= 8;
  page.drawText("Folgen des Widerrufs", { x: 48, y, size: 11, font: bold, color: ink });
  y -= 19;
  drawWrappedText({
    page,
    text: "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.\n\nHaben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
    x: 48,
    y,
    width: 499,
    font: regular,
    color: ink,
  });

  const form = pdf.addPage([595.28, 841.89]);
  y = 790;
  form.drawText("Muster-Widerrufsformular", { x: 48, y, size: 22, font: bold, color: ink });
  y -= 30;
  y = drawWrappedText({
    page: form,
    text: `(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)\n\nAn:\n${input.seller.name}\n${input.seller.street}\n${input.seller.postalCode} ${input.seller.city}\n${input.seller.country}\nE-Mail: ${input.seller.email}\n\nHiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über die Erbringung der im Angebot ${input.offerNumber} beschriebenen Dienstleistung.`,
    x: 48,
    y,
    width: 499,
    font: regular,
    color: ink,
  });
  y -= 12;
  for (const label of [
    "Bestellt am",
    "Name des/der Verbraucher(s)",
    "Anschrift des/der Verbraucher(s)",
    "Datum",
    "Unterschrift (nur bei Mitteilung auf Papier)",
  ]) {
    form.drawText(label, { x: 48, y, size: 9, font: bold, color: petrol });
    y -= 26;
    form.drawLine({
      start: { x: 48, y },
      end: { x: 547, y },
      thickness: 0.6,
      color: rgb(0.65, 0.72, 0.74),
    });
    y -= 30;
  }
  const base64 = Buffer.from(await pdf.save()).toString("base64");
  return { base64, hash: hashAcceptanceValue(base64) };
}

export async function createWithdrawalReceipt(input: {
  offerNumber: string;
  customerName: string;
  projectNumber: string;
  withdrawnByName: string;
  withdrawnByEmail: string;
  withdrawnAt: Date;
  acceptanceId: string;
  offerVersionHash: string;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.04, 0.12, 0.16);
  const petrol = rgb(0.03, 0.36, 0.39);
  let y = 785;
  page.drawText("WorkPilot360", { x: 48, y, size: 13, font: bold, color: petrol });
  y -= 48;
  page.drawText("Bestätigung des Widerrufs", { x: 48, y, size: 22, font: bold, color: ink });
  y -= 42;
  const rows = [
    ["Angebot", input.offerNumber],
    ["Kunde", input.customerName],
    ["Projekt", input.projectNumber],
    ["Widerrufen von", input.withdrawnByName],
    ["E-Mail", input.withdrawnByEmail],
    ["Eingang", `${formatGermanDate(input.withdrawnAt)} (Europe/Berlin)`],
  ];
  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 9, font: bold, color: petrol });
    page.drawText(safePdfText(value).slice(0, 82), { x: 170, y, size: 10, font: regular, color: ink });
    y -= 26;
  }
  y -= 18;
  drawWrappedText({
    page,
    text: "Der Widerruf des oben bezeichneten Vertrags ist eingegangen und wurde im WorkPilot360 dokumentiert.",
    x: 48,
    y,
    width: 499,
    font: regular,
    color: ink,
  });
  y -= 62;
  page.drawText(`Vorgangs-ID: ${input.acceptanceId}`, { x: 48, y, size: 8, font: regular, color: ink });
  y -= 14;
  page.drawText(`SHA-256 Angebot: ${input.offerVersionHash}`, { x: 48, y, size: 7.5, font: regular, color: ink });
  const base64 = Buffer.from(await pdf.save()).toString("base64");
  return { base64, hash: hashAcceptanceValue(base64) };
}

export async function createAcceptanceCertificate(input: {
  offerNumber: string;
  customerName: string;
  projectNumber: string;
  projectTitle: string;
  grossTotal: number;
  acceptedByName: string;
  acceptedByRole: string;
  acceptedByEmail: string;
  acceptedAt: Date;
  offerVersionHash: string;
  acceptanceId: string;
  consentText: string;
  consumerFlow?: boolean;
  earlyPerformanceRequested?: boolean;
  earlyPerformanceConsentText?: string;
  withdrawalDeadline?: Date;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.04, 0.12, 0.16);
  const petrol = rgb(0.03, 0.36, 0.39);
  let y = 785;
  page.drawText("WorkPilot360", { x: 48, y, size: 13, font: bold, color: petrol });
  y -= 48;
  page.drawText("Bestätigung der Angebotsannahme", { x: 48, y, size: 22, font: bold, color: ink });
  y -= 22;
  page.drawText(`Angebot ${input.offerNumber}`, { x: 48, y, size: 12, font: regular, color: ink });
  y -= 36;
  const rows = [
    ["Kunde", input.customerName],
    ["Projekt", `${input.projectNumber} - ${input.projectTitle}`],
    ["Bruttosumme", `${input.grossTotal.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR`],
    ["Angenommen von", input.acceptedByName],
    ["Funktion", input.acceptedByRole || "nicht angegeben"],
    ["E-Mail", input.acceptedByEmail],
    ["Zeitpunkt", `${formatGermanDate(input.acceptedAt)} (Europe/Berlin)`],
  ];
  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 9, font: bold, color: petrol });
    page.drawText(safePdfText(value).slice(0, 82), { x: 170, y, size: 10, font: regular, color: ink });
    y -= 26;
  }
  y -= 16;
  page.drawText("Abgegebene Erklärung", { x: 48, y, size: 11, font: bold, color: ink });
  y -= 22;
  const words = input.consentText.split(/\s+/);
  let line = "";
  for (const word of words) {
    if ((line + " " + word).length > 88) {
      page.drawText(safePdfText(line), { x: 48, y, size: 9, font: regular, color: ink });
      y -= 15;
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) page.drawText(safePdfText(line), { x: 48, y, size: 9, font: regular, color: ink });
  if (input.consumerFlow) {
    y -= 30;
    page.drawText("Verbraucherinformationen", { x: 48, y, size: 11, font: bold, color: ink });
    y -= 19;
    y = drawWrappedText({
      page,
      text: `${WITHDRAWAL_NOTICE_ACKNOWLEDGEMENT}\nWiderrufsfrist bis: ${input.withdrawalDeadline ? formatGermanDate(input.withdrawalDeadline) : "nicht berechnet"}\nVorzeitiger Leistungsbeginn: ${input.earlyPerformanceRequested ? "ausdrücklich verlangt" : "nicht verlangt"}${input.earlyPerformanceConsentText ? `\n${input.earlyPerformanceConsentText}` : ""}`,
      x: 48,
      y,
      width: 499,
      font: regular,
      color: ink,
    });
  }
  y -= 42;
  page.drawText("Technischer Nachweis", { x: 48, y, size: 11, font: bold, color: ink });
  y -= 20;
  page.drawText(`Vorgangs-ID: ${input.acceptanceId}`, { x: 48, y, size: 8, font: regular, color: ink });
  y -= 14;
  page.drawText(`SHA-256 Angebot: ${input.offerVersionHash}`, { x: 48, y, size: 7.5, font: regular, color: ink });
  y -= 32;
  page.drawText("Dieses Protokoll dokumentiert die im WorkPilot360 gespeicherte digitale Annahme.", { x: 48, y, size: 8.5, font: regular, color: ink });
  const bytes = await pdf.save();
  const base64 = Buffer.from(bytes).toString("base64");
  return { base64, hash: hashAcceptanceValue(base64) };
}

export function createAcceptanceId() {
  return randomUUID();
}
