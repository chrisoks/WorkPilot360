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
