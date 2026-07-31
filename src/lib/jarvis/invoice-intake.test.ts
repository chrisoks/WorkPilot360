import { describe, expect, it } from "vitest";
import {
  extractInvoiceCompany,
  extractInvoiceNumber,
  extractInvoicePaymentDate,
  extractInvoiceServiceDate,
  looksLikeInvoiceDraftRequest,
  looksLikeInvoiceDeliveryRequest,
  looksLikeInvoiceFinalizationRequest,
  looksLikeInvoicePaymentRequest,
} from "@/lib/jarvis/invoice-intake";

describe("JARVIS invoice intake", () => {
  it("recognizes safe draft creation but excludes reads and critical actions", () => {
    expect(looksLikeInvoiceDraftRequest("Erstelle einen Rechnungsentwurf für Projekt GLR-449")).toBe(true);
    expect(looksLikeInvoiceDraftRequest("Zeig mir offene Rechnungen")).toBe(false);
    expect(looksLikeInvoiceDraftRequest("Fakturiere und versende die Rechnung")).toBe(false);
    expect(looksLikeInvoiceDraftRequest("Storniere die Rechnung")).toBe(false);
  });

  it("recognizes an isolated invoice delivery and rejects action chains", () => {
    expect(
      looksLikeInvoiceDeliveryRequest("Sende Rechnung RE-10124")
    ).toBe(true);
    expect(
      looksLikeInvoiceDeliveryRequest(
        "Fakturiere und versende Rechnung RE-10124"
      )
    ).toBe(false);
    expect(
      looksLikeInvoiceDeliveryRequest(
        "Sende Rechnung RE-10124 und lösche das Projekt"
      )
    ).toBe(false);
  });

  it("recognizes isolated finalization and excludes combined critical actions", () => {
    expect(
      looksLikeInvoiceFinalizationRequest("Fakturiere Rechnung RE-10124")
    ).toBe(true);
    expect(
      looksLikeInvoiceFinalizationRequest(
        "Fakturiere und versende Rechnung RE-10124"
      )
    ).toBe(false);
    expect(extractInvoiceNumber("Bitte RE-10124 fakturieren")).toBe(
      "RE-10124"
    );
  });

  it("recognizes only an explicit isolated payment mutation", () => {
    expect(
      looksLikeInvoicePaymentRequest(
        "Markiere Rechnung RE-10119 am 31.07.2026 als bezahlt"
      )
    ).toBe(true);
    expect(looksLikeInvoicePaymentRequest("Markiere RE-10119 als bezahlt")).toBe(true);
    expect(looksLikeInvoicePaymentRequest("Ist Rechnung RE-10119 bezahlt?")).toBe(false);
    expect(
      looksLikeInvoicePaymentRequest(
        "Markiere RE-10119 als bezahlt und sende eine Mahnung"
      )
    ).toBe(false);
    expect(extractInvoicePaymentDate("Bezahlt am 31.07.2026")).toBe("2026-07-31");
  });

  it("extracts service date and company", () => {
    expect(extractInvoiceServiceDate("Leistungsdatum 31.07.2026")).toBe("2026-07-31");
    expect(extractInvoiceServiceDate("Leistungsdatum 2026-08-01")).toBe("2026-08-01");
    expect(extractInvoiceCompany("Rechnung von OK immocare")).toBe("OK immocare");
    expect(extractInvoiceCompany("Rechnung von OK solutions")).toBe("OK solutions");
  });
});
