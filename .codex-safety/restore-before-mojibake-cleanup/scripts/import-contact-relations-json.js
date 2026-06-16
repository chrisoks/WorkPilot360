const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");

    if (!process.env[key]) process.env[key] = value;
  }
}

function clean(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function nullable(value) {
  const cleaned = clean(value);
  return cleaned || null;
}

function normalizeName(value) {
  return clean(value)
    .replace(/^(Herr|Frau)\s+/i, "")
    .toLowerCase();
}

function splitName(value) {
  const cleaned = clean(value).replace(/^(Herr|Frau)\s+/i, "");
  const parts = cleaned.split(" ").filter(Boolean);
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? cleaned,
  };
}

function parseSalutation(value) {
  const cleaned = clean(value);
  if (/^Frau\s/i.test(cleaned)) return "Frau";
  if (/^Herr\s/i.test(cleaned)) return "Herr";
  return "";
}

function parseAddress(value) {
  const address = clean(value);
  const match = address.match(/^(.*?),\s*(\d{5})\s+(.+)$/);

  if (!match) {
    return {
      street: address,
      postalCode: null,
      city: null,
      country: "Deutschland",
    };
  }

  return {
    street: clean(match[1]),
    postalCode: clean(match[2]),
    city: clean(match[3]),
    country: "Deutschland",
  };
}

function parseCreatedAt(value) {
  const match = clean(value).match(/^(\d{2})\.(\d{2})\.(\d{2}),\s*(\d{2}):(\d{2})$/);
  if (!match) return new Date();

  const [, day, month, year, hours, minutes] = match;
  return new Date(
    Number(`20${year}`),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );
}

async function ensureContactsTable(prisma) {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Contact" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Kunde',
      "type" TEXT NOT NULL DEFAULT 'person',
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
}

