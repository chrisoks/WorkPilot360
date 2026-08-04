import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

async function main() {
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { type: "person", NOT: { category: "Ansprechpartner" } },
        {
          AND: [
            { OR: [{ type: "person" }, { category: "Ansprechpartner" }] },
            { NOT: { customerNumber: "" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      customerNumber: true,
      type: true,
      category: true,
    },
    orderBy: [{ organizationId: "asc" }, { id: "asc" }],
  });

  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    contactsToNormalize: contacts.length,
    customerNumbersToRemove: contacts.filter((contact) => contact.customerNumber !== "").length,
    categoriesToNormalize: contacts.filter((contact) => contact.type === "person" && contact.category !== "Ansprechpartner").length,
    organizations: [...new Set(contacts.map((contact) => contact.organizationId))].length,
  }, null, 2));

  if (!applyChanges || contacts.length === 0) return;

  await prisma.$transaction(async (transaction) => {
    for (const contact of contacts) {
      const data = {};
      const changedFields = [];
      if (contact.customerNumber !== "") {
        data.customerNumber = "";
        changedFields.push("customerNumber");
      }
      if (contact.type === "person" && contact.category !== "Ansprechpartner") {
        data.category = "Ansprechpartner";
        changedFields.push("category");
      }
      const updated = await transaction.contact.updateMany({
        where: {
          id: contact.id,
          organizationId: contact.organizationId,
          customerNumber: contact.customerNumber,
          type: contact.type,
          category: contact.category,
        },
        data,
      });
      if (updated.count !== 1) {
        throw new Error(`Kontakt ${contact.id} wurde zwischenzeitlich verändert; Normalisierung abgebrochen.`);
      }
      await transaction.contactIntegrationEvent.create({
        data: {
          organizationId: contact.organizationId,
          contactId: contact.id,
          eventType: "contact_person_normalized",
          changedFields,
        },
      });
    }

    for (const organizationId of new Set(contacts.map((contact) => contact.organizationId))) {
      await transaction.auditLog.create({
        data: {
          organizationId,
          actorId: null,
          action: "contact.person_customer_numbers_normalized",
          entityType: "contact_data_quality",
          entityId: organizationId,
          payload: {
            affectedContacts: contacts.filter((contact) => contact.organizationId === organizationId).length,
            customerNumbersRemoved: contacts.filter((contact) => contact.organizationId === organizationId && contact.customerNumber !== "").length,
            categoriesNormalized: contacts.filter((contact) => contact.organizationId === organizationId && contact.type === "person" && contact.category !== "Ansprechpartner").length,
          },
        },
      });
    }
  }, { isolationLevel: "Serializable" });

  console.log(JSON.stringify({ applied: true, contactsUpdated: contacts.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Normalisierung fehlgeschlagen.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
