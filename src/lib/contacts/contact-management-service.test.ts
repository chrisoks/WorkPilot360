import { describe, expect, it, vi } from "vitest";
import {
  evaluateContactChange,
  evaluateContactCreation,
  executeContactChange,
  executeContactCreation,
  getContactChangeConfirmationText,
  getContactCreateConfirmationText,
} from "@/lib/contacts/contact-management-service";

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: "contact-1", organizationId: "org-1", customerNumber: "7000049",
    type: "company", category: "Kunde", companyName: "Muster GmbH", firstName: null,
    lastName: null, position: null, email: "alt@example.de", invoiceEmail: null,
    activityReportEmail: null, activityReportDesired: true, phone: "+49 511 123456", phoneNormalized: "+49511123456",
    mobile: null, mobileNormalized: null, website: null, source: null, reachability: null,
    street: "Altstraße 1", addressLine1: null, addressLine2: null, postalCode: "30159",
    city: "Hannover", country: "Deutschland", updatedAt: new Date("2026-08-02T01:00:00.000Z"),
    ...overrides,
  };
}

function db(current = contact()) {
  return {
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(current),
      findFirstOrThrow: vi.fn().mockResolvedValue({ ...current, email: "neu@example.de" }),
      create: vi.fn().mockImplementation(async ({ data }) => ({ ...data, createdAt: new Date(), updatedAt: new Date() })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    contactIntegrationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ nextNumber: 7000050n }]),
  };
}

describe("contact management service", () => {
  it("uses explicit, case-sensitive confirmation phrases", () => {
    expect(getContactCreateConfirmationText("Muster GmbH")).toBe("KONTAKT ANLEGEN Muster GmbH");
    expect(getContactChangeConfirmationText("7000049")).toBe("KONTAKT ÄNDERN 7000049");
  });

  it("blocks a create preview when a possible duplicate exists", async () => {
    const database = db();
    database.contact.findMany.mockResolvedValueOnce([contact()]);
    const evaluation = await evaluateContactCreation({
      organizationId: "org-1",
      values: { type: "company", companyName: "Muster GmbH", email: "alt@example.de" },
      db: database as never,
    });
    expect(evaluation.mode).toBe("create");
    expect(evaluation.blockingIssues.join(" ")).toContain("Dubletten");
    expect(evaluation.checks.find((item) => item.key === "duplicate")?.status).toBe("blocked");
  });

  it("shows only changed fields and rejects malformed contact data", async () => {
    const evaluation = await evaluateContactChange({
      organizationId: "org-1", contactId: "contact-1",
      changes: { email: "neu@example.de", city: "Hannover" }, db: db() as never,
    });
    expect(evaluation.changes).toEqual([{ field: "email", label: "E-Mail", before: "alt@example.de", after: "neu@example.de" }]);
    await expect(evaluateContactChange({ organizationId: "org-1", contactId: "contact-1", changes: { email: "kaputt" }, db: db() as never }))
      .rejects.toMatchObject({ code: "invalid_input" });
  });

  it("serializes customer numbering and writes integration plus audit evidence", async () => {
    const transaction = db(null as never);
    const previewDb = db(null as never);
    const values = { type: "company" as const, companyName: "Neue GmbH", email: "neu@example.de", phone: "+49 511 123456" };
    const evaluation = await evaluateContactCreation({ organizationId: "org-1", values, db: previewDb as never });
    const created = await executeContactCreation({ tx: transaction as never, organizationId: "org-1", values, actorId: "user-1", requestId: "draft-1", expectedFingerprint: evaluation.fingerprint });
    expect(created.customerNumber).toBe("7000050");
    expect(transaction.contact.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phone: "+49511123456", phoneNormalized: "+49511123456" }),
    }));
    expect(transaction.$executeRaw).toHaveBeenCalled();
    expect(transaction.contactIntegrationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "created" }) }));
    expect(transaction.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "contact.created" }) }));
  });

  it("updates only approved fields with optimistic locking", async () => {
    const transaction = db();
    const evaluation = await evaluateContactChange({ organizationId: "org-1", contactId: "contact-1", changes: { email: "neu@example.de" }, db: transaction as never });
    await executeContactChange({ tx: transaction as never, organizationId: "org-1", contactId: "contact-1", changes: { email: "neu@example.de" }, actorId: "user-1", requestId: "draft-2", expectedFingerprint: evaluation.fingerprint });
    expect(transaction.contact.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "neu@example.de" }) }));
    expect(transaction.contactIntegrationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ changedFields: ["email"] }) }));
  });
});
