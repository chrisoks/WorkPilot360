import { describe, expect, it, vi } from "vitest";
import {
  evaluateInvoiceCredit,
  getInvoiceCreditConfirmationText,
  matchesInvoiceCreditConfirmation,
} from "@/lib/invoices/invoice-credit-service";

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
  serviceDate: "2026-07-20",
  netTotal: 150,
  grossTotal: 178.5,
  isPaid: false,
  updatedAt: new Date("2026-07-31T08:00:00.000Z"),
  lines: [
    { id: "line-1", position: 1, title: "Leistung A", totalNet: 100, vatRate: 19 },
    { id: "line-2", position: 2, title: "Leistung B", totalNet: 50, vatRate: 19 },
  ],
};

function dbWith(input?: {
  invoice?: Record<string, unknown> | null;
  previousCredits?: Array<Record<string, unknown>>;
}) {
  return {
    invoice: {
      findFirst: vi.fn().mockResolvedValue(input?.invoice === undefined ? invoice : input.invoice),
      findMany: vi.fn().mockResolvedValue(input?.previousCredits ?? []),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ invoiceNumber: "GU-10103" }]),
  } as never;
}

describe("invoice credit service", () => {
  it("requires the exact reference-, GU-number- and gross-bound phrase", () => {
    const phrase = getInvoiceCreditConfirmationText("RE-10119", "GU-10104", 23.8);
    expect(phrase).toBe("GUTSCHRIFT GU-10104 ZU RE-10119 ÜBER 23,80 EUR");
    expect(matchesInvoiceCreditConfirmation("RE-10119", "GU-10104", 23.8, phrase)).toBe(true);
    expect(matchesInvoiceCreditConfirmation("RE-10119", "GU-10104", 23.8, phrase.toLowerCase())).toBe(false);
  });

  it("evaluates a transparent line-bound partial credit", async () => {
    const result = await evaluateInvoiceCredit({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      items: [{ sourceInvoiceLineId: "line-1", netAmount: 20 }],
      db: dbWith(),
    });
    expect(result.creditNumber).toBe("GU-10104");
    expect(result.totalCreditNet).toBe(20);
    expect(result.totalCreditGross).toBe(23.8);
    expect(result.remainingInvoiceNet).toBe(150);
    expect(result.blockingIssues).toEqual([]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.lines[0]).toMatchObject({ creditNet: 20, remainingNet: 100 });
  });

  it("subtracts earlier credits and blocks over-crediting", async () => {
    const previousCredits = [{
      id: "credit-1",
      invoiceNumber: "GU-10100",
      status: "Gutschrift",
      updatedAt: new Date("2026-07-30T08:00:00.000Z"),
      lines: [{ sourceInvoiceLineId: "line-1", totalNet: -80 }],
    }];
    const result = await evaluateInvoiceCredit({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      items: [{ sourceInvoiceLineId: "line-1", netAmount: 21 }],
      db: dbWith({ previousCredits }),
    });
    expect(result.lines[0]).toMatchObject({ alreadyCreditedNet: 80, remainingNet: 20 });
    expect(result.blockingIssues.join(" ")).toContain("nur noch 20,00");
  });

  it("does not turn a full remaining correction into a partial credit", async () => {
    const result = await evaluateInvoiceCredit({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      items: [
        { sourceInvoiceLineId: "line-1", netAmount: 100 },
        { sourceInvoiceLineId: "line-2", netAmount: 50 },
      ],
      db: dbWith(),
    });
    expect(result.blockingIssues.join(" ")).toContain("gesamten noch offenen Rechnungswert");
  });

  it("warns for paid invoices and keeps time, inventory and payouts separate", async () => {
    const result = await evaluateInvoiceCredit({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      items: [{ sourceInvoiceLineId: "line-1", netAmount: 20 }],
      db: dbWith({ invoice: { ...invoice, status: "Bezahlt", isPaid: true } }),
    });
    expect(result.warnings.join(" ")).toContain("keine Auszahlung");
    expect(result.warnings.join(" ")).toContain("weder Zeiten");
    expect(result.blockingIssues).toEqual([]);
  });

  it("blocks invalid states, missing positions and tenant misses", async () => {
    await expect(evaluateInvoiceCredit({ organizationId: "org-1", invoiceId: "invoice-1", db: dbWith({ invoice: { ...invoice, status: "Entwurf" } }) })).rejects.toMatchObject({ code: "invalid_state" });
    await expect(evaluateInvoiceCredit({ organizationId: "org-2", invoiceId: "invoice-1", db: dbWith({ invoice: null }) })).rejects.toMatchObject({ code: "not_found" });
    const empty = await evaluateInvoiceCredit({ organizationId: "org-1", invoiceId: "invoice-1", db: dbWith({ invoice: { ...invoice, lines: [] } }) });
    expect(empty.blockingIssues.join(" ")).toContain("keine Positionen");
  });
});
