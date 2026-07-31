import { describe, expect, it } from "vitest";
import { extractInvoiceCompany, extractInvoiceServiceDate, looksLikeInvoiceDraftRequest } from "@/lib/jarvis/invoice-intake";

describe("JARVIS invoice intake", () => {
  it("recognizes safe draft creation but excludes reads and critical actions", () => {
    expect(looksLikeInvoiceDraftRequest("Erstelle einen Rechnungsentwurf für Projekt GLR-449")).toBe(true);
    expect(looksLikeInvoiceDraftRequest("Zeig mir offene Rechnungen")).toBe(false);
    expect(looksLikeInvoiceDraftRequest("Fakturiere und versende die Rechnung")).toBe(false);
    expect(looksLikeInvoiceDraftRequest("Storniere die Rechnung")).toBe(false);
  });

  it("extracts service date and company", () => {
    expect(extractInvoiceServiceDate("Leistungsdatum 31.07.2026")).toBe("2026-07-31");
    expect(extractInvoiceServiceDate("Leistungsdatum 2026-08-01")).toBe("2026-08-01");
    expect(extractInvoiceCompany("Rechnung von OK immocare")).toBe("OK immocare");
    expect(extractInvoiceCompany("Rechnung von OK solutions")).toBe("OK solutions");
  });
});
