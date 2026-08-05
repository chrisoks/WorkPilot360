import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    auditLog: { create: vi.fn() },
    notification: { createMany: vi.fn() },
    contactIntegrationEvent: { create: vi.fn() },
  };
  const prisma = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/demo/context", () => ({
  getDemoContext: vi.fn().mockResolvedValue({
    organization: { id: "org-1" },
    users: [{ id: "user-1", firstName: "Ada", lastName: "Admin", email: "ada@example.test", role: "GESCHAEFTSFUEHRER", isActive: true, organizationId: "org-1" }],
  }),
}));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "user-1", firstName: "Ada", lastName: "Admin", email: "ada@example.test", role: "GESCHAEFTSFUEHRER", isActive: true },
  }),
  sessionBoundActorResponse: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({
  canDeleteContacts: vi.fn(() => true),
  canManageContacts: vi.fn(() => true),
  canMarkContactsForDeletion: vi.fn(() => true),
  canReadContacts: vi.fn(() => true),
}));

import { PATCH, POST } from "./route";

const updatedAt = new Date("2026-08-05T08:00:00.000Z");

function contactRow(phone: string | null = null) {
  return {
    id: "contact-1", organizationId: "org-1", category: "Kunde", type: "company", legalForm: null,
    deletionMarkedAt: null, deletionMarkedById: null, deletionMarkedByName: null, customerNumber: "7000100",
    salutation: null, additionalSalutation: null, companyName: "Beispiel GmbH", firstName: null, lastName: null, position: null,
    email: "info@example.test", invoiceEmail: null, activityReportEmail: null, phone, phoneNormalized: phone,
    mobile: null, mobileNormalized: null, fax: null, faxNormalized: null, website: null, source: "E-Mail", reachability: "Sonstige",
    isInvoiceRecipient: false, isActivityReportRecipient: false, eInvoiceRequired: false, eInvoiceRecipientType: "business",
    hasDifferentBillingAddress: false, billingName: null, billingStreet: null, billingAddressLine1: null, billingAddressLine2: null,
    billingPostalCode: null, billingCity: null, billingCountry: null, parentCompanyId: null, parentCompanyName: null,
    mainContactName: null, isMainContact: false, street: "Altweg 1", addressLine1: null, addressLine2: null,
    postalCode: "74722", city: "Buchen", country: "Deutschland", paymentTermDays: 14, discountPercent: 0,
    discountTermDays: 0, priceGroup: null, iban: null, bic: null, bankName: null, taxId: null,
    debtorCreditorAccount: null, leitwegId: null, customerStatusOverride: "automatic", customerStatusOverrideReason: null,
    customerStatusOverrideAt: null, customerStatusOverrideById: null, customerStatusOverrideByName: null,
    prospectSince: null, prospectConvertedAt: null,
    createdAt: updatedAt, updatedAt,
  };
}

function patchRequest(phone: string) {
  return new Request("http://localhost/api/contacts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...contactRow(""), actorId: "user-1", expectedUpdatedAt: updatedAt.toISOString(), phone,
    }),
  });
}

describe("contact master data logbook audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$executeRaw.mockResolvedValue(0);
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.$executeRaw.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([contactRow()]).mockResolvedValueOnce([]);
    mocks.tx.$queryRaw.mockResolvedValue([contactRow("+49628199999")]);
    mocks.tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
    mocks.tx.contactIntegrationEvent.create.mockResolvedValue({ id: "event-1" });
  });

  it("writes exactly one value-free logbook entry in the same transaction", async () => {
    const response = await PATCH(patchRequest("06281 99999"));

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "contact_master_data_changed",
      entityType: "contact-logbook",
      entityId: "contact-1",
      actorId: "user-1",
      payload: expect.objectContaining({
        text: "Kundendaten geändert: Telefon.",
        author: "Ada Admin",
        changedFields: ["phone"],
        changeGroups: ["Telefon"],
        isSystem: true,
      }),
    }) });
    expect(JSON.stringify(mocks.tx.auditLog.create.mock.calls)).not.toContain("06281 99999");
    expect(JSON.stringify(mocks.tx.auditLog.create.mock.calls)).not.toContain("+49628199999");
  });
});

describe("contact reachability safeguard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$executeRaw.mockResolvedValue(0);
  });

  it("rejects creating a contact without email, mobile or phone before persistence", async () => {
    const response = await POST(new Request("http://localhost/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: "user-1",
        type: "company",
        category: "Kunde",
        companyName: "Ohne Erreichbarkeit GmbH",
        email: "",
        mobile: "",
        phone: "",
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Bitte hinterlege mindestens eine E-Mail-Adresse, Mobilnummer oder Festnetznummer.",
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects updating a contact without a direct contact channel before persistence", async () => {
    const response = await PATCH(new Request("http://localhost/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: "user-1",
        id: "contact-1",
        type: "company",
        category: "Kunde",
        companyName: "Ohne Erreichbarkeit GmbH",
        email: "",
        mobile: "",
        phone: "",
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("contact prospect lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$executeRaw.mockResolvedValue(0);
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValue([{ ...contactRow(), category: "Interessent", customerNumber: "", prospectSince: updatedAt }]);
    mocks.tx.contactIntegrationEvent.create.mockResolvedValue({ id: "event-1" });
  });

  it("creates an Interessent without allocating a customer number", async () => {
    const response = await POST(new Request("http://localhost/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: "user-1",
        type: "company",
        category: "Interessent",
        companyName: "Interessent GmbH",
        email: "kontakt@interessent.example",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ category: "Interessent", customerNumber: "", prospectSince: updatedAt.toISOString() });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("converts an Interessent atomically and assigns a customer number", async () => {
    const existingProspect = { ...contactRow(), category: "Interessent", customerNumber: "", prospectSince: updatedAt };
    const convertedAt = new Date("2026-08-05T09:00:00.000Z");
    const convertedCustomer = {
      ...existingProspect,
      category: "Kunde",
      customerNumber: "7000101",
      prospectConvertedAt: convertedAt,
      updatedAt: convertedAt,
    };
    mocks.prisma.$queryRaw.mockReset();
    mocks.prisma.$queryRaw.mockResolvedValueOnce([existingProspect]).mockResolvedValueOnce([]);
    mocks.tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ maximum: 7000100n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([convertedCustomer]);
    mocks.tx.$executeRaw.mockResolvedValue(0);
    mocks.tx.auditLog.create.mockResolvedValue({ id: "audit-conversion" });

    const response = await PATCH(new Request("http://localhost/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...existingProspect,
        actorId: "user-1",
        expectedUpdatedAt: updatedAt.toISOString(),
        category: "Kunde",
        customerNumber: "",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ category: "Kunde", customerNumber: "7000101", prospectConvertedAt: convertedAt.toISOString() });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "contact_prospect_converted",
      entityType: "contact-logbook",
      entityId: "contact-1",
      payload: expect.objectContaining({ previousCategory: "Interessent", nextCategory: "Kunde", customerNumber: "7000101" }),
    }) });
  });
});
