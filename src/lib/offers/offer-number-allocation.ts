import type { Prisma } from "@prisma/client";

type OfferNumberTransaction = Pick<Prisma.TransactionClient, "$queryRaw">;

function numericOfferNumber(offerNumber: string) {
  return Number((offerNumber.match(/\d+/g) ?? ["10099"]).join(""));
}

/** Reads the next number inside the organization-bound offer CRUD transaction. */
export async function allocateNextOfferNumber(
  tx: OfferNumberTransaction,
  organizationId: string
) {
  const rows = await tx.$queryRaw<Array<{ offerNumber: string }>>`
    SELECT "offerNumber"
    FROM "Offer"
    WHERE "organizationId" = ${organizationId}
  `;
  const highest =
    rows
      .map((row) => numericOfferNumber(row.offerNumber))
      .filter((value) => Number.isFinite(value))
      .sort((first, second) => second - first)[0] ?? 10099;

  return `ANG-${highest + 1}`;
}
