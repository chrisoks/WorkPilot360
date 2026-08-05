import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";
import { Prisma, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { generateXRechnungXml, type XRechnungSeller } from "@/lib/e-invoice/xrechnung";
import { validateXRechnungWithKosit } from "@/lib/e-invoice/kosit-validator";
import { validateXRechnungPayload } from "@/lib/e-invoice/xrechnung-validation";
import { buildValidatedZugferdPdf } from "@/lib/e-invoice/zugferd-pdf";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canDeleteInvoices, canManageInvoices, canSendDocumentMails, canViewInternalCostData } from "@/lib/permissions";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import type { CatalogPackageComponentSnapshot } from "@/lib/analytics/catalog-performance";
import { syncInvoiceInventoryMovements } from "@/lib/inventory/catalog-inventory";
import {
  addInvoiceDays,
  calculateInvoiceLineNet,
  clampInvoicePercent,
  cleanInvoiceNumber,
  normalizeInvoiceDate,
  normalizeInvoicePaymentTermDays,
  roundInvoiceMoney,
} from "@/lib/invoices/invoice-core";
import {
  finalizeInvoiceDraft,
  InvoiceFinalizationServiceError,
} from "@/lib/invoices/invoice-finalization-service";
import {
  getBerlinDateKey,
  InvoicePaymentServiceError,
  markInvoicePaid,
} from "@/lib/invoices/invoice-payment-service";
import {
  addReminderDays,
  createInvoiceReminder,
  InvoiceReminderServiceError,
} from "@/lib/invoices/invoice-reminder-service";
import {
  createInvoiceCancellation,
  InvoiceCancellationServiceError,
} from "@/lib/invoices/invoice-cancellation-service";
import {
  createInvoiceCredit,
  InvoiceCreditServiceError,
  type InvoiceCreditItemInput,
} from "@/lib/invoices/invoice-credit-service";
import {
  executeInvoiceLifecycle,
  InvoiceLifecycleServiceError,
} from "@/lib/invoices/invoice-lifecycle-service";
import { runInvoiceCrudTransaction } from "@/lib/invoices/invoice-crud-transaction";
import {
  externalizePdfPayload,
  resolveStorageBackedBytes,
} from "@/lib/storage/document-file";
import { archiveAndResolveInvoiceArtifact } from "@/lib/invoices/invoice-artifact-storage";

type InvoiceCompany = "OK solutions" | "OK immocare";

type InvoiceLineInput = {
  catalogItemId?: string;
  catalogType?: string;
  isLaborPosition?: boolean;
  quantity?: number;
  unit?: string;
  title?: string;
  description?: string;
  unitPrice?: number;
  discountPercent?: number;
  materialUnitCostSnapshot?: number;
  materialCostSnapshot?: number;
  laborUnitCostSnapshot?: number;
  laborCostSnapshot?: number;
  packageComponentsSnapshot?: CatalogPackageComponentSnapshot[];
  catalogCostSnapshotVersion?: number;
  vatRate?: number;
  laborItems?: InvoiceLineLaborInput[];
};

type InvoiceLineLaborInput = {
  userId?: string;
  employeeName?: string;
  plannedHours?: number;
  hourlyCostRate?: number;
  totalCost?: number;
};

type InvoiceInput = {
  actorId?: string;
  expectedUpdatedAt?: string;
  projectId?: string;
  projectNumber?: string;
  projectTitle?: string;
  saveAsDraft?: boolean;
  billingSource?: string;
  company?: InvoiceCompany;
  customerName?: string;
  customerStreet?: string;
  customerCity?: string;
  contactName?: string;
  internalContactName?: string;
  internalPhone?: string;
  internalEmail?: string;
  plannedExecutionMonth?: string;
  serviceDate?: string;
  sourceOfferId?: string;
  sourceOfferNumber?: string;
  creditItems?: InvoiceCreditItemInput[];
  introText?: string;
  closingText?: string;
  vatRate?: number;
  discountPercent?: number;
  paymentTermDays?: number | null;
  dueDate?: string;
  paymentDate?: string;
  reminderDate?: string;
  paymentDeadline?: string;
  lines?: InvoiceLineInput[];
  billedStampEntryIds?: string[];
  allowUnderbilledStampedHours?: boolean;
  suppressUnderbillingNotification?: boolean;
  documentTitle?: string;
};

type InvoiceRow = {
  id: string;
  organizationId: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  company: InvoiceCompany;
  invoiceNumber: string;
  status: string;
  billingSource: string;
  customerName: string;
  customerStreet: string;
  customerCity: string;
  contactName: string;
  internalContactName: string;
  internalPhone: string;
  internalEmail: string;
  plannedExecutionMonth: string;
  serviceDate: string;
  sourceOfferId: string;
  sourceOfferNumber: string;
  sourceInvoiceId: string;
  sourceInvoiceNumber: string;
  correctionReason: string;
  introText: string;
  closingText: string;
  netTotal: number;
  vatRate: number;
  grossTotal: number;
  discountPercent: number;
  paymentTermDays: number;
  dueDate: string;
  reminderLevel: number;
  lastReminderAt: Date | null;
  isPaid: boolean;
  paidAt: Date | null;
  pdfData: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceLineRow = {
  id: string;
  invoiceId: string;
  catalogItemId: string;
  catalogType: string;
  sourceInvoiceLineId: string;
  isLaborPosition: boolean;
  position: number;
  quantity: number;
  unit: string;
  title: string;
  description: string;
  unitPrice: number;
  discountPercent: number;
  materialUnitCostSnapshot: number;
  materialCostSnapshot: number;
  laborUnitCostSnapshot: number;
  laborCostSnapshot: number;
  packageComponentsSnapshot: Prisma.JsonValue;
  catalogCostSnapshotVersion: number;
  costSnapshotAt: Date | null;
  vatRate: number;
  totalNet: number;
};

type InvoiceLineLaborRow = {
  id: string;
  invoiceId: string;
  invoiceLineId: string;
  userId: string;
  employeeName: string;
  plannedHours: number;
  hourlyCostRate: number;
  totalCost: number;
  position: number;
};

type InvoiceHistoryRow = {
  id: string;
  invoiceId: string;
  projectId: string;
  invoiceNumber: string;
  eventType: string;
  title: string;
  note: string;
  actorName: string;
  createdAt: Date;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.25, 0.29, 0.34);
const LINE = rgb(0.38, 0.38, 0.38);
class InvoiceCrudConflictError extends Error {}
const DELETED_INVOICE_STATUS = "Gelöscht";
const LEGACY_DELETED_INVOICE_STATUS = "Gel\u00c3\u00b6scht";

function isInvoiceBlockedForXRechnung(status: unknown) {
  return ["Storniert", "Stornorechnung", "Gutschrift", DELETED_INVOICE_STATUS, LEGACY_DELETED_INVOICE_STATUS].includes(
    cleanString(status)
  );
}

function getXRechnungSellerProfile(company: InvoiceCompany): XRechnungSeller {
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

function getMissingXRechnungSellerFields(seller: XRechnungSeller) {
  return [
    ["Firmenname", seller.name],
    ["Straße", seller.street],
    ["PLZ", seller.postalCode],
    ["Ort", seller.city],
    ["Land", seller.country],
    ["E-Mail/Endpoint", seller.endpoint],
    ["USt-ID oder Steuernummer", seller.vatId || seller.taxNumber],
    ["IBAN", seller.iban],
  ]
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([label]) => label);
}

async function embedInvoiceFonts(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Regular.ttf")),
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Bold.ttf")),
    ]);
    const regular = await pdfDoc.embedFont(regularBytes, { subset: true });
    const bold = await pdfDoc.embedFont(boldBytes, { subset: true });

    return { regular, bold };
  } catch {
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    return { regular, bold };
  }
}

