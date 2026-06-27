export type XRechnungCompany = "OK solutions" | "OK immocare";

export type XRechnungSeller = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  endpoint?: string;
  vatId?: string;
  taxNumber?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
};

export type XRechnungInvoice = {
  invoiceNumber: string;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  currency?: string;
  seller: XRechnungSeller;
  customerName: string;
  customerStreet: string;
  customerCity: string;
  contactName?: string;
  netTotal: number;
  vatRate: number;
  grossTotal: number;
  paymentTermDays: number;
  buyerReference?: string;
};

export type XRechnungLine = {
  position: number;
  quantity: number;
  unit: string;
  title: string;
  description?: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  totalNet: number;
};

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function money(value: number) {
  return (Math.round((Number(value) || 0) * 100) / 100).toFixed(2);
}

function quantity(value: number) {
  return (Math.round((Number(value) || 0) * 1000) / 1000).toFixed(3);
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

function splitCity(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4,5})\s+(.+)$/);
  if (!match) return { postalCode: "", city: trimmed };
  return { postalCode: match[1], city: match[2] };
}

function unitCode(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["std", "h", "stunde", "stunden"].includes(normalized)) return "HUR";
  if (["m", "meter"].includes(normalized)) return "MTR";
  if (["m2", "qm", "m²"].includes(normalized)) return "MTK";
  if (["kg", "kilogramm"].includes(normalized)) return "KGM";
  if (["l", "liter"].includes(normalized)) return "LTR";
  return "C62";
}

function partyXml(role: "AccountingSupplierParty" | "AccountingCustomerParty", party: {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  endpoint?: string;
  vatId?: string;
  taxNumber?: string;
}) {
  const taxId = party.vatId || party.taxNumber || "";
  const taxScheme = party.vatId ? "VAT" : "FC";
  return [
    `  <cac:${role}>`,
    "    <cac:Party>",
    `      <cbc:EndpointID schemeID="${party.endpoint ? "EM" : "0204"}">${escapeXml(party.endpoint || "0000000000")}</cbc:EndpointID>`,
    "      <cac:PartyName>",
    `        <cbc:Name>${escapeXml(party.name)}</cbc:Name>`,
    "      </cac:PartyName>",
    "      <cac:PostalAddress>",
    `        <cbc:StreetName>${escapeXml(party.street)}</cbc:StreetName>`,
    `        <cbc:CityName>${escapeXml(party.city)}</cbc:CityName>`,
    `        <cbc:PostalZone>${escapeXml(party.postalCode)}</cbc:PostalZone>`,
    "        <cac:Country>",
    `          <cbc:IdentificationCode>${escapeXml(party.country)}</cbc:IdentificationCode>`,
    "        </cac:Country>",
    "      </cac:PostalAddress>",
    ...(taxId
      ? [
          "      <cac:PartyTaxScheme>",
          `        <cbc:CompanyID>${escapeXml(taxId)}</cbc:CompanyID>`,
          "        <cac:TaxScheme>",
          `          <cbc:ID>${taxScheme}</cbc:ID>`,
          "        </cac:TaxScheme>",
          "      </cac:PartyTaxScheme>",
        ]
      : []),
    "      <cac:PartyLegalEntity>",
    `        <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>`,
    "      </cac:PartyLegalEntity>",
    "    </cac:Party>",
    `  </cac:${role}>`,
  ].join("\n");
}

function paymentMeansXml(seller: XRechnungSeller) {
  if (!seller.iban) return "";
  return [
    "  <cac:PaymentMeans>",
    "    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>",
    "    <cac:PayeeFinancialAccount>",
    `      <cbc:ID>${escapeXml(seller.iban)}</cbc:ID>`,
    ...(seller.bankName ? [`      <cbc:Name>${escapeXml(seller.bankName)}</cbc:Name>`] : []),
    ...(seller.bic
      ? [
          "      <cac:FinancialInstitutionBranch>",
          `        <cbc:ID>${escapeXml(seller.bic)}</cbc:ID>`,
          "      </cac:FinancialInstitutionBranch>",
        ]
      : []),
    "    </cac:PayeeFinancialAccount>",
    "  </cac:PaymentMeans>",
  ].join("\n");
}

