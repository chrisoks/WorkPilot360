import { Prisma, type PrismaClient } from "@prisma/client";

type InvoiceCrudPrisma = Pick<PrismaClient, "$transaction">;

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryableTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function runInvoiceCrudTransaction<T>(input: {
  prisma: InvoiceCrudPrisma;
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
              hashtextextended(${`workpilot:invoice-crud:${input.organizationId}:${input.lockKey}`}, 0)
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

  throw new Error("Invoice transaction retry limit reached.");
}
