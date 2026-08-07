import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  evaluateInvoiceDraft: vi.fn(),
}));

vi.mock("@/lib/invoices/invoice-draft-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/invoices/invoice-draft-service")
  >("@/lib/invoices/invoice-draft-service");
  return {
    ...actual,
    evaluateInvoiceDraft: mocks.evaluateInvoiceDraft,
  };
});

import {
  evaluateInvoiceFinalization,
  finalizeInvoiceDraft,
  getInvoiceFinalizationConfirmationText,
  matchesInvoiceFinalizationConfirmation,
} from "@/lib/invoices/invoice-finalization-service";

const invoice = {
  id: "invoice-1",
  organizationId: "org-1",
  projectId: "project-1",
  projectNumber: "MKG-209",
  projectTitle: "Marketing",
  company: "OK solutions",
  invoiceNumber: "RE-10124",
  status: "Entwurf",
  billingSource: "manual",
  customerName: "Klaus Testmann",
  customerStreet: "",
  customerCity: "",
  contactName: "",
  internalContactName: "",
  internalPhone: "",
  internalEmail: "",
  plannedExecutionMonth: "2026-07",
  serviceDate: "2026-07-31",
  sourceOfferId: "",
  sourceOfferNumber: "",
  introText: "Einleitung",
  closingText: "Schluss",
  netTotal: 100,
  vatRate: 19,
  grossTotal: 119,
  discountPercent: 0,
  paymentTermDays: 14,
  dueDate: "2026-08-14",
  reminderLevel: 0,
  lastReminderAt: null,
  isPaid: false,
  paidAt: null,
  pdfData: null,
  createdAt: new Date("2026-07-31T10:00:00.000Z"),
  updatedAt: new Date("2026-07-31T10:05:00.000Z"),
  lines: [
    {
      catalogItemId: "catalog-1",
      catalogType: "service",
      quantity: 1,
      unit: "Stk",
      title: "Leistung",
      description: "",
      unitPrice: 100,
      discountPercent: 0,
      vatRate: 19,
    },
  ],
};

const evaluatedDraft = {
  input: {},
  project: {
    id: "project-1",
    projectNumber: "MKG-209",
    projectTitle: "Marketing",
    customerName: "Klaus Testmann",
    customerStreet: "",
    customerCity: "",
    contactName: "",
    projectKind: "Einmalprojekt",
    projectType: "",
    updatedAt: "2026-07-31T09:00:00.000Z",
  },
  sourceOffer: null,
  catalogVersions: [
    { id: "catalog-1", updatedAt: "2026-07-30T09:00:00.000Z" },
  ],
  totals: {
    lineNetBeforeInvoiceDiscount: 100,
    invoiceDiscountAmount: 0,
    netTotal: 100,
    vatRate: 19,
    vatAmount: 19,
    grossTotal: 119,
  },
  missingFields: [],
  errors: [],
  warnings: [],
  preflight: [
    {
      key: "inspection",
      label: "Endkontrolle",
      status: "warning" as const,
      detail: "Endkontrolle fehlt.",
    },
  ],
};

describe("invoice finalization service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evaluateInvoiceDraft.mockResolvedValue(evaluatedDraft);
  });

  it("requires the exact invoice-bound critical phrase", () => {
    expect(getInvoiceFinalizationConfirmationText("RE-10124")).toBe(
      "FAKTURIEREN RE-10124"
    );
    expect(
      matchesInvoiceFinalizationConfirmation(
        "RE-10124",
        "FAKTURIEREN RE-10124"
      )
    ).toBe(true);
    expect(
      matchesInvoiceFinalizationConfirmation(
        "RE-10124",
        "fakturieren RE-10124"
      )
    ).toBe(false);
    expect(
      matchesInvoiceFinalizationConfirmation(
        "RE-10124",
        "FAKTURIEREN RE-99999"
      )
    ).toBe(false);
  });

  it("builds a stable preflight that excludes the target invoice itself", async () => {
    const db = {
      invoice: { findFirst: vi.fn().mockResolvedValue(invoice) },
    };
    const result = await evaluateInvoiceFinalization({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      db: db as never,
    });

    expect(mocks.evaluateInvoiceDraft).toHaveBeenCalledWith(
      expect.objectContaining({ excludeInvoiceId: "invoice-1" })
    );
    expect(result.blockingIssues).toEqual([]);
    expect(result.warnings).toContain("Endkontrolle fehlt.");
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks when stored totals no longer match the positions", async () => {
    mocks.evaluateInvoiceDraft.mockResolvedValue({
      ...evaluatedDraft,
      totals: { ...evaluatedDraft.totals, grossTotal: 120 },
    });
    const result = await evaluateInvoiceFinalization({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      db: {
        invoice: { findFirst: vi.fn().mockResolvedValue(invoice) },
      } as never,
    });
    expect(result.blockingIssues).toContain(
      "Die gespeicherten Rechnungssummen stimmen nicht mehr mit den Positionsdaten überein."
    );
  });

  it("blocks UI and JARVIS finalization when a daily customer text is missing", async () => {
    const hourlyInvoice = {
      ...invoice,
      lines: invoice.lines.map((line) => ({
        ...line,
        hourlyBillingDetails: [{
          date: "2026-08-03",
          customerText: "",
          customerTextEdited: true,
          entries: [{
            timeEntryId: "time-1",
            planningEntryId: "planning-1",
            date: "2026-08-03",
            startTime: "08:00",
            endTime: "09:00",
            employeeName: "Hendrik Eid",
            stampedHours: 1,
            billedHours: 1,
            stampComment: "Rasen gemäht",
            appointmentDescription: "Innenhof",
          }],
        }],
      })),
    };
    const result = await evaluateInvoiceFinalization({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      db: {
        invoice: { findFirst: vi.fn().mockResolvedValue(hourlyInvoice) },
      } as never,
    });
    expect(result.blockingIssues).toContain(
      "Bitte Kundentext für Leistung am 03.08.26 ergänzen."
    );
  });

  it("finalizes exactly one draft and records that no send was triggered", async () => {
    const findFirst = vi.fn().mockResolvedValue(invoice);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      ...invoice,
      status: "Fakturiert",
    });
    const historyCreate = vi.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      invoice: { findFirst, updateMany, findUniqueOrThrow },
      invoiceHistory: { create: historyCreate },
    };
    const preflight = await evaluateInvoiceFinalization({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      db: tx as never,
    });
    const result = await finalizeInvoiceDraft({
      tx: tx as never,
      organizationId: "org-1",
      invoiceId: "invoice-1",
      actorName: "Christian Eid",
      expectedFingerprint: preflight.fingerprint,
      source: "jarvis",
    });

    expect(result.status).toBe("Fakturiert");
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "Entwurf" }),
        data: { status: "Fakturiert" },
      })
    );
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "finalized",
        note: expect.stringContaining("Ein Versand wurde nicht ausgelöst"),
      }),
    });
  });

  it("fails closed when the confirmed fingerprint is stale", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      invoice: {
        findFirst: vi.fn().mockResolvedValue(invoice),
        updateMany: vi.fn(),
      },
    };
    await expect(
      finalizeInvoiceDraft({
        tx: tx as never,
        organizationId: "org-1",
        invoiceId: "invoice-1",
        actorName: "Christian Eid",
        expectedFingerprint: "stale",
        source: "jarvis",
      })
    ).rejects.toMatchObject({
      code: "stale_context",
    });
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });
});
