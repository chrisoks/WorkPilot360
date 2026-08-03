import { Prisma, type PrismaClient } from "@prisma/client";

type OfferCrudPrisma = Pick<PrismaClient, "$transaction">;

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryableTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function runOfferCrudTransaction<T>(input: {
  prisma: OfferCrudPrisma;
  organizationId: string;
  lockKey: string;
  operation: (tx: Prisma.TransactionClient) => Promise<T>;
}) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await input.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`workpilot:offer-crud:${input.organizationId}:${input.lockKey}`}, 0)
            )
          `;
          return input.operation(tx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 30_000,
        }
      );
    } catch (error) {
      if (!isRetryableTransactionConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }

  throw new Error("Offer transaction retry limit reached.");
}