async function ensureInvoiceTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Invoice" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "projectTitle" TEXT NOT NULL DEFAULT '',
      "company" TEXT NOT NULL DEFAULT 'OK solutions',
      "invoiceNumber" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Entwurf',
      "billingSource" TEXT NOT NULL DEFAULT 'manual',
      "customerName" TEXT NOT NULL DEFAULT '',
      "customerStreet" TEXT NOT NULL DEFAULT '',
      "customerCity" TEXT NOT NULL DEFAULT '',
      "contactName" TEXT NOT NULL DEFAULT '',
      "internalContactName" TEXT NOT NULL DEFAULT '',
      "internalPhone" TEXT NOT NULL DEFAULT '',
      "internalEmail" TEXT NOT NULL DEFAULT '',
      "plannedExecutionMonth" TEXT NOT NULL DEFAULT '',
      "serviceDate" TEXT NOT NULL DEFAULT '',
      "sourceOfferId" TEXT NOT NULL DEFAULT '',
      "sourceOfferNumber" TEXT NOT NULL DEFAULT '',
      "introText" TEXT NOT NULL DEFAULT '',
      "closingText" TEXT NOT NULL DEFAULT '',
      "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "grossTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "paymentTermDays" INTEGER NOT NULL DEFAULT 14,
      "dueDate" TEXT NOT NULL DEFAULT '',
      "reminderLevel" INTEGER NOT NULL DEFAULT 0,
      "lastReminderAt" TIMESTAMP(3),
      "isPaid" BOOLEAN NOT NULL DEFAULT false,
      "paidAt" TIMESTAMP(3),
      "pdfData" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "paymentTermDays" INTEGER NOT NULL DEFAULT 14,
    ADD COLUMN IF NOT EXISTS "dueDate" TEXT NOT NULL DEFAULT ''
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "reminderLevel" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3)
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "plannedExecutionMonth" TEXT NOT NULL DEFAULT ''
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "sourceInvoiceId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "sourceInvoiceNumber" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "correctionReason" TEXT NOT NULL DEFAULT ''
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "serviceDate" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "sourceOfferId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "sourceOfferNumber" TEXT NOT NULL DEFAULT ''
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "billingSource" TEXT NOT NULL DEFAULT 'manual'
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "Invoice_organizationId_projectId_idx"
    ON "Invoice" ("organizationId", "projectId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "Invoice_organizationId_sourceInvoiceId_idx"
    ON "Invoice" ("organizationId", "sourceInvoiceId")
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_organizationId_invoiceNumber_key"
    ON "Invoice" ("organizationId", "invoiceNumber")
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "InvoiceLine" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "catalogItemId" TEXT NOT NULL DEFAULT '',
      "catalogType" TEXT NOT NULL DEFAULT '',
      "isLaborPosition" BOOLEAN NOT NULL DEFAULT false,
      "position" INTEGER NOT NULL DEFAULT 0,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
      "unit" TEXT NOT NULL DEFAULT 'Stk',
      "title" TEXT NOT NULL DEFAULT '',
      "description" TEXT NOT NULL DEFAULT '',
      "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
      "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "InvoiceLine"
    ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0
  `;

  await prisma.$executeRaw`
    ALTER TABLE "InvoiceLine"
    ADD COLUMN IF NOT EXISTS "isLaborPosition" BOOLEAN NOT NULL DEFAULT false
  `;

  await prisma.$executeRaw`
    ALTER TABLE "InvoiceLine"
    ADD COLUMN IF NOT EXISTS "sourceInvoiceLineId" TEXT NOT NULL DEFAULT ''
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "InvoiceLine_organizationId_sourceInvoiceLineId_idx"
    ON "InvoiceLine" ("organizationId", "sourceInvoiceLineId")
  `;

  await prisma.$executeRaw`
    ALTER TABLE "InvoiceLine"
    ADD COLUMN IF NOT EXISTS "materialUnitCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "materialCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "laborUnitCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "packageComponentsSnapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "catalogCostSnapshotVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "costSnapshotAt" TIMESTAMP(3)
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "SchemaDataPatch" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    UPDATE "InvoiceLine"
    SET "isLaborPosition" = true
    WHERE "catalogType" = 'service'
      AND NOT EXISTS (
        SELECT 1 FROM "SchemaDataPatch" WHERE "key" = 'invoice-lines-labor-position-backfill'
      )
  `;

  await prisma.$executeRaw`
    INSERT INTO "SchemaDataPatch" ("key")
    VALUES ('invoice-lines-labor-position-backfill')
    ON CONFLICT ("key") DO NOTHING
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "InvoiceHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "invoiceNumber" TEXT NOT NULL DEFAULT '',
      "eventType" TEXT NOT NULL DEFAULT '',
      "title" TEXT NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "actorName" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "InvoiceLineLabor" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "invoiceLineId" TEXT NOT NULL,
      "userId" TEXT NOT NULL DEFAULT '',
      "employeeName" TEXT NOT NULL DEFAULT '',
      "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "hourlyCostRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InvoiceLineLabor_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE CASCADE
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "InvoiceLineLabor_organizationId_invoiceId_idx"
    ON "InvoiceLineLabor" ("organizationId", "invoiceId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "InvoiceLineLabor_organizationId_invoiceLineId_idx"
    ON "InvoiceLineLabor" ("organizationId", "invoiceLineId")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "InvoiceHistory_organizationId_projectId_idx"
    ON "InvoiceHistory" ("organizationId", "projectId", "createdAt")
  `;

  await prisma.$executeRaw`
    UPDATE "Invoice" invoice
    SET "status" = 'Entwurf', "updatedAt" = CURRENT_TIMESTAMP
    WHERE invoice."status" = 'Fakturiert'
      AND EXISTS (
        SELECT 1
        FROM "InvoiceHistory" history
        WHERE history."organizationId" = invoice."organizationId"
          AND history."invoiceId" = invoice."id"
          AND history."title" = 'Rechnungsentwurf gespeichert'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "InvoiceHistory" history
        WHERE history."organizationId" = invoice."organizationId"
          AND history."invoiceId" = invoice."id"
          AND history."title" IN ('Rechnung angelegt', 'Rechnung bearbeitet', 'Rechnung fakturiert')
      )
  `;
}

async function ensureInvoiceTimeEntryColumns() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectTimeEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'project',
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "userId" TEXT,
      "employee" TEXT,
      "entrySource" TEXT NOT NULL DEFAULT 'stamped',
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMs" BIGINT NOT NULL DEFAULT 0,
      "pauseMs" BIGINT NOT NULL DEFAULT 0,
      "comment" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "userId" TEXT,
    ADD COLUMN IF NOT EXISTS "entrySource" TEXT NOT NULL DEFAULT 'stamped',
    ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "laborCostRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "costSnapshotAt" TIMESTAMP(3)
  `;
}

function getBilledStampEntryIds(input: unknown) {
  return Array.isArray(input)
    ? input.map((item) => cleanString(item)).filter(Boolean)
    : [];
}

function getInvoiceLaborHours(lines: Array<{ laborItems: Array<{ plannedHours?: number }> }>) {
  return lines.reduce(
    (sum, line) =>
      sum + line.laborItems.reduce((lineSum, labor) => lineSum + Number(labor.plannedHours || 0), 0),
    0
  );
}

async function getStampedHoursForInvoiceCheck(input: {
  organizationId: string;
  projectId: string;
  stampEntryIds: string[];
}) {
  if (input.stampEntryIds.length === 0) return 0;
  await ensureInvoiceTimeEntryColumns();
  const rows = await prisma.$queryRaw<Array<{ hours: number | null }>>`
    SELECT COALESCE(SUM("durationMs")::double precision / 3600000, 0) AS "hours"
    FROM "ProjectTimeEntry"
    WHERE "organizationId" = ${input.organizationId}
      AND "projectId" = ${input.projectId}
      AND "mode" = 'project'
      AND "id" IN (${Prisma.join(input.stampEntryIds)})
      AND ("invoiceId" IS NULL OR "invoiceId" = '')
  `;
  return Number(rows[0]?.hours ?? 0);
}

async function markStampedHoursAsInvoiced(db: Prisma.TransactionClient | typeof prisma, input: {
  organizationId: string;
  projectId: string;
  invoiceId: string;
  invoiceNumber: string;
  stampEntryIds: string[];
}) {
  if (input.stampEntryIds.length === 0) return;
  await db.$executeRaw`
    UPDATE "ProjectTimeEntry" entry
    SET "laborCostRateSnapshot" = COALESCE(cost."hourlyCostRate", 0),
        "laborCostSnapshot" = ROUND(((entry."durationMs"::double precision / 3600000) * COALESCE(cost."hourlyCostRate", 0))::numeric, 2)::double precision,
        "costSnapshotAt" = CURRENT_TIMESTAMP
    FROM (
      SELECT
        "userId",
        CASE
          WHEN GREATEST("annualHours" - (("vacationDays" + "trainingDays" + "sickDays") * "hoursPerDay"), 0) > 0
          THEN ROUND((("monthlySalary" * 12 * "fullCostFactor") / GREATEST("annualHours" - (("vacationDays" + "trainingDays" + "sickDays") * "hoursPerDay"), 0))::numeric, 2)::double precision
          ELSE 0
        END AS "hourlyCostRate"
      FROM "EmployeeCostCalculation"
      WHERE "organizationId" = ${input.organizationId}
    ) cost
    WHERE entry."organizationId" = ${input.organizationId}
      AND entry."projectId" = ${input.projectId}
      AND entry."mode" = 'project'
      AND entry."id" IN (${Prisma.join(input.stampEntryIds)})
      AND entry."userId" = cost."userId"
      AND COALESCE(entry."laborCostRateSnapshot", 0) = 0
  `;
  await db.$executeRaw`
    UPDATE "ProjectTimeEntry"
    SET "invoiceId" = ${input.invoiceId},
        "invoiceNumber" = ${input.invoiceNumber},
        "invoicedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${input.organizationId}
      AND "projectId" = ${input.projectId}
      AND "mode" = 'project'
      AND "id" IN (${Prisma.join(input.stampEntryIds)})
      AND ("invoiceId" IS NULL OR "invoiceId" = '')
  `;
}

async function notifyManagementAboutUnderbilling(input: {
  organizationId: string;
  projectId: string;
  projectLabel: string;
  invoiceNumber: string;
  stampedHours: number;
  invoiceHours: number;
}) {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;

  const projectRows = await prisma.$queryRaw<Array<{ responsibleName: string | null; deputyName: string | null }>>`
    SELECT "responsibleName", "deputyName"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${input.organizationId}
      AND id = ${input.projectId}
    LIMIT 1
  `;
  const projectRecipients = [
    projectRows[0]?.responsibleName,
    projectRows[0]?.deputyName,
  ]
    .map((name) => cleanString(name).toLowerCase())
    .filter(Boolean);
  const responsibleNames = projectRecipients.length > 0 ? projectRecipients : ["__no_project_recipient__"];

  const recipients = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT id
    FROM "User"
    WHERE "organizationId" = ${input.organizationId}
      AND "isActive" = true
      AND (
        "role" = 'GESCHAEFTSFUEHRER'
        OR LOWER(CONCAT("firstName", ' ', "lastName")) IN (${Prisma.join(responsibleNames)})
      )
  `;

  for (const recipient of recipients) {
    const notificationId = randomUUID();
    const subject = "Achtung Projekt mit weniger Stunden fakturiert als gestempelt";
    const body = `${input.projectLabel}: In ${input.invoiceNumber} wurden ${input.invoiceHours.toFixed(
      2
    )} Std. fakturiert, aber ${input.stampedHours.toFixed(2)} Std. produktiv gestempelt.`;
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id",
        "organizationId",
        "userId",
        "taskId",
        "channel",
        "subject",
        "body",
        "linkTarget",
        "linkTargetId",
        "linkLabel",
        "sentAt",
        "createdAt"
      )
      VALUES (
        ${notificationId},
        ${input.organizationId},
        ${recipient.id},
        NULL,
        'app',
        ${subject},
        ${body},
        'project',
        ${input.projectId},
        'Projekt öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
    await sendNotificationMailSafely({
      notificationId,
      userId: recipient.id,
      subject,
      body,
    });
  }
}

async function notifyCriticalReminderCreated(input: {
  organizationId: string;
  projectId: string;
  projectLabel: string;
  invoiceNumber: string;
  documentNumber: string;
  reminderLevel: number;
  actorName: string;
}) {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;

  const projectRows = await prisma.$queryRaw<Array<{ responsibleName: string | null; deputyName: string | null }>>`
    SELECT "responsibleName", "deputyName"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${input.organizationId}
      AND id = ${input.projectId}
    LIMIT 1
  `;
  const projectRecipients = [
    projectRows[0]?.responsibleName,
    projectRows[0]?.deputyName,
  ]
    .map((name) => cleanString(name).toLowerCase())
    .filter(Boolean);
  const responsibleNames = projectRecipients.length > 0 ? projectRecipients : ["__no_project_recipient__"];

  const recipients = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT id
    FROM "User"
    WHERE "organizationId" = ${input.organizationId}
      AND "isActive" = true
      AND (
        "role" = 'GESCHAEFTSFUEHRER'
        OR LOWER(CONCAT("firstName", ' ', "lastName")) IN (${Prisma.join(responsibleNames)})
      )
  `;

  for (const recipient of recipients) {
    const notificationId = randomUUID();
    const subject = `Kritisch: Mahnung ${input.documentNumber} erstellt`;
    const body = `${input.projectLabel}: Für Rechnung ${input.invoiceNumber} wurde Mahnstufe ${input.reminderLevel} durch ${input.actorName} erstellt. Bitte Zahlungseingang und nächste Eskalation im Blick behalten.`;
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id",
        "organizationId",
        "userId",
        "taskId",
        "channel",
        "subject",
        "body",
        "linkTarget",
        "linkTargetId",
        "linkLabel",
        "sentAt",
        "createdAt"
      )
      VALUES (
        ${notificationId},
        ${input.organizationId},
        ${recipient.id},
        NULL,
        'app',
        ${subject},
        ${body},
        'project',
        ${input.projectId},
        'Projekt öffnen',
        NULL,
        CURRENT_TIMESTAMP
      )
    `;
    await sendNotificationMailSafely({
      notificationId,
      userId: recipient.id,
      subject,
      body,
    });
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanInvoiceLineTitle(value: unknown) {
  return cleanString(value).replace(/\s*\(\s*\d+(?:[,.]\d+)?\s*€\s*\/\s*Std\.\s*\)\s*$/i, "");
}

function getUserName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function forbiddenInvoiceResponse() {
  return NextResponse.json(
    { error: "Keine Berechtigung fuer diese Rechnungsaktion." },
    { status: 403 }
  );
}

function cleanDateKey(value: unknown) {
  return normalizeInvoiceDate(value);
}

function getInvoiceMonthFromInput(input: InvoiceInput) {
  const serviceDate = cleanDateKey(input.serviceDate);
  return serviceDate ? serviceDate.slice(0, 7) : cleanString(input.plannedExecutionMonth);
}

function cleanPaymentTermDays(value: unknown) {
  return normalizeInvoicePaymentTermDays(value);
}

function addDaysToDateKey(dateKey: string, days: number) {
  return addInvoiceDays(dateKey, days);
}

function getInvoiceDueDate(input: InvoiceInput, serviceDate: string, paymentTermDays: number) {
  return cleanDateKey(input.dueDate) || addDaysToDateKey(serviceDate, paymentTermDays);
}

function cleanNumber(value: unknown, fallback = 0) {
  return cleanInvoiceNumber(value, fallback);
}

function cleanPercent(value: unknown) {
  return clampInvoicePercent(value);
}

function roundMoney(value: number) {
  return roundInvoiceMoney(value);
}

function normalizeUnit(value: unknown) {
  const unit = cleanString(value);
  const aliases: Record<string, string> = {
    h: "Std",
    std: "Std",
    stunde: "Std",
    stunden: "Std",
    stk: "Stk",
    stück: "Stk",
    stueck: "Stk",
    pauschale: "Pauschal",
    pauschal: "Pauschal",
    liter: "L",
    ltr: "L",
  };
  return aliases[unit.toLowerCase()] ?? unit;
}

function getLineBaseNet(line: Pick<Required<InvoiceLineInput>, "quantity" | "unitPrice">) {
  return line.quantity * line.unitPrice;
}

function getLineDiscountAmount(line: Pick<Required<InvoiceLineInput>, "quantity" | "unitPrice" | "discountPercent">) {
  return roundMoney(getLineBaseNet(line) * (line.discountPercent / 100));
}

function getLineTotalNet(line: Pick<Required<InvoiceLineInput>, "quantity" | "unitPrice" | "discountPercent">) {
  return calculateInvoiceLineNet(line);
}

async function getCatalogLineCostSnapshot(organizationId: string, line: Required<InvoiceLineInput>) {
  if (!line.catalogItemId) {
    return { materialUnitCostSnapshot: 0, laborUnitCostSnapshot: 0, packageComponentsSnapshot: [] as CatalogPackageComponentSnapshot[] };
  }

  const catalogRows = await prisma.$queryRaw<Array<{
    type: string;
    purchasePrice: number;
    salesPrice: number;
    planningMinutesPerUnit: number;
  }>>`
    SELECT "type", "purchasePrice", "salesPrice", "planningMinutesPerUnit"
    FROM "CatalogItem"
    WHERE "organizationId" = ${organizationId} AND "id" = ${line.catalogItemId}
    LIMIT 1
  `;
  const catalogItem = catalogRows[0];
  if (!catalogItem) {
    return { materialUnitCostSnapshot: 0, laborUnitCostSnapshot: 0, packageComponentsSnapshot: [] as CatalogPackageComponentSnapshot[] };
  }
  if (catalogItem.type === "article") {
    return {
      materialUnitCostSnapshot: roundMoney(Number(catalogItem.purchasePrice ?? 0)),
      laborUnitCostSnapshot: 0,
      packageComponentsSnapshot: [] as CatalogPackageComponentSnapshot[],
    };
  }
  if (catalogItem.type === "service") {
    return {
      materialUnitCostSnapshot: 0,
      laborUnitCostSnapshot: roundMoney(
        Number(catalogItem.purchasePrice ?? 0) * Number(catalogItem.planningMinutesPerUnit ?? 0) / 60
      ),
      packageComponentsSnapshot: [] as CatalogPackageComponentSnapshot[],
    };
  }

  const packageRows = await prisma.$queryRaw<Array<{
    componentItemId: string;
    componentNumber: string;
    componentName: string;
    componentType: string;
    componentUnit: string;
    quantity: number;
    planningMinutes: number;
    componentPurchasePrice: number;
    componentSalesPrice: number;
  }>>`
    SELECT
      package_item."componentItemId",
      component."number" AS "componentNumber",
      component."name" AS "componentName",
      component."unit" AS "componentUnit",
      package_item."quantity",
      component."type" AS "componentType",
      COALESCE(package_item."planningMinutesOverride", component."planningMinutesPerUnit") AS "planningMinutes",
      COALESCE(package_item."purchasePriceSnapshot", component."purchasePrice") AS "componentPurchasePrice",
      COALESCE(package_item."priceOverride", package_item."salesPriceSnapshot", component."salesPrice") AS "componentSalesPrice"
    FROM "CatalogPackageItem" package_item
    JOIN "CatalogItem" component
      ON component."organizationId" = package_item."organizationId"
      AND component."id" = package_item."componentItemId"
    WHERE package_item."organizationId" = ${organizationId}
      AND package_item."packageId" = ${line.catalogItemId}
  `;
  const packageComponentsSnapshot = packageRows
    .filter((row) => row.componentType === "article" || row.componentType === "service")
    .map((row): CatalogPackageComponentSnapshot => {
      const componentType = row.componentType as "article" | "service";
      const planningMinutes = Number(row.planningMinutes ?? 0);
      const materialQuantity = Number(row.quantity ?? 0);
      const salesPrice = Number(row.componentSalesPrice ?? 0);
      const purchasePrice = Number(row.componentPurchasePrice ?? 0);
      return {
        componentItemId: row.componentItemId,
        componentNumber: row.componentNumber ?? "",
        componentName: row.componentName ?? "",
        componentType,
        componentUnit: componentType === "service" ? "Std." : row.componentUnit ?? "",
        quantityPerPackage: componentType === "service" ? planningMinutes / 60 : materialQuantity,
        salesValuePerPackage: roundMoney(
          componentType === "service" ? salesPrice * planningMinutes / 60 : salesPrice * materialQuantity
        ),
        costValuePerPackage: roundMoney(
          componentType === "service" ? purchasePrice * planningMinutes / 60 : purchasePrice * materialQuantity
        ),
      };
    });
  return {
    materialUnitCostSnapshot: roundMoney(
      packageComponentsSnapshot
        .filter((component) => component.componentType === "article")
        .reduce((sum, component) => sum + component.costValuePerPackage, 0)
    ),
    laborUnitCostSnapshot: roundMoney(
      packageComponentsSnapshot
        .filter((component) => component.componentType === "service")
        .reduce((sum, component) => sum + component.costValuePerPackage, 0)
    ),
    packageComponentsSnapshot,
  };
}

async function withInvoiceLineCostSnapshots(organizationId: string, lines: Required<InvoiceLineInput>[]) {
  return Promise.all(
    lines.map(async (line) => {
      const snapshot = await getCatalogLineCostSnapshot(organizationId, line);
      const materialUnitCostSnapshot = roundMoney(snapshot.materialUnitCostSnapshot);
      const laborUnitCostSnapshot = roundMoney(snapshot.laborUnitCostSnapshot);
      return {
        ...line,
        materialUnitCostSnapshot,
        materialCostSnapshot: roundMoney(materialUnitCostSnapshot * Number(line.quantity || 0)),
        laborUnitCostSnapshot,
        laborCostSnapshot: roundMoney(laborUnitCostSnapshot * Number(line.quantity || 0)),
        packageComponentsSnapshot: snapshot.packageComponentsSnapshot,
        catalogCostSnapshotVersion: 1,
      };
    })
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate() {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function formatDateValue(value?: string) {
  const normalized = cleanDateKey(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatMonthValue(value?: string) {
  const normalized = cleanString(value);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return "";
  const [year, month] = normalized.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function getInvoiceServicePeriodInfo(invoice: Pick<InvoiceInput, "serviceDate" | "plannedExecutionMonth">) {
  const serviceDate = formatDateValue(invoice.serviceDate);
  if (serviceDate) return { label: "Leistungsdatum", value: serviceDate };

  const serviceMonth = formatMonthValue(invoice.plannedExecutionMonth);
  if (serviceMonth) return { label: "Leistungszeitraum", value: serviceMonth };

  return { label: "Leistungsdatum", value: "entspricht Rechnungsdatum" };
}

function splitWordToWidth(word: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];

  const chunks: string[] = [];
  let chunk = "";
  for (const char of Array.from(word)) {
    const candidate = `${chunk}${char}`;
    if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];

  normalized.forEach((paragraph) => {
    const words = paragraph
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => splitWordToWidth(word, font, size, maxWidth));
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
  });

  return lines;
}

function drawTextBlock(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: { font: PDFFont; size: number; maxWidth: number; lineHeight?: number; color?: ReturnType<typeof rgb> }
) {
  const lineHeight = options.lineHeight ?? options.size + 3;
  let cursorY = y;
  wrapText(text, options.font, options.size, options.maxWidth).forEach((line) => {
    if (line) {
      page.drawText(line, {
        x,
        y: cursorY,
        size: options.size,
        font: options.font,
        color: options.color ?? INK,
      });
    }
    cursorY -= lineHeight;
  });
  return cursorY;
}

async function getNextinvoiceNumber(
  db: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  prefix = "RE"
) {
  const invoiceNumberPrefix = prefix.toUpperCase();
  const rows = await db.$queryRaw<Array<{ invoiceNumber: string }>>`
    SELECT "invoiceNumber"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId}
      AND "invoiceNumber" LIKE ${`${invoiceNumberPrefix}-%`}
  `;
  const invoiceNumberPattern = new RegExp(`^${invoiceNumberPrefix}-(\\d+)$`);
  const highest =
    rows
      .map((row) => Number(row.invoiceNumber.match(invoiceNumberPattern)?.[1] ?? "10099"))
      .filter((value) => Number.isFinite(value))
      .sort((first, second) => second - first)[0] ?? 10099;

  return `${invoiceNumberPrefix}-${highest + 1}`;
}

function getTemplatePath(company: InvoiceCompany) {
  return path.join(
    process.cwd(),
    "public",
    "offer-templates",
    company === "OK immocare" ? "ok-immocare.pdf" : "ok-solutions.pdf"
  );
}

async function addTemplatePage(pdfDoc: PDFDocument, templateDoc: PDFDocument, pageIndex: 0 | 1) {
  const [templatePage] = await pdfDoc.copyPages(templateDoc, [pageIndex]);
  pdfDoc.addPage(templatePage);
  return templatePage;
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  options: { font: PDFFont; size: number; color?: ReturnType<typeof rgb> }
) {
  const width = options.font.widthOfTextAtSize(text, options.size);
  page.drawText(text, {
    x: rightX - width,
    y,
    size: options.size,
    font: options.font,
    color: options.color ?? INK,
  });
}

async function generateInvoicePdf(Invoice: InvoiceInput & { invoiceNumber: string }, lines: Required<InvoiceLineInput>[]) {
  const company = Invoice.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const templateBytes = await readFile(getTemplatePath(company));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const { regular, bold } = await embedInvoiceFonts(pdfDoc);

  const table = {
    left: 75,
    right: 548,
    posX: 78,
    quantityX: 112,
    titleX: 158,
    unitPriceRightX: 475,
    totalRightX: 545,
    titleWidth: 165,
  };
  const headerSize = 8.2;
  const rowSize = 7.8;
  const descriptionSize = 7.5;
  const titleSize = 7.8;
  const descriptionIndent = 8;
  const bottomLimit = 96;

  let page = await addTemplatePage(pdfDoc, templateDoc, 0);
  let y = 432;
  let currentPageIndex = 0;

  const drawTableHeader = (targetPage: PDFPage, headerY: number, headerFont: PDFFont) => {
    targetPage.drawLine({
      start: { x: table.left, y: headerY + 11 },
      end: { x: table.right, y: headerY + 11 },
      thickness: 0.8,
      color: LINE,
    });
    targetPage.drawText("Pos", { x: table.posX, y: headerY, size: headerSize, font: headerFont, color: INK });
    targetPage.drawText("Menge", { x: table.quantityX, y: headerY, size: headerSize, font: headerFont, color: INK });
    targetPage.drawText("Bezeichnung", { x: table.titleX, y: headerY, size: headerSize, font: headerFont, color: INK });
    drawRightAlignedText(targetPage, "Einheitspreis", table.unitPriceRightX, headerY, {
      size: headerSize,
      font: headerFont,
    });
    drawRightAlignedText(targetPage, "Gesamt", table.totalRightX, headerY, {
      size: headerSize,
      font: headerFont,
    });
    targetPage.drawLine({
      start: { x: table.left, y: headerY - 8 },
      end: { x: table.right, y: headerY - 8 },
      thickness: 0.8,
      color: LINE,
    });
  };

  const newPage = async () => {
    page = await addTemplatePage(pdfDoc, templateDoc, 1);
    currentPageIndex += 1;
    y = 713;
    drawTableHeader(page, y, bold);
    y -= 16;
  };

  page.drawText(Invoice.customerName || "-", { x: 71, y: 672, size: 8.7, font: bold, color: INK });
  page.drawText(Invoice.customerStreet || "", { x: 71, y: 660, size: 8.4, font: bold, color: INK });
  page.drawText(Invoice.customerCity || "", { x: 71, y: 648, size: 8.4, font: bold, color: INK });

  const documentTitle = cleanString(Invoice.documentTitle) || "Rechnung";
  const isDraftDocument = documentTitle === "Rechnungsentwurf";
  const servicePeriodInfo = getInvoiceServicePeriodInfo(Invoice);
  const infoRows = [
    [
      documentTitle === "Stornorechnung"
        ? "Stornonummer"
        : "Rechnungsnummer",
      isDraftDocument ? "-" : Invoice.invoiceNumber,
    ],
    ["Projektnummer", Invoice.projectNumber || ""],
    ["Rechnungsdatum", formatDate()],
    [servicePeriodInfo.label, servicePeriodInfo.value],
    ["Ansprechpartner", Invoice.internalContactName || ""],
    ["Telefon", Invoice.internalPhone || ""],
    ["E-Mail", Invoice.internalEmail || ""],
  ];
  infoRows.forEach(([label, value], index) => {
    const rowY = 676 - index * 13;
    page.drawText(label, { x: 313, y: rowY, size: 8.5, font: bold, color: MUTED });
    drawRightAlignedText(page, value || "-", 552, rowY, { size: 8.5, font: regular, color: INK });
  });

  page.drawText(`Projekt: ${Invoice.projectTitle || "-"}`, { x: 71, y: 544, size: 10.7, font: bold, color: INK });
  page.drawText(
    isDraftDocument ? documentTitle : `${documentTitle} Nr. ${Invoice.invoiceNumber}`,
    { x: 71, y: 520, size: 10.7, font: bold, color: INK }
  );
  const greeting = Invoice.contactName ? `Sehr geehrte/r ${Invoice.contactName},` : "Sehr geehrte Damen und Herren,";
  page.drawText(greeting, { x: 71, y: 492, size: 8.8, font: regular, color: INK });
  drawTextBlock(
    page,
    Invoice.introText || "wir danken Ihnen fuer Ihre Anfrage und stellen wir Ihnen folgende Leistungen in Rechnung.",
    71,
    472,
    { font: regular, size: 8.8, maxWidth: 480, lineHeight: 12 }
  );

  drawTableHeader(page, y, bold);
  y -= 21;

  for (const [index, line] of lines.entries()) {
    const descriptionLines = wrapText(line.description || "", regular, descriptionSize, table.titleWidth - descriptionIndent);
    const titleLines = wrapText(cleanInvoiceLineTitle(line.title) || "-", bold, titleSize, table.titleWidth);
    const lineDiscountAmount = getLineDiscountAmount(line);
    const lineTotalNet = getLineTotalNet(line);
    const rowHeight = Math.max(
      31,
      14 + titleLines.length * 10 + descriptionLines.length * 9 + (line.discountPercent > 0 ? 10 : 0)
    );

    if (y - rowHeight < bottomLimit) {
      await newPage();
    }

    const position = String(index + 1).padStart(3, "0");
    page.drawText(position, { x: table.posX, y, size: rowSize, font: regular, color: INK });
    page.drawText(`${formatQuantity(line.quantity)} ${line.unit}`, {
      x: table.quantityX,
      y,
      size: rowSize,
      font: regular,
      color: INK,
    });
    let textY = y;
    titleLines.forEach((titleLine) => {
      page.drawText(titleLine, { x: table.titleX, y: textY, size: titleSize, font: bold, color: INK });
      textY -= 10;
    });
    descriptionLines.forEach((descriptionLine) => {
      page.drawText(descriptionLine, {
        x: table.titleX + descriptionIndent,
        y: textY,
        size: descriptionSize,
        font: regular,
        color: INK,
      });
      textY -= 9;
    });
    drawRightAlignedText(page, formatEuro(line.unitPrice), table.unitPriceRightX, y, {
      size: rowSize,
      font: regular,
    });
    drawRightAlignedText(page, formatEuro(lineTotalNet), table.totalRightX, y, {
      size: rowSize,
      font: regular,
    });
    if (line.discountPercent > 0) {
      drawRightAlignedText(
        page,
        `( Rabatt ${formatQuantity(line.discountPercent)}% ${formatEuro(lineDiscountAmount)} )`,
        table.totalRightX,
        y - 11,
        { size: 6.6, font: regular, color: MUTED }
      );
    }
    y -= rowHeight;
  }

  const netBeforeInvoiceDiscount = lines.reduce((sum, line) => sum + getLineTotalNet(line), 0);
  const invoiceDiscountPercent = cleanPercent(Invoice.discountPercent);
  const invoiceDiscountAmount = roundMoney(netBeforeInvoiceDiscount * (invoiceDiscountPercent / 100));
  const netTotal = roundMoney(netBeforeInvoiceDiscount - invoiceDiscountAmount);
  const vatRate = cleanNumber(Invoice.vatRate, 19);
  const grossTotal = roundMoney(netTotal * (1 + vatRate / 100));

  if (y < (invoiceDiscountPercent > 0 ? 195 : 165)) {
    await newPage();
  }

  page.drawLine({ start: { x: 375, y: y + 12 }, end: { x: table.right, y: y + 12 }, thickness: 0.8, color: LINE });
  let totalsY = y;
  if (invoiceDiscountPercent > 0) {
    page.drawText("Nettobetrag (ohne Rabatt)", { x: 385, y: totalsY, size: 8.3, font: bold, color: INK });
    drawRightAlignedText(page, formatEuro(netBeforeInvoiceDiscount), table.totalRightX, totalsY, { size: 8.3, font: bold });
    totalsY -= 15;
    page.drawText(`Rabatt ${formatQuantity(invoiceDiscountPercent)}%`, { x: 385, y: totalsY, size: 8.3, font: regular, color: INK });
    drawRightAlignedText(page, `-${formatEuro(invoiceDiscountAmount)}`, table.totalRightX, totalsY, {
      size: 8.3,
      font: regular,
    });
    totalsY -= 15;
  }
  page.drawText("Netto", { x: 385, y: totalsY, size: 8.3, font: bold, color: INK });
  drawRightAlignedText(page, formatEuro(netTotal), table.totalRightX, totalsY, { size: 8.3, font: bold });
  page.drawText(`MwSt. ${formatQuantity(vatRate)} %`, { x: 385, y: totalsY - 15, size: 8.3, font: regular, color: INK });
  drawRightAlignedText(page, formatEuro(grossTotal - netTotal), table.totalRightX, totalsY - 15, {
    size: 8.3,
    font: regular,
  });
  page.drawText("Gesamt brutto", { x: 385, y: totalsY - 32, size: 9, font: bold, color: INK });
  drawRightAlignedText(page, formatEuro(grossTotal), table.totalRightX, totalsY - 32, { size: 9, font: bold });

  if (Invoice.closingText) {
    drawTextBlock(page, Invoice.closingText, 71, totalsY - 66, {
      font: regular,
      size: 8.3,
      maxWidth: 330,
      lineHeight: 11,
    });
  }

  pdfDoc.setTitle(`${Invoice.invoiceNumber} ${Invoice.projectTitle || "Rechnung"}`);
  pdfDoc.setSubject(company);
  pdfDoc.setProducer("WorkPilot360");
  pdfDoc.setCreator("WorkPilot360");

  const bytes = await pdfDoc.save();
  return {
    pdfData: Buffer.from(bytes).toString("base64"),
    netTotal,
    vatRate,
    grossTotal,
    pageCount: currentPageIndex + 1,
  };
}

function normalizeInvoiceLines(lines: InvoiceLineInput[] = []) {
  return lines
    .map((line) => {
      const quantity = Math.max(cleanNumber(line.quantity, 1), 0);
      const unitPrice = cleanNumber(line.unitPrice, 0);
      const discountPercent = cleanPercent(line.discountPercent);
      const catalogType = cleanString(line.catalogType);
      const isLaborPosition =
        typeof line.isLaborPosition === "boolean" ? line.isLaborPosition : catalogType === "service";
      const canPlanLabor = isLaborPosition;
      const laborItems = canPlanLabor && Array.isArray(line.laborItems)
        ? line.laborItems
            .reduce((items, labor) => {
              const alreadyPlanned = items.reduce((sum, item) => sum + item.plannedHours, 0);
              const availableHours = Math.max(quantity - alreadyPlanned, 0);
              const plannedHours = Math.max(cleanNumber(labor.plannedHours, 0), 0);
              const hourlyCostRate = Math.max(cleanNumber(labor.hourlyCostRate, 0), 0);
              const cappedHours = Math.min(plannedHours, availableHours);
              const item = {
                userId: cleanString(labor.userId),
                employeeName: cleanString(labor.employeeName),
                plannedHours: cappedHours,
                hourlyCostRate,
                totalCost: cappedHours * hourlyCostRate,
              };
              return [...items, item];
            }, [] as Array<{
              userId: string;
              employeeName: string;
              plannedHours: number;
              hourlyCostRate: number;
              totalCost: number;
            }>)
            .filter((labor) => labor.userId || labor.employeeName || labor.plannedHours > 0)
        : [];
      return {
        catalogItemId: cleanString(line.catalogItemId),
        catalogType,
        isLaborPosition,
        quantity,
        unit: normalizeUnit(line.unit) || "Stk",
        title: cleanInvoiceLineTitle(line.title),
        description: cleanString(line.description),
        unitPrice,
        discountPercent,
        materialUnitCostSnapshot: cleanNumber(line.materialUnitCostSnapshot, 0),
        materialCostSnapshot: cleanNumber(line.materialCostSnapshot, 0),
        laborUnitCostSnapshot: cleanNumber(line.laborUnitCostSnapshot, 0),
        laborCostSnapshot: cleanNumber(line.laborCostSnapshot, 0),
        packageComponentsSnapshot: cleanPackageComponentsSnapshot(line.packageComponentsSnapshot),
        catalogCostSnapshotVersion: Math.max(0, Math.floor(cleanNumber(line.catalogCostSnapshotVersion, 0))),
        vatRate: cleanNumber(line.vatRate, 19),
        laborItems,
      };
    })
    .filter((line) => line.title || line.catalogItemId);
}

function cleanPackageComponentsSnapshot(value: unknown): CatalogPackageComponentSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<CatalogPackageComponentSnapshot[]>((items, entry) => {
    if (!entry || typeof entry !== "object") return items;
    const candidate = entry as Partial<CatalogPackageComponentSnapshot>;
    if (candidate.componentType !== "article" && candidate.componentType !== "service") return items;
    const componentItemId = cleanString(candidate.componentItemId);
    const componentName = cleanString(candidate.componentName);
    if (!componentItemId || !componentName) return items;
    items.push({
      componentItemId,
      componentNumber: cleanString(candidate.componentNumber),
      componentName,
      componentType: candidate.componentType,
      componentUnit: normalizeUnit(candidate.componentUnit),
      quantityPerPackage: Math.max(0, cleanNumber(candidate.quantityPerPackage, 0)),
      salesValuePerPackage: Math.max(0, cleanNumber(candidate.salesValuePerPackage, 0)),
      costValuePerPackage: Math.max(0, cleanNumber(candidate.costValuePerPackage, 0)),
    });
    return items;
  }, []);
}

function serializeInvoice(
  row: InvoiceRow,
  lines: InvoiceLineRow[] = [],
  laborRows: InvoiceLineLaborRow[] = [],
  options: { includeInternalCosts?: boolean } = {}
) {
  const billingSource = cleanString(row.billingSource) || "manual";
  const includeInternalCosts = options.includeInternalCosts === true;
  return {
    ...row,
    billingSource,
    netTotal: Number(row.netTotal ?? 0),
    vatRate: Number(row.vatRate ?? 19),
    grossTotal: Number(row.grossTotal ?? 0),
    discountPercent: Number(row.discountPercent ?? 0),
    paymentTermDays: Number(row.paymentTermDays ?? 14),
    dueDate: row.dueDate ?? "",
    reminderLevel: Number(row.reminderLevel ?? 0),
    lastReminderAt: row.lastReminderAt?.toISOString?.() ?? row.lastReminderAt ?? "",
    isPaid: Boolean(row.isPaid),
    paidAt: row.paidAt?.toISOString?.() ?? row.paidAt ?? "",
    plannedExecutionMonth: row.plannedExecutionMonth ?? "",
    serviceDate: row.serviceDate ?? "",
    sourceOfferId: row.sourceOfferId ?? "",
    sourceOfferNumber: row.sourceOfferNumber ?? "",
    pdfAvailable: Boolean(row.pdfData),
    pdfData: undefined,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    lines: lines.map((line) => ({
      ...line,
      title: cleanInvoiceLineTitle(line.title),
      quantity: Number(line.quantity ?? 0),
      unitPrice: Number(line.unitPrice ?? 0),
      discountPercent: Number(line.discountPercent ?? 0),
      materialUnitCostSnapshot: includeInternalCosts ? Number(line.materialUnitCostSnapshot ?? 0) : 0,
      materialCostSnapshot: includeInternalCosts ? Number(line.materialCostSnapshot ?? 0) : 0,
      laborUnitCostSnapshot: includeInternalCosts ? Number(line.laborUnitCostSnapshot ?? 0) : 0,
      laborCostSnapshot: includeInternalCosts ? Number(line.laborCostSnapshot ?? 0) : 0,
      packageComponentsSnapshot: includeInternalCosts
        ? cleanPackageComponentsSnapshot(line.packageComponentsSnapshot)
        : [],
      catalogCostSnapshotVersion: includeInternalCosts ? Number(line.catalogCostSnapshotVersion ?? 0) : 0,
      costSnapshotAt: includeInternalCosts ? line.costSnapshotAt?.toISOString?.() ?? line.costSnapshotAt ?? "" : "",
      isLaborPosition: Boolean(line.isLaborPosition),
      vatRate: Number(line.vatRate ?? 19),
      totalNet: Number(line.totalNet ?? 0),
      laborItems: laborRows
        .filter((labor) => labor.invoiceLineId === line.id)
        .sort((first, second) => Number(first.position ?? 0) - Number(second.position ?? 0))
        .map((labor) => ({
          ...labor,
          plannedHours: Number(labor.plannedHours ?? 0),
          hourlyCostRate: includeInternalCosts ? Number(labor.hourlyCostRate ?? 0) : 0,
          totalCost: includeInternalCosts ? Number(labor.totalCost ?? 0) : 0,
        })),
    })),
  };
}

function serializeInvoiceHistory(row: InvoiceHistoryRow) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  };
}

async function getInvoiceLinesForInvoice(organizationId: string, invoiceId: string) {
  return prisma.$queryRaw<InvoiceLineRow[]>`
    SELECT *
    FROM "InvoiceLine"
    WHERE "organizationId" = ${organizationId} AND "invoiceId" = ${invoiceId}
    ORDER BY "position" ASC
  `;
}

async function getInvoiceLaborRowsForInvoice(organizationId: string, invoiceId: string) {
  return prisma.$queryRaw<InvoiceLineLaborRow[]>`
    SELECT *
    FROM "InvoiceLineLabor"
    WHERE "organizationId" = ${organizationId} AND "invoiceId" = ${invoiceId}
    ORDER BY "position" ASC
  `;
}

async function getInvoiceBuyerReference(organizationId: string, projectId: string, fallbackReference = "") {
  if (!projectId) return cleanString(fallbackReference);
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
      AND c."type" <> 'person'
      AND COALESCE(c."leitwegId", '') <> ''
    ORDER BY CASE
      WHEN c."id" = p."contactId" THEN 0
      WHEN c."parentCompanyId" = p."contactId" THEN 1
      ELSE 2
    END, c."updatedAt" DESC
    LIMIT 1
  `;
  return cleanString(rows[0]?.leitwegId) || cleanString(fallbackReference);
}

