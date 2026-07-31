export type OfferCompany = "OK solutions" | "OK immocare";
export type OfferType = "base" | "addendum";
export type OfferAddendumMode = "addition" | "replacement" | "reduction";

export type OfferDraftLineInput = {
  catalogItemId?: string;
  catalogType?: string;
  quantity?: number;
  unit?: string;
  title?: string;
  description?: string;
  unitPrice?: number;
  discountPercent?: number;
};

export type CanonicalOfferDraftLine = {
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

export type OfferDraftTotals = {
  lineNetBeforeOfferDiscount: number;
  offerDiscountAmount: number;
  netTotal: number;
  vatRate: number;
  vatAmount: number;
  grossTotal: number;
};

export type OfferDraftValidation = {
  missingFields: string[];
  errors: string[];
};

export function cleanOfferText(value: unknown, maxLength = 12_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function cleanOfferNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampOfferPercent(value: unknown) {
  return Math.min(Math.max(cleanOfferNumber(value, 0), 0), 100);
}

export function roundOfferMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeOfferCompany(value: unknown): OfferCompany {
  return value === "OK immocare" ? "OK immocare" : "OK solutions";
}

export function normalizeOfferType(value: unknown): OfferType {
  return value === "addendum" ? "addendum" : "base";
}

export function normalizeOfferAddendumMode(
  value: unknown
): OfferAddendumMode {
  return value === "replacement" || value === "reduction"
    ? value
    : "addition";
}

export function normalizeOfferMonth(value: unknown) {
  const month = cleanOfferText(value, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "";
}

export function normalizeOfferUnit(value: unknown) {
  const unit = cleanOfferText(value, 30);
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

export function calculateOfferLineNet(input: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}) {
  const base = input.quantity * input.unitPrice;
  const discount = roundOfferMoney(base * (input.discountPercent / 100));
  return roundOfferMoney(base - discount);
}

export function calculateOfferDraftTotals(
  lines: Array<Pick<CanonicalOfferDraftLine, "totalNet">>,
  discountPercent: number,
  vatRate: number
): OfferDraftTotals {
  const lineNetBeforeOfferDiscount = roundOfferMoney(
    lines.reduce((sum, line) => sum + Number(line.totalNet || 0), 0)
  );
  const boundedDiscount = clampOfferPercent(discountPercent);
  const offerDiscountAmount = roundOfferMoney(
    lineNetBeforeOfferDiscount * (boundedDiscount / 100)
  );
  const netTotal = roundOfferMoney(
    lineNetBeforeOfferDiscount - offerDiscountAmount
  );
  const boundedVatRate = Math.min(
    Math.max(cleanOfferNumber(vatRate, 19), 0),
    100
  );
  const vatAmount = roundOfferMoney(netTotal * (boundedVatRate / 100));
  const grossTotal = roundOfferMoney(netTotal + vatAmount);
  return {
    lineNetBeforeOfferDiscount,
    offerDiscountAmount,
    netTotal,
    vatRate: boundedVatRate,
    vatAmount,
    grossTotal,
  };
}

export function validateOfferDraft(input: {
  projectId: string;
  offerType: OfferType;
  parentOfferId: string;
  plannedExecutionMonth: string;
  plannedExecutionEndMonth: string;
  requiresExecutionEndMonth: boolean;
  lines: CanonicalOfferDraftLine[];
}): OfferDraftValidation {
  const missingFields: string[] = [];
  const errors: string[] = [];
  if (!input.projectId) missingFields.push("Projekt");
  if (!input.plannedExecutionMonth) {
    missingFields.push("Ausführungsmonat");
  }
  if (
    input.requiresExecutionEndMonth &&
    !input.plannedExecutionEndMonth
  ) {
    missingFields.push("Endmonat des Ausführungszeitraums");
  }
  if (input.offerType === "addendum" && !input.parentOfferId) {
    missingFields.push("Bezugsangebot für den Nachtrag");
  }
  if (input.lines.length === 0) missingFields.push("Mindestens eine Position");
  if (
    input.plannedExecutionMonth &&
    input.plannedExecutionEndMonth &&
    input.plannedExecutionEndMonth < input.plannedExecutionMonth
  ) {
    errors.push("Der Ausführungszeitraum endet vor dem Startmonat.");
  }
  input.lines.forEach((line, index) => {
    if (!line.title) errors.push(`Position ${index + 1}: Bezeichnung fehlt.`);
    if (!(line.quantity > 0)) {
      errors.push(`Position ${index + 1}: Menge muss größer als 0 sein.`);
    }
    if (line.unitPrice < 0) {
      errors.push(`Position ${index + 1}: Einzelpreis darf nicht negativ sein.`);
    }
  });
  return { missingFields, errors };
}