export function generateXRechnungXml(invoice: XRechnungInvoice, lines: XRechnungLine[]) {
  const currency = invoice.currency || "EUR";
  const sellerParty = invoice.seller;
  const customerCity = splitCity(invoice.customerCity);
  const customerParty = {
    name: invoice.customerName || "Rechnungsempfänger",
    street: invoice.customerStreet || "Adresse nicht gepflegt",
    postalCode: customerCity.postalCode,
    city: customerCity.city || invoice.customerCity || "Ort nicht gepflegt",
    country: "DE",
  };
  const issueDate = normalizeDate(invoice.issueDate);
  const serviceDate = normalizeDate(invoice.serviceDate || invoice.issueDate);
  const dueDate = normalizeDate(invoice.dueDate || invoice.serviceDate || invoice.issueDate);
  const taxTotal = Math.max(0, invoice.grossTotal - invoice.netTotal);

  const invoiceLines = lines
    .map((line, index) => {
      const lineNet = Number.isFinite(line.totalNet) ? line.totalNet : line.quantity * line.unitPrice;
      const description = [line.title, line.description].filter(Boolean).join(" - ");
      return [
        "  <cac:InvoiceLine>",
        `    <cbc:ID>${line.position || index + 1}</cbc:ID>`,
        `    <cbc:InvoicedQuantity unitCode="${unitCode(line.unit)}">${quantity(line.quantity)}</cbc:InvoicedQuantity>`,
        `    <cbc:LineExtensionAmount currencyID="${currency}">${money(lineNet)}</cbc:LineExtensionAmount>`,
        "    <cac:Item>",
        `      <cbc:Description>${escapeXml(description)}</cbc:Description>`,
        `      <cbc:Name>${escapeXml(line.title || "Position")}</cbc:Name>`,
        "      <cac:ClassifiedTaxCategory>",
        `        <cbc:ID>S</cbc:ID>`,
        `        <cbc:Percent>${money(line.vatRate)}</cbc:Percent>`,
        "        <cac:TaxScheme>",
        "          <cbc:ID>VAT</cbc:ID>",
        "        </cac:TaxScheme>",
        "      </cac:ClassifiedTaxCategory>",
        "    </cac:Item>",
        "    <cac:Price>",
        `      <cbc:PriceAmount currencyID="${currency}">${money(line.unitPrice)}</cbc:PriceAmount>`,
        "    </cac:Price>",
        "  </cac:InvoiceLine>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    '         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    '         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    "  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>",
    "  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>",
    `  <cbc:ID>${escapeXml(invoice.invoiceNumber)}</cbc:ID>`,
    `  <cbc:IssueDate>${issueDate}</cbc:IssueDate>`,
    `  <cbc:DueDate>${dueDate}</cbc:DueDate>`,
    "  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>",
    `  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>`,
    `  <cbc:BuyerReference>${escapeXml(invoice.buyerReference || "nicht angegeben")}</cbc:BuyerReference>`,
    "  <cac:InvoicePeriod>",
    `    <cbc:StartDate>${serviceDate}</cbc:StartDate>`,
    `    <cbc:EndDate>${serviceDate}</cbc:EndDate>`,
    "  </cac:InvoicePeriod>",
    partyXml("AccountingSupplierParty", sellerParty),
    partyXml("AccountingCustomerParty", customerParty),
    paymentMeansXml(sellerParty),
    "  <cac:PaymentTerms>",
    `    <cbc:Note>Zahlbar innerhalb von ${Math.max(0, Math.round(invoice.paymentTermDays || 0))} Tagen.</cbc:Note>`,
    "  </cac:PaymentTerms>",
    "  <cac:TaxTotal>",
    `    <cbc:TaxAmount currencyID="${currency}">${money(taxTotal)}</cbc:TaxAmount>`,
    "    <cac:TaxSubtotal>",
    `      <cbc:TaxableAmount currencyID="${currency}">${money(invoice.netTotal)}</cbc:TaxableAmount>`,
    `      <cbc:TaxAmount currencyID="${currency}">${money(taxTotal)}</cbc:TaxAmount>`,
    "      <cac:TaxCategory>",
    "        <cbc:ID>S</cbc:ID>",
    `        <cbc:Percent>${money(invoice.vatRate)}</cbc:Percent>`,
    "        <cac:TaxScheme>",
    "          <cbc:ID>VAT</cbc:ID>",
    "        </cac:TaxScheme>",
    "      </cac:TaxCategory>",
    "    </cac:TaxSubtotal>",
    "  </cac:TaxTotal>",
    "  <cac:LegalMonetaryTotal>",
    `    <cbc:LineExtensionAmount currencyID="${currency}">${money(invoice.netTotal)}</cbc:LineExtensionAmount>`,
    `    <cbc:TaxExclusiveAmount currencyID="${currency}">${money(invoice.netTotal)}</cbc:TaxExclusiveAmount>`,
    `    <cbc:TaxInclusiveAmount currencyID="${currency}">${money(invoice.grossTotal)}</cbc:TaxInclusiveAmount>`,
    `    <cbc:PayableAmount currencyID="${currency}">${money(invoice.grossTotal)}</cbc:PayableAmount>`,
    "  </cac:LegalMonetaryTotal>",
    invoiceLines,
    "</Invoice>",
  ].join("\n");
}
