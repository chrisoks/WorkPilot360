export type InvoiceRoutingContact = {
  id: string;
  type: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  invoiceEmail?: string | null;
  activityReportEmail?: string | null;
  isInvoiceRecipient?: boolean | null;
  isActivityReportRecipient?: boolean | null;
  isMainContact?: boolean | null;
  parentCompanyId?: string | null;
  hasDifferentBillingAddress?: boolean | null;
  billingName?: string | null;
  billingStreet?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingCountry?: string | null;
  street?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
};

export type InvoiceMailCandidate = {
  contactId: string;
  label: string;
  email: string;
  preferred: boolean;
  mainContact: boolean;
};

export type BillingAddressSnapshot = {
  customerName: string;
  customerStreet: string;
  customerCity: string;
  customerCountry: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function contactLabel(contact: InvoiceRoutingContact) {
  return clean(contact.companyName) || [contact.firstName, contact.lastName].map(clean).filter(Boolean).join(" ") || "Kontakt";
}

export function getInvoiceMailCandidates(contacts: InvoiceRoutingContact[]): InvoiceMailCandidate[] {
  const seen = new Set<string>();
  return contacts.flatMap((contact) => {
    const email = clean(contact.invoiceEmail) || clean(contact.email);
    const normalized = email.toLowerCase();
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [{
      contactId: contact.id,
      label: contactLabel(contact),
      email,
      preferred: Boolean(contact.isInvoiceRecipient),
      mainContact: Boolean(contact.isMainContact),
    }];
  });
}

export function getRecommendedInvoiceMailRecipient(candidates: InvoiceMailCandidate[]) {
  const preferred = candidates.filter((candidate) => candidate.preferred);
  if (preferred.length === 1) return { email: preferred[0].email, requiresSelection: false };
  if (preferred.length > 1) return { email: "", requiresSelection: true };

  const mainContacts = candidates.filter((candidate) => candidate.mainContact);
  if (mainContacts.length === 1) return { email: mainContacts[0].email, requiresSelection: false };
  if (mainContacts.length > 1) return { email: "", requiresSelection: true };

  if (candidates.length === 1) return { email: candidates[0].email, requiresSelection: false };
  return { email: "", requiresSelection: candidates.length > 1 };
}

export function getActivityReportMailRecipients(
  contacts: InvoiceRoutingContact[],
  customerContactId: string,
  invoiceRecipientEmail = ""
) {
  const primaryContact = contacts.find((contact) => contact.id === customerContactId && contact.type !== "person");
  const additionalContacts = contacts.filter(
    (contact) =>
      contact.type === "person" &&
      contact.parentCompanyId === customerContactId &&
      Boolean(contact.isActivityReportRecipient)
  );
  const excludedEmail = clean(invoiceRecipientEmail).toLowerCase();
  const seen = new Set<string>();

  return [primaryContact, ...additionalContacts].flatMap((contact) => {
    const email = clean(contact?.activityReportEmail) || clean(contact?.email);
    const normalized = email.toLowerCase();
    if (!normalized || normalized === excludedEmail || seen.has(normalized)) return [];
    seen.add(normalized);
    return [email];
  });
}

export function getBillingAddressSnapshot(
  contact: InvoiceRoutingContact | null | undefined,
  fallback: BillingAddressSnapshot
): BillingAddressSnapshot {
  if (!contact || contact.type === "person") return fallback;
  const different = Boolean(contact.hasDifferentBillingAddress);
  const streetParts = different
    ? [contact.billingStreet, contact.billingAddressLine1, contact.billingAddressLine2]
    : [contact.street, contact.addressLine1, contact.addressLine2];
  const cityParts = different
    ? [contact.billingPostalCode, contact.billingCity]
    : [contact.postalCode, contact.city];
  const name = different ? clean(contact.billingName) : contactLabel(contact);
  const country = different ? clean(contact.billingCountry) : clean(contact.country);

  return {
    customerName: name || fallback.customerName,
    customerStreet: streetParts.map(clean).filter((value, index, values) => value && values.indexOf(value) === index).join(", ") || fallback.customerStreet,
    customerCity: cityParts.map(clean).filter(Boolean).join(" ") || fallback.customerCity,
    customerCountry: country || fallback.customerCountry,
  };
}
