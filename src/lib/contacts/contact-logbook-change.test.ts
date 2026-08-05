import { describe, expect, it } from "vitest";
import { getContactMasterDataChange } from "./contact-logbook-change";

describe("contact logbook master data changes", () => {
  it("groups changed fields into one concise customer logbook entry", () => {
    const result = getContactMasterDataChange(
      { email: "alt@example.de", phone: "06281123", street: "Altweg 1", city: "Buchen" },
      { email: "neu@example.de", phone: "06281456", street: "Neuweg 2", city: "Buchen" },
      "company"
    );

    expect(result.labels).toEqual(["E-Mail", "Telefon", "Anschrift"]);
    expect(result.text).toBe("Kundendaten geändert: E-Mail, Telefon, Anschrift.");
  });

  it("stores no confidential before or after values", () => {
    const result = getContactMasterDataChange(
      { iban: "DE001234", taxId: "ALT-SECRET" },
      { iban: "DE009999", taxId: "NEU-SECRET" },
      "private"
    );

    expect(result.text).toBe("Kundendaten geändert: Zahlungsdaten.");
    expect(JSON.stringify(result)).not.toContain("DE00");
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("does not create noise when normalized values are unchanged", () => {
    const result = getContactMasterDataChange(
      { companyName: "OK  immocare", paymentTermDays: 14, isInvoiceRecipient: false },
      { companyName: " OK immocare ", paymentTermDays: "14", isInvoiceRecipient: false },
      "company"
    );

    expect(result).toEqual({ changedFields: [], labels: [], text: "" });
  });

  it("uses the correct wording for an Ansprechpartner", () => {
    const result = getContactMasterDataChange(
      { mobile: "" },
      { mobile: "+491701234567" },
      "person"
    );

    expect(result.text).toBe("Ansprechpartnerdaten geändert: Telefon.");
  });
});
