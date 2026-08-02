import { describe, expect, it } from "vitest";
import { extractCatalogManagementRequest, looksLikeCatalogManagementRequest } from "@/lib/jarvis/catalog-management-intake";

describe("catalog management intake", () => {
  it("extracts a service creation with economic and planning fields", () => {
    const question = "Lege eine neue Leistung an: Bezeichnung: Glasreinigung; Gewerk: Glasreinigung; Einheit: Std; Selbstkosten: 32,50; Verkaufspreis: 58; Planungsrelevant: ja; Planminuten je Einheit: 60.";
    expect(looksLikeCatalogManagementRequest(question)).toBe(true);
    expect(extractCatalogManagementRequest(question)).toEqual({ mode: "create", catalogNumber: undefined, values: { type: "service", name: "Glasreinigung", trade: "Glasreinigung", unit: "Std", purchasePrice: 32.5, salesPrice: 58, isPlanningRelevant: true, planningMinutesPerUnit: 60 } });
  });

  it("extracts an update by catalog number", () => {
    expect(extractCatalogManagementRequest("Ändere Leistung L1001: Verkaufspreis: 62; Beschreibung: Neue Ausführung."))
      .toEqual({ mode: "update", catalogNumber: "L1001", values: { salesPrice: 62, description: "Neue Ausführung" } });
  });

  it("does not capture packages or calculator questions", () => {
    expect(looksLikeCatalogManagementRequest("Lege ein Paket an: Name: Winterdienst.")) .toBe(false);
    expect(looksLikeCatalogManagementRequest("Rechne den Verkaufspreis für diese Leistung.")) .toBe(false);
  });
});
