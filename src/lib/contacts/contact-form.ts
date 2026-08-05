export const CONTACT_REACHABILITY_ERROR =
  "Bitte hinterlege mindestens eine E-Mail-Adresse, Mobilnummer oder Festnetznummer.";

export function getContactReachabilityError(input: {
  email?: unknown;
  invoiceEmail?: unknown;
  activityReportEmail?: unknown;
  mobile?: unknown;
  phone?: unknown;
}) {
  const hasReachability = [
    input.email,
    input.invoiceEmail,
    input.activityReportEmail,
    input.mobile,
    input.phone,
  ].some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
  return hasReachability ? "" : CONTACT_REACHABILITY_ERROR;
}

export function getContactCategoryLabel(category: string) {
  return category === "Kunde" ? "Gewerbekunde" : category;
}

export function getEffectiveContactCategory(
  category: string,
  type: "company" | "private" | "person"
) {
  if (type === "person") return "Ansprechpartner";
  if (type === "private") return "Privatkunde";
  return category;
}

export function getContactCategoryTone(category: string) {
  if (category === "Kunde") return "business";
  if (category === "Privatkunde") return "private";
  if (category === "Ansprechpartner") return "person";
  if (category === "Lieferant") return "supplier";
  if (category === "Partner") return "partner";
  return "neutral";
}

export type ContactAddressFields = {
  street: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
};

export function getInheritedCompanyAddress(
  company: Partial<ContactAddressFields> | undefined
): ContactAddressFields {
  return {
    street: company?.street ?? "",
    addressLine1: company?.addressLine1 ?? "",
    addressLine2: company?.addressLine2 ?? "",
    postalCode: company?.postalCode ?? "",
    city: company?.city ?? "",
    country: company?.country || "Deutschland",
  };
}

export type ContactSortDirection = "asc" | "desc";

export function sortContactsByValue<T>(
  contacts: T[],
  getValue: (contact: T) => string,
  direction: ContactSortDirection
) {
  const collator = new Intl.Collator("de", {
    numeric: true,
    sensitivity: "base",
  });

  return [...contacts].sort((first, second) => {
    const firstValue = getValue(first).trim();
    const secondValue = getValue(second).trim();
    if (!firstValue && !secondValue) return 0;
    if (!firstValue) return 1;
    if (!secondValue) return -1;
    const comparison = collator.compare(firstValue, secondValue);
    return direction === "asc" ? comparison : -comparison;
  });
}
