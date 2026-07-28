import {
  resolveJarvisProjectLogic,
  type JarvisProjectLogicInput,
} from "@/lib/jarvis/project-logic";

export type JarvisProjectConsumptionGuidance = {
  projectTypeLabel: string;
  projectTypeVerified: boolean;
  explanation: string;
};

export function getJarvisProjectConsumptionGuidance(
  project: Pick<
    JarvisProjectLogicInput,
    "projectKind" | "recurringBillingMode"
  >
): JarvisProjectConsumptionGuidance {
  const logic = resolveJarvisProjectLogic(project);

  if (logic.variant === "recurringMonthlyFlat") {
    return {
      projectTypeLabel: logic.label,
      projectTypeVerified: true,
      explanation:
        "Bei diesem Dauerläufer wird eine feste Monatspauschale abgerechnet. Eine Materialmenge in der Pauschalrechnung oder in einem Paket beweist deshalb nicht, wie viel Material im Monat tatsächlich vor Ort eingesetzt wurde.",
    };
  }
  if (logic.variant === "recurringHourly") {
    return {
      projectTypeLabel: logic.label,
      projectTypeVerified: true,
      explanation:
        "Bei diesem Stunden-Dauerläufer werden Zeiten nach Leistung abgerechnet. Material muss trotzdem separat über Rechnungspositionen, Lagerbuchungen und – für echten Verbrauch – einen eigenen Einsatznachweis nachvollzogen werden.",
    };
  }
  if (logic.variant === "oneTime") {
    return {
      projectTypeLabel: logic.label,
      projectTypeVerified: true,
      explanation:
        "Bei diesem Einmalprojekt zeigt die Auswertung die abgerechneten Materialien des gewählten Zeitraums. Für den tatsächlichen Gesamtverbrauch müssen zusätzlich Entnahmen, Rückgaben und ein eigener Einsatznachweis berücksichtigt werden.",
    };
  }
  return {
    projectTypeLabel: logic.label,
    projectTypeVerified: false,
    explanation:
      "Die Projektart oder die Abrechnung des Dauerläufers ist noch nicht eindeutig fachlich festgelegt. JARVIS wertet deshalb nur gespeicherte Rechnungs- und Lagerdaten aus und leitet daraus keinen projektartspezifischen Sollprozess ab.",
  };
}
