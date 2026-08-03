import type { Prisma } from "@prisma/client";

type ContactNumberTransaction = Pick<Prisma.TransactionClient, "$executeRaw" | "$queryRaw">;

export class ContactNumberConflictError extends Error {
  constructor() {
    super("Diese Kundennummer ist bereits vergeben.");
    this.name = "ContactNumberConflictError";
  }
}

async function lockContactNumbers(tx: ContactNumberTransaction, organizationId: string) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`workpilot:contact-number:${organizationId}`}, 0))
  `;
}

export async function allocateContactCustomerNumber(input: {
  tx: ContactNumberTransaction;
  organizationId: string;
  requestedNumber?: string;
}) {
  await lockContactNumbers(input.tx, input.organizationId);
  const maximumRows = await input.tx.$queryRaw<Array<{ maximum: bigint | number | null }>>`
    SELECT MAX(
      CASE
        WHEN BTRIM("customerNumber") ~ '^[0-9]+$' THEN BTRIM("customerNumber")::BIGINT
        ELSE NULL
      END
    ) AS "maximum"
    FROM "Contact"
    WHERE "organizationId" = ${input.organizationId}
  `;
  const maximum = Number(maximumRows[0]?.maximum ?? 7000048);
  const customerNumber = input.requestedNumber?.trim() || String(maximum + 1);
  const duplicateRows = await input.tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Contact"
    WHERE "organizationId" = ${input.organizationId}
      AND BTRIM("customerNumber") = ${customerNumber}
    LIMIT 1
  `;
  if (duplicateRows[0]) throw new ContactNumberConflictError();
  return customerNumber;
}

export async function assertChangedContactCustomerNumberAvailable(input: {
  tx: ContactNumberTransaction;
  organizationId: string;
  contactId: string;
  previousNumber: string;
  nextNumber: string;
}) {
  await lockContactNumbers(input.tx, input.organizationId);
  if (input.nextNumber === input.previousNumber) return;
  const duplicateRows = await input.tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Contact"
    WHERE "organizationId" = ${input.organizationId}
      AND "id" <> ${input.contactId}
      AND BTRIM("customerNumber") = ${input.nextNumber}
    LIMIT 1
  `;
  if (duplicateRows[0]) throw new ContactNumberConflictError();
}
