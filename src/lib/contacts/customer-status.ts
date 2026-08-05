export type CustomerStatus = "prospect" | "new" | "existing";
export type CustomerStatusOverride = "automatic" | CustomerStatus;

const CUSTOMER_STATUS_LABELS = {
  automatic: "Automatik",
  prospect: "Kunde ohne Rechnung",
  new: "Neukunde",
  existing: "Bestandskunde",
} as const;

export function deriveCustomerStatus(invoiceCount: number): CustomerStatus {
  if (invoiceCount <= 0) return "prospect";
  if (invoiceCount === 1) return "new";
  return "existing";
}

export function normalizeCustomerStatusOverride(value: unknown): CustomerStatusOverride {
  return value === "prospect" || value === "new" || value === "existing"
    ? value
    : "automatic";
}

export function getEffectiveCustomerStatus(
  systemStatus: CustomerStatus,
  override: CustomerStatusOverride
): CustomerStatus {
  return override === "automatic" ? systemStatus : override;
}

export function getCustomerStatusAuditText(input: {
  previousOverride: unknown;
  previousReason: string;
  nextOverride: unknown;
  nextReason: string;
}) {
  const previousOverride = normalizeCustomerStatusOverride(input.previousOverride);
  const nextOverride = normalizeCustomerStatusOverride(input.nextOverride);
  const previousReason = input.previousReason.trim();
  const nextReason = input.nextReason.trim();

  if (previousOverride === nextOverride && previousReason === nextReason) return "";

  if (nextOverride === "automatic") {
    return `Manuelle Kundenstatus-Einstufung „${CUSTOMER_STATUS_LABELS[previousOverride]}“ aufgehoben. Der Status wird wieder automatisch aus aktiven WorkPilot-Rechnungen ermittelt.`;
  }

  if (previousOverride === nextOverride) {
    return `Begründung zur manuellen Kundenstatus-Einstufung „${CUSTOMER_STATUS_LABELS[nextOverride]}“ geändert: ${nextReason}`;
  }

  const transition =
    previousOverride === "automatic"
      ? `Kundenstatus manuell auf „${CUSTOMER_STATUS_LABELS[nextOverride]}“ gesetzt.`
      : `Manuelle Kundenstatus-Einstufung von „${CUSTOMER_STATUS_LABELS[previousOverride]}“ auf „${CUSTOMER_STATUS_LABELS[nextOverride]}“ geändert.`;

  return `${transition} Begründung: ${nextReason}`;
}
