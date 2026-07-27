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
      title: "Abgeschlossene Monate waren nicht vollständig geplant",
      evidence: underplannedMonths
        .slice(-4)
        .map(
          (entry) =>
            `${formatMonth(entry.month)}: ${formatHours(entry.planned)} von ${formatHours(entry.required)}`
        )
        .join("; "),
      recommendation:
        "Monatskontingente und bestätigte Termine prüfen. Historische Lücken nicht automatisch nachtragen, sondern Ursache und tatsächliche Leistung dokumentieren.",
    });
  }

  if (missingInvoiceMonths.length > 0) {
    issues.push({
      id: "recurring-history-invoice-missing",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Für abgeschlossene Leistungsmonate fehlt eine Rechnung",
      evidence:
        `${missingInvoiceMonths.length} Monat/Monate ohne aktive Schlussrechnung: ` +
        missingInvoiceMonths.slice(-6).map(formatMonth).join(", ") + ".",
      recommendation:
        "Die betroffenen Monate einzeln prüfen. Vor einer Rechnung Nachweise, Leistungsumfang und bereits abgerechnete Positionen kontrollieren.",
    });
  }

  if (duplicateInvoiceMonths.length > 0) {
    issues.push({
      id: "recurring-month-duplicate-invoices",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Mehrere aktive Rechnungen liegen im selben Projektmonat",
      evidence:
        `Betroffene Monate: ${duplicateInvoiceMonths.slice(-6).map(formatMonth).join(", ")}.`,
      recommendation:
        "Entwurf, Faktura und mögliche Doppelabrechnung je Monat vergleichen. Keine Rechnung automatisch löschen oder stornieren.",
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
      title: "Der aktuelle Monat ist noch nicht ausreichend bestätigt geplant",
      evidence:
        `${formatMonth(evaluationMonth)}: ${formatHours(currentPlannedHours)} von ` +
        `${formatHours(currentRequiredHours)} bestätigt geplant.`,
      recommendation:
        "Fehlende Termine im Planungsboard ergänzen beziehungsweise Terminwünsche bestätigen und das Monatskontingent gegen den realen Bedarf prüfen.",
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
        area: "Stapelabrechnung",
        title: "Die Monatspauschale ist für die Stapelabrechnung blockiert",
        evidence:
          `Für ${formatMonth(previousMonth)} fehlt die aktive Vormonatsrechnung, ` +
          `die als Vorlage für ${formatMonth(evaluationMonth)} benötigt wird.`,
        recommendation:
          "Vormonat fachlich prüfen und gegebenenfalls korrekt fakturieren. Keine Vorlage aus einem anderen Monat oder Projekt übernehmen.",
      });
    }
  }

  const summary = [
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
    },
    checkedRules: [
      "Projektlaufzeit und betrachtete Monatskette",
      "Bestätigte Planung gegen Monatskontingent",
      "Gestempelte Stunden je Projektmonat",
      ...(canInspectInvoices
        ? [
            "Aktive Monatsrechnungen und Doppelungen",
            ...(monthlyFlat && input.project.autoBillingEnabled
              ? ["Vormonatsvorlage der Stapelabrechnung"]
              : []),
          ]
        : []),
    ],
    summary,
  };
}
