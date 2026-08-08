import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { shouldAttemptHourlyDraftAttachment } from "@/lib/billing/hourly-stamp-automation";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import {
  executeStampSessionTransition,
  StampSessionServiceError,
} from "@/lib/time/stamp-session-service";
import { executeStampSessionStart } from "@/lib/time/stamp-session-start-service";
import {
  evaluateStampSessionSwitch,
  executeStampSessionSwitch,
} from "@/lib/time/stamp-session-switch-service";
import {
  evaluateStampSessionStop,
  executeStampSessionStop,
  type StampSessionStopEntry,
  type StampSessionStopInput,
} from "@/lib/time/stamp-session-stop-service";
import { ensureStampInterruptionFollowup } from "@/lib/time/stamp-session-interruption-service";
import { attachStampEntryToHourlyInvoiceDraft as attachStampEntryToHourlyInvoiceDraftShared } from "@/lib/time/stamp-session-billing-service";
import {
  applyFinalInspectionBillingStatus,
  createFinalInspection,
  FinalInspectionServiceError,
} from "@/lib/projects/final-inspection-service";

type DemoUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  teamId?: string | null;
};

type ActiveStampSessionRow = {
  id: string;
  organizationId: string;
  userId: string;
  employee: string | null;
  mode: string;
  projectId: string;
  projectLabel: string | null;
  trade: string | null;
  planningEntryId: string | null;
  planningBillingGroupId: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  marketingContentItemId: string | null;
  marketingContentTitle: string | null;
  marketingContentType: string | null;
  comment: string | null;
  startedAt: Date;
  accumulatedMs: bigint | number;
  pauseStartedAt: Date | null;
  pauseMs: bigint | number;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  contactId?: string | null;
  addressContactId?: string | null;
  address?: string | null;
  projectType?: string | null;
  branch?: string | null;
  responsibleName: string | null;
};

type AutoInvoiceContactRow = {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  mainContactName: string | null;
  street: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  paymentTermDays: number | null;
  hasDifferentBillingAddress: boolean;
  billingName: string | null;
  billingStreet: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
};

type CatalogInvoiceItemRow = {
  id: string;
  type: string;
  number: string;
  name: string;
  unit: string;
  salesPrice: number;
  vatRate: number;
  laborCostRateKey: string | null;
};

type AutoInvoiceDraftRow = {
  id: string;
  invoiceNumber: string;
  company?: string | null;
  customerName?: string | null;
  customerStreet?: string | null;
  customerCity?: string | null;
  contactName?: string | null;
  internalContactName?: string | null;
  serviceDate?: string | null;
  paymentTermDays?: number | null;
  dueDate?: string | null;
};

type AutoInvoiceLineRow = {
  id: string;
};

let activeStampSessionTablePromise: Promise<void> | null = null;
let projectTimeEntryTablePromise: Promise<void> | null = null;

async function ensureActiveStampSessionTableOnce() {
  const existingTable = await prisma.$queryRaw<Array<{ exists: string | null }>>`
    SELECT to_regclass('"ActiveStampSession"')::text as "exists"
  `;

  if (!existingTable[0]?.exists) {
    await prisma.$executeRaw`
      CREATE TABLE "ActiveStampSession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "employee" TEXT,
      "mode" TEXT NOT NULL DEFAULT 'project',
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "trade" TEXT,
      "planningEntryId" TEXT,
      "planningBillingGroupId" TEXT,
      "billingCatalogItemId" TEXT,
      "billingCatalogItemLabel" TEXT,
      "startedAt" TIMESTAMP(3) NOT NULL,
        "accumulatedMs" BIGINT NOT NULL DEFAULT 0,
        "pauseStartedAt" TIMESTAMP(3),
        "pauseMs" BIGINT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  await prisma.$executeRaw`
    ALTER TABLE "ActiveStampSession"
    ADD COLUMN IF NOT EXISTS "employee" TEXT,
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "projectLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "trade" TEXT,
    ADD COLUMN IF NOT EXISTS "planningEntryId" TEXT,
    ADD COLUMN IF NOT EXISTS "planningBillingGroupId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentTitle" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentType" TEXT,
    ADD COLUMN IF NOT EXISTS "comment" TEXT,
    ADD COLUMN IF NOT EXISTS "accumulatedMs" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "pauseStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "pauseMs" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "ActiveStampSession_organizationId_userId_key"
    ON "ActiveStampSession" ("organizationId", "userId")
  `;
}

async function ensureActiveStampSessionTable() {
  activeStampSessionTablePromise ??= ensureActiveStampSessionTableOnce().catch((error) => {
    activeStampSessionTablePromise = null;
    throw error;
  });

  return activeStampSessionTablePromise;
}

async function ensureProjectTimeEntryTableOnce() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectTimeEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'project',
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "trade" TEXT,
      "planningEntryId" TEXT,
      "planningBillingGroupId" TEXT,
      "billingCatalogItemId" TEXT,
      "billingCatalogItemLabel" TEXT,
      "userId" TEXT,
      "employee" TEXT,
      "entrySource" TEXT NOT NULL DEFAULT 'stamped',
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMs" BIGINT NOT NULL DEFAULT 0,
      "pauseMs" BIGINT NOT NULL DEFAULT 0,
      "laborCostRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "costSnapshotAt" TIMESTAMP(3),
      "comment" TEXT,
      "invoiceId" TEXT,
      "invoiceNumber" TEXT,
      "invoicedAt" TIMESTAMP(3),
      "completionStatus" TEXT,
      "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'not_required',
      "overtimeApprovedByUserId" TEXT,
      "overtimeApprovedByName" TEXT,
      "overtimeApprovedAt" TIMESTAMP(3),
      "editHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "userId" TEXT,
    ADD COLUMN IF NOT EXISTS "trade" TEXT,
    ADD COLUMN IF NOT EXISTS "planningEntryId" TEXT,
    ADD COLUMN IF NOT EXISTS "planningBillingGroupId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "entrySource" TEXT NOT NULL DEFAULT 'stamped',
    ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "laborCostRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "costSnapshotAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentType" TEXT,
    ADD COLUMN IF NOT EXISTS "completionStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "editHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)
  `;
}

async function ensureProjectTimeEntryTable() {
  projectTimeEntryTablePromise ??= ensureProjectTimeEntryTableOnce().catch((error) => {
    projectTimeEntryTablePromise = null;
    throw error;
  });

  return projectTimeEntryTablePromise;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: Pick<DemoUser, "firstName" | "lastName" | "email">) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function normalizePersonName(value: unknown) {
  return cleanString(value).toLowerCase().replace(/\s+/g, " ");
}

function addDaysAtNoon(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, days));
  date.setHours(12, 0, 0, 0);
  return date;
}

