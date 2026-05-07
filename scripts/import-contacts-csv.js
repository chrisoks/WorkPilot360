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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

function clean(value) {
  return String(value ?? "").trim();
}

function nullable(value) {
  const cleaned = clean(value);
  return cleaned || null;
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
}

async function main() {
  loadEnv();

  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error("Bitte CSV-Pfad übergeben.");
  }

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

    const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const headers = rows.shift() ?? [];
    const importedAt = new Date();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      const firstName = clean(record.Vorname);
      const lastName = clean(record.Nachname);
      const companyName = clean(record.Firmenname);
      const email = clean(record["E-Mail"]);
      const customerNumber = clean(record.Kundennummer);

      if (!firstName && !lastName && !companyName && !email && !customerNumber) {
        skipped += 1;
        continue;
      }

      const address = parseAddress(record.Ort);
      const type = clean(record.Typ).toLowerCase() === "firma" ? "company" : "person";
      const createdAt = parseCreatedAt(record.Erstellungsdatum);
      const contactNumber = customerNumber || "";

      const existing = contactNumber
        ? await prisma.$queryRaw`
            SELECT id FROM "Contact"
            WHERE "organizationId" = ${organization.id}
              AND "customerNumber" = ${contactNumber}
            LIMIT 1
          `
        : await prisma.$queryRaw`
            SELECT id FROM "Contact"
            WHERE "organizationId" = ${organization.id}
              AND COALESCE("email", '') = ${email}
              AND COALESCE("firstName", '') = ${firstName}
              AND COALESCE("lastName", '') = ${lastName}
            LIMIT 1
          `;

      const existingId = existing[0]?.id;

      if (existingId) {
        await prisma.$executeRaw`
          UPDATE "Contact"
          SET
            "category" = ${clean(record.Kategorie) || "Kunde"},
            "type" = ${type},
            "customerNumber" = ${contactNumber},
            "companyName" = ${nullable(companyName)},
            "firstName" = ${nullable(firstName)},
            "lastName" = ${nullable(lastName)},
            "email" = ${nullable(email)},
            "phone" = ${nullable(record.Telefon)},
            "mobile" = ${nullable(record.Mobil)},
            "street" = ${address.street},
            "postalCode" = ${address.postalCode},
            "city" = ${address.city},
            "country" = ${address.country},
            "source" = COALESCE("source", 'CSV Import'),
            "reachability" = COALESCE("reachability", 'Sonstige'),
            "updatedAt" = ${importedAt}
          WHERE "id" = ${existingId}
        `;
        updated += 1;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "Contact" (
            "id", "organizationId", "category", "type", "customerNumber",
            "companyName", "firstName", "lastName", "email", "phone", "mobile",
            "street", "postalCode", "city", "country", "source", "reachability",
            "createdAt", "updatedAt"
          )
          VALUES (
            ${crypto.randomUUID()}, ${organization.id}, ${clean(record.Kategorie) || "Kunde"}, ${type}, ${contactNumber},
            ${nullable(companyName)}, ${nullable(firstName)}, ${nullable(lastName)}, ${nullable(email)}, ${nullable(record.Telefon)}, ${nullable(record.Mobil)},
            ${address.street}, ${address.postalCode}, ${address.city}, ${address.country}, 'CSV Import', 'Sonstige',
            ${createdAt}, ${importedAt}
          )
        `;
        created += 1;
      }
    }

    const total = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM "Contact" WHERE "organizationId" = ${organization.id}
    `;

    console.log(
      JSON.stringify({
        created,
        updated,
        skipped,
        totalContacts: total[0]?.count ?? 0,
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
