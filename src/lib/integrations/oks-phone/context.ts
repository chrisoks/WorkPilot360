import { getProjectBusinessAreaCode } from "@/lib/project-business-area";

export function isActiveContextNote(
  note: { isActive: boolean; archivedAt: Date | null; validFrom: string | null; validUntil: string | null },
  today: string
) {
  return (
    note.isActive &&
    note.archivedAt === null &&
    (!note.validFrom || note.validFrom <= today) &&
    (!note.validUntil || note.validUntil >= today)
  );
}

export function buildProjectDirectLinks(project: {
  id: string;
  projectType?: string | null;
  branch?: string | null;
  projectNumber?: string | null;
}) {
  const view = getProjectBusinessAreaCode(project) === "OK_IMMOCARE"
    ? "projectsImmocare"
    : "projectsSolutions";
  const base = `/dashboard?${new URLSearchParams({ view, project: project.id }).toString()}`;
  return {
    project: base,
    logbook: `${base}&projectTab=logbook`,
    notes: `${base}&projectTab=notes`,
    offers: `${base}&projectTab=documents&doc=Angebote`,
    invoices: `${base}&projectTab=documents&doc=Rechnungen`,
  };
}

export function buildCustomerDirectLinks(customerId: string) {
  const base = `/dashboard?${new URLSearchParams({ view: "contacts", customer: customerId }).toString()}`;
  return {
    customer: base,
    logbook: `${base}&customerTab=logbook`,
    notes: `${base}&customerTab=notes`,
  };
}

export function buildOfferDirectLink(
  project: Parameters<typeof buildProjectDirectLinks>[0],
  offer: { id: string; offerType?: string | null }
) {
  const documentType = offer.offerType === "addendum" ? "Angebote: Nachtragsangebote" : "Angebote";
  return `${buildProjectDirectLinks(project).project}&projectTab=documents&doc=${encodeURIComponent(documentType)}&offer=${encodeURIComponent(offer.id)}`;
}

export function buildInvoiceDirectLink(
  project: Parameters<typeof buildProjectDirectLinks>[0],
  invoiceId: string
) {
  return `${buildProjectDirectLinks(project).project}&projectTab=documents&doc=Rechnungen&invoice=${encodeURIComponent(invoiceId)}`;
}

export function getMatchedPhoneFields(contact: {
  phoneNormalized: string | null;
  mobileNormalized: string | null;
  faxNormalized: string | null;
}, phone: string) {
  return (["phoneNormalized", "mobileNormalized", "faxNormalized"] as const).filter(
    (field) => contact[field] === phone
  );
}

type OksPhoneMatchedContact = {
  id: string;
  type: string;
  parentCompanyId: string | null;
  phoneNormalized: string | null;
  mobileNormalized: string | null;
  faxNormalized: string | null;
};

/**
 * Legacy imports may have stored a main contact's direct number both on the
 * company and on the linked person. In that exact parent/child situation the
 * person is the more specific match. Shared numbers between several people
 * remain visible as genuinely ambiguous matches.
 */
export function preferLinkedPersonPhoneMatches<T extends OksPhoneMatchedContact>(contacts: T[], phone: string) {
  const linkedCompanyIds = new Set(
    contacts
      .filter(
        (contact) =>
          contact.type === "person" &&
          Boolean(contact.parentCompanyId) &&
          getMatchedPhoneFields(contact, phone).length > 0
      )
      .map((contact) => contact.parentCompanyId as string)
  );

  if (linkedCompanyIds.size === 0) return contacts;
  return contacts.filter(
    (contact) =>
      !(
        contact.type === "company" &&
        linkedCompanyIds.has(contact.id) &&
        getMatchedPhoneFields(contact, phone).length > 0
      )
  );
}
