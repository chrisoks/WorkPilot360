import { describe, expect, it, vi } from "vitest";
import {
  evaluateInvoicePayment,
  getInvoicePaymentConfirmationText,
  markInvoicePaid,
  matchesInvoicePaymentConfirmation,
} from "@/lib/invoices/invoice-payment-service";

const invoice = {
  id: "invoice-1",
  organizationId: "org-1",
  projectId: "project-1",
  projectNumber: "HAS-1",
  projectTitle: "Hausmeisterservice",
  company: "OK solutions",
  invoiceNumber: "RE-10119",
  status: "Fakturiert",
  billingSource: "manual",
  customerName: "Klaus Testmann",
  customerStreet: "",
  customerCity: "",
  contactName: "",
  internalContactName: "",
  internalPhone: "",
  internalEmail: "",
  plannedExecutionMonth: "2026-07",
  serviceDate: "2026-07-20",
  sourceOfferId: "",
  sourceOfferNumber: "",
  introText: "",
  closingText: "",
  netTotal: 100,
  vatRate: 19,
  grossTotal: 119,
  discountPercent: 0,
  paymentTermDays: 14,
  dueDate: "2026-08-03",
  reminderLevel: 0,
  lastReminderAt: null,
  isPaid: false,
  paidAt: null,
  pdfData: "pdf",
  createdAt: new Date("2026-07-20T10:00:00.000Z"),
  updatedAt: new Date("2026-07-30T10:00:00.000Z"),
};

describe("invoice payment service", () => {
  it("requires the exact invoice- and date-bound phrase", () => {
    expect(getInvoicePaymentConfirmationText("RE-10119", "2026-07-31")).toBe(
      "BEZAHLT RE-10119 AM 31.07.2026"
    );
    expect(
      matchesInvoicePaymentConfirmation(
        "RE-10119",
        "2026-07-31",
        "BEZAHLT RE-10119 AM 31.07.2026"
      )
    ).toBe(true);
    expect(
      matchesInvoicePaymentConfirmation(
        "RE-10119",
        "2026-07-31",
        "bezahlt RE-10119 AM 31.07.2026"
      )
    ).toBe(false);
    expect(
      matchesInvoicePaymentConfirmation(
        "RE-10119",
        "2026-07-31",
        "BEZAHLT RE-10119 AM 30.07.2026"
      )
    ).toBe(false);
  });

  it("binds the full amount and payment date into a stable fingerprint", async () => {
    const result = await evaluateInvoicePayment({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      paymentDate: "2026-07-31",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: { invoice: { findFirst: vi.fn().mockResolvedValue(invoice) } } as never,
    });
    expect(result.blockingIssues).toEqual([]);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "full-payment", status: "ok" }),
      ])
    );
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const changed = await evaluateInvoicePayment({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      paymentDate: "2026-07-30",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: { invoice: { findFirst: vi.fn().mockResolvedValue(invoice) } } as never,
    });
    expect(changed.fingerprint).not.toBe(result.fingerprint);
  });

  it("blocks future dates and non-factured invoices", async () => {
    const future = await evaluateInvoicePayment({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      paymentDate: "2026-08-01",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: { invoice: { findFirst: vi.fn().mockResolvedValue(invoice) } } as never,
    });
    expect(future.blockingIssues).toContain(
      "Das Zahlungsdatum darf nicht in der Zukunft liegen."
    );

    await expect(
      evaluateInvoicePayment({
        organizationId: "org-1",
        invoiceId: "invoice-1",
        paymentDate: "2026-07-31",
        db: {
          invoice: {
            findFirst: vi.fn().mockResolvedValue({ ...invoice, status: "Entwurf" }),
          },
        } as never,
      })
    ).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("marks exactly one factured invoice paid and writes one history event", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const historyCreate = vi.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      invoice: {
        findFirst: vi.fn().mockResolvedValue(invoice),
        updateMany,
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...invoice,
          status: "Bezahlt",
          isPaid: true,
          paidAt: new Date("2026-07-31T12:00:00.000Z"),
        }),
      },
      invoiceHistory: { create: historyCreate },
    };
    const preflight = await evaluateInvoicePayment({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      paymentDate: "2026-07-31",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: tx as never,
    });
    const result = await markInvoicePaid({
      tx: tx as never,
      organizationId: "org-1",
      invoiceId: "invoice-1",
      paymentDate: "2026-07-31",
      actorName: "Christian Eid",
      expectedFingerprint: preflight.fingerprint,
      source: "jarvis",
    });
    expect(result).toMatchObject({ status: "Bezahlt", isPaid: true });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "Fakturiert", isPaid: false }),
        data: expect.objectContaining({ status: "Bezahlt", isPaid: true }),
      })
    );
    expect(historyCreate).toHaveBeenCalledTimes(1);
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "paid",
        note: expect.stringContaining("durch JARVIS"),
      }),
    });
  });

  it("fails closed when invoice or payment date changed", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      invoice: {
        findFirst: vi.fn().mockResolvedValue(invoice),
        updateMany: vi.fn(),
      },
    };
    await expect(
      markInvoicePaid({
        tx: tx as never,
        organizationId: "org-1",
        invoiceId: "invoice-1",
        paymentDate: "2026-07-31",
        actorName: "Christian Eid",
        expectedFingerprint: "stale",
        source: "jarvis",
      })
    ).rejects.toMatchObject({ code: "stale_context" });
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });
});