async function getProjectForInterruptedStamp(organizationId: string, projectId: string) {
  const rows = await prisma.$queryRaw<ProjectRow[]>`
    SELECT id, "projectNumber", title, customer, "contactId", "addressContactId", address,
           "projectType", branch, "responsibleName"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND id = ${projectId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getProjectForHourlyInvoiceDraft(organizationId: string, projectId: string) {
  return getProjectForInterruptedStamp(organizationId, projectId);
}

function roundStampDurationToBillingFactor(durationMs: bigint | number, roundingFactorHours: number) {
  const hours = Number(durationMs || 0) / 3_600_000;
  if (hours <= 0) return 0;
  const factor = [0.25, 0.5, 1].includes(roundingFactorHours) ? roundingFactorHours : 0.5;
  return Math.ceil(hours / factor) * factor;
}

function getProjectInvoiceCompany(project: ProjectRow) {
  const projectType = cleanString(project.projectType).toLowerCase();
  const branch = cleanString(project.branch).toLowerCase();
  const projectNumber = cleanString(project.projectNumber).toLowerCase();
  return projectType.includes("immocare") || branch.includes("immocare") || projectNumber.startsWith("oki")
    ? "OK immocare"
    : "OK solutions";
}

function getMonthKeyFromDateKey(dateKey: string) {
  return cleanString(dateKey).slice(0, 7);
}

function cleanPaymentTermDays(value: unknown) {
  if (value === null || value === undefined || value === "") return 14;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 14;
  return Math.min(Math.max(parsed, 0), 365);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const parts = cleanString(dateKey).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return "";
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  date.setDate(date.getDate() + cleanPaymentTermDays(days));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function getAutoInvoiceContact(organizationId: string, project: ProjectRow) {
  const contactId = cleanString(project.contactId);
  const addressContactId = cleanString(project.addressContactId);
  if (!contactId && !addressContactId) return null;

  const rows = await prisma.$queryRaw<AutoInvoiceContactRow[]>`
    SELECT "companyName", "firstName", "lastName", "mainContactName", street,
           "addressLine1", "addressLine2", "postalCode", city, "paymentTermDays",
           "hasDifferentBillingAddress", "billingName", "billingStreet", "billingAddressLine1",
           "billingAddressLine2", "billingPostalCode", "billingCity"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
      AND id IN (${contactId || "__no_contact__"}, ${addressContactId || "__no_address_contact__"})
    ORDER BY CASE WHEN id = ${addressContactId || "__no_address_contact__"} THEN 0 ELSE 1 END,
             "isInvoiceRecipient" DESC,
             "isMainContact" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function getAutoInvoiceContactDefaults(project: ProjectRow, contact: AutoInvoiceContactRow | null) {
  const contactPersonName = [contact?.firstName, contact?.lastName].map(cleanString).filter(Boolean).join(" ");
  const useBillingAddress = Boolean(contact?.hasDifferentBillingAddress);
  const customerName = cleanString(useBillingAddress ? contact?.billingName : contact?.companyName) || cleanString(project.customer) || contactPersonName;
  const customerStreet = (useBillingAddress
    ? [contact?.billingStreet, contact?.billingAddressLine1, contact?.billingAddressLine2]
    : [contact?.street, contact?.addressLine1, contact?.addressLine2])
    .map(cleanString)
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
    .join(", ") || cleanString(project.address).split(",")[0] || "";
  const customerCity = (useBillingAddress ? [contact?.billingPostalCode, contact?.billingCity] : [contact?.postalCode, contact?.city]).map(cleanString).filter(Boolean).join(" ") ||
    cleanString(project.address).split(",").slice(1).join(",").trim();

  return {
    customerName,
    customerStreet,
    customerCity,
    contactName: cleanString(contact?.mainContactName) || contactPersonName,
    internalContactName: cleanString(project.responsibleName),
    paymentTermDays: cleanPaymentTermDays(contact?.paymentTermDays),
  };
}

function getCleanInvoiceLineTitle(catalogItem: CatalogInvoiceItemRow) {
  return `${catalogItem.number} | ${catalogItem.name}`;
}

async function getNextAutoInvoiceNumber(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ invoiceNumber: string }>>`
    SELECT "invoiceNumber"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId}
      AND "invoiceNumber" LIKE 'RE-%'
  `;
  const highest = rows
    .map((row) => Number(cleanString(row.invoiceNumber).match(/^RE-(\d+)$/)?.[1] ?? "10099"))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 10099);
  return `RE-${highest + 1}`;
}

