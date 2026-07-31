import { describe, expect, it } from "vitest";
import { addInvoiceDays, calculateInvoiceDraftTotals, calculateInvoiceLineNet, normalizeInvoiceDate, normalizeInvoicePaymentTermDays } from "@/lib/invoices/invoice-core";

describe("shared invoice core", () => {
  it("uses deterministic line and invoice totals", () => {
    expect(calculateInvoiceLineNet({ quantity: 2, unitPrice: 100, discountPercent: 10 })).toBe(180);
    expect(calculateInvoiceDraftTotals([{ totalNet: 180 }], 5, 19)).toEqual({ lineNetBeforeInvoiceDiscount: 180, invoiceDiscountAmount: 9, netTotal: 171, vatRate: 19, vatAmount: 32.49, grossTotal: 203.49 });
  });

  it("validates dates and clamps payment terms", () => {
    expect(normalizeInvoiceDate("2026-07-31")).toBe("2026-07-31");
    expect(normalizeInvoiceDate("31.07.2026")).toBe("");
    expect(normalizeInvoicePaymentTermDays(999)).toBe(365);
    expect(addInvoiceDays("2026-07-31", 14)).toBe("2026-08-14");
  });
});
