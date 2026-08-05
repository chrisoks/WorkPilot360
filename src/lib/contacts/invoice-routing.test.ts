import { describe, expect, it } from "vitest";
import {
  getBillingAddressSnapshot,
  getInvoiceMailCandidates,
  getRecommendedInvoiceMailRecipient,
} from "./invoice-routing";

describe("invoice routing", () => {
  it("selects one explicitly preferred mail recipient", () => {
    const candidates = getInvoiceMailCandidates([
      { id: "1", type: "person", firstName: "Anna", email: "anna@example.de", isInvoiceRecipient: true },
      { id: "2", type: "person", firstName: "Bert", email: "bert@example.de" },
    ]);
    expect(getRecommendedInvoiceMailRecipient(candidates)).toEqual({ email: "anna@example.de", requiresSelection: false });
  });

  it("fails closed when several possible recipients are equally suitable", () => {
    const candidates = getInvoiceMailCandidates([
      { id: "1", type: "person", firstName: "Anna", email: "anna@example.de" },
      { id: "2", type: "person", firstName: "Bert", email: "bert@example.de" },
    ]);
    expect(getRecommendedInvoiceMailRecipient(candidates)).toEqual({ email: "", requiresSelection: true });
  });

  it("uses the separate legal billing address without changing normal contact data", () => {
    expect(getBillingAddressSnapshot({
      id: "1", type: "company", companyName: "Kunde GmbH", street: "Normalweg 1", postalCode: "10000", city: "Berlin",
      hasDifferentBillingAddress: true, billingName: "Kunde Holding GmbH", billingStreet: "Rechnungsweg 2", billingPostalCode: "20000", billingCity: "Hamburg",
    }, { customerName: "Fallback", customerStreet: "Alt", customerCity: "Ort", customerCountry: "Deutschland" })).toEqual({
      customerName: "Kunde Holding GmbH", customerStreet: "Rechnungsweg 2", customerCity: "20000 Hamburg", customerCountry: "Deutschland",
    });
  });
});
