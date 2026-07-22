import { createHash, randomBytes, randomUUID } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/db/client";

export const OFFER_ACCEPTANCE_CONSENT =
  "Ich bestätige, dass ich zur Auftragserteilung berechtigt bin und das angezeigte Angebot verbindlich annehme.";

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
      "revokedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OfferAcceptanceRequest" ADD COLUMN IF NOT EXISTS "confirmationError" TEXT NOT NULL DEFAULT ''`);
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