async function getOrCreateCompany(prisma, organizationId, record, importedAt) {
  const companyName = clean(record["Hauptkontakt (Firma)"] || record.Firmenname);
  if (!companyName) return null;

  const address = parseAddress(record.Ort);
  const existing = await prisma.$queryRaw`
    SELECT *
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
      AND "type" = 'company'
      AND LOWER(COALESCE("companyName", '')) = ${companyName.toLowerCase()}
    LIMIT 1
  `;

  if (existing[0]) {
    await prisma.$executeRaw`
      UPDATE "Contact"
      SET
        "category" = 'Kunde',
        "street" = COALESCE(NULLIF("street", ''), ${address.street}),
        "postalCode" = COALESCE(NULLIF("postalCode", ''), ${address.postalCode}),
        "city" = COALESCE(NULLIF("city", ''), ${address.city}),
        "country" = COALESCE(NULLIF("country", ''), ${address.country}),
        "mainContactName" = ${nullable(record.Hauptkontakt)},
        "updatedAt" = ${importedAt}
      WHERE "id" = ${existing[0].id}
    `;
    return existing[0];
  }

  const customerNumber = clean(record.Kundennummer) || "";
  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Contact" (
      "id", "organizationId", "category", "type", "customerNumber", "companyName",
      "street", "postalCode", "city", "country", "source", "reachability",
      "mainContactName", "createdAt", "updatedAt"
    )
    VALUES (
      ${id}, ${organizationId}, 'Kunde', 'company', ${customerNumber}, ${companyName},
      ${address.street}, ${address.postalCode}, ${address.city}, ${address.country}, 'XLSX Import', 'Sonstige',
      ${nullable(record.Hauptkontakt)}, ${importedAt}, ${importedAt}
    )
  `;

  return { id, companyName, customerNumber };
}

async function main() {
  loadEnv();

  const jsonPath = process.argv[2];
  if (!jsonPath) throw new Error("Bitte JSON-Pfad übergeben.");

  const records = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const prisma = new PrismaClient();

  try {
    const organization = await prisma.organization.upsert({
      where: { slug: "demo" },
      update: {},
      create: {
        name: "Demo Organisation",
        slug: "demo",
      },
    });

    await ensureContactsTable(prisma);

    const importedAt = new Date();
    let companiesCreatedOrUpdated = 0;
    let contactsCreated = 0;
    let contactsUpdated = 0;
    let placeholdersCreated = 0;

    for (const record of records) {
      const company = await getOrCreateCompany(prisma, organization.id, record, importedAt);
      if (company) companiesCreatedOrUpdated += 1;

      const firstName = clean(record.Vorname);
      const lastName = clean(record.Nachname);
      const email = clean(record["E-Mail"]);
      const phone = clean(record.Telefon);
      const mobile = clean(record.Mobil);
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      if (!fullName && !email) continue;

      const mainContactName = clean(record.Hauptkontakt);
      const address = parseAddress(record.Ort);
      const isMainContact = normalizeName(fullName) === normalizeName(mainContactName);
      const existing = email
        ? await prisma.$queryRaw`
            SELECT id FROM "Contact"
            WHERE "organizationId" = ${organization.id}
              AND LOWER(COALESCE("email", '')) = ${email.toLowerCase()}
            LIMIT 1
          `
        : await prisma.$queryRaw`
            SELECT id FROM "Contact"
            WHERE "organizationId" = ${organization.id}
              AND LOWER(COALESCE("firstName", '')) = ${firstName.toLowerCase()}
              AND LOWER(COALESCE("lastName", '')) = ${lastName.toLowerCase()}
              AND COALESCE("parentCompanyName", '') = ${company?.companyName ?? ""}
            LIMIT 1
          `;

      if (existing[0]?.id) {
        await prisma.$executeRaw`
          UPDATE "Contact"
          SET
            "category" = 'Ansprechpartner',
            "type" = 'person',
            "salutation" = COALESCE(NULLIF("salutation", ''), ${nullable(record.Anrede || parseSalutation(mainContactName || fullName))}),
            "firstName" = ${nullable(firstName)},
            "lastName" = ${nullable(lastName)},
            "position" = COALESCE(NULLIF("position", ''), ${nullable(record.Position)}),
            "email" = ${nullable(email)},
            "phone" = COALESCE(NULLIF("phone", ''), ${nullable(phone)}),
            "mobile" = COALESCE(NULLIF("mobile", ''), ${nullable(mobile)}),
            "street" = COALESCE(NULLIF("street", ''), ${address.street}),
            "postalCode" = COALESCE(NULLIF("postalCode", ''), ${address.postalCode}),
            "city" = COALESCE(NULLIF("city", ''), ${address.city}),
            "country" = COALESCE(NULLIF("country", ''), ${address.country}),
            "parentCompanyId" = ${company?.id ?? null},
            "parentCompanyName" = ${company?.companyName ?? null},
            "mainContactName" = ${nullable(mainContactName)},
            "isMainContact" = ${isMainContact},
            "updatedAt" = ${importedAt}
          WHERE "id" = ${existing[0].id}
        `;
        contactsUpdated += 1;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "Contact" (
            "id", "organizationId", "category", "type", "customerNumber",
            "salutation", "firstName", "lastName", "position", "email", "phone", "mobile",
            "street", "postalCode", "city", "country", "source", "reachability",
            "parentCompanyId", "parentCompanyName", "mainContactName", "isMainContact",
            "createdAt", "updatedAt"
          )
          VALUES (
            ${crypto.randomUUID()}, ${organization.id}, 'Ansprechpartner', 'person', ${clean(record.Kundennummer)},
            ${nullable(record.Anrede || parseSalutation(mainContactName || fullName))}, ${nullable(firstName)}, ${nullable(lastName)}, ${nullable(record.Position)},
            ${nullable(email)}, ${nullable(phone)}, ${nullable(mobile)},
            ${address.street}, ${address.postalCode}, ${address.city}, ${address.country}, 'XLSX Import', 'Sonstige',
            ${company?.id ?? null}, ${company?.companyName ?? null}, ${nullable(mainContactName)}, ${isMainContact},
            ${parseCreatedAt(record.Erstellungsdatum)}, ${importedAt}
          )
        `;
        contactsCreated += 1;
      }
    }

    const companies = await prisma.$queryRaw`
      SELECT id, "companyName", "mainContactName"
      FROM "Contact"
      WHERE "organizationId" = ${organization.id}
        AND "type" = 'company'
        AND COALESCE("mainContactName", '') <> ''
    `;

    for (const company of companies) {
      const mainContactName = clean(company.mainContactName);
      const mainContact = await prisma.$queryRaw`
        SELECT id FROM "Contact"
        WHERE "organizationId" = ${organization.id}
          AND "parentCompanyId" = ${company.id}
          AND LOWER(CONCAT(COALESCE("firstName", ''), ' ', COALESCE("lastName", ''))) = ${normalizeName(mainContactName)}
        LIMIT 1
      `;
      if (mainContact[0]) continue;

      const name = splitName(mainContactName);
      await prisma.$executeRaw`
        INSERT INTO "Contact" (
          "id", "organizationId", "category", "type", "customerNumber",
          "salutation", "firstName", "lastName", "position", "source", "reachability",
          "parentCompanyId", "parentCompanyName", "mainContactName", "isMainContact",
          "createdAt", "updatedAt"
        )
        VALUES (
          ${crypto.randomUUID()}, ${organization.id}, 'Ansprechpartner', 'person', '',
          ${nullable(parseSalutation(mainContactName))}, ${nullable(name.firstName)}, ${nullable(name.lastName)}, 'Hauptkontakt',
          'XLSX Import', 'Sonstige', ${company.id}, ${company.companyName}, ${mainContactName}, true,
          ${importedAt}, ${importedAt}
        )
      `;
      placeholdersCreated += 1;
    }

    console.log(
      JSON.stringify({
        companiesCreatedOrUpdated,
        contactsCreated,
        contactsUpdated,
        placeholdersCreated,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
