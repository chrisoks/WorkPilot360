export type RecurringMonthDiagnosticIssue = {
  id: string;
  severity: "critical" | "warning";
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

export type RecurringMonthDiagnosticProject = {
  projectRuntimeFrom: string | null;
  projectRuntimeUntil: string | null;
  recurringBillingMode: string | null;
  timeBudgetEnabled: boolean;
  timeBudgetHours: string | null;
  timeBudgetAllocations: unknown;
  autoBillingEnabled: boolean;
  autoBillingStartMonth: string | null;
  autoBillingEndMonth: string | null;
};

export type RecurringMonthDiagnosticPlanningEntry = {
  date: string;
  durationMinutes: number;
  approvalStatus: string;
  deletedAt: Date | null;
};

export type RecurringMonthDiagnosticTimeEntry = {
  date: string;
  durationMs: bigint | number;
  deletedAt?: Date | null;
};

export type RecurringMonthDiagnosticInvoice = {
  id: string;
  status: string;
  plannedExecutionMonth: string;
  serviceDate: string;
  createdAt: Date;
};

export type RecurringMonthDiagnosticResult = {
  issues: RecurringMonthDiagnosticIssue[];
  metrics: {
    historicalMonthsChecked: number;
    underplannedMonths: number;
    missingInvoiceMonths: number;
    duplicateInvoiceMonths: number;
    currentPlannedHours: number;
    currentRequiredHours: number;
    currentStampedHours: number;
    nextMonthPlannedHours: number;
    nextMonthRequiredHours: number;
  };
  checkedRules: string[];
  summary: string[];
};

type TimeBudgetAllocation = {
  month: string;
  hours: string | number;
};

const FINAL_INACTIVE_STATUS_MARKERS = ["geloscht", "storn"];
const LEGACY_DELETED_INVOICE_STATUS = "Gel\u00c3\u00b6scht";

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundHours(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getMonthKey(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 7);
  }
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function addMonths(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return "";
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

function listMonths(startMonth: string, endMonth: string) {
  if (!startMonth || !endMonth || startMonth > endMonth) return [];
  const months: string[] = [];
  let cursor = startMonth;
  while (cursor && cursor <= endMonth && months.length < 240) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value)} Std.`;
}

function parseAllocations(value: unknown): TimeBudgetAllocation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    const month = typeof candidate.month === "string" ? getMonthKey(candidate.month) : "";
    const hours =
      typeof candidate.hours === "string" || typeof candidate.hours === "number"
        ? candidate.hours
        : "";
    return month ? [{ month, hours }] : [];
  });
}

function getRequiredHours(
  project: RecurringMonthDiagnosticProject,
  monthKey: string
) {
  const allocation = parseAllocations(project.timeBudgetAllocations).find(
    (entry) => entry.month === monthKey
  );
  const allocationHours = Math.max(0, numberValue(allocation?.hours));
  if (allocationHours > 0) return allocationHours;
  return project.timeBudgetEnabled
    ? Math.max(0, numberValue(project.timeBudgetHours))
    : 0;
}

function getConfirmedPlanningHours(
  planningEntries: RecurringMonthDiagnosticPlanningEntry[],
  monthKey: string
) {
  return roundHours(
    planningEntries
      .filter(
        (entry) =>
          !entry.deletedAt &&
          entry.approvalStatus === "confirmed" &&
          getMonthKey(entry.date) === monthKey
      )
      .reduce(
        (sum, entry) => sum + Math.max(0, numberValue(entry.durationMinutes)) / 60,
        0
      )
  );
}

function getStampedHours(
  timeEntries: RecurringMonthDiagnosticTimeEntry[],
  monthKey: string
) {
  return roundHours(
    timeEntries
      .filter(
        (entry) =>
          !entry.deletedAt &&
          getMonthKey(entry.date) === monthKey
      )
      .reduce(
        (sum, entry) =>
          sum + Math.max(0, numberValue(entry.durationMs)) / 3_600_000,
        0
      )
  );
}

function isInactiveInvoice(invoice: RecurringMonthDiagnosticInvoice) {
  if (invoice.status === LEGACY_DELETED_INVOICE_STATUS) return true;
  const status = normalize(invoice.status);
  return FINAL_INACTIVE_STATUS_MARKERS.some((marker) => status.includes(marker));
}

function isFinalInvoice(invoice: RecurringMonthDiagnosticInvoice) {
  return !isInactiveInvoice(invoice) && normalize(invoice.status) !== "entwurf";
}

function getInvoiceMonth(invoice: RecurringMonthDiagnosticInvoice) {
  return (
    getMonthKey(invoice.serviceDate) ||
    getMonthKey(invoice.plannedExecutionMonth) ||
    getMonthKey(invoice.createdAt)
  );
}

function isMonthInside(
  monthKey: string,
  startMonth: string,
  endMonth: string
) {
  return (
    (!startMonth || monthKey >= startMonth) &&
    (!endMonth || monthKey <= endMonth)
  );
}

export function diagnoseRecurringProjectMonths(input: {
  project: RecurringMonthDiagnosticProject;
  planningEntries: RecurringMonthDiagnosticPlanningEntry[];
  timeEntries: RecurringMonthDiagnosticTimeEntry[];
  invoices?: RecurringMonthDiagnosticInvoice[];
  evaluationDateKey: string;
}): RecurringMonthDiagnosticResult {
  const issues: RecurringMonthDiagnosticIssue[] = [];
  const evaluationMonth = getMonthKey(input.evaluationDateKey);
  const runtimeStart = getMonthKey(input.project.projectRuntimeFrom);
  const runtimeEnd = getMonthKey(input.project.projectRuntimeUntil);
  const mode = input.project.recurringBillingMode;
  const monthlyFlat = mode === "monthlyFlat";
  const hourly = mode === "hourly";
  const invoices = (input.invoices ?? []).filter((invoice) => !isInactiveInvoice(invoice));
  const canInspectInvoices = Array.isArray(input.invoices);
  const previousMonth = addMonths(evaluationMonth, -1);
  const historyStart = addMonths(evaluationMonth, -12);
  const historicalMonths = listMonths(runtimeStart, runtimeEnd || previousMonth)
    .filter((month) => month < evaluationMonth && month >= historyStart)
    .slice(-12);
  const underplannedMonths: Array<{
    month: string;
    planned: number;
    required: number;
  }> = [];
  const missingInvoiceMonths: string[] = [];
  const duplicateInvoiceMonths: string[] = [];

  for (const month of historicalMonths) {
    const required = getRequiredHours(input.project, month);
    const planned = getConfirmedPlanningHours(input.planningEntries, month);
    const stamped = getStampedHours(input.timeEntries, month);
    if (required > 0 && planned + 0.01 < required) {
      underplannedMonths.push({ month, planned, required });
    }
    if (!canInspectInvoices) continue;
    const monthInvoices = invoices.filter(
      (invoice) => getInvoiceMonth(invoice) === month
    );
    const finalInvoices = monthInvoices.filter(isFinalInvoice);
    if ((monthlyFlat || (hourly && stamped > 0)) && finalInvoices.length === 0) {
      missingInvoiceMonths.push(month);
    }
    if (monthInvoices.length > 1) {
      duplicateInvoiceMonths.push(month);
    }
  }

  if (underplannedMonths.length > 0) {
    issues.push({
      id: "recurring-history-underplanned",
      severity: "warning",
      area: "Monatsplanung",
      title: "In vergangenen Monaten wurden weniger Stunden geplant als vorgesehen",
      evidence: underplannedMonths
        .slice(-4)
        .map(
          (entry) =>
            `${formatMonth(entry.month)}: ${formatHours(entry.planned)} von ${formatHours(entry.required)}`
        )
        .join("; "),
      recommendation:
        "Öffne für die genannten Monate das Planungsboard und vergleiche die vorgesehenen Stunden mit den bestätigten Terminen und der tatsächlich erbrachten Leistung. Trage vergangene Termine nicht nur zur Korrektur der Anzeige nach, sondern dokumentiere den tatsächlichen Grund für die Abweichung.",
    });
  }

  if (missingInvoiceMonths.length > 0) {
    issues.push({
      id: "recurring-history-invoice-missing",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Für vergangene Leistungsmonate wurde keine fertige Rechnung gefunden",
      evidence:
        `${missingInvoiceMonths.length} bereits abgeschlossener Monat/abgeschlossene Monate haben keine aktive, fertiggestellte Rechnung: ` +
        missingInvoiceMonths.slice(-6).map(formatMonth).join(", ") + ".",
      recommendation:
        "Öffne im Projekt „Rechnungen“ und prüfe jeden genannten Monat einzeln. Vergleiche vor einer neuen Rechnung das gültige Angebot, die Leistungsnachweise und bereits abgerechnete Positionen, damit nichts doppelt berechnet wird.",
    });
  }

  if (duplicateInvoiceMonths.length > 0) {
    issues.push({
      id: "recurring-month-duplicate-invoices",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Für denselben Projektmonat gibt es mehrere aktive Rechnungen",
      evidence:
        `Betroffene Monate: ${duplicateInvoiceMonths.slice(-6).map(formatMonth).join(", ")}.`,
      recommendation:
        "Öffne im Projekt „Rechnungen“ und vergleiche für jeden genannten Monat Entwürfe und fertige Rechnungen. Kläre zuerst, ob eine Doppelabrechnung vorliegt; lösche oder storniere keine Rechnung ungeprüft.",
    });
  }

  const currentActive = isMonthInside(evaluationMonth, runtimeStart, runtimeEnd);
  const currentRequiredHours = currentActive
    ? getRequiredHours(input.project, evaluationMonth)
    : 0;
  const currentPlannedHours = currentActive
    ? getConfirmedPlanningHours(input.planningEntries, evaluationMonth)
    : 0;
  const currentStampedHours = currentActive
    ? getStampedHours(input.timeEntries, evaluationMonth)
    : 0;
  if (
    currentActive &&
    currentRequiredHours > 0 &&
    currentPlannedHours + 0.01 < currentRequiredHours
  ) {
    issues.push({
      id: "recurring-current-month-underplanned",
      severity: "warning",
      area: "Monatsplanung",
      title: "Für den aktuellen Monat sind noch nicht alle vorgesehenen Stunden fest eingeplant",
      evidence:
        `${formatMonth(evaluationMonth)}: ${formatHours(currentPlannedHours)} von ` +
        `${formatHours(currentRequiredHours)} bestätigt geplant.`,
      recommendation:
        "Öffne das Planungsboard, ergänze die fehlenden Termine oder bestätige vorhandene Terminwünsche. Prüfe außerdem, ob die hinterlegte Monatsvorgabe noch dem tatsächlichen Bedarf entspricht.",
    });
  }

  const nextMonth = addMonths(evaluationMonth, 1);
  const nextMonthActive = isMonthInside(nextMonth, runtimeStart, runtimeEnd);
  const nextMonthRequiredHours = nextMonthActive
    ? getRequiredHours(input.project, nextMonth)
    : 0;
  const nextMonthPlannedHours = nextMonthActive
    ? getConfirmedPlanningHours(input.planningEntries, nextMonth)
    : 0;
  const nextMonthUnderplanned =
    nextMonthActive &&
    nextMonthRequiredHours > 0 &&
    nextMonthPlannedHours + 0.01 < nextMonthRequiredHours;
  const nextMonthUnplannedMonthlyFlat =
    nextMonthActive &&
    monthlyFlat &&
    nextMonthRequiredHours === 0 &&
    nextMonthPlannedHours === 0;
  if (nextMonthUnderplanned || nextMonthUnplannedMonthlyFlat) {
    issues.push({
      id: nextMonthUnderplanned
        ? "recurring-next-month-underplanned"
        : "recurring-next-month-unplanned",
      severity: "warning",
      area: "Vorausplanung",
      title: nextMonthUnderplanned
        ? "Für den nächsten Projektmonat sind noch nicht alle vorgesehenen Stunden geplant"
        : "Für den nächsten Monat der Pauschalleistung ist noch kein Termin geplant",
      evidence: nextMonthUnderplanned
        ? `${formatMonth(nextMonth)}: ${formatHours(nextMonthPlannedHours)} von ${formatHours(nextMonthRequiredHours)} bestätigt geplant.`
        : `${formatMonth(nextMonth)} liegt innerhalb der Projektlaufzeit, enthält aber noch keinen bestätigten Termin.`,
      recommendation:
        "Öffne den nächsten Monat im Planungsboard und plane beziehungsweise bestätige die benötigten Termine. Wird die Leistung bewusst nur bei Bedarf erbracht, dokumentiere diesen Grund nachvollziehbar im Projekt.",
    });
  }

  if (
    canInspectInvoices &&
    monthlyFlat &&
    input.project.autoBillingEnabled &&
    currentActive
  ) {
    const autoStart =
      getMonthKey(input.project.autoBillingStartMonth) || runtimeStart;
    const autoEnd =
      getMonthKey(input.project.autoBillingEndMonth) || runtimeEnd;
    const autoActive = isMonthInside(evaluationMonth, autoStart, autoEnd);
    const currentInvoices = invoices.filter(
      (invoice) => getInvoiceMonth(invoice) === evaluationMonth
    );
    const previousFinalInvoice = invoices.find(
      (invoice) =>
        getInvoiceMonth(invoice) === previousMonth && isFinalInvoice(invoice)
    );
    if (autoActive && currentInvoices.length === 0 && !previousFinalInvoice) {
      issues.push({
        id: "monthly-flat-previous-invoice-missing",
        severity: "critical",
        area: "Automatische Monatsrechnung",
        title: "Die automatische Monatsrechnung kann nicht erstellt werden",
        evidence:
          `Für ${formatMonth(previousMonth)} wurde keine aktive Rechnung gefunden. WorkPilot360 benötigt genau diese Rechnung als Vorlage für die automatische Rechnung von ${formatMonth(evaluationMonth)} und darf keinen Monat überspringen.`,
        recommendation:
          "Öffne im Projekt „Rechnungen“ und prüfe zuerst den Vormonat. Erstelle beziehungsweise stelle dessen Rechnung nur nach Prüfung von Angebot und Leistung fertig. Verwende keine Rechnung aus einem anderen Monat oder Projekt als Ersatzvorlage.",
      });
    }
  }

  const summary = [
    nextMonthActive
      ? `Folgemonat ${formatMonth(nextMonth)}: ${formatHours(nextMonthPlannedHours)} bestätigt geplant.`
      : "Der Folgemonat liegt außerhalb der Projektlaufzeit.",
    `${historicalMonths.length} abgeschlossene Projektmonate geprüft.`,
    `${underplannedMonths.length} Planungsmonat(e) unter Soll.`,
    ...(canInspectInvoices
      ? [
          `${missingInvoiceMonths.length} Monat(e) ohne erforderliche Rechnung.`,
          `${duplicateInvoiceMonths.length} Monat(e) mit mehreren aktiven Rechnungen.`,
        ]
      : ["Rechnungsmonate waren für die aktuelle Rolle nicht prüfbar."]),
    currentActive
      ? `Aktueller Monat: ${formatHours(currentPlannedHours)} geplant, ${formatHours(currentStampedHours)} gestempelt.`
      : "Der aktuelle Monat liegt außerhalb der Projektlaufzeit.",
  ];

  return {
    issues,
    metrics: {
      historicalMonthsChecked: historicalMonths.length,
      underplannedMonths: underplannedMonths.length,
      missingInvoiceMonths: missingInvoiceMonths.length,
      duplicateInvoiceMonths: duplicateInvoiceMonths.length,
      currentPlannedHours,
      currentRequiredHours,
      currentStampedHours,
      nextMonthPlannedHours,
      nextMonthRequiredHours,
    },
    checkedRules: [
      "Vorausplanung des nächsten aktiven Projektmonats",
      "Projektlaufzeit und betrachtete Monatskette",
      "Bestätigte Planung gegen Monatskontingent",
      "Gestempelte Stunden je Projektmonat",
      ...(canInspectInvoices
        ? [
            "Aktive Monatsrechnungen und Doppelungen",
            ...(monthlyFlat && input.project.autoBillingEnabled
              ? ["Vormonatsvorlage für die automatische Monatsrechnung"]
              : []),
          ]
        : []),
    ],
    summary,
  };
}
