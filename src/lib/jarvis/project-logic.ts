export type JarvisProjectLogicVariant =
  | "oneTime"
  | "recurringMonthlyFlat"
  | "recurringHourly"
  | "recurringUnknown"
  | "unknown";

export type JarvisProjectLogicInput = {
  projectKind: string | null;
  recurringBillingMode: string | null;
  projectRuntimeFrom: string | null;
  projectRuntimeUntil: string | null;
  billingInterval: string | null;
  autoBillingEnabled: boolean;
  autoBillingStartMonth: string | null;
  autoBillingEndMonth: string | null;
};

export type JarvisProjectLogicIssue = {
  id: string;
  severity: "critical" | "warning";
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

export type JarvisProjectLogicProfile = {
  variant: JarvisProjectLogicVariant;
  label: string;
  isRecurring: boolean;
  isHourlyRecurring: boolean;
  isMonthlyFlatRecurring: boolean;
  evaluationScope: "project" | "month" | "unknown";
  processSummary: string[];
};

const PROFILES: Record<JarvisProjectLogicVariant, JarvisProjectLogicProfile> = {
  oneTime: {
    variant: "oneTime",
    label: "Einmaliges Projekt",
    isRecurring: false,
    isHourlyRecurring: false,
    isMonthlyFlatRecurring: false,
    evaluationScope: "project",
    processSummary: [
      "Sollprozess Einmalprojekt: gültiges Angebot → Planung → Ausführung → Endkontrolle → Schlussrechnung → Abschluss.",
      "Ein gültiges, im Projekt hinterlegtes Angebot ist in WorkPilot360 für jedes Projekt verpflichtend.",
      "Manuelle Zeiten benötigen eine Angebotszuweisung auf Angebotsebene.",
      "Nach der Schlussrechnung wird das Gesamtprojekt abgeschlossen; es gibt keine monatliche Dauerläufer-Fortsetzung.",
    ],
  },
  recurringMonthlyFlat: {
    variant: "recurringMonthlyFlat",
    label: "Dauerläufer mit Monatspauschale",
    isRecurring: true,
    isHourlyRecurring: false,
    isMonthlyFlatRecurring: true,
    evaluationScope: "month",
    processSummary: [
      "Sollprozess Monatspauschale: gültiges Angebot → Laufzeit und Monatskontingent → Monatsplanung → Ausführung/Nachweise → Monatsrechnung → Folgemonat.",
      "Ein gültiges, im Projekt hinterlegtes Angebot ist in WorkPilot360 auch für Dauerläufer verpflichtend.",
      "Stempelzeiten benötigen keine einzelne Abrechnungsleistung; abgerechnet wird die vereinbarte Monatspauschale.",
      "Die automatische Monatsabrechnung verwendet immer die aktive Rechnung des direkten Vormonats als Vorlage und darf keinen Monat überspringen.",
    ],
  },
  recurringHourly: {
    variant: "recurringHourly",
    label: "Dauerläufer mit Stundenabrechnung",
    isRecurring: true,
    isHourlyRecurring: true,
    isMonthlyFlatRecurring: false,
    evaluationScope: "month",
    processSummary: [
      "Sollprozess Stunden-Dauerläufer: gültiges Angebot → Laufzeit und Monatsplanung → Gewerk/Abrechnungsleistung → Stempelungen → Monatsentwurf → fertige Rechnung → Folgemonat.",
      "Ein gültiges, im Projekt hinterlegtes Angebot ist in WorkPilot360 auch für Dauerläufer verpflichtend.",
      "Die erste passende Monatsstempelung erzeugt genau einen Rechnungsentwurf; weitere Zeiten werden demselben Monatsentwurf zugeordnet.",
      "Abgerechnet werden die tatsächlich zugeordneten und geprüften Stunden, nicht eine Monatspauschale.",
    ],
  },
  recurringUnknown: {
    variant: "recurringUnknown",
    label: "Dauerläufer ohne eindeutiges Abrechnungsmodell",
    isRecurring: true,
    isHourlyRecurring: false,
    isMonthlyFlatRecurring: false,
    evaluationScope: "month",
    processSummary: [
      "Der Dauerläufer-Sollprozess kann erst nach der Wahl zwischen Monatspauschale und Stundenabrechnung sicher bestimmt werden.",
    ],
  },
  unknown: {
    variant: "unknown",
    label: "Projektart nicht eindeutig",
    isRecurring: false,
    isHourlyRecurring: false,
    isMonthlyFlatRecurring: false,
    evaluationScope: "unknown",
    processSummary: [
      "Der Sollprozess kann erst nach der eindeutigen Wahl zwischen einmaligem Projekt und Dauerläufer bestimmt werden.",
    ],
  },
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function monthKey(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

export function resolveJarvisProjectLogic(
  input: Pick<JarvisProjectLogicInput, "projectKind" | "recurringBillingMode">
): JarvisProjectLogicProfile {
  const kind = normalize(input.projectKind);
  const recurring = kind.includes("dauerl");
  const oneTime = kind.includes("einmal");

  if (recurring) {
    if (input.recurringBillingMode === "monthlyFlat") {
      return PROFILES.recurringMonthlyFlat;
    }
    if (input.recurringBillingMode === "hourly") {
      return PROFILES.recurringHourly;
    }
    return PROFILES.recurringUnknown;
  }
  if (oneTime) return PROFILES.oneTime;
  return PROFILES.unknown;
}

export function diagnoseJarvisProjectLogic(
  input: JarvisProjectLogicInput
): {
  profile: JarvisProjectLogicProfile;
  issues: JarvisProjectLogicIssue[];
} {
  const profile = resolveJarvisProjectLogic(input);
  const issues: JarvisProjectLogicIssue[] = [];
  const runtimeFrom = monthKey(input.projectRuntimeFrom);
  const runtimeUntil = monthKey(input.projectRuntimeUntil);
  const autoFrom = monthKey(input.autoBillingStartMonth);
  const autoUntil = monthKey(input.autoBillingEndMonth);

  if (profile.variant === "unknown") {
    issues.push({
      id: "project-kind-missing",
      severity: "critical",
      area: "Projektlogik",
      title: "Projektart ist nicht eindeutig",
      evidence:
      "In den Projektinformationen ist nicht eindeutig festgelegt, ob die Leistung einmalig oder regelmäßig ausgeführt wird. JARVIS kann deshalb den richtigen Ablauf für Planung und Abrechnung nicht sicher prüfen.",
      recommendation:
        "Öffne die Projektinformationen und wähle dort entweder „Einmaliges Projekt“ oder „Dauerläufer-Projekt“ aus.",
    });
  }

  if (profile.variant === "recurringUnknown") {
    issues.push({
      id: "recurring-billing-mode-missing",
      severity: "critical",
      area: "Abrechnung",
      title: "Beim Dauerläufer fehlt die Art der Abrechnung",
      evidence:
        "Es ist nicht festgelegt, ob dieser Dauerläufer mit einer festen Monatspauschale oder nach tatsächlich geleisteten Stunden abgerechnet wird. Dadurch kann WorkPilot360 Planung und Abrechnung der einzelnen Monate nicht richtig steuern.",
      recommendation:
        "Öffne die Projektinformationen und wähle als Abrechnung entweder „Monatspauschale“ oder „Stundenabrechnung“ aus.",
    });
  }

  if (
    profile.variant === "oneTime" &&
    ["monthlyFlat", "hourly"].includes(input.recurringBillingMode ?? "")
  ) {
    issues.push({
      id: "one-time-recurring-mode-conflict",
      severity: "warning",
      area: "Projektlogik",
      title: "Projektart und gespeicherte Abrechnung passen nicht zusammen",
      evidence:
        "Das Projekt ist als einmaliges Projekt gespeichert, enthält aber zusätzlich eine Einstellung für die monatliche Dauerläufer-Abrechnung. JARVIS orientiert sich bei der Prüfung an der Projektart, die widersprüchliche Einstellung kann jedoch spätere Abläufe stören.",
      recommendation:
        "Prüfe in den Projektinformationen zuerst, welche Projektart richtig ist. Entferne anschließend die nicht passende Dauerläufer-Abrechnungseinstellung.",
    });
  }

  if (
    (profile.variant === "oneTime" ||
      profile.variant === "recurringHourly") &&
    input.autoBillingEnabled
  ) {
    issues.push({
      id:
        profile.variant === "oneTime"
          ? "one-time-flat-auto-billing-conflict"
          : "hourly-flat-auto-billing-conflict",
      severity: "critical",
      area: "Abrechnungsautomatik",
      title:
        profile.variant === "oneTime"
          ? "Automatische Monatsrechnungen sind bei einem Einmalprojekt aktiviert"
          : "Monatspauschale und Stundenabrechnung sind gleichzeitig aktiviert",
      evidence:
        profile.variant === "oneTime"
          ? "Die aktivierte automatische Monatsabrechnung gehört nur zu Dauerläufern mit einer festen Monatspauschale. Bei einem einmaligen Projekt könnte sie ungewollte Rechnungsentwürfe erzeugen."
          : "Dieser Dauerläufer soll nach den tatsächlich gestempelten Stunden abgerechnet werden. Gleichzeitig ist aber die automatische Abrechnung einer festen Monatspauschale aktiv. Dadurch besteht das Risiko einer doppelten Abrechnung.",
      recommendation:
        "Deaktiviere in den Projekteinstellungen die automatische Pauschalabrechnung. Prüfe vor dem Erstellen oder Versenden einer Rechnung außerdem, ob bereits doppelte Monatsentwürfe vorhanden sind.",
    });
  }

  if (profile.isRecurring && (!runtimeFrom || !runtimeUntil)) {
    issues.push({
      id: "recurring-runtime-missing",
      severity: "warning",
      area: "Laufzeit",
      title: "Start- oder Endmonat des Dauerläufers fehlt",
      evidence:
        "Die vereinbarte Projektlaufzeit ist nicht vollständig hinterlegt. Dadurch können Monatsplanung, Auslastungsvorschau und automatische Abrechnung Monate übersehen oder falsch einordnen.",
      recommendation:
        "Öffne die Projektinformationen und trage den vereinbarten Ausführungszeitraum vollständig von Startmonat bis Endmonat ein.",
    });
  }

  if (profile.isRecurring && runtimeFrom && runtimeUntil && runtimeFrom > runtimeUntil) {
    issues.push({
      id: "recurring-runtime-reversed",
      severity: "critical",
      area: "Laufzeit",
      title: "Start und Ende der Projektlaufzeit sind vertauscht",
      evidence: `Als Startmonat ist ${runtimeFrom} gespeichert, als Endmonat ${runtimeUntil}. Der Start liegt damit nach dem Ende; Planung und Abrechnung können diesen Zeitraum nicht korrekt verarbeiten.`,
      recommendation:
        "Öffne die Projektinformationen und korrigiere Start- und Endmonat anhand der tatsächlichen Vereinbarung mit dem Kunden.",
    });
  }

  if (profile.isRecurring && !normalize(input.billingInterval)) {
    issues.push({
      id: "recurring-billing-interval-missing",
      severity: "warning",
      area: "Abrechnung",
      title: "Es ist kein Abrechnungsrhythmus hinterlegt",
      evidence:
        "In den Projektinformationen steht nicht, in welchem Rhythmus der Dauerläufer abgerechnet werden soll. Dadurch ist nicht eindeutig, wann die nächste Rechnung fällig ist.",
      recommendation:
        "Ergänze in den Projektinformationen den mit dem Kunden vereinbarten Abrechnungsrhythmus.",
    });
  }

  if (
    profile.isMonthlyFlatRecurring &&
    input.autoBillingEnabled &&
    autoFrom &&
    autoUntil &&
    autoFrom > autoUntil
  ) {
    issues.push({
      id: "auto-billing-period-reversed",
      severity: "critical",
      area: "Abrechnungsautomatik",
      title: "Start und Ende der automatischen Monatsabrechnung sind vertauscht",
      evidence: `Die automatische Abrechnung soll am ${autoFrom} beginnen, aber bereits am ${autoUntil} enden. Dadurch kann WorkPilot360 keinen gültigen Abrechnungszeitraum bestimmen.`,
      recommendation:
        "Korrigiere in den Projekteinstellungen Start- und Endmonat der automatischen Abrechnung anhand der vereinbarten Laufzeit.",
    });
  }

  if (
    profile.isMonthlyFlatRecurring &&
    input.autoBillingEnabled &&
    runtimeFrom &&
    autoFrom &&
    autoFrom < runtimeFrom
  ) {
    issues.push({
      id: "auto-billing-start-before-runtime",
      severity: "warning",
      area: "Abrechnungsautomatik",
      title: "Die automatische Monatsabrechnung beginnt zu früh",
      evidence: `Die automatische Abrechnung beginnt im Monat ${autoFrom}, die vereinbarte Projektlaufzeit aber erst im Monat ${runtimeFrom}. Dadurch könnte eine Rechnung für einen Monat ohne vereinbarte Leistung entstehen.`,
      recommendation:
        "Prüfe den Leistungsbeginn im Angebot und passe den Startmonat der automatischen Abrechnung in den Projekteinstellungen an.",
    });
  }

  if (
    profile.isMonthlyFlatRecurring &&
    input.autoBillingEnabled &&
    runtimeUntil &&
    autoUntil &&
    autoUntil > runtimeUntil
  ) {
    issues.push({
      id: "auto-billing-end-after-runtime",
      severity: "warning",
      area: "Abrechnungsautomatik",
      title: "Die automatische Monatsabrechnung läuft zu lange",
      evidence: `Die automatische Abrechnung endet im Monat ${autoUntil}, die vereinbarte Projektlaufzeit aber bereits im Monat ${runtimeUntil}. Dadurch könnte nach Projektende noch eine Rechnung entstehen.`,
      recommendation:
        "Prüfe das Leistungsende im Angebot und passe den Endmonat der automatischen Abrechnung in den Projekteinstellungen an.",
    });
  }

  return { profile, issues };
}