async function getCatalogInvoiceItem(organizationId: string, catalogItemId: string) {
  if (!catalogItemId) return null;
  const rows = await prisma.$queryRaw<CatalogInvoiceItemRow[]>`
    SELECT id, type, number, name, unit, "salesPrice", "vatRate", "laborCostRateKey"
    FROM "CatalogItem"
    WHERE "organizationId" = ${organizationId}
      AND id = ${catalogItemId}
      AND "isActive" = true
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getOrCreateHourlyInvoiceDraft(input: {
  organizationId: string;
  project: ProjectRow;
  monthKey: string;
  serviceDate: string;
}) {
  const company = getProjectInvoiceCompany(input.project);
  const contact = await getAutoInvoiceContact(input.organizationId, input.project);
  const defaults = getAutoInvoiceContactDefaults(input.project, contact);
  const dueDate = addDaysToDateKey(input.serviceDate, defaults.paymentTermDays);
  const existingRows = await prisma.$queryRaw<AutoInvoiceDraftRow[]>`
    SELECT id, "invoiceNumber", company, "customerName", "customerStreet", "customerCity",
           "contactName", "internalContactName", "serviceDate", "paymentTermDays", "dueDate"
    FROM "Invoice"
    WHERE "organizationId" = ${input.organizationId}
      AND "projectId" = ${input.project.id}
      AND status = 'Entwurf'
      AND "billingSource" = 'hourly-recurring'
      AND "plannedExecutionMonth" = ${input.monthKey}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;
  if (existingRows[0]) {
    await prisma.$executeRaw`
      UPDATE "Invoice"
      SET company = ${company},
          "customerName" = CASE WHEN COALESCE("customerName", '') = '' THEN ${defaults.customerName} ELSE "customerName" END,
          "customerStreet" = CASE WHEN COALESCE("customerStreet", '') = '' THEN ${defaults.customerStreet} ELSE "customerStreet" END,
          "customerCity" = CASE WHEN COALESCE("customerCity", '') = '' THEN ${defaults.customerCity} ELSE "customerCity" END,
          "contactName" = CASE WHEN COALESCE("contactName", '') = '' THEN ${defaults.contactName} ELSE "contactName" END,
          "internalContactName" = CASE WHEN COALESCE("internalContactName", '') = '' THEN ${defaults.internalContactName} ELSE "internalContactName" END,
          "serviceDate" = CASE WHEN COALESCE("serviceDate", '') = '' THEN ${input.serviceDate} ELSE "serviceDate" END,
          "paymentTermDays" = CASE WHEN COALESCE("serviceDate", '') = '' THEN ${defaults.paymentTermDays} ELSE "paymentTermDays" END,
          "dueDate" = CASE WHEN COALESCE("dueDate", '') = '' THEN ${dueDate} ELSE "dueDate" END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${input.organizationId}
        AND id = ${existingRows[0].id}
    `;
    return existingRows[0];
  }

  const invoiceNumber = await getNextAutoInvoiceNumber(input.organizationId);
  const invoiceId = randomUUID();
  const customerName = cleanString(input.project.customer);
  await prisma.$executeRaw`
    INSERT INTO "Invoice" (
      "id", "organizationId", "projectId", "projectNumber", "projectTitle", "company",
      "invoiceNumber", "status", "billingSource", "customerName", "customerStreet", "customerCity",
      "contactName", "internalContactName", "plannedExecutionMonth",
      "serviceDate", "introText", "closingText", "discountPercent", "paymentTermDays",
      "dueDate", "netTotal", "vatRate", "grossTotal", "pdfData", "updatedAt"
    ) VALUES (
      ${invoiceId}, ${input.organizationId}, ${input.project.id}, ${input.project.projectNumber || input.project.id},
      ${input.project.title}, ${company}, ${invoiceNumber}, ${"Entwurf"}, ${"hourly-recurring"},
      ${defaults.customerName || customerName}, ${defaults.customerStreet}, ${defaults.customerCity},
      ${defaults.contactName}, ${defaults.internalContactName}, ${input.monthKey}, ${input.serviceDate},
      ${"wir stellen Ihnen folgende Leistungen in Rechnung."}, ${""}, ${0}, ${defaults.paymentTermDays},
      ${dueDate}, ${0}, ${19}, ${0}, ${null}, CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "InvoiceHistory" (
      id, "organizationId", "invoiceId", "projectId", "invoiceNumber",
      "eventType", title, note, "actorName"
    ) VALUES (
      ${randomUUID()}, ${input.organizationId}, ${invoiceId}, ${input.project.id}, ${invoiceNumber},
      ${"created"}, ${"Rechnungsentwurf automatisch angelegt"},
      ${"Automatisch aus der ersten Stempelung eines Dauerläufers mit Stundenabrechnung erzeugt."},
      ${"System"}
    )
  `;

  return { id: invoiceId, invoiceNumber };
}

async function recalculateHourlyInvoiceDraftTotals(organizationId: string, invoiceId: string) {
  const rows = await prisma.$queryRaw<Array<{ netTotal: number; vatRate: number }>>`
    SELECT COALESCE(SUM("totalNet"), 0)::float AS "netTotal",
           COALESCE(MAX("vatRate"), 19)::float AS "vatRate"
    FROM "InvoiceLine"
    WHERE "organizationId" = ${organizationId}
      AND "invoiceId" = ${invoiceId}
  `;
  const netTotal = roundMoney(Number(rows[0]?.netTotal || 0));
  const vatRate = Number(rows[0]?.vatRate || 19);
  const grossTotal = roundMoney(netTotal * (1 + vatRate / 100));

  await prisma.$executeRaw`
    UPDATE "Invoice"
    SET "netTotal" = ${netTotal},
        "vatRate" = ${vatRate},
        "grossTotal" = ${grossTotal},
        "pdfData" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organizationId}
      AND id = ${invoiceId}
  `;
}