async function persistInvoiceLines(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    invoiceId: string;
    lines: Required<InvoiceLineInput>[];
    replaceExisting?: boolean;
  }
) {
  if (input.replaceExisting) {
    await tx.$executeRaw`
      DELETE FROM "InvoiceLine"
      WHERE "organizationId" = ${input.organizationId}
        AND "invoiceId" = ${input.invoiceId}
    `;
  }

  const savedLines: InvoiceLineRow[] = [];
  const savedLaborRows: InvoiceLineLaborRow[] = [];
  for (const [index, line] of input.lines.entries()) {
    const lineRows = await tx.$queryRaw<InvoiceLineRow[]>`
      INSERT INTO "InvoiceLine" (
        "id", "organizationId", "invoiceId", "catalogItemId", "catalogType", "isLaborPosition", "position",
        "quantity", "unit", "title", "description", "unitPrice", "discountPercent",
        "materialUnitCostSnapshot", "materialCostSnapshot", "laborUnitCostSnapshot", "laborCostSnapshot",
        "packageComponentsSnapshot", "catalogCostSnapshotVersion", "costSnapshotAt",
        "vatRate", "totalNet", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${input.organizationId}, ${input.invoiceId}, ${line.catalogItemId}, ${line.catalogType}, ${line.isLaborPosition}, ${index + 1},
        ${line.quantity}, ${line.unit}, ${line.title}, ${line.description},
        ${line.unitPrice}, ${line.discountPercent},
        ${line.materialUnitCostSnapshot}, ${line.materialCostSnapshot}, ${line.laborUnitCostSnapshot}, ${line.laborCostSnapshot},
        ${JSON.stringify(line.packageComponentsSnapshot)}::jsonb, ${line.catalogCostSnapshotVersion}, CURRENT_TIMESTAMP,
        ${line.vatRate}, ${getLineTotalNet(line)}, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    savedLines.push(lineRows[0]);

    for (const [laborIndex, labor] of line.laborItems.entries()) {
      const laborRows = await tx.$queryRaw<InvoiceLineLaborRow[]>`
        INSERT INTO "InvoiceLineLabor" (
          "id", "organizationId", "invoiceId", "invoiceLineId", "userId", "employeeName",
          "plannedHours", "hourlyCostRate", "totalCost", "position", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${input.organizationId}, ${input.invoiceId}, ${lineRows[0].id}, ${labor.userId}, ${labor.employeeName},
          ${labor.plannedHours}, ${labor.hourlyCostRate}, ${labor.totalCost}, ${laborIndex + 1}, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      savedLaborRows.push(laborRows[0]);
    }
  }

  return { savedLines, savedLaborRows };
}

