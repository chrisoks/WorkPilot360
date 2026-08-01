import { describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  cleanupStorageBackedPayload: vi.fn().mockResolvedValue(undefined),
  persistStorageBackedPayload: vi.fn().mockResolvedValue(undefined),
  prepareStorageBackedPayload: vi.fn(async (input: {
    originalName: string;
    contentType: string;
    bytes: Uint8Array;
  }) => ({
    prepared: {
      attachments: [
        {
          name: input.originalName,
          type: "Dokument",
          mimeType: input.contentType,
          size: input.bytes.byteLength,
          dataUrl: `data:${input.contentType};base64,${Buffer.from(input.bytes).toString("base64")}`,
        },
      ],
      files: [],
      provider: null,
      fallbackCount: 1,
    },
    storedFileId: null,
    reference: null,
  })),
}));

vi.mock("@/lib/storage/document-file", () => storageMocks);

import {
  addReminderDays,
  createInvoiceReminder,
  evaluateInvoiceReminder,
  getInvoiceReminderConfirmationText,
  matchesInvoiceReminderConfirmation,
} from "@/lib/invoices/invoice-reminder-service";

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
  customerStreet: "Musterweg 1",
  customerCity: "74722 Buchen",
  contactName: "Klaus Testmann",
  internalContactName: "Christian Eid",
  internalPhone: "",
  internalEmail: "",
  plannedExecutionMonth: "2026-06",
  serviceDate: "2026-06-20",
  sourceOfferId: "",
  sourceOfferNumber: "",
  introText: "",
  closingText: "",
  netTotal: 100,
  vatRate: 19,
  grossTotal: 119,
  discountPercent: 0,
  paymentTermDays: 14,
  dueDate: "2026-07-14",
  reminderLevel: 0,
  lastReminderAt: null,
  isPaid: false,
  paidAt: null,
  pdfData: "pdf",
  createdAt: new Date("2026-06-20T10:00:00.000Z"),
  updatedAt: new Date("2026-07-30T10:00:00.000Z"),
};

function dbWithInvoice(value: Record<string, unknown> = invoice) {
  return { invoice: { findFirst: vi.fn().mockResolvedValue(value) } } as never;
}

describe("invoice reminder service", () => {
  it("requires the exact document- and deadline-bound phrase", () => {
    expect(getInvoiceReminderConfirmationText("MA-RE-10119-1", "2026-08-07")).toBe(
      "MAHNUNG MA-RE-10119-1 BIS 07.08.2026"
    );
    expect(
      matchesInvoiceReminderConfirmation(
        "MA-RE-10119-1",
        "2026-08-07",
        "MAHNUNG MA-RE-10119-1 BIS 07.08.2026"
      )
    ).toBe(true);
    expect(
      matchesInvoiceReminderConfirmation(
        "MA-RE-10119-1",
        "2026-08-07",
        "Mahnung MA-RE-10119-1 BIS 07.08.2026"
      )
    ).toBe(false);
  });

  it("prepares the next level, deadline and fingerprint", async () => {
    const result = await evaluateInvoiceReminder({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      reminderDate: "2026-07-31",
      paymentDeadline: "2026-08-07",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: dbWithInvoice(),
    });
    expect(result.blockingIssues).toEqual([]);
    expect(result.nextReminderLevel).toBe(1);
    expect(result.documentNumber).toBe("MA-RE-10119-1");
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "overdue", status: "ok" }),
        expect.objectContaining({ key: "amount", status: "ok" }),
      ])
    );
  });

  it("blocks paid, non-factured and not-yet-due invoices", async () => {
    await expect(
      evaluateInvoiceReminder({
        organizationId: "org-1",
        invoiceId: "invoice-1",
        db: dbWithInvoice({ ...invoice, isPaid: true, status: "Bezahlt" }),
      })
    ).rejects.toMatchObject({ code: "invalid_state" });
    await expect(
      evaluateInvoiceReminder({
        organizationId: "org-1",
        invoiceId: "invoice-1",
        db: dbWithInvoice({ ...invoice, status: "Entwurf" }),
      })
    ).rejects.toMatchObject({ code: "invalid_state" });

    const notDue = await evaluateInvoiceReminder({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      reminderDate: "2026-07-31",
      paymentDeadline: "2026-08-07",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: dbWithInvoice({ ...invoice, dueDate: "2026-08-01" }),
    });
    expect(notDue.blockingIssues).toContain(
      "Die Rechnung ist am gewählten Mahndatum noch nicht überfällig."
    );
  });

  it("blocks level three and a duplicate reminder date", async () => {
    const result = await evaluateInvoiceReminder({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      reminderDate: "2026-07-31",
      paymentDeadline: "2026-08-07",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: dbWithInvoice({
        ...invoice,
        reminderLevel: 3,
        lastReminderAt: new Date("2026-07-31T08:00:00.000Z"),
      }),
    });
    expect(result.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Mahnstufe 3"),
        expect.stringContaining("bereits eine Mahnung"),
      ])
    );
  });

  it("calculates a calendar-safe default deadline", () => {
    expect(addReminderDays("2026-07-31", 7)).toBe("2026-08-07");
    expect(addReminderDays("invalid", 7)).toBe("");
  });

  it("updates one invoice and stores exactly one document and history event", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const logbookCreate = vi.fn().mockResolvedValue({ id: "logbook-1" });
    const historyCreate = vi.fn().mockResolvedValue({ id: "history-1" });
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      invoice: {
        findFirst: vi.fn().mockResolvedValue(invoice),
        updateMany,
        findFirstOrThrow: vi.fn().mockResolvedValue({
          ...invoice,
          reminderLevel: 1,
          lastReminderAt: new Date("2026-07-31T12:00:00.000Z"),
        }),
      },
      projectLogbookEntry: { create: logbookCreate },
      invoiceHistory: { create: historyCreate },
    };
    const evaluated = await evaluateInvoiceReminder({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      reminderDate: "2026-07-31",
      paymentDeadline: "2026-08-07",
      now: new Date("2026-07-31T12:00:00.000Z"),
      db: tx as never,
    });
    const result = await createInvoiceReminder({
      tx: tx as never,
      organizationId: "org-1",
      invoiceId: "invoice-1",
      reminderDate: "2026-07-31",
      paymentDeadline: "2026-08-07",
      actorName: "Jarvis Tester",
      actorUserId: "user-1",
      expectedFingerprint: evaluated.fingerprint,
      source: "jarvis",
    });

    expect(result.reminderDocument.documentNumber).toBe("MA-RE-10119-1");
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(logbookCreate).toHaveBeenCalledTimes(1);
    expect(historyCreate).toHaveBeenCalledTimes(1);
    expect(storageMocks.prepareStorageBackedPayload).toHaveBeenCalledTimes(1);
    expect(storageMocks.persistStorageBackedPayload).toHaveBeenCalledTimes(1);
    expect(logbookCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Dokumente: Mahnung",
          source: "jarvis",
        }),
      })
    );
  });
});
