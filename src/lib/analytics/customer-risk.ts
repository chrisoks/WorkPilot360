export type CustomerRiskState = "good" | "ok" | "low";

type CustomerRiskInput = {
  overdueInvoiceCount: number;
  highestReminderLevel: number;
  hotAlertCount: number;
  openRevenue: number;
  revenue: number;
};

export type CustomerRiskAssessment = {
  label: "Unauffällig" | "Prüfen" | "Kritisch";
  reason: string;
  reasons: string[];
  score: number;
  state: CustomerRiskState;
};

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export function getCustomerRiskAssessment(input: CustomerRiskInput): CustomerRiskAssessment {
  const hasHighOpenShare = input.openRevenue > 0 && input.revenue > 0 && input.openRevenue / input.revenue > 0.5;
  const reasons: string[] = [];

  if (input.overdueInvoiceCount > 0) {
    reasons.push(pluralize(input.overdueInvoiceCount, "überfällige Rechnung", "überfällige Rechnungen"));
  }
  if (input.highestReminderLevel > 0) {
    reasons.push(`Mahnstufe ${input.highestReminderLevel}`);
  }
  if (input.hotAlertCount > 0) {
    reasons.push(pluralize(input.hotAlertCount, "KuZu-Hot-Alert", "KuZu-Hot-Alerts"));
  }
  if (hasHighOpenShare) {
    reasons.push("Mehr als 50 % des Umsatzes offen");
  }

  const score =
    input.overdueInvoiceCount * 3 +
    input.highestReminderLevel * 2 +
    input.hotAlertCount * 2 +
    (hasHighOpenShare ? 1 : 0);
  const state: CustomerRiskState = score >= 5 ? "low" : score >= 2 ? "ok" : "good";
  const statusReasons = state === "good" ? [] : reasons;

  return {
    label: state === "low" ? "Kritisch" : state === "ok" ? "Prüfen" : "Unauffällig",
    reason: statusReasons.length > 0 ? statusReasons.join(" · ") : "Keine akuten Risikosignale",
    reasons: statusReasons,
    score,
    state,
  };
}
