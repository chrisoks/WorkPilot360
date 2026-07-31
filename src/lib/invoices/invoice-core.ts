export type InvoiceCompany = "OK solutions" | "OK immocare";

export type InvoiceDraftLineInput = {
  catalogItemId?: string;
  catalogType?: string;
  quantity?: number;
  unit?: string;
  title?: string;
  description?: string;
  unitPrice?: number;
  discountPercent?: number;
  vatRate?: number;
};

export type CanonicalInvoiceDraftLine = {
  catalogItemId: string;
  catalogType: string;
  quantity: number;
  unit: string;
  title: string;
  description: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  totalNet: number;
};

export type InvoiceDraftTotals = {
  lineNetBeforeInvoiceDiscount: number;
  invoiceDiscountAmount: number;
  netTotal: number;
  vatRate: number;
  vatAmount: number;
  grossTotal: number;
};

export function cleanInvoiceText(value: unknown, maxLength = 12_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function cleanInvoiceNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampInvoicePercent(value: unknown) {
  return Math.min(Math.max(cleanInvoiceNumber(value, 0), 0), 100);
}

export function roundInvoiceMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeInvoiceCompany(value: unknown): InvoiceCompany {
  return value === "OK immocare" ? "OK immocare" : "OK solutions";
}

export function normalizeInvoiceDate(value: unknown) {
  const date = cleanInvoiceText(value, 10);
  return /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T12:00:00Z`))
    ? date
    : "";
}

export function normalizeInvoiceMonth(value: unknown) {
  const month = cleanInvoiceText(value, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "";
}

export function normalizeInvoicePaymentTermDays(value: unknown) {
  return Math.min(Math.max(Math.round(cleanInvoiceNumber(value, 14)), 0), 365);
}

export function addInvoiceDays(dateKey: string, days: number) {
  const date = normalizeInvoiceDate(dateKey);
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day, 12));
  result.setUTCDate(result.getUTCDate() + normalizeInvoicePaymentTermDays(days));
  return result.toISOString().slice(0, 10);
}

export function normalizeInvoiceUnit(value: unknown) {
  const unit = cleanInvoiceText(value, 30);
  const aliases: Record<string, string> = {
    h: "Std",
    std: "Std",
    stunde: "Std",
    stunden: "Std",
    stk: "Stk",
    stück: "Stk",
    stueck: "Stk",
    pauschale: "Pauschal",
    pauschal: "Pauschal",
    liter: "L",
    ltr: "L",
  };
  return aliases[unit.toLocaleLowerCase("de-DE")] ?? unit;
}

export function calculateInvoiceLineNet(input: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}) {
  const base = input.quantity * input.unitPrice;
  const discount = roundInvoiceMoney(base * (clampInvoicePercent(input.discountPercent) / 100));
  return roundInvoiceMoney(base - discount);
}

export function calculateInvoiceDraftTotals(
  lines: Array<Pick<CanonicalInvoiceDraftLine, "totalNet">>,
  discountPercent: number,
  vatRate: number
): InvoiceDraftTotals {
  const lineNetBeforeInvoiceDiscount = roundInvoiceMoney(
    lines.reduce((sum, line) => sum + Number(line.totalNet || 0), 0)
  );
  const invoiceDiscountAmount = roundInvoiceMoney(
    lineNetBeforeInvoiceDiscount * (clampInvoicePercent(discountPercent) / 100)
  );
  const netTotal = roundInvoiceMoney(
    lineNetBeforeInvoiceDiscount - invoiceDiscountAmount
  );
  const boundedVatRate = clampInvoicePercent(vatRate);
  const vatAmount = roundInvoiceMoney(netTotal * (boundedVatRate / 100));
  return {
    lineNetBeforeInvoiceDiscount,
    invoiceDiscountAmount,
    netTotal,
    vatRate: boundedVatRate,
    vatAmount,
    grossTotal: roundInvoiceMoney(netTotal + vatAmount),
  };
}

export function validateInvoiceDraft(input: {
  projectId: string;
  serviceDate: string;
  lines: CanonicalInvoiceDraftLine[];
}) {
  const missingFields: string[] = [];
  const errors: string[] = [];
  if (!input.projectId) missingFields.push("Projekt");
  if (!input.serviceDate) missingFields.push("Leistungsdatum");
  if (input.lines.length === 0) missingFields.push("Mindestens eine Position");
  input.lines.forEach((line, index) => {
    if (!line.title) errors.push(`Position ${index + 1}: Bezeichnung fehlt.`);
    if (!(line.quantity > 0)) errors.push(`Position ${index + 1}: Menge muss größer als 0 sein.`);
    if (line.unitPrice < 0) errors.push(`Position ${index + 1}: Einzelpreis darf nicht negativ sein.`);
  });
  return { missingFields, errors };
}
