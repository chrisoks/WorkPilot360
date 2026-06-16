import type { XRechnungInvoice, XRechnungLine } from "./xrechnung";

export type XRechnungValidationSeverity = "error" | "warning" | "info";

export type XRechnungValidationIssue = {
  severity: XRechnungValidationSeverity;
  code: string;
  message: string;
};

export type XRechnungValidationResult = {
  valid: boolean;
  mode: "technical-minimum";
  issues: XRechnungValidationIssue[];
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isDateKey(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanText(value));
}

function isPositiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function isNonNegativeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sameMoney(left: number, right: number) {
  return Math.abs(roundMoney(left) - roundMoney(right)) <= 0.02;
}

function addIssue(
  issues: XRechnungValidationIssue[],
  severity: XRechnungValidationSeverity,
  code: string,
  message: string
) {
  issues.push({ severity, code, message });
}

export function validateXRechnungPayload(
  invoice: XRechnungInvoice,
  lines: XRechnungLine[]
): XRechnungValidationResult {
  const issues: XRechnungValidationIssue[] = [];
  const seller = invoice.seller;

  if (!cleanText(invoice.invoiceNumber)) {
    addIssue(issues, "error", "invoice-number-missing", "Rechnungsnummer fehlt.");
  }
  if (!isDateKey(invoice.issueDate)) {
    addIssue(issues, "error", "issue-date-invalid", "Rechnungsdatum fehlt oder ist kein Datum im Format JJJJ-MM-TT.");
  }
  if (!isDateKey(invoice.serviceDate)) {
    addIssue(issues, "error", "service-date-invalid", "Leistungsdatum fehlt oder ist kein Datum im Format JJJJ-MM-TT.");
  }
  if (!isDateKey(invoice.dueDate)) {
    addIssue(issues, "error", "due-date-invalid", "Fälligkeitsdatum fehlt oder ist kein Datum im Format JJJJ-MM-TT.");
  }
  if (!isNonNegativeNumber(invoice.paymentTermDays)) {
    addIssue(issues, "error", "payment-terms-invalid", "Zahlungsziel muss eine Zahl ab 0 Tagen sein.");
  }

  const sellerRequiredFields: Array<[string, unknown, string]> = [
    ["seller-name-missing", seller.name, "Verkäufer: Firmenname fehlt."],
    ["seller-street-missing", seller.street, "Verkäufer: Straße fehlt."],
    ["seller-postal-code-missing", seller.postalCode, "Verkäufer: PLZ fehlt."],
    ["seller-city-missing", seller.city, "Verkäufer: Ort fehlt."],
    ["seller-country-missing", seller.country, "Verkäufer: Land fehlt."],
    ["seller-endpoint-missing", seller.endpoint, "Verkäufer: E-Mail/Endpoint fehlt."],
  ];
  sellerRequiredFields.forEach(([code, value, message]) => {
    if (!cleanText(value)) addIssue(issues, "error", code, message);
  });

  if (!cleanText(seller.vatId) && !cleanText(seller.taxNumber)) {
    addIssue(issues, "error", "seller-tax-id-missing", "Verkäufer: USt-ID oder Steuernummer fehlt.");
  }
  if (!cleanText(seller.iban)) {
    addIssue(issues, "error", "seller-iban-missing", "Verkäufer: IBAN fehlt.");
  }

  const customerRequiredFields: Array<[string, unknown, string]> = [
    ["customer-name-missing", invoice.customerName, "Rechnungsempfänger: Name fehlt."],
    ["customer-street-missing", invoice.customerStreet, "Rechnungsempfänger: Straße fehlt."],
    ["customer-city-missing", invoice.customerCity, "Rechnungsempfänger: PLZ/Ort fehlt."],
  ];
  customerRequiredFields.forEach(([code, value, message]) => {
    if (!cleanText(value)) addIssue(issues, "error", code, message);
  });

  if (!cleanText(invoice.buyerReference) || cleanText(invoice.buyerReference) === "nicht angegeben") {
    addIssue(issues, "warning", "buyer-reference-missing", "BuyerReference/Leitweg-ID ist nicht gepflegt.");
  }

  if (!lines.length) {
    addIssue(issues, "error", "lines-missing", "Rechnungspositionen fehlen.");
  }

  lines.forEach((line, index) => {
    const label = `Position ${line.position || index + 1}`;
    if (!cleanText(line.title)) addIssue(issues, "error", "line-title-missing", `${label}: Bezeichnung fehlt.`);
    if (!isPositiveNumber(line.quantity)) addIssue(issues, "error", "line-quantity-invalid", `${label}: Menge muss größer 0 sein.`);
    if (!cleanText(line.unit)) addIssue(issues, "error", "line-unit-missing", `${label}: Einheit fehlt.`);
    if (!isNonNegativeNumber(line.unitPrice)) addIssue(issues, "error", "line-price-invalid", `${label}: Einzelpreis muss eine Zahl ab 0 sein.`);
    if (!isNonNegativeNumber(line.totalNet)) addIssue(issues, "error", "line-total-invalid", `${label}: Nettosumme muss eine Zahl ab 0 sein.`);
    if (!isNonNegativeNumber(line.vatRate)) addIssue(issues, "error", "line-vat-invalid", `${label}: MwSt.-Satz muss eine Zahl ab 0 sein.`);
  });

  const lineNetTotal = roundMoney(lines.reduce((sum, line) => sum + Number(line.totalNet || 0), 0));
  if (lines.length && !sameMoney(lineNetTotal, Number(invoice.netTotal || 0))) {
    addIssue(
      issues,
      "error",
      "net-total-mismatch",
      `Summe der Positionen (${lineNetTotal.toFixed(2)} EUR) passt nicht zur Rechnungssumme (${roundMoney(Number(invoice.netTotal || 0)).toFixed(2)} EUR).`
    );
  }

  if (!isNonNegativeNumber(invoice.netTotal) || !isNonNegativeNumber(invoice.grossTotal)) {
    addIssue(issues, "error", "invoice-total-invalid", "Rechnungssummen müssen Zahlen ab 0 sein.");
  } else if (Number(invoice.grossTotal || 0) < Number(invoice.netTotal || 0)) {
    addIssue(issues, "error", "gross-total-invalid", "Bruttosumme darf nicht kleiner als Nettosumme sein.");
  }

  const expectedTaxTotal = roundMoney(Number(invoice.netTotal || 0) * (Number(invoice.vatRate || 0) / 100));
  const actualTaxTotal = roundMoney(Number(invoice.grossTotal || 0) - Number(invoice.netTotal || 0));
  if (Number(invoice.netTotal || 0) > 0 && !sameMoney(expectedTaxTotal, actualTaxTotal)) {
    addIssue(
      issues,
      "warning",
      "tax-total-mismatch",
      `Steuerbetrag (${actualTaxTotal.toFixed(2)} EUR) passt nicht exakt zum MwSt.-Satz (${expectedTaxTotal.toFixed(2)} EUR erwartet).`
    );
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return {
    valid: !hasErrors,
    mode: "technical-minimum",
    issues,
  };
}
