import { PrismaClient } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

function normalizePhone(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { kind: "empty", normalized: null };

  const hasInternationalPrefix = raw.startsWith("+") || raw.startsWith("00");
  const hasGermanNationalPrefix = raw.startsWith("0");
  if (!hasInternationalPrefix && !hasGermanNationalPrefix) {
    return { kind: "ambiguous", normalized: null };
  }

  const candidate = raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
  const parsed = parsePhoneNumberFromString(candidate, hasInternationalPrefix ? undefined : "DE");
  if (!parsed || !parsed.isValid()) return { kind: "invalid", normalized: null };
  return { kind: "valid", normalized: parsed.number };
}

const FIELD_PAIRS = [
  ["phone", "phoneNormalized"],
  ["mobile", "mobileNormalized"],
  ["fax", "faxNormalized"],
];

function createCounter() {
  return { empty: 0, valid: 0, invalid: 0, ambiguous: 0, changed: 0 };
}

async function main() {
  const contacts = await prisma.contact.findMany({
    select: {
      id: true,
      organizationId: true,
      phone: true,
      mobile: true,
      fax: true,
      phoneNormalized: true,
      mobileNormalized: true,
      faxNormalized: true,
      updatedAt: true,
    },
  });

  const totals = Object.fromEntries(FIELD_PAIRS.map(([rawField]) => [rawField, createCounter()]));
  const duplicateGroups = new Map();
  const changes = [];

  for (const contact of contacts) {
    const update = {};
    const changedFields = [];

    for (const [rawField, normalizedField] of FIELD_PAIRS) {
      const result = normalizePhone(contact[rawField]);
      totals[rawField][result.kind] += 1;

      if (result.normalized) {
        const duplicateKey = `${contact.organizationId}:${result.normalized}`;
        duplicateGroups.set(duplicateKey, (duplicateGroups.get(duplicateKey) ?? 0) + 1);
      }

      const rawChanged = result.normalized !== null && contact[rawField] !== result.normalized;
      const normalizedChanged = contact[normalizedField] !== result.normalized;
      if (rawChanged || normalizedChanged) {
        totals[rawField].changed += 1;
        if (rawChanged) {
          update[rawField] = result.normalized;
          changedFields.push(rawField);
        }
        update[normalizedField] = result.normalized;
        changedFields.push(normalizedField);
      }
    }

    if (changedFields.length > 0) {
      changes.push({ contact, update, changedFields });
    }
  }

  const duplicateGroupCount = [...duplicateGroups.values()].filter((count) => count > 1).length;
  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    contactsScanned: contacts.length,
    fields: totals,
    duplicateGroups: duplicateGroupCount,
    contactsToUpdate: changes.length,
  }, null, 2));

  if (!applyChanges || changes.length === 0) return;

  const batchSize = 100;
  for (let index = 0; index < changes.length; index += batchSize) {
    const batch = changes.slice(index, index + batchSize);
    await prisma.$transaction(batch.flatMap(({ contact, update, changedFields }) => [
      prisma.contact.update({
        where: { id: contact.id },
        data: { ...update, updatedAt: contact.updatedAt },
      }),
      prisma.contactIntegrationEvent.create({
        data: {
          organizationId: contact.organizationId,
          contactId: contact.id,
          eventType: "phone_normalized",
          changedFields,
        },
      }),
    ]));
  }

  console.log(JSON.stringify({ applied: true, contactsUpdated: changes.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Normalization failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