async function attachStampEntryToHourlyInvoiceDraft(input: {
  organizationId: string;
  users: DemoUser[];
  entry: StampSessionStopEntry;
}) {
  if (input.entry.mode !== "project") return null;
  if (!input.entry.projectId || !input.entry.billingCatalogItemId || !input.entry.billingCatalogItemLabel) return null;
  if (cleanString(input.entry.invoiceId)) {
    return {
      invoiceId: cleanString(input.entry.invoiceId),
      invoiceNumber: cleanString(input.entry.invoiceNumber),
    };
  }
  if (!(await isHourlyRecurringProject(input.organizationId, input.entry.projectId))) return null;

  const project = await getProjectForHourlyInvoiceDraft(input.organizationId, input.entry.projectId);
  const catalogItem = await getCatalogInvoiceItem(input.organizationId, input.entry.billingCatalogItemId);
  const monthKey = getMonthKeyFromDateKey(input.entry.date);
  if (!project || !catalogItem || !monthKey) return null;

  const deadlineSettings = await getDeadlineSettings(input.organizationId);
  const roundedHours = roundStampDurationToBillingFactor(
    input.entry.durationMs,
    deadlineSettings.hourlyBillingRoundingFactorHours
  );
  if (roundedHours <= 0) return null;

  const draft = await getOrCreateHourlyInvoiceDraft({
    organizationId: input.organizationId,
    project,
    monthKey,
    serviceDate: input.entry.date,
  });
  const lineTitle = getCleanInvoiceLineTitle(catalogItem);
  const existingLineRows = await prisma.$queryRaw<AutoInvoiceLineRow[]>`
    SELECT id
    FROM "InvoiceLine"
    WHERE "organizationId" = ${input.organizationId}
      AND "invoiceId" = ${draft.id}
      AND "catalogItemId" = ${catalogItem.id}
      AND title = ${lineTitle}
    ORDER BY position ASC
    LIMIT 1
  `;

  const currentMaxPositionRows = await prisma.$queryRaw<Array<{ position: number }>>`
    SELECT COALESCE(MAX(position), 0)::int AS position
    FROM "InvoiceLine"
    WHERE "organizationId" = ${input.organizationId}
      AND "invoiceId" = ${draft.id}
  `;
  const invoiceLineId = existingLineRows[0]?.id || randomUUID();
  const unitPrice = Number(catalogItem.salesPrice || 0);
  const vatRate = Number(catalogItem.vatRate || 19);

  if (!existingLineRows[0]) {
    await prisma.$executeRaw`
      INSERT INTO "InvoiceLine" (
        id, "organizationId", "invoiceId", "catalogItemId", "catalogType", "isLaborPosition", position,
        quantity, unit, title, description, "unitPrice", "discountPercent",
        "materialUnitCostSnapshot", "materialCostSnapshot", "costSnapshotAt",
        "vatRate", "totalNet", "updatedAt"
      ) VALUES (
        ${invoiceLineId}, ${input.organizationId}, ${draft.id}, ${catalogItem.id}, ${catalogItem.type}, ${true},
        ${Number(currentMaxPositionRows[0]?.position || 0) + 1},
        ${0}, ${catalogItem.unit || "Std"}, ${lineTitle}, ${""}, ${unitPrice}, ${0},
        ${0}, ${0}, CURRENT_TIMESTAMP, ${vatRate}, ${0}, CURRENT_TIMESTAMP
      )
    `;
  }

  const employeeName =
    input.entry.employee ||
    input.users.find((user) => user.id === input.entry.userId)?.firstName ||
    "Mitarbeiter";
  const hourlyCostRate = Number(input.entry.laborCostRateSnapshot || 0);
  await prisma.$executeRaw`
    INSERT INTO "InvoiceLineLabor" (
      id, "organizationId", "invoiceId", "invoiceLineId", "userId", "employeeName",
      "plannedHours", "hourlyCostRate", "totalCost", position, "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${input.organizationId}, ${draft.id}, ${invoiceLineId},
      ${input.entry.userId || ""}, ${employeeName}, ${roundedHours}, ${hourlyCostRate},
      ${roundMoney(roundedHours * hourlyCostRate)}, 0, CURRENT_TIMESTAMP
    )
  `;

  const aggregateRows = await prisma.$queryRaw<Array<{ hours: number; cost: number }>>`
    SELECT COALESCE(SUM("plannedHours"), 0)::float AS hours,
           COALESCE(SUM("totalCost"), 0)::float AS cost
    FROM "InvoiceLineLabor"
    WHERE "organizationId" = ${input.organizationId}
      AND "invoiceLineId" = ${invoiceLineId}
  `;
  const quantity = Number(aggregateRows[0]?.hours || 0);
  const materialCost = Number(aggregateRows[0]?.cost || 0);
  await prisma.$executeRaw`
    UPDATE "InvoiceLine"
    SET quantity = ${quantity},
        "materialCostSnapshot" = ${roundMoney(materialCost)},
        "totalNet" = ${roundMoney(quantity * unitPrice)},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${input.organizationId}
      AND id = ${invoiceLineId}
  `;

  await recalculateHourlyInvoiceDraftTotals(input.organizationId, draft.id);

  await prisma.$executeRaw`
    UPDATE "ProjectTimeEntry"
    SET "invoiceId" = ${draft.id},
        "invoiceNumber" = ${draft.invoiceNumber},
        "invoicedAt" = NULL
    WHERE "organizationId" = ${input.organizationId}
      AND id = ${input.entry.id}
      AND COALESCE("invoiceId", '') = ''
  `;

  return {
    invoiceId: draft.id,
    invoiceNumber: draft.invoiceNumber,
  };
}

