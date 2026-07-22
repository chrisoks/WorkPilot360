import { describe, expect, it } from "vitest";
import {
  buildCustomerDirectLinks,
  buildInvoiceDirectLink,
  buildOfferDirectLink,
  buildProjectDirectLinks,
  getMatchedPhoneFields,
  isActiveContextNote,
  preferLinkedPersonPhoneMatches,
} from "./context";

describe("OKS Phone customer context helpers", () => {
  it("keeps only notes active on the requested date", () => {
    expect(isActiveContextNote({ isActive: true, archivedAt: null, validFrom: "2026-01-01", validUntil: "2026-12-31" }, "2026-07-20")).toBe(true);
    expect(isActiveContextNote({ isActive: false, archivedAt: null, validFrom: null, validUntil: null }, "2026-07-20")).toBe(false);
    expect(isActiveContextNote({ isActive: true, archivedAt: null, validFrom: "2026-08-01", validUntil: null }, "2026-07-20")).toBe(false);
  });

  it("builds stable links from structured project classification", () => {
    expect(buildProjectDirectLinks({ id: "p 1", projectNumber: "OKI-42" }).project)
      .toBe("/dashboard?view=projectsImmocare&project=p+1");
    expect(buildProjectDirectLinks({ id: "p2", projectNumber: "MKG-1" }).logbook)
      .toBe("/dashboard?view=projectsSolutions&project=p2&projectTab=logbook");
  });

  it("builds exact customer and document links without trusting display labels", () => {
    expect(buildCustomerDirectLinks("customer 1")).toEqual({
      customer: "/dashboard?view=contacts&customer=customer+1",
      logbook: "/dashboard?view=contacts&customer=customer+1&customerTab=logbook",
      notes: "/dashboard?view=contacts&customer=customer+1&customerTab=notes",
    });
    expect(buildOfferDirectLink({ id: "p1", projectNumber: "MKG-1" }, { id: "o/1", offerType: "addendum" }))
      .toBe("/dashboard?view=projectsSolutions&project=p1&projectTab=documents&doc=Angebote%3A%20Nachtragsangebote&offer=o%2F1");
    expect(buildInvoiceDirectLink({ id: "p1", projectNumber: "MKG-1" }, "i/1"))
      .toBe("/dashboard?view=projectsSolutions&project=p1&projectTab=documents&doc=Rechnungen&invoice=i%2F1");
  });

  it("reports every exact normalized field without merging contacts", () => {
    expect(getMatchedPhoneFields({ phoneNormalized: "+49170", mobileNormalized: "+49170", faxNormalized: null }, "+49170"))
      .toEqual(["phoneNormalized", "mobileNormalized"]);
  });

  it("prefers a linked person over the legacy company duplicate", () => {
    const phone = "+496281557912";
    const company = {
      id: "company-1",
      type: "company",
      parentCompanyId: null,
      phoneNormalized: phone,
      mobileNormalized: null,
      faxNormalized: null,
    };
    const person = {
      id: "person-1",
      type: "person",
      parentCompanyId: company.id,
      phoneNormalized: phone,
      mobileNormalized: null,
      faxNormalized: null,
    };

    expect(preferLinkedPersonPhoneMatches([company, person], phone)).toEqual([person]);
  });

  it("keeps several people sharing a real central number ambiguous", () => {
    const phone = "+49628112345";
    const first = { id: "p1", type: "person", parentCompanyId: "c1", phoneNormalized: phone, mobileNormalized: null, faxNormalized: null };
    const second = { id: "p2", type: "person", parentCompanyId: "c1", phoneNormalized: phone, mobileNormalized: null, faxNormalized: null };

    expect(preferLinkedPersonPhoneMatches([first, second], phone)).toEqual([first, second]);
  });
});
