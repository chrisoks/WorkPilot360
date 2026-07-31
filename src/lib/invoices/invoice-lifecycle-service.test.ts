import { describe, expect, it, vi } from "vitest";
import {
  evaluateInvoiceLifecycle,
  executeInvoiceLifecycle,
  getInvoiceLifecycleConfirmationText,
  matchesInvoiceLifecycleConfirmation,
} from "@/lib/invoices/invoice-lifecycle-service";

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "invoice-1",
    invoiceNumber: "RE-10124",
    status: "Entwurf",
    projectId: "project-1",
    projectNumber: "GLR-449",
    projectTitle: "Glasreinigung",
    customerName: "Musterkunde",
    netTotal: 100,
    grossTotal: 119,
    isPaid: false,
    pdfData: "draft-pdf",
    updatedAt: new Date("2026-07-31T22:00:00.000Z"),
    ...overrides,
  };
}

function dbFor(source = invoice(), options: { deletion?: unknown; times?: number; inventory?: number; dispatches?: number; derived?: unknown[] } = {}) {
  return {
    invoice: {
      findFirst: vi.fn().mockResolvedValue(source),
      findMany: vi.fn().mockResolvedValue(options.derived || []),
    },
    invoiceHistory: { findFirst: vi.fn().mockResolvedValue(options.deletion || null) },
    projectTimeEntry: { count: vi.fn().mockResolvedValue(options.times || 0) },
    catalogInventoryMovement: { count: vi.fn().mockResolvedValue(options.inventory || 0) },
    documentMailDispatch: { count: vi.fn().mockResolvedValue(options.dispatches || 0) },
  } as never;
}

describe("invoice lifecycle service", () => {
  it("requires exact action-specific confirmation phrases", () => {
    expect(getInvoiceLifecycleConfirmationText("RE-10124", "delete")).toBe("RECHNUNG LÖSCHEN RE-10124");
    expect(getInvoiceLifecycleConfirmationText("RE-10124", "restore")).toBe("RECHNUNG WIEDERHERSTELLEN RE-10124");
    expect(matchesInvoiceLifecycleConfirmation("RE-10124", "delete", "RECHNUNG LÖSCHEN RE-10124")).toBe(true);
    expect(matchesInvoiceLifecycleConfirmation("RE-10124", "restore", "Rechnung wiederherstellen RE-10124")).toBe(false);
  });

  it("prepares a reversible soft-delete only for an untouched draft", async () => {
    const result = await evaluateInvoiceLifecycle({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      action: "delete",
      reason: "Doppelt angelegt",
      db: dbFor(),
    });
    expect(result.blockingIssues).toEqual([]);
    expect(result.warnings.join(" ")).toContain("nicht physisch entfernt");
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blocks deletion of a fakturierte Rechnung and points to cancellation", async () => {
    const result = await evaluateInvoiceLifecycle({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      action: "delete",
      reason: "Fehlerhaft",
      db: dbFor(invoice({ status: "Fakturiert" })),
    });
    expect(result.blockingIssues.join(" ")).toContain("Nur Rechnungsentwürfe");
    expect(result.blockingIssues.join(" ")).toContain("storniert oder korrigiert");
  });

  it("blocks deletion when financial or delivery side effects exist", async () => {
    const result = await evaluateInvoiceLifecycle({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      action: "delete",
      reason: "Fehlerhaft",
      db: dbFor(invoice(), { times: 1, inventory: 2, dispatches: 1, derived: [{ id: "credit-1", invoiceNumber: "GU-1", status: "Fakturiert" }] }),
    });
    expect(result.blockingIssues.join(" ")).toContain("Stempelung");
    expect(result.blockingIssues.join(" ")).toContain("Lagerbewegung");
    expect(result.blockingIssues.join(" ")).toContain("Versandprotokoll");
    expect(result.blockingIssues.join(" ")).toContain("GU-1");
  });

  it("restores only when the latest deletion history proves the draft status", async () => {
    const result = await evaluateInvoiceLifecycle({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      action: "restore",
      reason: "Irrtümlich gelöscht",
      db: dbFor(invoice({ status: "Gelöscht" }), {
        deletion: { id: "history-1", note: "RE-10124 wurde gelöscht. Vorheriger Status: Entwurf.", createdAt: new Date() },
      }),
    });
    expect(result.previousStatus).toBe("Entwurf");
    expect(result.blockingIssues).toEqual([]);
  });

  it("fails closed for an undocumented legacy deletion", async () => {
    const result = await evaluateInvoiceLifecycle({
      organizationId: "org-1",
      invoiceId: "invoice-1",
      action: "restore",
      reason: "Wieder sichtbar",
      db: dbFor(invoice({ status: "Gelöscht" }), {
        deletion: { id: "history-1", note: "RE-10124 wurde gelöscht.", createdAt: new Date() },
      }),
    });
    expect(result.blockingIssues.join(" ")).toContain("nicht sicher dokumentiert");
  });

  it("executes once and writes history plus project logbook without unlinking data", async () => {
    const source = invoice();
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      invoice: {
        findFirst: vi.fn().mockResolvedValue(source),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue({ ...source, status: "Gelöscht" }),
      },
      invoiceHistory: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "history-1" }) },
      projectTimeEntry: { count: vi.fn().mockResolvedValue(0) },
      catalogInventoryMovement: { count: vi.fn().mockResolvedValue(0) },
      documentMailDispatch: { count: vi.fn().mockResolvedValue(0) },
      projectLogbookEntry: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    } as any;
    const preview = await evaluateInvoiceLifecycle({ organizationId: "org-1", invoiceId: "invoice-1", action: "delete", reason: "Doppelt", db: tx });
    await executeInvoiceLifecycle({
      tx,
      organizationId: "org-1",
      invoiceId: "invoice-1",
      action: "delete",
      reason: "Doppelt",
      actorId: "user-1",
      actorName: "GF Test",
      expectedFingerprint: preview.fingerprint,
      source: "jarvis",
    });
    expect(tx.invoice.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.invoiceHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.projectLogbookEntry.create).toHaveBeenCalledTimes(1);
  });
});
