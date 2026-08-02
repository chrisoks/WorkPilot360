import { describe, expect, it, vi } from "vitest";
import { evaluateContactBulkCategory, executeContactBulkCategory, getContactBulkCategoryConfirmationText } from "./contact-bulk-category-service";

function contact(id: string, customerNumber: string, category = "Kunde") {
  return { id, customerNumber, companyName: `Firma ${customerNumber}`, firstName: null, lastName: null, category, updatedAt: new Date("2026-08-02T05:00:00.000Z") };
}

describe("contact bulk category service", () => {
  it("creates an exact dry-run and confirmation phrase", async () => {
    const db = { contact: { findMany: vi.fn().mockResolvedValue([contact("c1", "7001"), contact("c2", "7002", "Partner")]) } } as never;
    const result = await evaluateContactBulkCategory({ organizationId: "org-1", request: { mode: "apply", customerNumbers: ["7001", "7002"], targetCategory: "Archiv" }, db });
    expect(result.items).toHaveLength(2);
    expect(result.blockingIssues).toEqual([]);
    expect(getContactBulkCategoryConfirmationText(result)).toBe("MASSENÄNDERUNG AUSFÜHREN 2 KONTAKTE");
  });

  it("blocks missing or ineffective targets instead of applying a subset", async () => {
    const db = { contact: { findMany: vi.fn().mockResolvedValue([contact("c1", "7001", "Archiv")]) } } as never;
    const result = await evaluateContactBulkCategory({ organizationId: "org-1", request: { mode: "apply", customerNumbers: ["7001", "7002"], targetCategory: "Archiv" }, db });
    expect(result.blockingIssues).toHaveLength(2);
    expect(result.items).toEqual([]);
  });

  it("writes all contacts, integration events and one rollback-capable audit", async () => {
    const rows = [contact("c1", "7001"), contact("c2", "7002")];
    const tx = {
      $executeRaw: vi.fn(),
      contact: { findMany: vi.fn().mockResolvedValue(rows), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findFirstOrThrow: vi.fn().mockResolvedValue({ updatedAt: new Date("2026-08-02T05:01:00.000Z") }) },
      contactIntegrationEvent: { createMany: vi.fn() }, auditLog: { create: vi.fn() },
    };
    const preview = await evaluateContactBulkCategory({ organizationId: "org-1", request: { mode: "apply", customerNumbers: ["7001", "7002"], targetCategory: "Partner" }, db: tx as never });
    const result = await executeContactBulkCategory({ tx: tx as never, organizationId: "org-1", actorId: "u1", requestId: "req-1", request: { mode: "apply", customerNumbers: ["7001", "7002"], targetCategory: "Partner" }, expectedFingerprint: preview.fingerprint });
    expect(result.count).toBe(2);
    expect(tx.contact.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "contact.bulk-category.changed", entityId: "req-1" }) }));
  });

  it("prepares an exact rollback only while every contact still matches the audited follow-up state", async () => {
    const after = new Date("2026-08-02T05:01:00.000Z");
    const db = {
      auditLog: { findFirst: vi.fn().mockResolvedValueOnce({ payload: { items: [{ id: "c1", customerNumber: "7001", label: "A", before: "Kunde", after: "Archiv", updatedAt: "2026-08-02T05:00:00.000Z", afterUpdatedAt: after.toISOString() }] } }).mockResolvedValueOnce(null) },
      contact: { findMany: vi.fn().mockResolvedValue([{ ...contact("c1", "7001", "Archiv"), updatedAt: after }]) },
    } as never;
    const result = await evaluateContactBulkCategory({ organizationId: "org-1", request: { mode: "rollback", sourceRequestId: "req-original" }, db });
    expect(result.items).toEqual([expect.objectContaining({ customerNumber: "7001", before: "Archiv", after: "Kunde" })]);
    expect(result.blockingIssues).toEqual([]);
    expect(getContactBulkCategoryConfirmationText(result)).toBe("MASSENÄNDERUNG ZURÜCKROLLEN req-original");
  });

  it("blocks a partial rollback after any later contact edit", async () => {
    const db = {
      auditLog: { findFirst: vi.fn().mockResolvedValueOnce({ payload: { items: [{ id: "c1", customerNumber: "7001", label: "A", before: "Kunde", after: "Archiv", updatedAt: "2026-08-02T05:00:00.000Z", afterUpdatedAt: "2026-08-02T05:01:00.000Z" }] } }).mockResolvedValueOnce(null) },
      contact: { findMany: vi.fn().mockResolvedValue([{ ...contact("c1", "7001", "Partner"), updatedAt: new Date("2026-08-02T05:02:00.000Z") }]) },
    } as never;
    const result = await evaluateContactBulkCategory({ organizationId: "org-1", request: { mode: "rollback", sourceRequestId: "req-original" }, db });
    expect(result.items).toEqual([]);
    expect(result.blockingIssues).toHaveLength(1);
  });
});
