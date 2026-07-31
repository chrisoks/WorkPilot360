import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoiceFindFirst: vi.fn(),
  projectFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  contactFindMany: vi.fn(),
  dispatchFindFirst: vi.fn(),
  dispatchCreate: vi.fn(),
  dispatchUpdateMany: vi.fn(),
  dispatchFindUniqueOrThrow: vi.fn(),
  historyCreate: vi.fn(),
  executeRaw: vi.fn(),
  sendMail: vi.fn(),
  refreshToken: vi.fn(),
}));

const transactionClient = {
  $executeRaw: mocks.executeRaw,
  documentMailDispatch: {
    findUnique: mocks.dispatchFindFirst,
    findFirst: mocks.dispatchFindFirst,
    create: mocks.dispatchCreate,
    updateMany: mocks.dispatchUpdateMany,
    findUniqueOrThrow: mocks.dispatchFindUniqueOrThrow,
  },
  invoiceHistory: { create: mocks.historyCreate },
};

vi.mock("@/lib/db/client", () => ({
  prisma: {
    invoice: { findFirst: mocks.invoiceFindFirst },
    workPilotProject: { findFirst: mocks.projectFindFirst },
    user: { findFirst: mocks.userFindFirst },
    contact: { findMany: mocks.contactFindMany },
    documentMailDispatch: {
      updateMany: mocks.dispatchUpdateMany,
    },
    $transaction: vi.fn(
      async (
        callback: (tx: typeof transactionClient) => Promise<unknown>
      ) => callback(transactionClient)
    ),
  },
}));

vi.mock("@/lib/mail/microsoft", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/mail/microsoft")
  >("@/lib/mail/microsoft");
  return {
    ...actual,
    refreshMicrosoftAccessToken: mocks.refreshToken,
    sendMicrosoftGraphMail: mocks.sendMail,
  };
});

import {
  evaluateInvoiceDelivery,
  getInvoiceDeliveryConfirmationText,
  matchesInvoiceDeliveryConfirmation,
  sendInvoiceDelivery,
} from "@/lib/invoices/invoice-delivery-service";

const invoice = {
  id: "invoice-1",
  organizationId: "org-1",
  projectId: "project-1",
  projectNumber: "GLR-449",
  projectTitle: "Glasreinigung",
  company: "OK solutions",
  invoiceNumber: "RE-10124",
  status: "Fakturiert",
  isPaid: false,
  customerName: "Klaus Testmann",
  customerStreet: "Testweg 1",
  customerCity: "74722 Buchen",
  contactName: "Klaus Testmann",
  serviceDate: "2026-07-31",
  dueDate: "2026-08-14",
  netTotal: 100,
  vatRate: 19,
  grossTotal: 119,
  paymentTermDays: 14,
  pdfData: Buffer.from("%PDF-test").toString("base64"),
  createdAt: new Date("2026-07-31T10:00:00.000Z"),
  updatedAt: new Date("2026-07-31T10:05:00.000Z"),
  lines: [
    {
      id: "line-1",
      position: 1,
      quantity: 1,
      unit: "Stk",
      title: "Glasreinigung",
      description: "",
      unitPrice: 100,
      discountPercent: 0,
      vatRate: 19,
      totalNet: 100,
      updatedAt: new Date("2026-07-31T10:05:00.000Z"),
    },
  ],
};

const project = {
  id: "project-1",
  projectNumber: "GLR-449",
  contactId: "contact-1",
  contactPersonId: null,
  addressContactId: null,
};

const actor = {
  id: "user-1",
  firstName: "Christian",
  lastName: "Eid",
  email: "christian@example.com",
  mailAccount: {
    status: "connected",
    email: "christian@example.com",
    accessToken: "token",
  },
};

describe("invoice delivery service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoiceFindFirst.mockResolvedValue(invoice);
    mocks.projectFindFirst.mockResolvedValue(project);
    mocks.userFindFirst.mockResolvedValue(actor);
    mocks.contactFindMany.mockResolvedValue([
      { invoiceEmail: "rechnung@kunde.de", email: "kunde@example.com" },
    ]);
    mocks.refreshToken.mockResolvedValue(actor.mailAccount);
    mocks.dispatchFindFirst.mockResolvedValue(null);
    mocks.dispatchCreate.mockResolvedValue({
      id: "dispatch-1",
      status: "sending",
    });
    mocks.dispatchUpdateMany.mockResolvedValue({ count: 1 });
    mocks.dispatchFindUniqueOrThrow.mockResolvedValue({
      id: "dispatch-1",
      status: "sent",
    });
    mocks.historyCreate.mockResolvedValue({});
    mocks.sendMail.mockResolvedValue(undefined);
  });

  it("requires the exact invoice-and-recipient-bound phrase", () => {
    expect(
      getInvoiceDeliveryConfirmationText(
        "RE-10124",
        "rechnung@kunde.de"
      )
    ).toBe("SENDEN RE-10124 AN rechnung@kunde.de");
    expect(
      matchesInvoiceDeliveryConfirmation(
        "RE-10124",
        "rechnung@kunde.de",
        "SENDEN RE-10124 AN rechnung@kunde.de"
      )
    ).toBe(true);
    expect(
      matchesInvoiceDeliveryConfirmation(
        "RE-10124",
        "rechnung@kunde.de",
        "senden RE-10124 AN rechnung@kunde.de"
      )
    ).toBe(false);
  });

  it("binds a released PDF, sender and recipient to one fingerprint", async () => {
    const result = await evaluateInvoiceDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      invoiceId: "invoice-1",
    });

    expect(result.payload.to).toEqual(["rechnung@kunde.de"]);
    expect(result.attachments).toEqual([
      expect.objectContaining({
        name: "RE-10124.pdf",
        contentType: "application/pdf",
      }),
    ]);
    expect(result.blockingIssues).toEqual([]);
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps a missing recipient editable but blocks delivery", async () => {
    mocks.projectFindFirst.mockResolvedValue({
      ...project,
      contactId: null,
    });
    const result = await evaluateInvoiceDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      invoiceId: "invoice-1",
    });

    expect(result.payload.to).toEqual([]);
    expect(result.blockingIssues).toContain(
      "Mindestens eine gültige Empfängeradresse fehlt."
    );
  });

  it("claims the dispatch before handing the message to Microsoft 365", async () => {
    const evaluation = await evaluateInvoiceDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      invoiceId: "invoice-1",
    });
    await sendInvoiceDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      actorName: "Christian Eid",
      dispatchId: "dispatch-1",
      invoiceId: "invoice-1",
      payload: evaluation.payload,
      expectedFingerprint: evaluation.fingerprint,
      source: "jarvis",
    });

    expect(mocks.dispatchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "dispatch-1",
        status: "sending",
      }),
    });
    expect(mocks.dispatchCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendMail.mock.invocationCallOrder[0]
    );
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "email_sent",
        note: expect.stringContaining("durch JARVIS"),
      }),
    });
  });

  it("does not send again when the same dispatch is already recorded", async () => {
    mocks.dispatchFindFirst.mockResolvedValue({
      id: "dispatch-1",
      organizationId: "org-1",
      documentKind: "invoice",
      documentId: "invoice-1",
      senderUserId: "user-1",
      status: "sent",
    });
    const evaluation = await evaluateInvoiceDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      invoiceId: "invoice-1",
    });
    const result = await sendInvoiceDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      actorName: "Christian Eid",
      dispatchId: "dispatch-1",
      invoiceId: "invoice-1",
      payload: evaluation.payload,
      expectedFingerprint: evaluation.fingerprint,
      source: "jarvis",
    });

    expect(result.replay).toBe(true);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
