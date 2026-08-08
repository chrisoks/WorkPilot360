import { Prisma, type PrismaClient } from "@prisma/client";
import { runInvoiceCrudTransaction } from "./invoice-crud-transaction";
import {
  normalizeHourlyBillingDays,
  updateHourlyBillingDayCustomerText,
} from "./hourly-billing-details";

type HourlyCustomerTextPrisma = Pick<PrismaClient, "$transaction">;

export class HourlyCustomerTextServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HourlyCustomerTextServiceError";
  }
}

export async function saveHourlyCustomerText(input: {
  prisma: HourlyCustomerTextPrisma;
  organizationId: string;
  invoiceId: string;
  invoiceLineId: string;
  date: string;
  customerText: string;
  expectedUpdatedAt: string;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new HourlyCustomerTextServiceError("Das Leistungsdatum ist ungültig.", 400);
  }
  if (input.customerText.length > 4_000) {
    throw new HourlyCustomerTextServiceError("Der Kundentext ist zu lang.", 400);
  }
  const expectedTimestamp = new Date(input.expectedUpdatedAt).getTime();
  if (!input.expectedUpdatedAt || !Number.isFinite(expectedTimestamp)) {
    throw new HourlyCustomerTextServiceError(
      "Die Rechnung wurde zwischenzeitlich geändert. Bitte neu laden und erneut bearbeiten.",
      409
    );
  }

  return runInvoiceCrudTransaction({
    prisma: input.prisma,
    organizationId: input.organizationId,
    lockKey: `invoice:${input.invoiceId}`,
    operation: async (tx) => {
      const invoiceRows = await tx.$queryRaw<
        Array<{ id: string; status: string; billingSource: string; updatedAt: Date }>
      >`
        SELECT "id", "status", "billingSource", "updatedAt"
        FROM "Invoice"
        WHERE "organizationId" = ${input.organizationId} AND "id" = ${input.invoiceId}
        FOR UPDATE
      `;
      const invoice = invoiceRows[0];
      if (!invoice) {
        throw new HourlyCustomerTextServiceError("Rechnung wurde nicht gefunden.", 404);
      }
      if (invoice.status !== "Entwurf" || invoice.billingSource !== "hourly-recurring") {
        throw new HourlyCustomerTextServiceError(
          "Der Kundentext kann nur in einem offenen Stundenabrechnungsentwurf automatisch gespeichert werden.",
          409
        );
      }
      if (invoice.updatedAt.getTime() !== expectedTimestamp) {
        throw new HourlyCustomerTextServiceError(
          "Die Rechnung wurde zwischenzeitlich geändert. Bitte neu laden und erneut bearbeiten.",
          409
        );
      }

      const lineRows = await tx.$queryRaw<Array<{ id: string; hourlyBillingDetails: Prisma.JsonValue }>>`
        SELECT "id", "hourlyBillingDetails"
        FROM "InvoiceLine"
        WHERE "organizationId" = ${input.organizationId}
          AND "invoiceId" = ${input.invoiceId}
          AND "id" = ${input.invoiceLineId}
        FOR UPDATE
      `;
      const line = lineRows[0];
      if (!line) {
        throw new HourlyCustomerTextServiceError("Rechnungsposition wurde nicht gefunden.", 404);
      }
      const billingDays = normalizeHourlyBillingDays(line.hourlyBillingDetails);
      if (!billingDays.some((day) => day.date === input.date)) {
        throw new HourlyCustomerTextServiceError("Die Tagesleistung wurde nicht gefunden.", 409);
      }
      const hourlyBillingDetails = updateHourlyBillingDayCustomerText(
        billingDays,
        input.date,
        input.customerText
      );
      const updatedAt = new Date();
      await tx.invoiceLine.update({
        where: { id: line.id },
        data: { hourlyBillingDetails: hourlyBillingDetails as Prisma.InputJsonValue },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { updatedAt },
      });

      return {
        invoiceId: invoice.id,
        lineId: line.id,
        date: input.date,
        customerText: input.customerText,
        updatedAt: updatedAt.toISOString(),
      };
    },
  });
}
