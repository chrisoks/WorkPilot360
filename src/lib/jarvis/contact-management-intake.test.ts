import { describe, expect, it } from "vitest";
import { extractContactManagementRequest, looksLikeContactManagementRequest } from "@/lib/jarvis/contact-management-intake";

describe("contact management intake", () => {
  it("recognizes a company creation with structured fields", () => {
    const question = "Lege einen neuen Firmenkontakt an: Firma: Neue GmbH; E-Mail: info@neu.de; Telefon: +49 511 123456; Ort: Hannover";
    expect(looksLikeContactManagementRequest(question)).toBe(true);
    expect(extractContactManagementRequest(question)).toEqual({
      mode: "create",
      values: { type: "company", companyName: "Neue GmbH", email: "info@neu.de", phone: "+49 511 123456", city: "Hannover" },
    });
  });

  it("requires an explicit customer number for a safe update", () => {
    expect(extractContactManagementRequest("Ändere Kontakt Kundennummer 7000049: E-Mail: neu@example.de")).toEqual({
      mode: "update", customerNumber: "7000049", values: { email: "neu@example.de" },
    });
  });
});
