import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canDeleteContacts, canManageContacts, canReadContacts } from "@/lib/permissions";
import {
  deriveCustomerStatus,
  getCustomerStatusAuditText,
  getEffectiveCustomerStatus,
  normalizeCustomerStatusOverride,
} from "@/lib/contacts/customer-status";
import { normalizePhoneNumber } from "@/lib/phone/normalize";
import {
  ContactDeletionServiceError,
  evaluateContactDeletion,
  executeContactDeletion,
  getContactDeletionConfirmationText,
} from "@/lib/contacts/contact-deletion-service";
import {
  allocateContactCustomerNumber,
  assertChangedContactCustomerNumberAvailable,
  ContactNumberConflictError,
} from "@/lib/contacts/customer-number-service";

type ContactRow = {
  id: string;
  organizationId: string;
  category: string;
  type: string;
  legalForm: string | null;
  customerNumber: string;
  salutation: string | null;
  additionalSalutation: string | null;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  email: string | null;
  invoiceEmail: string | null;
  activityReportEmail: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  mobile: string | null;
  mobileNormalized: string | null;
  fax: string | null;
  faxNormalized: string | null;
  website: string | null;
  source: string | null;
  reachability: string | null;
  isInvoiceRecipient: boolean;
  isActivityReportRecipient: boolean;
  eInvoiceRequired: boolean;
  eInvoiceRecipientType: string | null;
  parentCompanyId: string | null;
  parentCompanyName: string | null;
  mainContactName: string | null;
  isMainContact: boolean;
  street: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  paymentTermDays: number | null;
  discountPercent: number | null;
  discountTermDays: number | null;
  priceGroup: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  taxId: string | null;
  debtorCreditorAccount: string | null;
  leitwegId: string | null;
  customerStatusOverride: string;
  customerStatusOverrideReason: string | null;
  customerStatusOverrideAt: Date | null;
  customerStatusOverrideById: string | null;
  customerStatusOverrideByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CustomerInvoiceCountRow = {
  contactId: string;
  invoiceCount: number;
};

class ContactWriteConflictError extends Error {}

function getContactDisplayName(contact: ContactRow) {
  return (
    contact.companyName ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    contact.customerNumber ||
    "Kunde"
  );
}

async function ensureContactsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Contact" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Kunde',
      "type" TEXT NOT NULL DEFAULT 'person',
      "legalForm" TEXT,
      "customerNumber" TEXT NOT NULL,
      "salutation" TEXT,
      "additionalSalutation" TEXT,
      "companyName" TEXT,
      "firstName" TEXT,
      "lastName" TEXT,
      "position" TEXT,
      "email" TEXT,
      "invoiceEmail" TEXT,
      "activityReportEmail" TEXT,
      "phone" TEXT,
      "phoneNormalized" TEXT,
      "mobile" TEXT,
      "mobileNormalized" TEXT,
      "fax" TEXT,
      "faxNormalized" TEXT,
      "website" TEXT,
      "source" TEXT,
      "reachability" TEXT,
      "isInvoiceRecipient" BOOLEAN NOT NULL DEFAULT false,
      "isActivityReportRecipient" BOOLEAN NOT NULL DEFAULT false,
      "eInvoiceRequired" BOOLEAN NOT NULL DEFAULT false,
      "eInvoiceRecipientType" TEXT NOT NULL DEFAULT 'business',
      "parentCompanyId" TEXT,
      "parentCompanyName" TEXT,
      "mainContactName" TEXT,
      "isMainContact" BOOLEAN NOT NULL DEFAULT false,
      "street" TEXT,
      "addressLine1" TEXT,
      "addressLine2" TEXT,
      "postalCode" TEXT,
      "city" TEXT,
      "country" TEXT,
      "paymentTermDays" INTEGER,
      "discountPercent" DOUBLE PRECISION,
      "discountTermDays" INTEGER,
      "priceGroup" TEXT,
      "iban" TEXT,
      "bic" TEXT,
      "bankName" TEXT,
      "taxId" TEXT,
      "debtorCreditorAccount" TEXT,
      "leitwegId" TEXT,
      "customerStatusOverride" TEXT NOT NULL DEFAULT 'automatic',
      "customerStatusOverrideReason" TEXT,
      "customerStatusOverrideAt" TIMESTAMP(3),
      "customerStatusOverrideById" TEXT,
      "customerStatusOverrideByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "parentCompanyId" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "parentCompanyName" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "mainContactName" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "isMainContact" BOOLEAN NOT NULL DEFAULT false`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "legalForm" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "invoiceEmail" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "activityReportEmail" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "isActivityReportRecipient" BOOLEAN NOT NULL DEFAULT false`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "eInvoiceRequired" BOOLEAN NOT NULL DEFAULT false`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "eInvoiceRecipientType" TEXT NOT NULL DEFAULT 'business'`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "customerStatusOverride" TEXT NOT NULL DEFAULT 'automatic'`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "customerStatusOverrideReason" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "customerStatusOverrideAt" TIMESTAMP(3)`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "customerStatusOverrideById" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "customerStatusOverrideByName" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "phoneNormalized" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "mobileNormalized" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "faxNormalized" TEXT`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Contact_organizationId_phoneNormalized_idx" ON "Contact"("organizationId", "phoneNormalized")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Contact_organizationId_mobileNormalized_idx" ON "Contact"("organizationId", "mobileNormalized")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Contact_organizationId_faxNormalized_idx" ON "Contact"("organizationId", "faxNormalized")`;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function forbiddenContactResponse() {
  return NextResponse.json(
    { error: "Du darfst Kontakte nicht verwalten." },
    { status: 403 }
  );
}

function forbiddenContactDeleteResponse() {
  return NextResponse.json(
    { error: "Du darfst Kontakte nicht endgueltig loeschen." },
    { status: 403 }
  );
}

function nullableString(value: unknown) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function normalizeContactPhone(value: unknown, label: string, existingValue?: string | null) {
  const raw = cleanString(value);
  const result = normalizePhoneNumber(raw);
  if (result.kind === "invalid") {
    if (existingValue !== undefined && raw === cleanString(existingValue)) return { raw, normalized: null };
    return { error: `${label}: ${result.reason}` } as const;
  }
  return { raw: result.normalized ?? "", normalized: result.normalized };
}

function getChangedContactFields(previous: ContactRow, body: Record<string, unknown>) {
  const trackedFields = ["phone", "mobile", "fax", "email", "companyName", "firstName", "lastName", "parentCompanyId"] as const;
  return trackedFields.filter((field) => cleanString(previous[field]) !== cleanString(body[field]));
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function getEmailValidationError(label: string, value: string) {
  if (!value) return "";
  return isValidEmailAddress(value) ? "" : `${label} ist keine gültige E-Mail-Adresse.`;
}

function getRequiredContactError(input: { type: string; companyName?: unknown; firstName?: unknown; lastName?: unknown }) {
  if (input.type === "company") {
    return cleanString(input.companyName) ? "" : "Bitte einen Firmennamen angeben.";
  }

  return cleanString(input.firstName) || cleanString(input.lastName)
    ? ""
    : "Bitte mindestens Vorname oder Nachname angeben.";
}

function parseInteger(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function cleanEInvoiceRecipientType(value: unknown) {
  const cleaned = cleanString(value);
  return cleaned === "public" ? "public" : "business";
}

function parseNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getUserName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function isCustomerContact(contact: Pick<ContactRow, "category" | "type">) {
  return contact.type === "private" || contact.category === "Kunde" || contact.category === "Privatkunde";
}

function formatContact(contact: ContactRow, invoiceCount = 0) {
  const systemStatus = deriveCustomerStatus(invoiceCount);
  const storedOverride = normalizeCustomerStatusOverride(contact.customerStatusOverride);
  const customerStatusOverride = isCustomerContact(contact) ? storedOverride : "automatic";
  return {
    id: contact.id,
    category: contact.category,
    type: contact.type,
    legalForm: contact.legalForm ?? "",
    customerNumber: contact.customerNumber,
    salutation: contact.salutation ?? "",
    additionalSalutation: contact.additionalSalutation ?? "",
    companyName: contact.companyName ?? "",
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    position: contact.position ?? "",
    email: contact.email ?? "",
    invoiceEmail: contact.invoiceEmail ?? "",
    activityReportEmail: contact.activityReportEmail ?? "",
    phone: contact.phone ?? "",
    mobile: contact.mobile ?? "",
    fax: contact.fax ?? "",
    website: contact.website ?? "",
    source: contact.source ?? "",
    reachability: contact.reachability ?? "",
    isInvoiceRecipient: contact.isInvoiceRecipient,
    isActivityReportRecipient: contact.isActivityReportRecipient,
    eInvoiceRequired: Boolean(contact.eInvoiceRequired),
    eInvoiceRecipientType: cleanEInvoiceRecipientType(contact.eInvoiceRecipientType),
    parentCompanyId: contact.parentCompanyId ?? "",
    parentCompanyName: contact.parentCompanyName ?? "",
    mainContactName: contact.mainContactName ?? "",
    isMainContact: contact.isMainContact,
    street: contact.street ?? "",
    addressLine1: contact.addressLine1 ?? "",
    addressLine2: contact.addressLine2 ?? "",
    postalCode: contact.postalCode ?? "",
    city: contact.city ?? "",
    country: contact.country ?? "",
    paymentTermDays: contact.paymentTermDays,
    discountPercent: contact.discountPercent,
    discountTermDays: contact.discountTermDays,
    priceGroup: contact.priceGroup ?? "",
    iban: contact.iban ?? "",
    bic: contact.bic ?? "",
    bankName: contact.bankName ?? "",
    taxId: contact.taxId ?? "",
    debtorCreditorAccount: contact.debtorCreditorAccount ?? "",
    leitwegId: contact.leitwegId ?? "",
    customerStatusSystem: systemStatus,
    customerStatusEffective: getEffectiveCustomerStatus(systemStatus, customerStatusOverride),
    customerStatusSource: customerStatusOverride === "automatic" ? "automatic" : "manual",
    customerStatusInvoiceCount: invoiceCount,
    customerStatusOverride,
    customerStatusOverrideReason: contact.customerStatusOverrideReason ?? "",
    customerStatusOverrideAt: contact.customerStatusOverrideAt?.toISOString() ?? "",
    customerStatusOverrideById: contact.customerStatusOverrideById ?? "",
    customerStatusOverrideByName: contact.customerStatusOverrideByName ?? "",
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

async function getCustomerInvoiceCounts(organizationId: string) {
  const rows = await prisma.$queryRaw<CustomerInvoiceCountRow[]>`
    SELECT project."contactId" AS "contactId", COUNT(invoice."id")::int AS "invoiceCount"
    FROM "Invoice" invoice
    INNER JOIN "WorkPilotProject" project
      ON project."id" = invoice."projectId"
      AND project."organizationId" = invoice."organizationId"
    WHERE invoice."organizationId" = ${organizationId}
      AND project."contactId" IS NOT NULL
      AND project."contactId" <> ''
      AND invoice."netTotal" > 0
      AND LOWER(invoice."status") <> 'entwurf'
      AND LOWER(invoice."status") NOT LIKE '%storno%'
      AND LOWER(invoice."status") NOT LIKE '%gelöscht%'
      AND LOWER(invoice."status") NOT LIKE '%geloescht%'
    GROUP BY project."contactId"
  `;
  return new Map(rows.map((row) => [row.contactId, Number(row.invoiceCount)]));
}

function getCustomerStatusInput(args: {
  body: Record<string, unknown>;
  actor: Pick<User, "id" | "firstName" | "lastName" | "email">;
  isCustomer: boolean;
  existing?: Pick<
    ContactRow,
    | "customerStatusOverride"
    | "customerStatusOverrideReason"
    | "customerStatusOverrideAt"
    | "customerStatusOverrideById"
    | "customerStatusOverrideByName"
  >;
}) {
  const customerStatusOverride = args.isCustomer
    ? normalizeCustomerStatusOverride(args.body.customerStatusOverride)
    : "automatic";
  const reason = cleanString(args.body.customerStatusOverrideReason);
  if (customerStatusOverride !== "automatic" && !reason) {
    return { error: "Bitte begründe die manuelle Kundenstatus-Einstufung." } as const;
  }
  const existingOverride = normalizeCustomerStatusOverride(args.existing?.customerStatusOverride);
  const manualDecisionUnchanged =
    customerStatusOverride !== "automatic" &&
    customerStatusOverride === existingOverride &&
    reason === (args.existing?.customerStatusOverrideReason ?? "");
  return {
    customerStatusOverride,
    customerStatusOverrideReason: customerStatusOverride === "automatic" ? null : reason.slice(0, 500),
    customerStatusOverrideAt:
      customerStatusOverride === "automatic"
        ? null
        : manualDecisionUnchanged
          ? args.existing?.customerStatusOverrideAt ?? new Date()
          : new Date(),
    customerStatusOverrideById:
      customerStatusOverride === "automatic"
        ? null
        : manualDecisionUnchanged
          ? args.existing?.customerStatusOverrideById ?? args.actor.id
          : args.actor.id,
    customerStatusOverrideByName:
      customerStatusOverride === "automatic"
        ? null
        : manualDecisionUnchanged
          ? args.existing?.customerStatusOverrideByName ?? getUserName(args.actor)
          : getUserName(args.actor),
  } as const;
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const requestedActorId = searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canReadContacts(actor)) {
    return forbiddenContactResponse();
  }
  await ensureContactsTable();

  const contacts = await prisma.$queryRaw<ContactRow[]>`
    SELECT *
    FROM "Contact"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;
  const invoiceCounts = await getCustomerInvoiceCounts(organization.id);

  return NextResponse.json(contacts.map((contact) => formatContact(contact, invoiceCounts.get(contact.id) ?? 0)));
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureContactsTable();

  const body = await req.json();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageContacts(actor)) {
    return forbiddenContactResponse();
  }
  const id = randomUUID();
  const category = cleanString(body.category) || "Kunde";
  const requestedType = cleanString(body.type);
  const type = requestedType === "company" || requestedType === "private" ? requestedType : "person";
  const requiredContactError = getRequiredContactError({ ...body, type });
  if (requiredContactError) {
    return NextResponse.json({ error: requiredContactError }, { status: 400 });
  }
  const requestedCustomerNumber = cleanString(body.customerNumber);
  const email = cleanString(body.email);
  const invoiceEmail = cleanString(body.invoiceEmail);
  const activityReportEmail = cleanString(body.activityReportEmail);
  const emailValidationError =
    getEmailValidationError("E-Mail-Adresse Kontaktperson", email) ||
    getEmailValidationError("E-Mail Rechnung", invoiceEmail) ||
    getEmailValidationError("E-Mail Tätigkeitsbericht", activityReportEmail);
  if (emailValidationError) {
    return NextResponse.json({ error: emailValidationError }, { status: 400 });
  }
  const customerStatus = getCustomerStatusInput({
    body,
    actor,
    isCustomer: type === "private" || category === "Kunde" || category === "Privatkunde",
  });
  if ("error" in customerStatus) {
    return NextResponse.json({ error: customerStatus.error }, { status: 400 });
  }
  const phone = normalizeContactPhone(body.phone, "Telefon");
  const mobile = normalizeContactPhone(body.mobile, "Mobiltelefon");
  const fax = normalizeContactPhone(body.fax, "Fax");
  for (const result of [phone, mobile, fax]) {
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let inserted: ContactRow[];
  try {
    inserted = await prisma.$transaction(async (transaction) => {
    const customerNumber = await allocateContactCustomerNumber({
      tx: transaction,
      organizationId: organization.id,
      requestedNumber: requestedCustomerNumber,
    });
    const rows = await transaction.$queryRaw<ContactRow[]>`
    INSERT INTO "Contact" (
      "id", "organizationId", "category", "type", "legalForm", "customerNumber",
      "salutation", "additionalSalutation", "companyName", "firstName", "lastName", "position",
      "email", "invoiceEmail", "activityReportEmail", "phone", "phoneNormalized", "mobile", "mobileNormalized", "fax", "faxNormalized", "website", "source", "reachability", "isInvoiceRecipient", "isActivityReportRecipient",
      "eInvoiceRequired", "eInvoiceRecipientType",
      "parentCompanyId", "parentCompanyName", "mainContactName", "isMainContact",
      "street", "addressLine1", "addressLine2", "postalCode", "city", "country",
      "paymentTermDays", "discountPercent", "discountTermDays", "priceGroup",
      "iban", "bic", "bankName", "taxId", "debtorCreditorAccount", "leitwegId",
      "customerStatusOverride", "customerStatusOverrideReason", "customerStatusOverrideAt", "customerStatusOverrideById", "customerStatusOverrideByName"
    )
    VALUES (
      ${id}, ${organization.id}, ${category}, ${type}, ${nullableString(body.legalForm)}, ${customerNumber},
      ${nullableString(body.salutation)}, ${nullableString(body.additionalSalutation)}, ${nullableString(body.companyName)},
      ${nullableString(body.firstName)}, ${nullableString(body.lastName)}, ${nullableString(body.position)},
      ${nullableString(email)}, ${nullableString(invoiceEmail)}, ${nullableString(activityReportEmail)}, ${nullableString(phone.raw)}, ${phone.normalized}, ${nullableString(mobile.raw)}, ${mobile.normalized}, ${nullableString(fax.raw)}, ${fax.normalized},
      ${nullableString(body.website)}, ${nullableString(body.source)}, ${nullableString(body.reachability)}, ${Boolean(invoiceEmail)}, ${Boolean(activityReportEmail)},
      ${Boolean(body.eInvoiceRequired)}, ${cleanEInvoiceRecipientType(body.eInvoiceRecipientType)},
      ${nullableString(body.parentCompanyId)}, ${nullableString(body.parentCompanyName)}, ${nullableString(body.mainContactName)}, ${Boolean(body.isMainContact)},
      ${nullableString(body.street)}, ${nullableString(body.addressLine1)}, ${nullableString(body.addressLine2)},
      ${nullableString(body.postalCode)}, ${nullableString(body.city)}, ${nullableString(body.country)},
      ${parseInteger(body.paymentTermDays)}, ${parseNumber(body.discountPercent)}, ${parseInteger(body.discountTermDays)}, ${nullableString(body.priceGroup)},
      ${nullableString(body.iban)}, ${nullableString(body.bic)}, ${nullableString(body.bankName)}, ${nullableString(body.taxId)},
      ${nullableString(body.debtorCreditorAccount)}, ${nullableString(body.leitwegId)},
      ${customerStatus.customerStatusOverride}, ${customerStatus.customerStatusOverrideReason}, ${customerStatus.customerStatusOverrideAt},
      ${customerStatus.customerStatusOverrideById}, ${customerStatus.customerStatusOverrideByName}
    )
    RETURNING *
    `;
    await transaction.contactIntegrationEvent.create({
      data: { organizationId: organization.id, contactId: id, eventType: "created", changedFields: [] },
    });
    return rows;
    });
  } catch (error) {
    if (error instanceof ContactNumberConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(formatContact(inserted[0]));
}

export async function PATCH(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureContactsTable();

  const body = await req.json();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canManageContacts(actor)) {
    return forbiddenContactResponse();
  }
  const id = cleanString(body.id);

  if (!id) {
    return NextResponse.json({ error: "Keine Kontakt-ID übergeben." }, { status: 400 });
  }

  const category = cleanString(body.category) || "Kunde";
  const requestedType = cleanString(body.type);
  const type = requestedType === "company" || requestedType === "private" ? requestedType : "person";
  const requiredContactError = getRequiredContactError({ ...body, type });
  if (requiredContactError) {
    return NextResponse.json({ error: requiredContactError }, { status: 400 });
  }
  const email = cleanString(body.email);
  const invoiceEmail = cleanString(body.invoiceEmail);
  const activityReportEmail = cleanString(body.activityReportEmail);
  const emailValidationError =
    getEmailValidationError("E-Mail-Adresse Kontaktperson", email) ||
    getEmailValidationError("E-Mail Rechnung", invoiceEmail) ||
    getEmailValidationError("E-Mail Tätigkeitsbericht", activityReportEmail);
  if (emailValidationError) {
    return NextResponse.json({ error: emailValidationError }, { status: 400 });
  }
  const existingContacts = await prisma.$queryRaw<ContactRow[]>`
    SELECT *
    FROM "Contact"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  if (existingContacts.length === 0) {
    return NextResponse.json({ error: "Kontakt wurde nicht gefunden." }, { status: 404 });
  }
  const expectedUpdatedAt = cleanString(body.expectedUpdatedAt);
  if (!expectedUpdatedAt || new Date(expectedUpdatedAt).getTime() !== existingContacts[0].updatedAt.getTime()) {
    return NextResponse.json(
      { error: "Der Kontakt wurde zwischenzeitlich geändert. Bitte neu laden und die Eingaben erneut prüfen." },
      { status: 409 }
    );
  }
  const customerNumber = cleanString(body.customerNumber) || existingContacts[0].customerNumber;
  const customerStatus = getCustomerStatusInput({
    body,
    actor,
    isCustomer: type === "private" || category === "Kunde" || category === "Privatkunde",
    existing: existingContacts[0],
  });
  if ("error" in customerStatus) {
    return NextResponse.json({ error: customerStatus.error }, { status: 400 });
  }

  const previousContact = existingContacts[0];
  const phone = normalizeContactPhone(body.phone, "Telefon", previousContact.phone);
  const mobile = normalizeContactPhone(body.mobile, "Mobiltelefon", previousContact.mobile);
  const fax = normalizeContactPhone(body.fax, "Fax", previousContact.fax);
  for (const result of [phone, mobile, fax]) {
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const changedFields = getChangedContactFields(previousContact, body);
  const customerStatusAuditText = getCustomerStatusAuditText({
    previousOverride: previousContact.customerStatusOverride,
    previousReason: previousContact.customerStatusOverrideReason ?? "",
    nextOverride: customerStatus.customerStatusOverride,
    nextReason: customerStatus.customerStatusOverrideReason ?? "",
  });
  const contactDisplayName = getContactDisplayName({
    ...previousContact,
    category,
    type,
    customerNumber,
    companyName: nullableString(body.companyName),
    firstName: nullableString(body.firstName),
    lastName: nullableString(body.lastName),
  });
  const managementRecipients = customerStatusAuditText
    ? users.filter(
        (user) =>
          user.organizationId === organization.id &&
          user.isActive !== false &&
          user.role === Role.GESCHAEFTSFUEHRER
      )
    : [];

  let updated: ContactRow[];
  try {
    updated = await prisma.$transaction(async (transaction) => {
    await assertChangedContactCustomerNumberAvailable({
      tx: transaction,
      organizationId: organization.id,
      contactId: id,
      previousNumber: previousContact.customerNumber,
      nextNumber: customerNumber,
    });
    const rows = await transaction.$queryRaw<ContactRow[]>`
      UPDATE "Contact"
      SET
      "category" = ${category},
      "type" = ${type},
      "legalForm" = ${nullableString(body.legalForm)},
      "customerNumber" = ${customerNumber},
      "salutation" = ${nullableString(body.salutation)},
      "additionalSalutation" = ${nullableString(body.additionalSalutation)},
      "companyName" = ${nullableString(body.companyName)},
      "firstName" = ${nullableString(body.firstName)},
      "lastName" = ${nullableString(body.lastName)},
      "position" = ${nullableString(body.position)},
      "email" = ${nullableString(email)},
      "invoiceEmail" = ${nullableString(invoiceEmail)},
      "activityReportEmail" = ${nullableString(activityReportEmail)},
      "phone" = ${nullableString(phone.raw)},
      "phoneNormalized" = ${phone.normalized},
      "mobile" = ${nullableString(mobile.raw)},
      "mobileNormalized" = ${mobile.normalized},
      "fax" = ${nullableString(fax.raw)},
      "faxNormalized" = ${fax.normalized},
      "website" = ${nullableString(body.website)},
      "source" = ${nullableString(body.source)},
      "reachability" = ${nullableString(body.reachability)},
      "isInvoiceRecipient" = ${Boolean(invoiceEmail)},
      "isActivityReportRecipient" = ${Boolean(activityReportEmail)},
      "eInvoiceRequired" = ${Boolean(body.eInvoiceRequired)},
      "eInvoiceRecipientType" = ${cleanEInvoiceRecipientType(body.eInvoiceRecipientType)},
      "parentCompanyId" = ${nullableString(body.parentCompanyId)},
      "parentCompanyName" = ${nullableString(body.parentCompanyName)},
      "mainContactName" = ${nullableString(body.mainContactName)},
      "isMainContact" = ${Boolean(body.isMainContact)},
      "street" = ${nullableString(body.street)},
      "addressLine1" = ${nullableString(body.addressLine1)},
      "addressLine2" = ${nullableString(body.addressLine2)},
      "postalCode" = ${nullableString(body.postalCode)},
      "city" = ${nullableString(body.city)},
      "country" = ${nullableString(body.country)},
      "paymentTermDays" = ${parseInteger(body.paymentTermDays)},
      "discountPercent" = ${parseNumber(body.discountPercent)},
      "discountTermDays" = ${parseInteger(body.discountTermDays)},
      "priceGroup" = ${nullableString(body.priceGroup)},
      "iban" = ${nullableString(body.iban)},
      "bic" = ${nullableString(body.bic)},
      "bankName" = ${nullableString(body.bankName)},
      "taxId" = ${nullableString(body.taxId)},
      "debtorCreditorAccount" = ${nullableString(body.debtorCreditorAccount)},
      "leitwegId" = ${nullableString(body.leitwegId)},
      "customerStatusOverride" = ${customerStatus.customerStatusOverride},
      "customerStatusOverrideReason" = ${customerStatus.customerStatusOverrideReason},
      "customerStatusOverrideAt" = ${customerStatus.customerStatusOverrideAt},
      "customerStatusOverrideById" = ${customerStatus.customerStatusOverrideById},
      "customerStatusOverrideByName" = ${customerStatus.customerStatusOverrideByName},
      "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
        AND "updatedAt" = ${previousContact.updatedAt}
      RETURNING *
    `;

    if (!rows[0]) {
      throw new ContactWriteConflictError(
        "Der Kontakt wurde zwischenzeitlich geändert. Bitte neu laden und die Eingaben erneut prüfen."
      );
    }

    if (customerStatusAuditText) {
      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: actor.id,
          action: "customer_status_changed",
          entityType: "contact-logbook",
          entityId: id,
          payload: {
            text: customerStatusAuditText,
            author: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
            authorUserId: actor.id,
            previousOverride: normalizeCustomerStatusOverride(previousContact.customerStatusOverride),
            nextOverride: customerStatus.customerStatusOverride,
            reason: customerStatus.customerStatusOverrideReason ?? "",
            isSystem: true,
          },
        },
      });

      if (managementRecipients.length > 0) {
        await transaction.notification.createMany({
          data: managementRecipients.map((recipient) => ({
            organizationId: organization.id,
            userId: recipient.id,
            channel: "app",
            subject: "Kundenstatus manuell geändert",
            body: `${contactDisplayName}: ${customerStatusAuditText}`,
            linkTarget: "customer",
            linkTargetId: id,
            linkLabel: "Kundenakte öffnen",
          })),
        });
      }
    }

    if (changedFields.length > 0) {
      await transaction.contactIntegrationEvent.create({
        data: { organizationId: organization.id, contactId: id, eventType: "updated", changedFields },
      });
    }

    return rows;
    });
  } catch (error) {
    if (error instanceof ContactNumberConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ContactWriteConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (updated.length === 0) {
    return NextResponse.json({ error: "Kontakt wurde nicht gefunden." }, { status: 404 });
  }

  const invoiceCounts = await getCustomerInvoiceCounts(organization.id);
  return NextResponse.json(formatContact(updated[0], invoiceCounts.get(updated[0].id) ?? 0));
}

export async function DELETE(req: Request) {
  const { organization, users } = await getDemoContext();
  await ensureContactsTable();

  const body = await req.json();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canDeleteContacts(actor)) {
    return forbiddenContactDeleteResponse();
  }
  const id = cleanString(body.id);

  if (!id) {
    return NextResponse.json({ error: "Keine Kontakt-ID übergeben." }, { status: 400 });
  }

  try {
    const evaluation = await evaluateContactDeletion({ organizationId: organization.id, contactId: id, reason: body.reason });
    const requiredText = getContactDeletionConfirmationText(evaluation.contact.customerNumber);
    if (cleanString(body.confirmationText) !== requiredText) {
      return NextResponse.json({ error: `Gib zur endgültigen Löschung exakt „${requiredText}“ ein.`, code: "invalid_confirmation" }, { status: 400 });
    }
    await prisma.$transaction(
      (transaction) => executeContactDeletion({
        tx: transaction,
        organizationId: organization.id,
        contactId: id,
        reason: evaluation.reason,
        actorId: actor.id,
        requestId: randomUUID(),
        expectedFingerprint: evaluation.fingerprint,
      }),
      { isolationLevel: "Serializable" }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ContactDeletionServiceError) {
      const status = error.code === "not_found" ? 404 : error.code === "invalid_input" ? 400 : 409;
      return NextResponse.json({ error: error.message, code: error.code, references: error.references }, { status });
    }
    return NextResponse.json({ error: "Kontakt konnte nicht sicher endgültig gelöscht werden." }, { status: 500 });
  }
}