async function addInvoiceHistory(db: Prisma.TransactionClient | typeof prisma, input: {
  organizationId: string;
  invoiceId: string;
  projectId: string;
  invoiceNumber: string;
  eventType: string;
  title: string;
  note: string;
  actorName: string;
}) {
  await db.$executeRaw`
    INSERT INTO "InvoiceHistory" (
      "id", "organizationId", "invoiceId", "projectId", "invoiceNumber",
      "eventType", "title", "note", "actorName"
    ) VALUES (
      ${randomUUID()}, ${input.organizationId}, ${input.invoiceId}, ${input.projectId}, ${input.invoiceNumber},
      ${input.eventType}, ${input.title}, ${input.note}, ${input.actorName}
    )
  `;
}

async function cancelInvoice(input: {
  organizationId: string;
  invoiceId: string;
  actorName: string;
  actorUserId: string;
  reason: string;
  includeInternalCosts: boolean;
}) {
  try {
    const result = await prisma.$transaction(
      (tx) =>
        createInvoiceCancellation({
          tx,
          organizationId: input.organizationId,
          invoiceId: input.invoiceId,
          actorName: input.actorName,
          actorUserId: input.actorUserId,
          reason: input.reason,
          source: "ui",
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const originalInvoice = await prisma.invoice.findFirstOrThrow({
      where: { id: result.originalInvoiceId, organizationId: input.organizationId },
      include: { lines: { orderBy: { position: "asc" }, include: { laborItems: true } } },
    });
    await externalizePdfPayload({
      organizationId: input.organizationId,
      ownerType: "invoice",
      ownerId: result.cancellationInvoice.id,
      sourceType: "invoice-pdf",
      category: "invoices",
      originalName: `${result.cancellationInvoice.invoiceNumber}.pdf`,
      pdfBase64: result.cancellationInvoice.pdfData,
      createdByUserId: input.actorUserId,
      writeReference: (tx, reference) =>
        tx.invoice.update({
          where: { id: result.cancellationInvoice.id },
          data: { pdfData: reference },
        }),
    });
    return NextResponse.json({
      originalInvoice: serializeInvoice(
        originalInvoice as unknown as InvoiceRow,
        originalInvoice.lines as unknown as InvoiceLineRow[],
        originalInvoice.lines.flatMap((line) => line.laborItems) as unknown as InvoiceLineLaborRow[],
        { includeInternalCosts: input.includeInternalCosts }
      ),
      cancellationInvoice: serializeInvoice(
        result.cancellationInvoice as unknown as InvoiceRow,
        result.cancellationInvoice.lines as unknown as InvoiceLineRow[],
        result.cancellationInvoice.lines.flatMap((line) => line.laborItems) as unknown as InvoiceLineLaborRow[],
        { includeInternalCosts: input.includeInternalCosts }
      ),
    });
  } catch (error) {
    console.error("Invoice cancellation failed", error);
    const known = error instanceof InvoiceCancellationServiceError;
    return NextResponse.json(
      {
        error: known
          ? error.message
          : "Stornorechnung konnte nicht sicher erstellt werden.",
      },
      {
        status: known
          ? error.code === "not_found"
            ? 404
            : error.code === "conflict" || error.code === "stale_context"
              ? 409
              : 400
          : 500,
      }
    );
  }
}

async function creditInvoice(input: {
  organizationId: string;
  invoiceId: string;
  actorName: string;
  actorUserId: string;
  reason: string;
  items: InvoiceCreditItemInput[];
  includeInternalCosts: boolean;
}) {
  try {
    const result = await prisma.$transaction(
      (tx) => createInvoiceCredit({
        tx,
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        actorName: input.actorName,
        actorUserId: input.actorUserId,
        reason: input.reason,
        items: input.items,
        source: "ui",
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    await externalizePdfPayload({
      organizationId: input.organizationId,
      ownerType: "invoice",
      ownerId: result.creditInvoice.id,
      sourceType: "invoice-pdf",
      category: "invoices",
      originalName: `${result.creditInvoice.invoiceNumber}.pdf`,
      pdfBase64: result.creditInvoice.pdfData,
      createdByUserId: input.actorUserId,
      writeReference: (tx, reference) =>
        tx.invoice.update({
          where: { id: result.creditInvoice.id },
          data: { pdfData: reference },
        }),
    });
    return NextResponse.json({
      creditInvoice: serializeInvoice(
        result.creditInvoice as unknown as InvoiceRow,
        result.creditInvoice.lines as unknown as InvoiceLineRow[],
        result.creditInvoice.lines.flatMap((line) => line.laborItems) as unknown as InvoiceLineLaborRow[],
        { includeInternalCosts: input.includeInternalCosts }
      ),
    });
  } catch (error) {
    console.error("Invoice credit failed", error);
    const known = error instanceof InvoiceCreditServiceError;
    return NextResponse.json(
      { error: known ? error.message : "Teilgutschrift konnte nicht sicher erstellt werden." },
      {
        status: known
          ? error.code === "not_found"
            ? 404
            : error.code === "conflict" || error.code === "stale_context"
              ? 409
              : 400
          : 500,
      }
    );
  }
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureInvoiceTables();
  const { searchParams } = new URL(req.url);
  const requestedActorId = searchParams.get("actorId");
  const pdfId = cleanString(searchParams.get("pdfId"));
  const xrechnungId = cleanString(searchParams.get("xrechnungId"));
  const xrechnungValidationId = cleanString(searchParams.get("xrechnungValidationId"));
  const zugferdId = cleanString(searchParams.get("zugferdId"));
  const historyProjectId = cleanString(searchParams.get("historyProjectId"));
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    if (
      actorResult.status === 401 &&
      !cleanString(requestedActorId) &&
      !pdfId &&
      !xrechnungId &&
      !xrechnungValidationId &&
      !zugferdId &&
      !historyProjectId
    ) {
      return NextResponse.json([]);
    }
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canSendDocumentMails(actor)) {
    return forbiddenInvoiceResponse();
  }
  const includeInternalCosts = canViewInternalCostData(actor);

  if (xrechnungId || xrechnungValidationId || zugferdId) {
    const targetInvoiceId = xrechnungId || xrechnungValidationId || zugferdId;
    const rows = await prisma.$queryRaw<InvoiceRow[]>`
      SELECT *
      FROM "Invoice"
      WHERE "organizationId" = ${organization.id} AND "id" = ${targetInvoiceId}
      LIMIT 1
    `;
    const invoice = rows[0];
    if (!invoice) {
      return NextResponse.json({ error: "Rechnung wurde nicht gefunden." }, { status: 404 });
    }
    if (isInvoiceBlockedForXRechnung(invoice.status)) {
      return NextResponse.json(
        { error: "XRechnung kann fuer geloeschte oder stornierte Rechnungen sowie Gutschriften nicht erzeugt werden." },
        { status: 409 }
      );
    }

    const lineRows = await getInvoiceLinesForInvoice(organization.id, invoice.id);
    if (!lineRows.length) {
      return NextResponse.json({ error: "XRechnung kann ohne Rechnungspositionen nicht erzeugt werden." }, { status: 400 });
    }

    const buyerReference = await getInvoiceBuyerReference(
      organization.id,
      invoice.projectId,
      invoice.projectNumber || invoice.invoiceNumber
    );
    const seller = getXRechnungSellerProfile(invoice.company);
    const missingSellerFields = getMissingXRechnungSellerFields(seller);
    if (missingSellerFields.length > 0) {
      return NextResponse.json(
        {
          error: `XRechnung kann nicht erzeugt werden, weil Firmendaten fehlen: ${missingSellerFields.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const paymentTermDays = Number(invoice.paymentTermDays ?? 14);
    const serviceDate = cleanDateKey(invoice.serviceDate);
    const dueDate = cleanDateKey(invoice.dueDate) || addDaysToDateKey(serviceDate, paymentTermDays);
    const xrechnungInvoice = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.createdAt?.toISOString?.().slice(0, 10) || new Date().toISOString().slice(0, 10),
      serviceDate,
      dueDate,
      seller,
      customerName: invoice.customerName,
      customerStreet: invoice.customerStreet,
      customerCity: invoice.customerCity,
      contactName: invoice.contactName,
      netTotal: Number(invoice.netTotal ?? 0),
      vatRate: Number(invoice.vatRate ?? 19),
      grossTotal: Number(invoice.grossTotal ?? 0),
      paymentTermDays,
      buyerReference,
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
    const xml = generateXRechnungXml(xrechnungInvoice, xrechnungLines);
    const kositValidation = validation.valid
      ? await validateXRechnungWithKosit(xml)
      : {
          available: false,
          valid: false,
          status: "not-configured" as const,
          message: "KoSIT-Validierung wurde wegen technischer Mindestfehler nicht ausgeführt.",
          issues: [],
        };

    if (xrechnungValidationId) {
      return NextResponse.json({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        validation,
        kositValidation,
      });
    }

    if (!validation.valid || (kositValidation.available && !kositValidation.valid)) {
      return NextResponse.json(
        {
          error: zugferdId
            ? "ZUGFeRD kann wegen Validierungsfehlern nicht erzeugt werden."
            : "XRechnung kann wegen Validierungsfehlern nicht erzeugt werden.",
          validation,
          kositValidation,
        },
        { status: 400 }
      );
    }

    if (zugferdId) {
      if (!invoice.pdfData) {
        return NextResponse.json({ error: "ZUGFeRD kann nicht erzeugt werden: Rechnungs-PDF fehlt." }, { status: 404 });
      }

      let invoicePdfBytes: Buffer;
      try {
        const resolvedPdf = await resolveStorageBackedBytes({
          organizationId: organization.id,
          payload: invoice.pdfData,
          expectedOwnerType: "invoice",
          expectedOwnerId: invoice.id,
        });
        if (!resolvedPdf) throw new Error("invoice_pdf_missing");
        invoicePdfBytes = resolvedPdf;
      } catch (error) {
        console.error("ZUGFeRD source PDF could not be loaded", error);
        return NextResponse.json(
          { error: "ZUGFeRD kann momentan nicht erzeugt werden: Rechnungs-PDF ist vorübergehend nicht verfügbar." },
          { status: 503, headers: { "Retry-After": "30" } }
        );
      }

      const zugferd = await buildValidatedZugferdPdf({
        invoicePdfBytes,
        xrechnungXml: Buffer.from(xml, "utf8"),
      });
      if (!zugferd.conversion.available) {
        return NextResponse.json(
          { error: "ZUGFeRD kann nicht erzeugt werden: PDF/A-3-Konverter ist nicht konfiguriert.", zugferdConversion: zugferd.conversion },
          { status: 503 }
        );
      }
      if (!zugferd.conversion.converted) {
        return NextResponse.json(
          { error: `ZUGFeRD kann nicht erzeugt werden: ${zugferd.conversion.message}`, zugferdConversion: zugferd.conversion },
          { status: 500 }
        );
      }
      if (!zugferd.validation?.available) {
        return NextResponse.json(
          { error: "ZUGFeRD kann nicht erzeugt werden: PDF/A-3-Validator ist nicht konfiguriert." },
          { status: 503 }
        );
      }
      if (!zugferd.validation.valid || !zugferd.pdfBytes) {
        return NextResponse.json(
          {
            error: "ZUGFeRD wurde vom PDF/A-3-Validator abgelehnt.",
            zugferdValidation: zugferd.validation,
          },
          { status: 400 }
        );
      }

      let archivedZugferd = Buffer.from(zugferd.pdfBytes);
      try {
        archivedZugferd = await archiveAndResolveInvoiceArtifact({
          organizationId: organization.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          kind: "zugferd",
          bytes: zugferd.pdfBytes,
          createdByUserId: actorResult.actor.id,
        });
      } catch (error) {
        console.error("ZUGFeRD archive deferred; delivering generated artifact", error);
      }
      return new Response(new Uint8Array(archivedZugferd), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}-zugferd.pdf"`,
        },
      });
    }

    let archivedXRechnung = Buffer.from(xml, "utf8");
    try {
      archivedXRechnung = await archiveAndResolveInvoiceArtifact({
        organizationId: organization.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        kind: "xrechnung",
        bytes: archivedXRechnung,
        createdByUserId: actorResult.actor.id,
      });
    } catch (error) {
      console.error("XRechnung archive deferred; delivering generated artifact", error);
    }
    return new Response(new Uint8Array(archivedXRechnung), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}-xrechnung.xml"`,
      },
    });
  }

  if (pdfId) {
    const rows = await prisma.$queryRaw<InvoiceRow[]>`
      SELECT *
      FROM "Invoice"
      WHERE "organizationId" = ${organization.id} AND "id" = ${pdfId}
      LIMIT 1
    `;
    const Invoice = rows[0];
    if (!Invoice) {
      return NextResponse.json({ error: "PDF wurde nicht gefunden." }, { status: 404 });
    }
    if (Invoice.status === "Entwurf") {
      const lineRows = await getInvoiceLinesForInvoice(organization.id, Invoice.id);
      const draftLines = lineRows.map((line) => ({
        catalogItemId: line.catalogItemId,
        catalogType: line.catalogType,
        isLaborPosition: Boolean(line.isLaborPosition),
        quantity: Number(line.quantity ?? 0),
        unit: line.unit || "Stk",
        title: cleanInvoiceLineTitle(line.title) || "-",
        description: line.description || "",
        unitPrice: Number(line.unitPrice ?? 0),
        discountPercent: Number(line.discountPercent ?? 0),
        materialUnitCostSnapshot: Number(line.materialUnitCostSnapshot ?? 0),
        materialCostSnapshot: Number(line.materialCostSnapshot ?? 0),
        laborUnitCostSnapshot: Number(line.laborUnitCostSnapshot ?? 0),
        laborCostSnapshot: Number(line.laborCostSnapshot ?? 0),
        packageComponentsSnapshot: cleanPackageComponentsSnapshot(line.packageComponentsSnapshot),
        catalogCostSnapshotVersion: Number(line.catalogCostSnapshotVersion ?? 0),
        vatRate: Number(line.vatRate ?? Invoice.vatRate ?? 19),
        laborItems: [],
      })) as Required<InvoiceLineInput>[];
      const draftPdf = await generateInvoicePdf(
        {
          projectId: Invoice.projectId,
          projectNumber: Invoice.projectNumber,
          projectTitle: Invoice.projectTitle,
          company: Invoice.company,
          customerName: Invoice.customerName,
          customerStreet: Invoice.customerStreet,
          customerCity: Invoice.customerCity,
          contactName: Invoice.contactName,
          internalContactName: Invoice.internalContactName,
          internalPhone: Invoice.internalPhone,
          internalEmail: Invoice.internalEmail,
          plannedExecutionMonth: Invoice.plannedExecutionMonth,
          serviceDate: Invoice.serviceDate,
          sourceOfferId: Invoice.sourceOfferId,
          sourceOfferNumber: Invoice.sourceOfferNumber,
          introText: Invoice.introText,
          closingText: Invoice.closingText,
          vatRate: Number(Invoice.vatRate ?? 19),
          discountPercent: Number(Invoice.discountPercent ?? 0),
          invoiceNumber: Invoice.invoiceNumber,
          documentTitle: "Rechnungsentwurf",
        },
        draftLines
      );
      const bytes = Buffer.from(draftPdf.pdfData ?? "", "base64");
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Rechnungsentwurf-${Invoice.projectNumber || Invoice.id}.pdf"`,
        },
      });
    }
    if (!Invoice.pdfData) {
      return NextResponse.json({ error: "PDF wurde nicht gefunden." }, { status: 404 });
    }
    let bytes: Buffer;
    try {
      const resolvedPdf = await resolveStorageBackedBytes({
        organizationId: organization.id,
        payload: Invoice.pdfData,
        expectedOwnerType: "invoice",
        expectedOwnerId: Invoice.id,
      });
      if (!resolvedPdf) throw new Error("invoice_pdf_missing");
      bytes = resolvedPdf;
    } catch (error) {
      console.error("Invoice PDF could not be loaded", error);
      return NextResponse.json(
        { error: "Das Rechnungs-PDF ist vorübergehend nicht verfügbar." },
        { status: 503, headers: { "Retry-After": "30" } }
      );
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${Invoice.invoiceNumber}.pdf"`,
      },
    });
  }

  if (historyProjectId) {
    const historyRows = await prisma.$queryRaw<InvoiceHistoryRow[]>`
      SELECT *
      FROM "InvoiceHistory"
      WHERE "organizationId" = ${organization.id} AND "projectId" = ${historyProjectId}
      ORDER BY "createdAt" DESC
    `;
    return NextResponse.json(historyRows.map(serializeInvoiceHistory));
  }

  const projectId = cleanString(searchParams.get("projectId"));
  const rows = projectId
    ? await prisma.$queryRaw<InvoiceRow[]>`
        SELECT "id", "organizationId", "projectId", "projectNumber", "projectTitle", "company",
               "invoiceNumber", "status", "billingSource", "customerName", "customerStreet",
               "customerCity", "contactName", "internalContactName", "internalPhone",
               "internalEmail", "plannedExecutionMonth", "serviceDate", "sourceOfferId",
               "sourceOfferNumber", "sourceInvoiceId", "sourceInvoiceNumber", "correctionReason", "introText", "closingText", "netTotal", "vatRate",
               "grossTotal", "discountPercent", "paymentTermDays", "dueDate",
               "reminderLevel", "lastReminderAt", "isPaid", "paidAt",
               CASE WHEN "pdfData" IS NULL THEN NULL ELSE 'available' END AS "pdfData",
               "createdAt", "updatedAt"
        FROM "Invoice"
        WHERE "organizationId" = ${organization.id} AND "projectId" = ${projectId} AND "status" NOT IN (${DELETED_INVOICE_STATUS}, ${LEGACY_DELETED_INVOICE_STATUS})
        ORDER BY "createdAt" DESC
      `
    : await prisma.$queryRaw<InvoiceRow[]>`
        SELECT "id", "organizationId", "projectId", "projectNumber", "projectTitle", "company",
               "invoiceNumber", "status", "billingSource", "customerName", "customerStreet",
               "customerCity", "contactName", "internalContactName", "internalPhone",
               "internalEmail", "plannedExecutionMonth", "serviceDate", "sourceOfferId",
               "sourceOfferNumber", "sourceInvoiceId", "sourceInvoiceNumber", "correctionReason", "introText", "closingText", "netTotal", "vatRate",
               "grossTotal", "discountPercent", "paymentTermDays", "dueDate",
               "reminderLevel", "lastReminderAt", "isPaid", "paidAt",
               CASE WHEN "pdfData" IS NULL THEN NULL ELSE 'available' END AS "pdfData",
               "createdAt", "updatedAt"
        FROM "Invoice"
        WHERE "organizationId" = ${organization.id} AND "status" NOT IN (${DELETED_INVOICE_STATUS}, ${LEGACY_DELETED_INVOICE_STATUS})
        ORDER BY "createdAt" DESC
      `;

  const lineRows: InvoiceLineRow[] = [];
  const laborRows: InvoiceLineLaborRow[] = [];
  for (const Invoice of rows) {
    const rowsForInvoice = await prisma.$queryRaw<InvoiceLineRow[]>`
      SELECT *
      FROM "InvoiceLine"
      WHERE "organizationId" = ${organization.id} AND "invoiceId" = ${Invoice.id}
      ORDER BY "position" ASC
    `;
    lineRows.push(...rowsForInvoice);

    const laborRowsForInvoice = await prisma.$queryRaw<InvoiceLineLaborRow[]>`
      SELECT *
      FROM "InvoiceLineLabor"
      WHERE "organizationId" = ${organization.id} AND "invoiceId" = ${Invoice.id}
      ORDER BY "position" ASC
    `;
    laborRows.push(...laborRowsForInvoice);
  }

  return NextResponse.json(
    rows.map((row) =>
      serializeInvoice(
        row,
        lineRows.filter((line) => line.invoiceId === row.id),
        laborRows.filter((labor) => labor.invoiceId === row.id),
        { includeInternalCosts }
      )
    )
  );
}



