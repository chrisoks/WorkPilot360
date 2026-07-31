import { describe, expect, it, vi } from "vitest";
import { evaluateInvoiceDraft } from "@/lib/invoices/invoice-draft-service";

function db(overrides: { duplicateOffer?: boolean; unbilled?: boolean } = {}) {
  return {
    workPilotProject: {
      findFirst: vi.fn(async ({ where }) => where.organizationId === "org-1" && where.id === "project-1" ? {
        id: "project-1", projectNumber: "GLR-449", title: "Glasreinigung", customer: "Musterkunde", address: "Testweg 1", status: "Umsetzung", projectKind: "einmaliges Projekt", projectType: "OK solutions", contactId: "contact-1", contactPersonId: null, updatedAt: new Date("2026-07-31T08:00:00Z"),
      } : null),
    },
    contact: {
      findFirst: vi.fn(async ({ where }) => where.organizationId === "org-1" ? { companyName: "Musterkunde GmbH", firstName: null, lastName: null, addressLine1: "Testweg 1", street: "", postalCode: "74722", city: "Buchen", paymentTermDays: 14 } : null),
    },
    catalogItem: {
      findMany: vi.fn(async ({ where }) => where.organizationId === "org-1" ? [{ id: "service-1", type: "Leistung", name: "Glasreinigung Stunde", number: "GLR-001", description: "Glasreinigung", unit: "Std", salesPrice: 55, vatRate: 19, updatedAt: new Date("2026-07-31T08:00:00Z") }] : []),
    },
    offer: {
      findFirst: vi.fn(async ({ where }) => where.organizationId === "org-1" && where.id === "offer-1" ? { id: "offer-1", offerNumber: "ANG-10100", status: "Gewonnen", plannedExecutionMonth: "2026-07", updatedAt: new Date("2026-07-31T08:00:00Z") } : null),
    },
    invoice: {
      findMany: vi.fn(async () => overrides.duplicateOffer ? [{ id: "invoice-old", invoiceNumber: "RE-10100", status: "Entwurf", plannedExecutionMonth: "2026-07", serviceDate: "2026-07-20", sourceOfferId: "offer-1" }] : []),
    },
    projectLogbookEntry: { findMany: vi.fn(async () => []) },
    projectTimeEntry: { findMany: vi.fn(async () => overrides.unbilled ? [{ durationMs: 7_200_000n, pauseMs: 0n }] : []) },
  } as any;
}

describe("JARVIS invoice draft service", () => {
  it("recalculates catalog lines and exposes the shared faktura preflight", async () => {
    const result = await evaluateInvoiceDraft({
      organizationId: "org-1",
      db: db({ unbilled: true }),
      restrictToCatalog: true,
      draft: { projectId: "project-1", serviceDate: "2026-07-31", sourceOfferId: "offer-1", lines: [{ catalogItemId: "service-1", quantity: 2, unitPrice: 55 }] },
    });
    expect(result.errors).toEqual([]);
    expect(result.totals).toMatchObject({ netTotal: 110, grossTotal: 130.9 });
    expect(result.input.lines[0]).toMatchObject({ title: "Glasreinigung Stunde", totalNet: 110 });
    expect(result.preflight).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "duplicate", status: "ok" }),
      expect.objectContaining({ key: "time", status: "warning" }),
    ]));
  });

  it("blocks duplicate offer billing and cross-organization records", async () => {
    const duplicate = await evaluateInvoiceDraft({ organizationId: "org-1", db: db({ duplicateOffer: true }), restrictToCatalog: true, draft: { projectId: "project-1", serviceDate: "2026-07-31", sourceOfferId: "offer-1", lines: [{ catalogItemId: "service-1", quantity: 1 }] } });
    expect(duplicate.errors.join(" ")).toContain("bereits mit RE-10100");
    expect(duplicate.preflight.find((item) => item.key === "duplicate")?.status).toBe("blocked");

    await expect(evaluateInvoiceDraft({ organizationId: "org-2", db: db(), restrictToCatalog: true, draft: { projectId: "project-1", serviceDate: "2026-07-31", lines: [{ catalogItemId: "service-1", quantity: 1 }] } })).rejects.toMatchObject({ code: "not_found" });
  });
});
