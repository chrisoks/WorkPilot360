export type ContactMasterDataChange = {
  changedFields: string[];
  labels: string[];
  text: string;
};

const CHANGE_GROUPS: Array<{ label: string; fields: string[] }> = [
  { label: "Name/Firma", fields: ["legalForm", "salutation", "additionalSalutation", "companyName", "firstName", "lastName", "position"] },
  { label: "Kontaktart und Kundennummer", fields: ["category", "type", "customerNumber"] },
  { label: "E-Mail", fields: ["email"] },
  { label: "Telefon", fields: ["phone", "mobile", "fax"] },
  { label: "Weitere Kontaktdaten", fields: ["website", "source", "reachability"] },
  { label: "Ansprechpartner-Zuordnung", fields: ["parentCompanyId", "parentCompanyName", "mainContactName", "isMainContact"] },
  { label: "Anschrift", fields: ["street", "addressLine1", "addressLine2", "postalCode", "city", "country"] },
  { label: "Rechnungsversand", fields: ["invoiceEmail", "activityReportEmail", "isInvoiceRecipient", "isActivityReportRecipient"] },
  { label: "Rechnungsanschrift", fields: ["hasDifferentBillingAddress", "billingName", "billingStreet", "billingAddressLine1", "billingAddressLine2", "billingPostalCode", "billingCity", "billingCountry"] },
  { label: "Konditionen", fields: ["paymentTermDays", "discountPercent", "discountTermDays", "priceGroup"] },
  { label: "Zahlungsdaten", fields: ["iban", "bic", "bankName", "taxId", "debtorCreditorAccount"] },
  { label: "E-Rechnung", fields: ["eInvoiceRequired", "eInvoiceRecipientType", "leitwegId"] },
];

function normalizeAuditValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim().replace(/\s+/g, " ");
}
export function getContactMasterDataChange(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  contactType: string
): ContactMasterDataChange {
  const changedFields = CHANGE_GROUPS.flatMap((group) => group.fields)
    .filter((field) => normalizeAuditValue(previous[field]) !== normalizeAuditValue(next[field]));
  const changedSet = new Set(changedFields);
  const labels = CHANGE_GROUPS
    .filter((group) => group.fields.some((field) => changedSet.has(field)))
    .map((group) => group.label);
  const subject = contactType === "person" ? "Ansprechpartnerdaten" : "Kundendaten";

  return {
    changedFields,
    labels,
    text: labels.length > 0 ? `${subject} geändert: ${labels.join(", ")}.` : "",
  };
}
