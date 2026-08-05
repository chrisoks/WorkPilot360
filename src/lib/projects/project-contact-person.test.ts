import { describe, expect, it } from "vitest";
import {
  getProjectContactPersonName,
  getProjectContactPersonOptionLabel,
  getProjectContactPersonOptions,
} from "./project-contact-person";

const company = {
  id: "company-1",
  type: "company",
  category: "Kunde",
  companyName: "Hotel-Restaurant Reichsadler",
  salutation: "Herr",
  firstName: "Christian",
  lastName: "Reinhardt",
  mainContactName: "",
};

describe("project contact person options", () => {
  it("offers the person stored directly on the company contact", () => {
    const options = getProjectContactPersonOptions(company, [company]);

    expect(options.map((option) => option.id)).toEqual(["company-1"]);
    expect(getProjectContactPersonOptionLabel(options[0], company.id)).toBe(
      "Herr Christian Reinhardt (Firmenkontakt)"
    );
  });

  it("also keeps separately linked contact persons and prioritizes their main contact", () => {
    const regular = {
      id: "person-1",
      type: "person",
      category: "Ansprechpartner",
      firstName: "Berta",
      lastName: "Beispiel",
      parentCompanyId: company.id,
      isMainContact: false,
    };
    const main = {
      id: "person-2",
      type: "person",
      category: "Ansprechpartner",
      firstName: "Anna",
      lastName: "Anfang",
      parentCompanyId: company.id,
      isMainContact: true,
    };

    const options = getProjectContactPersonOptions(company, [regular, company, main]);

    expect(options.map((option) => option.id)).toEqual(["company-1", "person-2", "person-1"]);
  });

  it("does not invent an option when no person is stored on the company", () => {
    const withoutPerson = { ...company, salutation: "Herr", firstName: "", lastName: "", mainContactName: "" };

    expect(getProjectContactPersonOptions(withoutPerson, [withoutPerson])).toEqual([]);
  });

  it("uses mainContactName as fallback for legacy company contacts", () => {
    const legacy = { ...company, salutation: "", firstName: "", lastName: "", mainContactName: "Christian Reinhardt" };

    expect(getProjectContactPersonName(legacy)).toBe("Christian Reinhardt");
  });
});
