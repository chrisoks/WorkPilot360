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
      "Sollprozess Einmalprojekt: Auftragsgrundlage → Planung → Ausführung → Endkontrolle → Schlussrechnung → Abschluss.",
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
      "Sollprozess Monatspauschale: Laufzeit und Monatskontingent → Monatsplanung → Ausführung/Nachweise → Monatsrechnung → Folgemonat.",
      "Stempelzeiten benötigen keine einzelne Abrechnungsleistung; abgerechnet wird die vereinbarte Monatspauschale.",
      "Die Stapelabrechnung verwendet die aktive Rechnung des direkten Vormonats als Vorlage und darf fehlende Monate nicht überspringen.",
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
      "Sollprozess Stunden-Dauerläufer: Laufzeit und Monatsplanung → Gewerk/Abrechnungsleistung → Stempelungen → Monatsentwurf → Faktura → Folgemonat.",
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
        "WorkPilot360 kann nicht sicher zwischen einmaligem Projekt und Dauerläufer unterscheiden.",
      recommendation:
        "In den Projektinformationen „Einmaliges Projekt“ oder „Dauerläufer-Projekt“ festlegen.",
    });
  }

  if (profile.variant === "recurringUnknown") {
    issues.push({
      id: "recurring-billing-mode-missing",
      severity: "critical",
      area: "Abrechnung",
      title: "Abrechnungsmodell des Dauerläufers fehlt",
      evidence:
        "Der Dauerläufer ist weder als Stundenabrechnung noch als Monatspauschale eindeutig konfiguriert.",
      recommendation:
        "Das Abrechnungsmodell in den Projektinformationen festlegen.",
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
      title: "Einmalprojekt enthält ein Dauerläufer-Abrechnungsmodell",
      evidence:
        "Projektart und gespeichertes Abrechnungsmodell widersprechen sich. JARVIS behandelt die Projektart als führend.",
      recommendation:
        "Projektart fachlich bestätigen und die nicht passende Dauerläufer-Einstellung in den Projektinformationen bereinigen.",
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
          ? "Pauschale Stapelabrechnung ist bei einem Einmalprojekt aktiv"
          : "Pauschale Stapelabrechnung ist bei Stundenabrechnung aktiv",
      evidence:
        profile.variant === "oneTime"
          ? "Die aktivierte Monatsautomatik gehört fachlich nur zu Dauerläufern mit Monatspauschale."
          : "Stunden-Dauerläufer werden aus echten Stempelzeiten abgerechnet und dürfen nicht zusätzlich in die Pauschal-Stapelabrechnung gelangen.",
      recommendation:
        "Die automatische Pauschalabrechnung deaktivieren und vor der nächsten Faktura vorhandene Monatsentwürfe auf Doppelungen prüfen.",
    });
  }

  if (profile.isRecurring && (!runtimeFrom || !runtimeUntil)) {
    issues.push({
      id: "recurring-runtime-missing",
      severity: "warning",
      area: "Laufzeit",
      title: "Laufzeit des Dauerläufers ist unvollständig",
      evidence:
        "Start- oder Endmonat fehlt. Forecast, Vorgabezeiten und Monatslogik können dadurch unvollständig sein.",
      recommendation:
        "Ausführungszeitraum von und bis vollständig pflegen.",
    });
  }

  if (profile.isRecurring && runtimeFrom && runtimeUntil && runtimeFrom > runtimeUntil) {
    issues.push({
      id: "recurring-runtime-reversed",
      severity: "critical",
      area: "Laufzeit",
      title: "Die Dauerläufer-Laufzeit ist vertauscht",
      evidence: `Der Startmonat ${runtimeFrom} liegt nach dem Endmonat ${runtimeUntil}.`,
      recommendation:
        "Start- und Endmonat in den Projektinformationen fachlich korrigieren.",
    });
  }

  if (profile.isRecurring && !normalize(input.billingInterval)) {
    issues.push({
      id: "recurring-billing-interval-missing",
      severity: "warning",
      area: "Abrechnung",
      title: "Abrechnungsintervall des Dauerläufers fehlt",
      evidence:
        "Der wiederkehrende Abrechnungsturnus ist in den Projektinformationen nicht gepflegt.",
      recommendation:
        "Das vertraglich vereinbarte Abrechnungsintervall ergänzen.",
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
      title: "Der Zeitraum der Stapelabrechnung ist vertauscht",
      evidence: `Der Automatikstart ${autoFrom} liegt nach dem Automatikende ${autoUntil}.`,
      recommendation:
        "Start- und Endmonat der automatischen Abrechnung korrigieren.",
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
      title: "Die Stapelabrechnung beginnt vor der Projektlaufzeit",
      evidence: `Automatikstart ${autoFrom}, Projektstart ${runtimeFrom}.`,
      recommendation:
        "Automatikstart und vertraglichen Leistungsbeginn abgleichen.",
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
      title: "Die Stapelabrechnung endet nach der Projektlaufzeit",
      evidence: `Automatikende ${autoUntil}, Projektende ${runtimeUntil}.`,
      recommendation:
        "Automatikende und vertragliches Leistungsende abgleichen.",
    });
  }

  return { profile, issues };
}