export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureInvoiceTables();
  const body = (await req.json()) as InvoiceInput;
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageInvoices(actor)) {
    return forbiddenInvoiceResponse();
  }
  const includeInternalCosts = canViewInternalCostData(actor);
  const actorName = getUserName(actor);
  const internalContactName = cleanString(body.internalContactName) || actorName;
  const lines = await withInvoiceLineCostSnapshots(organization.id, normalizeInvoiceLines(body.lines));
  const saveAsDraft = Boolean(body.saveAsDraft);

  if (!body.projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  if (!saveAsDraft && lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const billedStampEntryIds = saveAsDraft ? [] : getBilledStampEntryIds(body.billedStampEntryIds);
  const stampedHours = saveAsDraft
    ? 0
    : await getStampedHoursForInvoiceCheck({
        organizationId: organization.id,
        projectId: cleanString(body.projectId),
        stampEntryIds: billedStampEntryIds,
      });
  const invoiceLaborHours = saveAsDraft ? 0 : getInvoiceLaborHours(lines);
  const isUnderbilledStampedHours = stampedHours > 0 && invoiceLaborHours + 0.01 < stampedHours;

  if (isUnderbilledStampedHours && !body.allowUnderbilledStampedHours) {
    return NextResponse.json(
      {
        error: `Es wurden ${stampedHours.toFixed(2)} Std. gestempelt, aber nur ${invoiceLaborHours.toFixed(2)} Std. fakturiert.`,
        requiresUnderbillingConfirmation: true,
        stampedHours,
        invoiceLaborHours,
      },
      { status: 409 }
    );
  }

  const id = randomUUID();
  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const billingSource = cleanString(body.billingSource) === "batch" ? "batch" : "manual";
  const serviceDate = cleanDateKey(body.serviceDate);
  const paymentTermDays = cleanPaymentTermDays(body.paymentTermDays);
  const dueDate = getInvoiceDueDate(body, serviceDate, paymentTermDays);
  const plannedExecutionMonth = getInvoiceMonthFromInput(body);
  if (!saveAsDraft && billedStampEntryIds.length) await ensureInvoiceTimeEntryColumns();
  const core = await runInvoiceCrudTransaction({
    prisma,
    organizationId: organization.id,
    lockKey: "number:RE",
    operation: async (tx) => {
      const invoiceNumber = await getNextinvoiceNumber(tx, organization.id);
      const pdf =
        lines.length > 0
          ? await generateInvoicePdf(
              {
                ...body,
                company,
                invoiceNumber,
                internalContactName,
                documentTitle: saveAsDraft ? "Rechnungsentwurf" : "Rechnung",
              },
              lines
            )
          : { netTotal: 0, vatRate: cleanNumber(body.vatRate, 19), grossTotal: 0, pdfData: null };
      const rows = await tx.$queryRaw<InvoiceRow[]>`
        INSERT INTO "Invoice" (
          "id", "organizationId", "projectId", "projectNumber", "projectTitle", "company",
          "invoiceNumber", "status", "billingSource", "customerName", "customerStreet", "customerCity",
          "contactName", "internalContactName", "internalPhone", "internalEmail",
          "plannedExecutionMonth", "serviceDate", "sourceOfferId", "sourceOfferNumber",
          "introText", "closingText", "discountPercent", "paymentTermDays", "dueDate",
          "netTotal", "vatRate", "grossTotal", "pdfData", "updatedAt"
        ) VALUES (
          ${id}, ${organization.id}, ${cleanString(body.projectId)}, ${cleanString(body.projectNumber)},
          ${cleanString(body.projectTitle)}, ${company}, ${invoiceNumber}, ${saveAsDraft ? "Entwurf" : "Fakturiert"}, ${billingSource},
          ${cleanString(body.customerName)}, ${cleanString(body.customerStreet)}, ${cleanString(body.customerCity)},
          ${cleanString(body.contactName)}, ${internalContactName}, ${cleanString(body.internalPhone)},
          ${cleanString(body.internalEmail)}, ${plannedExecutionMonth}, ${serviceDate},
          ${cleanString(body.sourceOfferId)}, ${cleanString(body.sourceOfferNumber)},
          ${cleanString(body.introText)}, ${cleanString(body.closingText)},
          ${cleanPercent(body.discountPercent)}, ${paymentTermDays}, ${dueDate},
          ${pdf.netTotal}, ${pdf.vatRate}, ${pdf.grossTotal}, ${pdf.pdfData}, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      const persisted = await persistInvoiceLines(tx, {
        organizationId: organization.id,
        invoiceId: id,
        lines,
      });
      await addInvoiceHistory(tx, {
        organizationId: organization.id,
        invoiceId: id,
        projectId: cleanString(body.projectId),
        invoiceNumber,
        eventType: "created",
        title: saveAsDraft ? "Rechnungsentwurf gespeichert" : "Rechnung angelegt",
        note: `${invoiceNumber} wurde ${saveAsDraft ? "als Entwurf gespeichert" : "erstellt"}.`,
        actorName,
      });
      if (!saveAsDraft) {
        await markStampedHoursAsInvoiced(tx, {
          organizationId: organization.id,
          projectId: cleanString(body.projectId),
          invoiceId: id,
          invoiceNumber,
          stampEntryIds: billedStampEntryIds,
        });
      }
      await syncInvoiceInventoryMovements({
        db: tx,
        organizationId: organization.id,
        invoiceId: id,
        actorUserId: actor.id,
        actorName,
        useExistingTransaction: true,
      });
      return { invoiceNumber, pdf, row: rows[0], ...persisted };
    },
  });
  const { invoiceNumber, pdf, row, savedLines, savedLaborRows } = core;

  if (!saveAsDraft && isUnderbilledStampedHours && !body.suppressUnderbillingNotification) {
    await notifyManagementAboutUnderbilling({
      organizationId: organization.id,
      projectId: cleanString(body.projectId),
      projectLabel: `${cleanString(body.projectNumber)} | ${cleanString(body.projectTitle)}`,
      invoiceNumber,
      stampedHours,
      invoiceHours: invoiceLaborHours,
    });
  }

  await externalizePdfPayload({
    organizationId: organization.id,
    ownerType: "invoice",
    ownerId: id,
    sourceType: "invoice-pdf",
    category: "invoices",
    originalName: `${invoiceNumber}.pdf`,
    pdfBase64: pdf.pdfData,
    createdByUserId: actor.id,
    writeReference: (tx, reference) =>
      tx.invoice.update({ where: { id }, data: { pdfData: reference } }),
  });

  return NextResponse.json(serializeInvoice(row, savedLines, savedLaborRows, { includeInternalCosts }));
}

export async function PUT(req: Request) {
  const { users } = await getDemoContext();
  await ensureInvoiceTables();
  const body = (await req.json()) as InvoiceInput & { invoiceNumber?: string };
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  if (!canManageInvoices(actorResult.actor)) {
    return forbiddenInvoiceResponse();
  }
  const lines = normalizeInvoiceLines(body.lines);

  if (lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const pdf = await generateInvoicePdf({
    ...body,
    company,
    invoiceNumber: cleanString(body.invoiceNumber) || "VORSCHAU",
  }, lines);

  return NextResponse.json({
    pdfDataUrl: `data:application/pdf;base64,${pdf.pdfData}`,
    netTotal: pdf.netTotal,
    vatRate: pdf.vatRate,
    grossTotal: pdf.grossTotal,
    pageCount: pdf.pageCount,
  });
}

export async function PATCH(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureInvoiceTables();
  const body = (await req.json()) as InvoiceInput & { id?: string; action?: string; actorName?: string; reason?: string };
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageInvoices(actor)) {
    return forbiddenInvoiceResponse();
  }
  const includeInternalCosts = canViewInternalCostData(actor);
  const actorName = getUserName(actor);
  const id = cleanString(body.id);
  const saveAsDraft = Boolean(body.saveAsDraft);

  if (!id) {
    return NextResponse.json({ error: "Rechnung fehlt." }, { status: 400 });
  }

  if (cleanString(body.action) === "cancel") {
    return cancelInvoice({
      organizationId: organization.id,
      invoiceId: id,
      actorName,
      actorUserId: actor.id,
      reason: cleanString(body.reason),
      includeInternalCosts,
    });
  }

  if (cleanString(body.action) === "credit") {
    return creditInvoice({
      organizationId: organization.id,
      invoiceId: id,
      actorName,
      actorUserId: actor.id,
      reason: cleanString(body.reason),
      items: Array.isArray(body.creditItems) ? body.creditItems : [],
      includeInternalCosts,
    });
  }

  if (cleanString(body.action) === "finalize") {
    try {
      const storedDraft = await prisma.invoice.findFirst({
        where: {
          id,
          organizationId: organization.id,
          status: "Entwurf",
        },
        include: { lines: { orderBy: { position: "asc" } } },
      });
      if (!storedDraft) {
        return NextResponse.json(
          { error: "Der Rechnungsentwurf wurde nicht gefunden oder bereits fakturiert." },
          { status: 409 }
        );
      }
      const storedLines = normalizeInvoiceLines(
        storedDraft.lines.map((line) => ({
          catalogItemId: line.catalogItemId,
          catalogType: line.catalogType,
          isLaborPosition: line.isLaborPosition,
          quantity: line.quantity,
          unit: line.unit,
          title: line.title,
          description: line.description,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          materialUnitCostSnapshot: line.materialUnitCostSnapshot,
          materialCostSnapshot: line.materialCostSnapshot,
          laborUnitCostSnapshot: line.laborUnitCostSnapshot,
          laborCostSnapshot: line.laborCostSnapshot,
          packageComponentsSnapshot: cleanPackageComponentsSnapshot(
            line.packageComponentsSnapshot
          ),
          catalogCostSnapshotVersion: line.catalogCostSnapshotVersion,
          vatRate: line.vatRate,
        }))
      );
      const { lines: _storedInvoiceLines, ...storedInvoiceData } =
        storedDraft;
      const finalizedPdf = await generateInvoicePdf(
        {
          ...storedInvoiceData,
          company:
            storedDraft.company === "OK immocare"
              ? "OK immocare"
              : "OK solutions",
          invoiceNumber: storedDraft.invoiceNumber,
          documentTitle: "Rechnung",
        },
        storedLines
      );
      const finalized = await prisma.$transaction(
        async (tx) => {
          await tx.invoice.update({
            where: { id: storedDraft.id },
            data: { pdfData: finalizedPdf.pdfData },
          });
          const finalizedInvoice = await finalizeInvoiceDraft({
            tx,
            organizationId: organization.id,
            invoiceId: id,
            actorName,
            source: "ui",
          });
          await syncInvoiceInventoryMovements({
            db: tx,
            organizationId: organization.id,
            invoiceId: id,
            actorUserId: actor.id,
            actorName,
            useExistingTransaction: true,
          });
          return finalizedInvoice;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      await externalizePdfPayload({
        organizationId: organization.id,
        ownerType: "invoice",
        ownerId: finalized.id,
        sourceType: "invoice-pdf",
        category: "invoices",
        originalName: `${finalized.invoiceNumber}.pdf`,
        pdfBase64: finalizedPdf.pdfData,
        createdByUserId: actor.id,
        writeReference: (tx, reference) =>
          tx.invoice.update({
            where: { id: finalized.id },
            data: { pdfData: reference },
          }),
      });
      const [lines, laborRows] = await Promise.all([
        getInvoiceLinesForInvoice(organization.id, finalized.id),
        prisma.invoiceLineLabor.findMany({
          where: {
            organizationId: organization.id,
            invoiceId: finalized.id,
          },
          orderBy: { position: "asc" },
        }),
      ]);
      return NextResponse.json(
        serializeInvoice(
          {
            ...finalized,
            company:
              finalized.company === "OK immocare"
                ? "OK immocare"
                : "OK solutions",
          },
          lines,
          laborRows,
          {
          includeInternalCosts,
          }
        )
      );
    } catch (error) {
      if (error instanceof InvoiceFinalizationServiceError) {
        const status =
          error.code === "not_found"
            ? 404
            : error.code === "blocked" ||
                error.code === "stale_context" ||
                error.code === "conflict" ||
                error.code === "invalid_state"
              ? 409
              : 400;
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status }
        );
      }
      throw error;
    }
  }

  if (cleanString(body.action) === "mark-paid") {
    try {
      const paid = await prisma.$transaction(
        (tx) =>
          markInvoicePaid({
            tx,
            organizationId: organization.id,
            invoiceId: id,
            paymentDate: cleanString(body.paymentDate) || getBerlinDateKey(),
            actorName,
            source: "ui",
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return NextResponse.json(
        serializeInvoice(paid as InvoiceRow, [], [], { includeInternalCosts })
      );
    } catch (error) {
      if (error instanceof InvoicePaymentServiceError) {
        const status =
          error.code === "not_found"
            ? 404
            : error.code === "invalid_input"
              ? 400
              : 409;
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status }
        );
      }
      throw error;
    }
  }

  if (cleanString(body.action) === "record-reminder") {
    const rows = await prisma.$queryRaw<InvoiceRow[]>`
      UPDATE "Invoice"
      SET "reminderLevel" = LEAST(COALESCE("reminderLevel", 0) + 1, 3),
          "lastReminderAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id}
        AND "id" = ${id}
        AND "status" NOT IN ('Entwurf', 'Storniert', 'Stornorechnung')
        AND "isPaid" = false
      RETURNING *
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "Mahnung konnte nicht erfasst werden." }, { status: 404 });
    }

    await addInvoiceHistory(prisma, {
      organizationId: organization.id,
      invoiceId: id,
      projectId: rows[0].projectId,
      invoiceNumber: rows[0].invoiceNumber,
      eventType: "reminder",
      title: `Mahnstufe ${rows[0].reminderLevel} erfasst`,
      note: `${rows[0].invoiceNumber} wurde auf Mahnstufe ${rows[0].reminderLevel} gesetzt.`,
      actorName,
    });

    return NextResponse.json(serializeInvoice(rows[0], [], [], { includeInternalCosts }));
  }

  if (cleanString(body.action) === "create-reminder-document") {
    try {
      const reminderDate = cleanString(body.reminderDate) || getBerlinDateKey();
      const result = await prisma.$transaction(
        (tx) =>
          createInvoiceReminder({
            tx,
            organizationId: organization.id,
            invoiceId: id,
            reminderDate,
            paymentDeadline:
              cleanString(body.paymentDeadline) || addReminderDays(reminderDate, 7),
            actorName,
            actorUserId: actor.id,
            source: "ui",
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      await notifyCriticalReminderCreated({
        organizationId: organization.id,
        projectId: result.invoice.projectId,
        projectLabel:
          [result.invoice.projectNumber, result.invoice.projectTitle]
            .filter(Boolean)
            .join(" · ") || result.invoice.projectId,
        invoiceNumber: result.invoice.invoiceNumber,
        documentNumber: result.reminderDocument.documentNumber,
        reminderLevel: Number(result.invoice.reminderLevel ?? 0),
        actorName,
      });
      return NextResponse.json({
        invoice: serializeInvoice(result.invoice as InvoiceRow, [], [], {
          includeInternalCosts,
        }),
        reminderDocument: result.reminderDocument,
      });
    } catch (error) {
      if (error instanceof InvoiceReminderServiceError) {
        const status =
          error.code === "not_found"
            ? 404
            : error.code === "invalid_input"
              ? 400
              : 409;
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status }
        );
      }
      throw error;
    }
  }

  if (cleanString(body.action) === "mark-printed") {
    const rows = await prisma.$queryRaw<InvoiceRow[]>`
      SELECT *
      FROM "Invoice"
      WHERE "organizationId" = ${organization.id} AND "id" = ${id}
      LIMIT 1
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "Rechnung wurde nicht gefunden." }, { status: 404 });
    }

    await addInvoiceHistory(prisma, {
      organizationId: organization.id,
      invoiceId: id,
      projectId: rows[0].projectId,
      invoiceNumber: rows[0].invoiceNumber,
      eventType: "printed",
      title: "Rechnung gedruckt",
      note: `${rows[0].invoiceNumber} wurde gedruckt bzw. zum Drucken geöffnet.`,
      actorName,
    });

    return NextResponse.json(serializeInvoice(rows[0], [], [], { includeInternalCosts }));
  }

  const lines = await withInvoiceLineCostSnapshots(organization.id, normalizeInvoiceLines(body.lines));

  if (!saveAsDraft && lines.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine Position hinzufügen." }, { status: 400 });
  }

  const billedStampEntryIds = saveAsDraft ? [] : getBilledStampEntryIds(body.billedStampEntryIds);
  const stampedHours = saveAsDraft
    ? 0
    : await getStampedHoursForInvoiceCheck({
        organizationId: organization.id,
        projectId: cleanString(body.projectId),
        stampEntryIds: billedStampEntryIds,
      });
  const invoiceLaborHours = saveAsDraft ? 0 : getInvoiceLaborHours(lines);
  const isUnderbilledStampedHours = stampedHours > 0 && invoiceLaborHours + 0.01 < stampedHours;

  if (isUnderbilledStampedHours && !body.allowUnderbilledStampedHours) {
    return NextResponse.json(
      {
        error: `Es wurden ${stampedHours.toFixed(2)} Std. gestempelt, aber nur ${invoiceLaborHours.toFixed(2)} Std. fakturiert.`,
        requiresUnderbillingConfirmation: true,
        stampedHours,
        invoiceLaborHours,
      },
      { status: 409 }
    );
  }

  const existingRows = await prisma.$queryRaw<
    Array<{ invoiceNumber: string; status: string; billingSource: string; internalContactName: string; updatedAt: Date }>
  >`
    SELECT "invoiceNumber", "status", "billingSource", "internalContactName", "updatedAt"
    FROM "Invoice"
    WHERE "organizationId" = ${organization.id} AND "id" = ${id}
    LIMIT 1
  `;
  const existingInvoice = existingRows[0];
  if (!existingInvoice) {
    return NextResponse.json({ error: "Rechnung wurde nicht gefunden." }, { status: 404 });
  }
  const expectedUpdatedAt = cleanString(body.expectedUpdatedAt);
  if (!expectedUpdatedAt || new Date(expectedUpdatedAt).getTime() !== existingInvoice.updatedAt.getTime()) {
    return NextResponse.json(
      { error: "Die Rechnung wurde zwischenzeitlich geändert. Bitte neu laden und erneut bearbeiten." },
      { status: 409 }
    );
  }
  const finalizesDraft = !saveAsDraft && existingInvoice.status === "Entwurf";

  const company = body.company === "OK immocare" ? "OK immocare" : "OK solutions";
  const requestedBillingSource = cleanString(body.billingSource);
  if (
    requestedBillingSource === "batch" &&
    !["batch", "hourly-recurring"].includes(cleanString(existingInvoice.billingSource))
  ) {
    return NextResponse.json(
      { error: "Manuelle Rechnungsentwürfe können nicht über die Stapelabrechnung fakturiert werden." },
      { status: 409 }
    );
  }
  const billingSource =
    requestedBillingSource === "batch" || requestedBillingSource === "manual"
      ? requestedBillingSource
      : cleanString(existingInvoice.billingSource) || "manual";
  const serviceDate = cleanDateKey(body.serviceDate);
  const paymentTermDays = cleanPaymentTermDays(body.paymentTermDays);
  const dueDate = getInvoiceDueDate(body, serviceDate, paymentTermDays);
  const plannedExecutionMonth = getInvoiceMonthFromInput(body);
  const internalContactName =
    cleanString(body.internalContactName) || cleanString(existingInvoice.internalContactName) || actorName;
  const pdf =
    lines.length > 0
      ? await generateInvoicePdf(
          {
            ...body,
            company,
            invoiceNumber: existingInvoice.invoiceNumber,
            internalContactName,
            documentTitle: saveAsDraft ? "Rechnungsentwurf" : "Rechnung",
          },
          lines
        )
      : { netTotal: 0, vatRate: cleanNumber(body.vatRate, 19), grossTotal: 0, pdfData: null };

  if (!saveAsDraft && billedStampEntryIds.length) await ensureInvoiceTimeEntryColumns();
  let core;
  try {
    core = await runInvoiceCrudTransaction({
      prisma,
      organizationId: organization.id,
      lockKey: `invoice:${id}`,
      operation: async (tx) => {
        const lockedRows = await tx.$queryRaw<Array<{ invoiceNumber: string; status: string; billingSource: string; internalContactName: string; updatedAt: Date }>>`
          SELECT "invoiceNumber", "status", "billingSource", "internalContactName", "updatedAt"
          FROM "Invoice"
          WHERE "organizationId" = ${organization.id} AND "id" = ${id}
          FOR UPDATE
        `;
        const lockedInvoice = lockedRows[0];
        if (!lockedInvoice) throw new InvoiceCrudConflictError("Rechnung wurde nicht gefunden.");
        if (
          lockedInvoice.invoiceNumber !== existingInvoice.invoiceNumber ||
          lockedInvoice.status !== existingInvoice.status ||
          lockedInvoice.billingSource !== existingInvoice.billingSource ||
          lockedInvoice.internalContactName !== existingInvoice.internalContactName ||
          lockedInvoice.updatedAt.getTime() !== existingInvoice.updatedAt.getTime()
        ) {
          throw new InvoiceCrudConflictError(
            "Die Rechnung wurde zwischenzeitlich geändert. Bitte neu laden und erneut bearbeiten."
          );
        }
        const rows = await tx.$queryRaw<InvoiceRow[]>`
          UPDATE "Invoice"
          SET
            "projectId" = ${cleanString(body.projectId)}, "projectNumber" = ${cleanString(body.projectNumber)},
            "projectTitle" = ${cleanString(body.projectTitle)}, "company" = ${company}, "billingSource" = ${billingSource},
            "customerName" = ${cleanString(body.customerName)}, "customerStreet" = ${cleanString(body.customerStreet)},
            "customerCity" = ${cleanString(body.customerCity)}, "contactName" = ${cleanString(body.contactName)},
            "internalContactName" = ${internalContactName}, "internalPhone" = ${cleanString(body.internalPhone)},
            "internalEmail" = ${cleanString(body.internalEmail)}, "plannedExecutionMonth" = ${plannedExecutionMonth},
            "serviceDate" = ${serviceDate}, "sourceOfferId" = ${cleanString(body.sourceOfferId)},
            "sourceOfferNumber" = ${cleanString(body.sourceOfferNumber)}, "introText" = ${cleanString(body.introText)},
            "closingText" = ${cleanString(body.closingText)}, "discountPercent" = ${cleanPercent(body.discountPercent)},
            "paymentTermDays" = ${paymentTermDays}, "dueDate" = ${dueDate}, "netTotal" = ${pdf.netTotal},
            "vatRate" = ${pdf.vatRate}, "grossTotal" = ${pdf.grossTotal}, "pdfData" = ${pdf.pdfData},
            "status" = CASE WHEN ${saveAsDraft} THEN 'Entwurf' WHEN "status" = 'Entwurf' THEN 'Fakturiert' ELSE "status" END,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "organizationId" = ${organization.id} AND "id" = ${id}
          RETURNING *
        `;
        const persisted = await persistInvoiceLines(tx, {
          organizationId: organization.id,
          invoiceId: id,
          lines,
          replaceExisting: true,
        });
        await addInvoiceHistory(tx, {
          organizationId: organization.id,
          invoiceId: id,
          projectId: cleanString(body.projectId),
          invoiceNumber: existingInvoice.invoiceNumber,
          eventType: "updated",
          title: saveAsDraft
            ? "Rechnungsentwurf gespeichert"
            : finalizesDraft
              ? "Rechnung fakturiert"
              : "Rechnung bearbeitet",
          note: `${existingInvoice.invoiceNumber} wurde ${
            saveAsDraft ? "als Entwurf gespeichert" : finalizesDraft ? "fakturiert" : "aktualisiert"
          }.`,
          actorName,
        });
        if (!saveAsDraft) {
          await markStampedHoursAsInvoiced(tx, {
            organizationId: organization.id,
            projectId: cleanString(body.projectId),
            invoiceId: id,
            invoiceNumber: existingInvoice.invoiceNumber,
            stampEntryIds: billedStampEntryIds,
          });
        }
        await syncInvoiceInventoryMovements({
          db: tx,
          organizationId: organization.id,
          invoiceId: id,
          actorUserId: actor.id,
          actorName,
          useExistingTransaction: true,
        });
        return { row: rows[0], ...persisted };
      },
    });
  } catch (error) {
    if (error instanceof InvoiceCrudConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  const { row, savedLines, savedLaborRows } = core;

  if (!saveAsDraft && isUnderbilledStampedHours && !body.suppressUnderbillingNotification) {
    await notifyManagementAboutUnderbilling({
      organizationId: organization.id,
      projectId: cleanString(body.projectId),
      projectLabel: `${cleanString(body.projectNumber)} | ${cleanString(body.projectTitle)}`,
      invoiceNumber: existingInvoice.invoiceNumber,
      stampedHours,
      invoiceHours: invoiceLaborHours,
    });
  }

  await externalizePdfPayload({
    organizationId: organization.id,
    ownerType: "invoice",
    ownerId: id,
    sourceType: "invoice-pdf",
    category: "invoices",
    originalName: `${existingInvoice.invoiceNumber}.pdf`,
    pdfBase64: pdf.pdfData,
    createdByUserId: actor.id,
    writeReference: (tx, reference) =>
      tx.invoice.update({ where: { id }, data: { pdfData: reference } }),
  });

  return NextResponse.json(serializeInvoice(row, savedLines, savedLaborRows, { includeInternalCosts }));
}

export async function DELETE(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureInvoiceTables();
  const body = await req.json().catch(() => ({}));
  const id = cleanString(body.id);
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const includeInternalCosts = canViewInternalCostData(actor);
  const actorName = getUserName(actor);
  const reason = cleanString(body.reason);

  if (!id) {
    return NextResponse.json({ error: "Rechnung fehlt." }, { status: 400 });
  }

  if (!canDeleteInvoices(actor)) {
    return NextResponse.json(
      { error: "Nur Gesch\u00e4ftsf\u00fchrer d\u00fcrfen Rechnungen l\u00f6schen." },
      { status: 403 }
    );
  }

  try {
    const invoice = await prisma.$transaction(
      (tx) => executeInvoiceLifecycle({
        tx,
        organizationId: organization.id,
        invoiceId: id,
        action: "delete",
        reason,
        actorId: actor.id,
        actorName,
        source: "ui",
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json(serializeInvoice(invoice as InvoiceRow, [], [], { includeInternalCosts }));
  } catch (error) {
    if (error instanceof InvoiceLifecycleServiceError) {
      const status = error.code === "not_found" ? 404 : error.code === "blocked" || error.code === "invalid_input" ? 400 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Die Rechnung konnte nicht sicher gelöscht werden." }, { status: 500 });
  }
}


