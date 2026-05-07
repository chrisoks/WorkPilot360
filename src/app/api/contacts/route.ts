import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

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
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  website: string | null;
  source: string | null;
  reachability: string | null;
  isInvoiceRecipient: boolean;
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
  createdAt: Date;
  updatedAt: Date;
};

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
      "phone" TEXT,
      "mobile" TEXT,
      "fax" TEXT,
      "website" TEXT,
      "source" TEXT,
      "reachability" TEXT,
      "isInvoiceRecipient" BOOLEAN NOT NULL DEFAULT false,
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "parentCompanyId" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "parentCompanyName" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "mainContactName" TEXT`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "isMainContact" BOOLEAN NOT NULL DEFAULT false`;
  await prisma.$executeRaw`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "legalForm" TEXT`;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function parseInteger(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatContact(contact: ContactRow) {
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
    phone: contact.phone ?? "",
    mobile: contact.mobile ?? "",
    fax: contact.fax ?? "",
    website: contact.website ?? "",
    source: contact.source ?? "",
    reachability: contact.reachability ?? "",
    isInvoiceRecipient: contact.isInvoiceRecipient,
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
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

async function getNextCustomerNumber(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ customerNumber: string }>>`
    SELECT "customerNumber"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const currentNumber = Number(rows[0]?.customerNumber ?? "7000048");
  return String(Number.isFinite(currentNumber) ? currentNumber + 1 : 7000049);
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureContactsTable();

  const contacts = await prisma.$queryRaw<ContactRow[]>`
    SELECT *
    FROM "Contact"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;

  return NextResponse.json(contacts.map(formatContact));
}

export async function POST(req: Request) {
  const { organization } = await getDemoContext();
  await ensureContactsTable();

  const body = await req.json();
  const id = randomUUID();
  const category = cleanString(body.category) || "Kunde";
  const type = cleanString(body.type) === "company" ? "company" : "person";
  const customerNumber = cleanString(body.customerNumber) || (await getNextCustomerNumber(organization.id));

  const inserted = await prisma.$queryRaw<ContactRow[]>`
    INSERT INTO "Contact" (
      "id", "organizationId", "category", "type", "legalForm", "customerNumber",
      "salutation", "additionalSalutation", "companyName", "firstName", "lastName", "position",
      "email", "phone", "mobile", "fax", "website", "source", "reachability", "isInvoiceRecipient",
      "parentCompanyId", "parentCompanyName", "mainContactName", "isMainContact",
      "street", "addressLine1", "addressLine2", "postalCode", "city", "country",
      "paymentTermDays", "discountPercent", "discountTermDays", "priceGroup",
      "iban", "bic", "bankName", "taxId", "debtorCreditorAccount", "leitwegId"
    )
    VALUES (
      ${id}, ${organization.id}, ${category}, ${type}, ${nullableString(body.legalForm)}, ${customerNumber},
      ${nullableString(body.salutation)}, ${nullableString(body.additionalSalutation)}, ${nullableString(body.companyName)},
      ${nullableString(body.firstName)}, ${nullableString(body.lastName)}, ${nullableString(body.position)},
      ${nullableString(body.email)}, ${nullableString(body.phone)}, ${nullableString(body.mobile)}, ${nullableString(body.fax)},
      ${nullableString(body.website)}, ${nullableString(body.source)}, ${nullableString(body.reachability)}, ${Boolean(body.isInvoiceRecipient)},
      ${nullableString(body.parentCompanyId)}, ${nullableString(body.parentCompanyName)}, ${nullableString(body.mainContactName)}, ${Boolean(body.isMainContact)},
      ${nullableString(body.street)}, ${nullableString(body.addressLine1)}, ${nullableString(body.addressLine2)},
      ${nullableString(body.postalCode)}, ${nullableString(body.city)}, ${nullableString(body.country)},
      ${parseInteger(body.paymentTermDays)}, ${parseNumber(body.discountPercent)}, ${parseInteger(body.discountTermDays)}, ${nullableString(body.priceGroup)},
      ${nullableString(body.iban)}, ${nullableString(body.bic)}, ${nullableString(body.bankName)}, ${nullableString(body.taxId)},
      ${nullableString(body.debtorCreditorAccount)}, ${nullableString(body.leitwegId)}
    )
    RETURNING *
  `;

  return NextResponse.json(formatContact(inserted[0]));
}

export async function PATCH(req: Request) {
  const { organization } = await getDemoContext();
  await ensureContactsTable();

  const body = await req.json();
  const id = cleanString(body.id);

  if (!id) {
    return NextResponse.json({ error: "Keine Kontakt-ID übergeben." }, { status: 400 });
  }

  const category = cleanString(body.category) || "Kunde";
  const type = cleanString(body.type) === "company" ? "company" : "person";
  const customerNumber = cleanString(body.customerNumber) || (await getNextCustomerNumber(organization.id));

  const updated = await prisma.$queryRaw<ContactRow[]>`
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
      "email" = ${nullableString(body.email)},
      "phone" = ${nullableString(body.phone)},
      "mobile" = ${nullableString(body.mobile)},
      "fax" = ${nullableString(body.fax)},
      "website" = ${nullableString(body.website)},
      "source" = ${nullableString(body.source)},
      "reachability" = ${nullableString(body.reachability)},
      "isInvoiceRecipient" = ${Boolean(body.isInvoiceRecipient)},
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
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;

  if (updated.length === 0) {
    return NextResponse.json({ error: "Kontakt wurde nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(formatContact(updated[0]));
}

export async function DELETE(req: Request) {
  const { organization } = await getDemoContext();
  await ensureContactsTable();

  const body = await req.json();
  const id = cleanString(body.id);

  if (!id) {
    return NextResponse.json({ error: "Keine Kontakt-ID übergeben." }, { status: 400 });
  }

  const deleted = await prisma.$queryRaw<Array<{ id: string }>>`
    DELETE FROM "Contact"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    RETURNING "id"
  `;

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Kontakt wurde nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