function findInterruptedWorkResponsibleUser(users: DemoUser[], project: ProjectRow | null) {
  const responsibleName = normalizePersonName(project?.responsibleName);
  return responsibleName
    ? users.find((user) => user.isActive && normalizePersonName(getUserName(user)) === responsibleName)
    : null;
}

function findInterruptedWorkFallbackOwner(users: DemoUser[]) {
  return (
    users.find((user) => user.isActive && user.role === Role.GESCHAEFTSFUEHRER) ??
    users.find((user) => user.isActive && user.role === Role.ADMIN) ??
    users.find((user) => user.isActive)
  );
}

function findInterruptedWorkOwner(users: DemoUser[], project: ProjectRow | null) {
  return findInterruptedWorkResponsibleUser(users, project) ?? findInterruptedWorkFallbackOwner(users);
}

function findInterruptedWorkParticipants(users: DemoUser[], owner: DemoUser, entry: StampSessionStopEntry) {
  const excludedUserIds = new Set([owner.id, entry.userId].filter(Boolean));
  const leadershipParticipants = users.filter(
    (user) => user.isActive && user.role === Role.FUEHRUNGSKRAFT && !excludedUserIds.has(user.id)
  );

  if (leadershipParticipants.length > 0) return leadershipParticipants;

  return users.filter(
    (user) => user.isActive && user.role === Role.GESCHAEFTSFUEHRER && !excludedUserIds.has(user.id)
  );
}

function findInterruptedWorkManagementRecipients(users: DemoUser[]) {
  return users.filter(
    (user) => user.isActive && (user.role === Role.GESCHAEFTSFUEHRER || user.role === Role.ADMIN)
  );
}

async function createInterruptedWorkNotification(input: {
  organizationId: string;
  taskId: string;
  userId: string;
  subject: string;
  body: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      taskId: input.taskId,
      userId: input.userId,
      channel: "app",
      subject: input.subject,
      body: input.body,
      sentAt: null,
      linkTarget: "task",
      linkTargetId: input.taskId,
      linkLabel: "Aufgabe oeffnen",
    },
  });

  await sendNotificationMailSafely({
    notificationId: notification.id,
    userId: input.userId,
    subject: input.subject,
    body: input.body,
  });
}

