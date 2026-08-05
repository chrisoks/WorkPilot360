export type ProjectContactPersonCandidate = {
  id: string;
  type: string;
  category: string;
  salutation?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  mainContactName?: string | null;
  email?: string | null;
  customerNumber?: string | null;
  parentCompanyId?: string | null;
  parentCompanyName?: string | null;
  isMainContact?: boolean | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function getProjectContactPersonName(contact?: ProjectContactPersonCandidate | null) {
  if (!contact) return "";

  const nameCore = [contact.firstName, contact.lastName]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  const personName = nameCore ? [clean(contact.salutation), nameCore].filter(Boolean).join(" ") : "";

  if (contact.type === "company") {
    return personName || clean(contact.mainContactName);
  }

  return personName || clean(contact.mainContactName) || clean(contact.email) || clean(contact.customerNumber);
}

export function getProjectContactPersonOptions<T extends ProjectContactPersonCandidate>(
  company: T | null | undefined,
  contacts: T[]
) {
  if (!company) return [];

  const directCompanyContact = getProjectContactPersonName(company) ? [company] : [];
  const linkedContacts = contacts
    .filter(
      (contact) =>
        contact.id !== company.id &&
        (contact.type === "person" || contact.category === "Ansprechpartner") &&
        (contact.parentCompanyId === company.id ||
          (clean(company.companyName) && clean(contact.parentCompanyName) === clean(company.companyName)))
    )
    .sort((first, second) => {
      if (first.isMainContact && !second.isMainContact) return -1;
      if (!first.isMainContact && second.isMainContact) return 1;
      return getProjectContactPersonName(first).localeCompare(getProjectContactPersonName(second), "de");
    });

  return [...directCompanyContact, ...linkedContacts];
}

export function getProjectContactPersonOptionLabel(
  contact: ProjectContactPersonCandidate,
  companyId: string
) {
  const name = getProjectContactPersonName(contact);
  return contact.id === companyId ? `${name} (Firmenkontakt)` : name;
}
