import { describe, expect, it, vi } from "vitest";
import { saveHourlyCustomerText } from "./hourly-customer-text-service";

const originalUpdatedAt = new Date("2026-08-08T10:00:00.000Z");

function createPrisma(options?: { status?: string; billingSource?: string; updatedAt?: Date }) {
  let queryIndex = 0;
  const invoiceLineUpdate = vi.fn().mockResolvedValue({});
  const invoiceUpdate = vi.fn().mockResolvedValue({});
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockImplementation(async () => {
      queryIndex += 1;
      if (queryIndex === 1) {
        return [{
          id: "invoice-1",
          status: options?.status ?? "Entwurf",
          billingSource: options?.billingSource ?? "hourly-recurring",
          updatedAt: options?.updatedAt ?? originalUpdatedAt,
        }];
      }
      return [{
        id: "line-1",
        hourlyBillingDetails: [{
          date: "2026-08-07",
          customerText: "Alt",
          customerTextEdited: true,
          entries: [{
            timeEntryId: "time-1",
            planningEntryId: "",
            date: "2026-08-07",
            startTime: "08:00",
            endTime: "09:00",
            employeeName: "Mitarbeiter",
            stampedHours: 1,
            billedHours: 1,
            stampComment: "",
            appointmentDescription: "",
          }],
        }],
      }];
    }),
    invoiceLine: { update: invoiceLineUpdate },
    invoice: { update: invoiceUpdate },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
    },
    invoiceLineUpdate,
    invoiceUpdate,
  };
}

describe("saveHourlyCustomerText", () => {
  it("updates only the stored day text and preserves whitespace", async () => {
    const test = createPrisma();

    const result = await saveHourlyCustomerText({
      prisma: test.prisma as never,
      organizationId: "org-1",
      invoiceId: "invoice-1",
      invoiceLineId: "line-1",
      date: "2026-08-07",
      customerText: "Rasenpflege im Innenhof ",
      expectedUpdatedAt: originalUpdatedAt.toISOString(),
    });

    expect(result.customerText).toBe("Rasenpflege im Innenhof ");
    expect(test.invoiceLineUpdate).toHaveBeenCalledWith({
      where: { id: "line-1" },
      data: {
        hourlyBillingDetails: [expect.objectContaining({
          date: "2026-08-07",
          customerText: "Rasenpflege im Innenhof ",
          customerTextEdited: true,
        })],
      },
    });
    expect(test.invoiceUpdate).toHaveBeenCalledOnce();
  });

  it("rejects stale edits before changing the line", async () => {
    const test = createPrisma({ updatedAt: new Date("2026-08-08T10:01:00.000Z") });

    await expect(saveHourlyCustomerText({
      prisma: test.prisma as never,
      organizationId: "org-1",
      invoiceId: "invoice-1",
      invoiceLineId: "line-1",
      date: "2026-08-07",
      customerText: "Neu",
      expectedUpdatedAt: originalUpdatedAt.toISOString(),
    })).rejects.toMatchObject({ status: 409 });
    expect(test.invoiceLineUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-draft invoices", async () => {
    const test = createPrisma({ status: "Offen" });

    await expect(saveHourlyCustomerText({
      prisma: test.prisma as never,
      organizationId: "org-1",
      invoiceId: "invoice-1",
      invoiceLineId: "line-1",
      date: "2026-08-07",
      customerText: "Neu",
      expectedUpdatedAt: originalUpdatedAt.toISOString(),
    })).rejects.toMatchObject({ status: 409 });
    expect(test.invoiceLineUpdate).not.toHaveBeenCalled();
  });
});
