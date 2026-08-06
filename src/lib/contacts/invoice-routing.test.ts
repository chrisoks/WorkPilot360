import { describe, expect, it } from "vitest";
import {
  getActivityReportMailRecipients,
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

  it("routes activity reports to the customer and explicitly selected additional contacts", () => {
    expect(getActivityReportMailRecipients([
      { id: "company", type: "company", email: "info@example.de", activityReportEmail: "bericht@example.de" },
      { id: "person-1", type: "person", parentCompanyId: "company", email: "extra@example.de", isActivityReportRecipient: true },
      { id: "person-2", type: "person", parentCompanyId: "company", email: "other@example.de", isActivityReportRecipient: false },
      { id: "foreign", type: "person", parentCompanyId: "other-company", email: "foreign@example.de", isActivityReportRecipient: true },
    ], "company")).toEqual(["bericht@example.de", "extra@example.de"]);
  });

  it("does not send a separate duplicate when the invoice recipient already receives the report", () => {
    expect(getActivityReportMailRecipients([
      { id: "company", type: "company", email: "info@example.de" },
      { id: "person-1", type: "person", parentCompanyId: "company", email: "INFO@example.de", isActivityReportRecipient: true },
      { id: "person-2", type: "person", parentCompanyId: "company", email: "extra@example.de", isActivityReportRecipient: true },
    ], "company", "info@example.de")).toEqual(["extra@example.de"]);
  });
});
