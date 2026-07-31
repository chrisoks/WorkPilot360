import { describe, expect, it } from "vitest";
import {
  extractInvoiceCompany,
  extractInvoiceNumber,
  extractInvoicePaymentDate,
  extractInvoiceReminderDeadline,
  extractInvoiceServiceDate,
  looksLikeInvoiceDraftRequest,
  looksLikeInvoiceDeliveryRequest,
  looksLikeInvoiceFinalizationRequest,
  looksLikeInvoicePaymentRequest,
  looksLikeInvoiceReminderRequest,
  looksLikeInvoiceCancellationRequest,
  looksLikeInvoiceCreditRequest,
  extractInvoiceCancellationReason,
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

  it("recognizes only an isolated reminder creation", () => {
    expect(
      looksLikeInvoiceReminderRequest(
        "Erstelle eine Mahnung für Rechnung RE-10119 mit Zahlungsfrist bis 07.08.2026"
      )
    ).toBe(true);
    expect(looksLikeInvoiceReminderRequest("Welche Mahnstufe hat RE-10119?")).toBe(false);
    expect(
      looksLikeInvoiceReminderRequest(
        "Erstelle und versende eine Mahnung für RE-10119"
      )
    ).toBe(false);
    expect(extractInvoiceReminderDeadline("Zahlungsfrist bis 07.08.2026")).toBe(
      "2026-08-07"
    );
  });

  it("separates a full cancellation from unsupported partial credits", () => {
    expect(looksLikeInvoiceCancellationRequest("Storniere Rechnung RE-10119 vollständig wegen Doppelberechnung")).toBe(true);
    expect(looksLikeInvoiceCancellationRequest("Wie storniere ich eine Rechnung?")).toBe(false);
    expect(looksLikeInvoiceCancellationRequest("Erstelle eine Teilgutschrift für RE-10119")).toBe(false);
    expect(looksLikeInvoiceCreditRequest("Storniere RE-10119 teilweise")).toBe(true);
    expect(looksLikeInvoiceCreditRequest("Erstelle eine Gutschrift zu Rechnung RE-10119")).toBe(true);
    expect(extractInvoiceCancellationReason("Storniere RE-10119, Grund: Doppelberechnung")).toBe("Doppelberechnung");
  });

  it("extracts service date and company", () => {
    expect(extractInvoiceServiceDate("Leistungsdatum 31.07.2026")).toBe("2026-07-31");
    expect(extractInvoiceServiceDate("Leistungsdatum 2026-08-01")).toBe("2026-08-01");
    expect(extractInvoiceCompany("Rechnung von OK immocare")).toBe("OK immocare");
    expect(extractInvoiceCompany("Rechnung von OK solutions")).toBe("OK solutions");
  });
});
