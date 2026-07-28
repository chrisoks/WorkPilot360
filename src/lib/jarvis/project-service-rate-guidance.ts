import {
  resolveJarvisProjectLogic,
  type JarvisProjectLogicInput,
} from "@/lib/jarvis/project-logic";

export type JarvisProjectServiceRateGuidance = {
  projectTypeLabel: string;
  projectTypeConfigured: boolean;
  hasContractualHourlyBilling: boolean;
  explanation: string;
};

export function getJarvisProjectServiceRateGuidance(
  project: Pick<
    JarvisProjectLogicInput,
    "projectKind" | "recurringBillingMode"
  >
): JarvisProjectServiceRateGuidance {
  const logic = resolveJarvisProjectLogic(project);

  if (logic.variant === "recurringHourly") {
    return {
      projectTypeLabel: logic.label,
      projectTypeConfigured: true,
      hasContractualHourlyBilling: true,
      explanation:
        "Dieser Dauerläufer wird nach tatsächlich zugeordneten Stundenleistungen abgerechnet. Der aus fertigen Rechnungen berechnete Satz kann deshalb mit den zugehörigen Stempelstunden verglichen werden.",
    };
  }
  if (logic.variant === "recurringMonthlyFlat") {
    return {
      projectTypeLabel: logic.label,
      projectTypeConfigured: true,
      hasContractualHourlyBilling: false,
      explanation:
        "Dieser Dauerläufer wird mit einer festen Monatspauschale abgerechnet. Es gibt deshalb keinen vertraglich berechneten Kunden-Stundensatz. Ein rechnerischer Erlös je eingesetzter Stunde wäre nur eine Wirtschaftlichkeitskennzahl aus Monatserlös und vollständig erfassten Arbeitsstunden.",
    };
  }
  if (logic.variant === "oneTime") {
    return {
      projectTypeLabel: logic.label,
      projectTypeConfigured: true,
      hasContractualHourlyBilling: true,
      explanation:
        "Bei diesem Einmalprojekt ist ein tatsächlich berechneter Stundensatz nur für ausdrücklich als Stundenleistung abgerechnete Positionen belegbar. Pauschale oder paketierte Projektbestandteile dürfen nicht ohne Weiteres als Kunden-Stundensatz ausgegeben werden.",
    };
  }
  return {
    projectTypeLabel: logic.label,
    projectTypeConfigured: false,
    hasContractualHourlyBilling: false,
    explanation:
      "Projektart oder Dauerläufer-Abrechnung sind noch nicht eindeutig festgelegt. JARVIS kann Rechnungs- und Zeitdaten zur Prüfung zeigen, aber keinen projektartgerechten Stundensatz bestätigen.",
  };
}
