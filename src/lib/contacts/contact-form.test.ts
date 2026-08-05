import { describe, expect, it } from "vitest";
import {
  CONTACT_REACHABILITY_ERROR,
  getContactCategoryLabel,
  getContactCategoryTone,
  getContactReachabilityError,
  getInheritedCompanyAddress,
  sortContactsByValue,
} from "./contact-form";

describe("contact form safeguards", () => {
  it("requires at least one direct contact channel", () => {
    expect(getContactReachabilityError({ email: "", mobile: " ", phone: null })).toBe(
      CONTACT_REACHABILITY_ERROR
    );
    expect(getContactReachabilityError({ email: "info@example.test" })).toBe("");
    expect(getContactReachabilityError({ invoiceEmail: "rechnung@example.test" })).toBe("");
    expect(getContactReachabilityError({ mobile: "+49 170 1234567" })).toBe("");
    expect(getContactReachabilityError({ phone: "06281 1234" })).toBe("");
  });

  it("keeps the stored customer category stable while presenting Gewerbekunde", () => {
    expect(getContactCategoryLabel("Kunde")).toBe("Gewerbekunde");
    expect(getContactCategoryTone("Kunde")).toBe("business");
    expect(getContactCategoryTone("Privatkunde")).toBe("private");
    expect(getContactCategoryTone("Ansprechpartner")).toBe("person");
  });

  it("copies all address fields from the selected company", () => {
    expect(
      getInheritedCompanyAddress({
        street: "Hauptstraße 1",
        addressLine1: "Haus A",
        addressLine2: "3. OG",
        postalCode: "74722",
        city: "Buchen",
        country: "Deutschland",
      })
    ).toEqual({
      street: "Hauptstraße 1",
      addressLine1: "Haus A",
      addressLine2: "3. OG",
      postalCode: "74722",
      city: "Buchen",
      country: "Deutschland",
    });
  });

  it("sorts customer numbers descending by default and leaves empty person numbers last", () => {
    const contacts = [
      { number: "700009" },
      { number: "" },
      { number: "700010" },
      { number: "700002" },
    ];
    expect(sortContactsByValue(contacts, (contact) => contact.number, "desc")).toEqual([
      { number: "700010" },
      { number: "700009" },
      { number: "700002" },
      { number: "" },
    ]);
  });
});
