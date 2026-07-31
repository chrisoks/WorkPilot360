import { describe, expect, it, vi } from "vitest";
import {
  evaluateInvoiceCancellation,
  getInvoiceCancellationConfirmationText,
  matchesInvoiceCancellationConfirmation,
} from "@/lib/invoices/invoice-cancellation-service";

const invoice = {
  id: "invoice-1",
  invoiceNumber: "RE-10119",
  status: "Fakturiert",
  projectId: "project-1",
  projectNumber: "HAS-1",
  projectTitle: "Hausmeisterservice",
  company: "OK solutions",
  customerName: "Musterkunde",
  customerStreet: "Testweg 1",
  customerCity: "74722 Buchen",
  contactName: "",
  internalContactName: "Jarvis Tester",
  serviceDate: "2026-07-20",
  netTotal: 100,
  vatRate: 19,
  grossTotal: 119,
  isPaid: false,
  paidAt: null,
  updatedAt: new Date("2026-07-31T08:00:00.000Z"),
  lines: [{
    id: "line-1",
    quantity: 2,
    unitPrice: 50,
    discountPercent: 0,
    totalNet: 100,
    updatedAt: new Date("2026-07-31T08:00:00.000Z"),
    laborItems: [],
  }],
};

function dbWithInvoice(value: Record<string, unknown> | null = invoice) {
  return {
    invoice: { findFirst: vi.fn().mockResolvedValue(value), findMany: vi.fn().mockResolvedValue([]) },
    projectTimeEntry: { count: vi.fn().mockResolvedValue(2) },
    $queryRaw: vi.fn().mockResolvedValue([{ invoiceNumber: "ST-10103" }]),
  } as never;
}

describe("invoice cancellation service", () => {
  it("requires the exact invoice- and ST-number-bound phrase", () => {
    expect(getInvoiceCancellationConfirmationText("RE-10119", "ST-10104")).toBe(
      "STORNIEREN RE-10119 MIT ST-10104"
    );
    expect(matchesInvoiceCancellationConfirmation("RE-10119", "ST-10104", "STORNIEREN RE-10119 MIT ST-10104")).toBe(true);
    expect(matchesInvoiceCancellationConfirmation("RE-10119", "ST-10104", "Stornieren RE-10119 MIT ST-10104")).toBe(false);
  });

  it("blocks a full cancellation after an active partial credit", async () => {
    const db = dbWithInvoice() as any;
    db.invoice.findMany.mockResolvedValue([{ id: "credit-1", invoiceNumber: "GU-10100", grossTotal: -23.8, updatedAt: new Date("2026-07-31T09:00:00.000Z") }]);
    const result = await evaluateInvoiceCancellation({ organizationId: "org-1", invoiceId: "invoice-1", db });
    expect(result.activeCreditCount).toBe(1);
    expect(result.creditedGrossTotal).toBe(23.8);
    expect(result.blockingIssues.join(" ")).toContain("würde überkorrigieren");
  });

  it("binds positions, time releases, amount and next ST number into the evaluation", async () => {
    const result = await evaluateInvoiceCancellation({ organizationId: "org-1", invoiceId: "invoice-1", db: dbWithInvoice() });
    expect(result.cancellationNumber).toBe("ST-10104");
    expect(result.lineCount).toBe(1);
    expect(result.releasedTimeEntryCount).toBe(2);
    expect(result.blockingIssues).toEqual([]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "lines", status: "ok" }),
      expect.objectContaining({ key: "time", status: "ok" }),
      expect.objectContaining({ key: "amount", status: "ok" }),
    ]));
  });

  it("warns for paid invoices without pretending to refund them", async () => {
    const result = await evaluateInvoiceCancellation({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      db: dbWithInvoice({ ...invoice, status: "Bezahlt", isPaid: true }),
    });
    expect(result.warnings.join(" ")).toContain("keine Rückzahlung");
    expect(result.blockingIssues).toEqual([]);
  });

  it("blocks drafts, cancelled records, missing positions and cross-tenant misses", async () => {
    await expect(evaluateInvoiceCancellation({ organizationId: "org-1", invoiceId: "invoice-1", db: dbWithInvoice({ ...invoice, status: "Entwurf" }) })).rejects.toMatchObject({ code: "invalid_state" });
    await expect(evaluateInvoiceCancellation({ organizationId: "org-1", invoiceId: "invoice-1", db: dbWithInvoice({ ...invoice, status: "Storniert" }) })).rejects.toMatchObject({ code: "invalid_state" });
    await expect(evaluateInvoiceCancellation({ organizationId: "org-2", invoiceId: "invoice-1", db: dbWithInvoice(null) })).rejects.toMatchObject({ code: "not_found" });
    const missingLines = await evaluateInvoiceCancellation({ organizationId: "org-1", invoiceId: "invoice-1", db: dbWithInvoice({ ...invoice, lines: [] }) });
    expect(missingLines.blockingIssues).toContain("Die Rechnung hat keine Positionen und kann nicht sicher storniert werden.");
  });
});