async function ensureInterruptedWorkTask(input: {
  organizationId: string;
  users: DemoUser[];
  project: ProjectRow | null;
  entry: StampSessionStopEntry;
  comment: string;
}) {
  const owner = findInterruptedWorkOwner(input.users, input.project);
  if (!owner) return;

  const existingRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Task"
    WHERE "organizationId" = ${input.organizationId}
      AND "projectId" = ${input.entry.projectId}
      AND description LIKE ${`%Stempelung: ${input.entry.id}%`}
    LIMIT 1
  `;
  if (existingRows.length > 0) return;

  const taskId = randomUUID();
  const projectLabel =
    input.project?.projectNumber && input.project?.title
      ? `${input.project.projectNumber} | ${input.project.title}`
      : input.entry.projectLabel || input.entry.projectId;
  const description = [
    "Quelle: Unterbrochene Arbeit",
    "Eine Projektarbeit wurde als unterbrochen gestempelt.",
    `Projekt: ${projectLabel}`,
    `Mitarbeiter: ${input.entry.employee || "-"}`,
    `Datum: ${input.entry.date} ${input.entry.startTime}-${input.entry.endTime}`,
    `Kommentar: ${input.comment}`,
    `Stempelung: ${input.entry.id}`,
  ].join("\n");

  await prisma.$executeRaw`
    INSERT INTO "Task" (
      id,
      "organizationId",
      title,
      description,
      status,
      priority,
      deadline,
      customer,
      "projectId",
      "ownerId",
      "teamId",
      "createdById",
      "acceptanceStatus",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${taskId},
      ${input.organizationId},
      ${`Unterbrochene Arbeit klären: ${projectLabel}`},
      ${description},
      'OFFEN',
      'HOCH',
      ${addDaysAtNoon(0)},
      ${input.project?.customer || null},
      ${input.entry.projectId},
      ${owner.id},
      ${owner.teamId ?? null},
      ${owner.id},
      'accepted',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  const participants = findInterruptedWorkParticipants(input.users, owner, input.entry);
  for (const participant of participants) {
    await prisma.$executeRaw`
      INSERT INTO "TaskParticipant" (id, "organizationId", "taskId", "userId", "acceptanceStatus")
      VALUES (${randomUUID()}, ${input.organizationId}, ${taskId}, ${participant.id}, 'pending')
      ON CONFLICT ("taskId", "userId") DO NOTHING
    `;
  }

  const recipientIds = new Set<string>([
    owner.id,
    ...participants.map((participant) => participant.id),
    ...findInterruptedWorkManagementRecipients(input.users).map((user) => user.id),
  ]);
  const subject = "Kritisch: Unterbrochene Arbeit klaeren";
  const body = [
    "Eine Projektarbeit wurde als unterbrochen gestempelt und braucht aktive Klaerung.",
    `Projekt: ${projectLabel}`,
    `Mitarbeiter: ${input.entry.employee || "-"}`,
    `Datum: ${input.entry.date} ${input.entry.startTime}-${input.entry.endTime}`,
    `Kommentar: ${input.comment}`,
    "Bitte Ursache klaeren, weitere Planung entscheiden und die Aufgabe erst danach abschliessen.",
  ].join("\n");

  for (const userId of recipientIds) {
    await createInterruptedWorkNotification({
      organizationId: input.organizationId,
      taskId,
      userId,
      subject,
      body,
    });
  }
}

function toMillis(value: bigint | number) {
  return Number(value);
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function isHourlyRecurringProject(organizationId: string, projectId: string) {
  if (!projectId || projectId === "__unproductive__") return false;

  const rows = await prisma.$queryRaw<Array<{ projectKind: string | null; recurringBillingMode: string | null }>>`
    SELECT "projectKind", "recurringBillingMode"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  const project = rows[0];
  if (!project) return false;

  return (
    project.recurringBillingMode === "hourly" &&
    (project.projectKind ?? "").toLowerCase().includes("dauerl")
  );
}

function formatDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function timeToMinutes(value: string | null) {
  const match = (value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getBerlinOffsetMs(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const berlinTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return berlinTimeAsUtc - Math.floor(timestampMs / 1000) * 1000;
}

function normalizeStoredStampDate(date: Date | null, nowMs = Date.now()) {
  if (!date) return null;

  const timestampMs = date.getTime();
  if (!Number.isFinite(timestampMs) || timestampMs <= nowMs + 60_000) return date;

  const correctedTimestampMs = timestampMs - getBerlinOffsetMs(timestampMs);
  if (correctedTimestampMs <= nowMs + 60_000) return new Date(correctedTimestampMs);

  return date;
}

function formatSession(row: ActiveStampSessionRow | null) {
  if (!row) return null;
  const startedAt = normalizeStoredStampDate(row.startedAt) ?? row.startedAt;
  const pauseStartedAt = normalizeStoredStampDate(row.pauseStartedAt);

  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    employee: row.employee ?? "",
    mode: row.mode === "unproductive" ? "unproductive" : "project",
    projectId: row.projectId,
    projectLabel: row.projectLabel ?? "",
    trade: row.trade ?? "",
    planningEntryId: row.planningEntryId ?? "",
    planningBillingGroupId: row.planningBillingGroupId ?? "",
    billingCatalogItemId: row.billingCatalogItemId ?? "",
    billingCatalogItemLabel: row.billingCatalogItemLabel ?? "",
    marketingContentItemId: row.marketingContentItemId ?? "",
    marketingContentTitle: row.marketingContentTitle ?? "",
    marketingContentType: row.marketingContentType ?? "",
    comment: row.comment ?? "",
    startedAt: startedAt.toISOString(),
    accumulatedMs: toMillis(row.accumulatedMs),
    pauseStartedAt: pauseStartedAt?.toISOString() ?? null,
    pauseMs: toMillis(row.pauseMs),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getActiveSession(organizationId: string, userId: string) {
  const rows = await prisma.$queryRaw<ActiveStampSessionRow[]>`
    SELECT *
    FROM "ActiveStampSession"
    WHERE "organizationId" = ${organizationId}
      AND "userId" = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = cleanString(searchParams.get("userId"));

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();

  if (!userId) {
    const actorResult = await getSessionBoundActor(req, users, null);
    if (!actorResult.ok) {
      return sessionBoundActorResponse(actorResult);
    }

    const sessions = await prisma.$queryRaw<ActiveStampSessionRow[]>`
      SELECT *
      FROM "ActiveStampSession"
      WHERE "organizationId" = ${organization.id}
      ORDER BY "startedAt" DESC
    `;

    return NextResponse.json(sessions.map(formatSession));
  }

  const actorResult = await getSessionBoundActor(req, users, userId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const session = await getActiveSession(organization.id, actorResult.actor.id);

  return NextResponse.json(formatSession(session));
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = cleanString(body.action);

  if (action === "change") {
    return changeSession(req, body);
  }

  if (action === "stop") {
    return stopSession(req, body);
  }

  if (action !== "start") {
    return NextResponse.json({ error: "Unbekannte Stempelaktion." }, { status: 400 });
  }

  const userId = cleanString(body.userId);
  const mode = cleanString(body.mode) === "unproductive" ? "unproductive" : "project";
  const projectId = cleanString(body.projectId) || (mode === "unproductive" ? "__unproductive__" : "");
  const trade = mode === "project" ? cleanString(body.trade) : "";
  const requestedPlanningEntryId = mode === "project" ? cleanString(body.planningEntryId) : "";
  const requestedPlanningBillingGroupId = mode === "project" ? cleanString(body.planningBillingGroupId) : "";
  const requestedBillingCatalogItemId = mode === "project" ? cleanString(body.billingCatalogItemId) : "";
  const confirmImplementationStatus = mode === "project" && body.confirmImplementationStatus === true;
  const comment = cleanString(body.comment);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Bitte ein Projekt angeben." }, { status: 400 });
  }

  if (!comment) {
    return NextResponse.json({ error: "Bitte kurz eintragen, was du gerade machst." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();

  const stampUserResult = await getSessionBoundActor(req, users, userId);
  if (!stampUserResult.ok) {
    return sessionBoundActorResponse(stampUserResult);
  }
  const stampUser = stampUserResult.actor;
  try {
    const sharedStart = await executeStampSessionStart({
      organizationId: organization.id,
      userId: stampUser.id,
      actorName: getUserName(stampUser),
      start: {
        mode,
        projectId,
        unproductiveLabel:
          mode === "unproductive" ? cleanString(body.projectLabel) : "",
        comment,
        trade,
        planningEntryId: requestedPlanningEntryId,
        planningBillingGroupId: requestedPlanningBillingGroupId,
        billingCatalogItemId: requestedBillingCatalogItemId,
        marketingContentItemId: cleanString(body.marketingContentItemId),
        marketingContentTitle: cleanString(body.marketingContentTitle),
        marketingContentType: cleanString(body.marketingContentType),
        confirmImplementationStatus,
      },
      requestId: randomUUID(),
      source: "ui",
    });
    return NextResponse.json(
      {
        ...sharedStart.session,
        projectStatusTransition: sharedStart.evaluation.statusTransition
          ? {
              changed: true,
              projectId: sharedStart.evaluation.project?.id ?? "",
              previousStatus:
                sharedStart.evaluation.statusTransition.fromStatus,
              nextStatus: sharedStart.evaluation.statusTransition.toStatus,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof StampSessionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

}

async function changeSession(req: Request, body: Record<string, unknown>) {
  const userId = cleanString(body.userId);
  const requestId = cleanString(body.requestId) || randomUUID();
  const next = body.next && typeof body.next === "object" ? body.next as Record<string, unknown> : {};
  const nextMode: "project" | "unproductive" = cleanString(next.mode) === "unproductive" ? "unproductive" : "project";
  const nextProjectId = cleanString(next.projectId) || (nextMode === "unproductive" ? "__unproductive__" : "");
  const nextComment = cleanString(next.comment);
  if (!userId) return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  if (!nextProjectId) return NextResponse.json({ error: "Bitte ein Folgeprojekt angeben." }, { status: 400 });
  if (!nextComment) return NextResponse.json({ error: "Bitte die Folgetätigkeit angeben." }, { status: 400 });

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();
  await ensureProjectTimeEntryTable();
  const stampUserResult = await getSessionBoundActor(req, users, userId);
  if (!stampUserResult.ok) return sessionBoundActorResponse(stampUserResult);
  const stampUser = stampUserResult.actor;
  const current = await getActiveSession(organization.id, stampUser.id);
  if (!current && !cleanString(body.requestId)) {
    return NextResponse.json({ error: "Keine aktive Ausgangsstempelung gefunden." }, { status: 404 });
  }
  const requestedCompletionStatus = cleanString(body.completionStatus);
  const completionStatus: "finished" | "interrupted" | "" = ["finished", "interrupted"].includes(requestedCompletionStatus)
    ? requestedCompletionStatus as "finished" | "interrupted"
    : "";
  const interruptionReason = cleanString(body.interruptionReason);
  const isReplay = current?.id === `${requestId}:start`;
  if (!isReplay && current?.mode === "project" && !completionStatus) {
    return NextResponse.json({ error: "Bitte angeben, ob die bisherige Projektarbeit fertig oder unterbrochen ist." }, { status: 400 });
  }
  if (!isReplay && completionStatus === "interrupted" && !interruptionReason) {
    return NextResponse.json({ error: "Bitte kurz begründen, warum die bisherige Arbeit unterbrochen wurde." }, { status: 400 });
  }
  try {
    const change = {
      stop: {
        completionStatus,
        comment: cleanString(body.comment) || cleanString(current?.comment),
        interruptionReason,
      },
      start: {
        mode: nextMode,
        projectId: nextProjectId,
        unproductiveLabel: nextMode === "unproductive" ? cleanString(next.projectLabel) : "",
        comment: nextComment,
        trade: nextMode === "project" ? cleanString(next.trade) : "",
        planningEntryId: nextMode === "project" ? cleanString(next.planningEntryId) : "",
        planningBillingGroupId: nextMode === "project" ? cleanString(next.planningBillingGroupId) : "",
        billingCatalogItemId: nextMode === "project" ? cleanString(next.billingCatalogItemId) : "",
        confirmImplementationStatus: nextMode === "project" && next.confirmImplementationStatus === true,
      },
    };
    const preview = isReplay ? null : await evaluateStampSessionSwitch({
      organizationId: organization.id,
      userId: stampUser.id,
      change,
    });
    if (
      preview?.stop.requiresBreakConfirmation &&
      body.confirmScheduledBreakShortfall !== true
    ) {
      return NextResponse.json(
        {
          error: `Gegenüber dem hinterlegten Pausenfenster fehlen ${preview.stop.scheduledBreakShortfallMinutes} Minuten erfasste Pause. Soll die bisherige Stempelung trotzdem beendet werden?`,
          code: "break_confirmation_required",
          missingBreakMinutes: preview.stop.scheduledBreakShortfallMinutes,
        },
        { status: 409 },
      );
    }
    if (preview?.stop.requiresFinalInspection && !["self", "colleague"].includes(cleanString(body.finalInspectionMode))) {
      return NextResponse.json({ error: "Vor dem Wechsel muss die verpflichtende Endkontrolle vollständig festgelegt werden." }, { status: 400 });
    }
    if (cleanString(body.finalInspectionMode) === "self" && body.allInspectionChecksDone !== true) {
      return NextResponse.json({ error: "Für die eigene Endkontrolle müssen alle sechs Prüfpunkte bestätigt sein." }, { status: 400 });
    }
    const switched = await executeStampSessionSwitch({
      organizationId: organization.id,
      userId: stampUser.id,
      actorName: getUserName(stampUser),
      change,
      expectedFingerprint: preview?.fingerprint,
      requestId,
      source: "ui",
    });
    const finalInspectionMode = cleanString(body.finalInspectionMode);
    if (finalInspectionMode === "self" || finalInspectionMode === "colleague") {
      const inspection = await createFinalInspection({
        organizationId: organization.id,
        actorUserId: stampUser.id,
        actorName: getUserName(stampUser),
        inspection: {
          projectId: switched.stopped.projectId,
          projectLabel: switched.stopped.projectLabel,
          mode: finalInspectionMode,
          allChecksDone: body.allInspectionChecksDone === true,
          comment: cleanString(body.comment),
          upsellNotes: cleanString(body.upsellNotes),
        },
        requestId: `${requestId}:final-inspection`,
        source: "ui",
      });
      await applyFinalInspectionBillingStatus({
        organizationId: organization.id,
        projectId: switched.stopped.projectId,
        projectMonth: inspection.projectMonth,
        actorUserId: stampUser.id,
        actorName: getUserName(stampUser),
        requestId: `${requestId}:billing-status`,
        source: "ui",
      });
    }
    let billingAutomation: { status: "attached"; invoiceId: string; invoiceNumber: string } | null = null;
    if (shouldAttemptHourlyDraftAttachment({ mode: switched.stopped.mode, completionStatus: switched.stopped.completionStatus })) {
      const attached = await attachStampEntryToHourlyInvoiceDraftShared({ organizationId: organization.id, entry: switched.stopped });
      if (!attached) throw new StampSessionServiceError("conflict", "Die bisherige Zeit wurde gespeichert, konnte aber keinem sicheren Rechnungsentwurf zugeordnet werden. Der Wechsel kann gefahrlos wiederholt werden.", 409);
      billingAutomation = { status: "attached", invoiceId: attached.invoiceId, invoiceNumber: attached.invoiceNumber };
    }
    if (switched.stopped.completionStatus === "interrupted") {
      await ensureStampInterruptionFollowup({ organizationId: organization.id, entry: switched.stopped, interruptionReason });
    }
    return NextResponse.json({ stopped: { ...switched.stopped, billingAutomation }, started: switched.started, replayed: switched.replayed }, { status: 201 });
  } catch (error) {
    if (error instanceof StampSessionServiceError || error instanceof FinalInspectionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const action = cleanString(body.action);
  const userId = cleanString(body.userId);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "Unbekannte Stempelaktion." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();
  const stampUserResult = await getSessionBoundActor(req, users, userId);
  if (!stampUserResult.ok) {
    return sessionBoundActorResponse(stampUserResult);
  }
  try {
    const session = await executeStampSessionTransition({
      organizationId: organization.id,
      userId: stampUserResult.actor.id,
      action,
      allowAlreadyInTargetState: true,
    });
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof StampSessionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  return stopSession(req, body);
}

async function stopSession(req: Request, body: Record<string, unknown>) {
  const userId = cleanString(body.userId);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureActiveStampSessionTable();
  await ensureProjectTimeEntryTable();

  const stampUserResult = await getSessionBoundActor(req, users, userId);
  if (!stampUserResult.ok) {
    return sessionBoundActorResponse(stampUserResult);
  }
  const stampUser = stampUserResult.actor;

  const session = await getActiveSession(organization.id, userId);

  if (!session) {
    return NextResponse.json({ error: "Keine aktive Stempelung gefunden." }, { status: 404 });
  }

  const interruptionReason = cleanString(body.interruptionReason);
  const requestedCompletionStatus = cleanString(body.completionStatus);
  const completionStatus =
    session.mode === "project" && ["finished", "interrupted"].includes(requestedCompletionStatus)
      ? requestedCompletionStatus
      : "";
  const finalComment = cleanString(body.comment) || cleanString(session.comment) || "";

  if (session.mode === "project" && !completionStatus) {
    return NextResponse.json(
      {
        error:
          "Projektstempelungen können nur über Arbeit fertig oder Arbeit unterbrochen abgeschlossen werden.",
      },
      { status: 400 }
    );
  }

  if (session.mode === "project" && completionStatus === "interrupted" && !interruptionReason) {
    return NextResponse.json(
      { error: "Bitte kurz begründen, warum die Arbeit unterbrochen wurde." },
      { status: 400 }
    );
  }

  const stopInput: StampSessionStopInput = {
    completionStatus:
      completionStatus === "finished" || completionStatus === "interrupted"
        ? completionStatus
        : "",
    comment: finalComment,
    interruptionReason,
  };
  const preview = await evaluateStampSessionStop({
    organizationId: organization.id,
    userId: stampUser.id,
    stop: stopInput,
  });
  if (preview.requiresBreakConfirmation && body.confirmScheduledBreakShortfall !== true) {
    return NextResponse.json(
      {
        error: `Gegenüber dem hinterlegten Pausenfenster fehlen ${preview.scheduledBreakShortfallMinutes} Minuten erfasste Pause. Soll die Stempelung trotzdem beendet werden?`,
        code: "break_confirmation_required",
        missingBreakMinutes: preview.scheduledBreakShortfallMinutes,
      },
      { status: 409 },
    );
  }

  let stopped;
  try {
    stopped = await executeStampSessionStop({
      organizationId: organization.id,
      userId: stampUser.id,
      actorName: getUserName(stampUser),
      stop: stopInput,
      expectedFingerprint: preview.fingerprint,
      requestId: randomUUID(),
      source: "ui",
    });
  } catch (error) {
    if (error instanceof StampSessionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const entry = stopped.entry;

  let billingAutomation:
    | { status: "attached"; invoiceId: string; invoiceNumber: string }
    | { status: "failed"; message: string }
    | null = null;

  if (
    shouldAttemptHourlyDraftAttachment({
      mode: entry.mode,
      completionStatus: entry.completionStatus,
    })
  ) {
    try {
      const attachedDraft = await attachStampEntryToHourlyInvoiceDraftShared({
        organizationId: organization.id,
        entry,
      });
      if (attachedDraft) {
        billingAutomation = {
          status: "attached",
          invoiceId: attachedDraft.invoiceId,
          invoiceNumber: attachedDraft.invoiceNumber,
        };
      }
    } catch (error) {
      console.error("Hourly recurring invoice draft could not be updated", error);
      billingAutomation = {
        status: "failed",
        message:
          "Die Stempelung wurde gespeichert, konnte aber keinem Rechnungsentwurf zugeordnet werden. Bitte die Abrechnung prüfen.",
      };
    }
  }

  const projectStatusTransition = stopped.projectStatusTransition
    ? { changed: true, ...stopped.projectStatusTransition }
    : null;

  if (completionStatus === "interrupted") {
    await ensureStampInterruptionFollowup({
      organizationId: organization.id,
      entry,
      interruptionReason,
    });
  }

  return NextResponse.json(
    {
      ...entry,
      billingAutomation,
      projectStatusTransition,
    },
    { status: 201 }
  );
}
