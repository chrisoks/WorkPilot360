import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, " ");
}

function displayName(contact) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

async function main() {
  const companies = await prisma.contact.findMany({
    where: {
      type: "company",
      source: { in: ["CSV Import", "XLSX Import", "HERO Import"] },
      phoneNormalized: { not: null },
      firstName: { not: null },
      lastName: { not: null },
    },
    select: {
      id: true,
      organizationId: true,
      companyName: true,
      firstName: true,
      lastName: true,
      phone: true,
      phoneNormalized: true,
      source: true,
    },
  });
  const people = await prisma.contact.findMany({
    where: {
      type: "person",
      parentCompanyId: { in: companies.map((company) => company.id) },
      phoneNormalized: { not: null },
    },
    select: {
      id: true,
      parentCompanyId: true,
      firstName: true,
      lastName: true,
      phone: true,
      phoneNormalized: true,
    },
  });
  const peopleByCompany = new Map();
  for (const person of people) {
    const entries = peopleByCompany.get(person.parentCompanyId) ?? [];
    entries.push(person);
    peopleByCompany.set(person.parentCompanyId, entries);
  }

  const changes = companies.flatMap((company) => {
    const companyPersonName = normalizeName(displayName(company));
    if (!companyPersonName || !company.phoneNormalized) return [];
    const exactPerson = (peopleByCompany.get(company.id) ?? []).find(
      (person) =>
        normalizeName(displayName(person)) === companyPersonName &&
        person.phoneNormalized === company.phoneNormalized
    );
    return exactPerson ? [{ company, person: exactPerson }] : [];
  });

  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    companiesScanned: companies.length,
    exactLegacyDuplicates: changes.map(({ company, person }) => ({
      companyId: company.id,
      company: company.companyName,
      personId: person.id,
      person: displayName(person),
      phone: company.phone,
      source: company.source,
    })),
  }, null, 2));

  if (!applyChanges || changes.length === 0) return;
  await prisma.$transaction(changes.flatMap(({ company }) => [
    prisma.contact.update({
      where: { id: company.id },
      data: { phone: null, phoneNormalized: null, updatedAt: new Date() },
    }),
    prisma.contactIntegrationEvent.create({
      data: {
        organizationId: company.organizationId,
        contactId: company.id,
        eventType: "legacy_phone_duplicate_removed",
        changedFields: ["phone", "phoneNormalized"],
      },
    }),
  ]));
  console.log(JSON.stringify({ applied: true, companiesUpdated: changes.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Cleanup failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
