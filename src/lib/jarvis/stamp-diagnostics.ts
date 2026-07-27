export type StampDiagnosticSeverity = "critical" | "warning";

export type StampDiagnosticIssue = {
  id: string;
  severity: StampDiagnosticSeverity;
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

export type StampDiagnosticEntry = {
  id: string;
  mode: string;
  projectId: string;
  trade: string | null;
  planningEntryId: string | null;
  offerId: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  userId: string | null;
  employee: string | null;
  entrySource: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMs: bigint | number;
  pauseMs: bigint | number;
  laborCostRateSnapshot: number;
  comment: string | null;
  invoiceId: string | null;
  completionStatus: string | null;
  overtimeApprovalStatus: string | null;
  overtimeApprovedByUserId: string | null;
  overtimeApprovedByName: string | null;
  overtimeApprovedAt: Date | null;
};

export type StampDiagnosticActiveSession = {
  id: string;
  mode: string;
  projectId: string;
  userId: string;
  employee: string | null;
  trade: string | null;
  planningEntryId: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  comment: string | null;
  startedAt: Date;
  pauseStartedAt: Date | null;
  createdAt: Date;
};

export type StampDiagnosticPlanningEntry = {
  id: string;
  projectId: string | null;
  userId: string | null;
  date: string;
  deletedAt: Date | null;
};

export type StampDiagnosticInvoice = {
  id: string;
  projectId: string;
  status: string;
  billingSource: string;
  plannedExecutionMonth: string;
  netTotal: number;
};

export type StampDiagnosticInvoiceLine = {
  id: string;
  invoiceId: string;
  catalogItemId: string;
  quantity: number;
  unitPrice: number;
  totalNet: number;
};

export type StampDiagnosticInvoiceLabor = {
  invoiceId: string;
  invoiceLineId: string;
  userId: string;
  plannedHours: number;
};

export type StampDiagnosticInput = {
  projectId: string;
  isHourlyRecurring: boolean;
  entries: StampDiagnosticEntry[];
  comparisonEntries?: StampDiagnosticEntry[];
  crossProjectComparisonPerformed?: boolean;
  activeSessions: StampDiagnosticActiveSession[];
  planningEntries: StampDiagnosticPlanningEntry[];
  invoices?: StampDiagnosticInvoice[];
  invoiceLines?: StampDiagnosticInvoiceLine[];
  invoiceLaborItems?: StampDiagnosticInvoiceLabor[];
  interruptionTaskDescriptions?: string[];
  verifyInterruptionTasks: boolean;
  roundingFactorHours: number;
  now?: Date;
};

export type StampDiagnosticResult = {
  issues: StampDiagnosticIssue[];
  metrics: {
    entries: number;
    totalHours: number;
    employees: number;
    activeSessions: number;
    duplicateEntries: number;
    overlappingPairs: number;
    invoicedEntries: number;
    openOvertimeApprovals: number;
  };
  checkedRules: string[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("de-DE");
}

function numberValue(value: bigint | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function getBerlinDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseTimeMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return hours * 60 + minutes + seconds / 60;
}

function validDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function intervalForEntry(entry: StampDiagnosticEntry) {
  if (!validDateKey(entry.date)) return null;
  const start = parseTimeMinutes(entry.startTime);
  let end = parseTimeMinutes(entry.endTime);
  if (start === null || end === null) return null;
  if (end < start) end += 24 * 60;
  return {
    start,
    end,
    elapsedMs: Math.max(0, end - start) * 60_000,
  };
}

function roundedHours(durationMs: bigint | number, configuredFactor: number) {
  const hours = numberValue(durationMs) / 3_600_000;
  if (hours <= 0) return 0;
  const factor = [0.25, 0.5, 1].includes(configuredFactor)
    ? configuredFactor
    : 0.5;
  return Math.ceil(hours / factor) * factor;
}

function addIssue(
  issues: StampDiagnosticIssue[],
  issue: StampDiagnosticIssue,
  condition: boolean
) {
  if (condition) issues.push(issue);
}

function countExactDuplicates(entries: StampDiagnosticEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = [
      entry.userId,
      entry.date,
      entry.startTime,
      entry.endTime,
      numberValue(entry.durationMs),
      entry.mode,
    ].join("|");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0
  );
}

function countOverlappingPairs(
  projectId: string,
  entries: StampDiagnosticEntry[],
  comparisonEntries: StampDiagnosticEntry[] = []
) {
  const uniqueEntries = new Map<string, StampDiagnosticEntry>();
  for (const entry of [...entries, ...comparisonEntries]) {
    uniqueEntries.set(entry.id, entry);
  }
  const grouped = new Map<string, Array<{ id: string; start: number; end: number }>>();
  const entryById = new Map<string, StampDiagnosticEntry>();
  for (const entry of uniqueEntries.values()) {
    const interval = intervalForEntry(entry);
    if (!interval || !entry.userId) continue;
    entryById.set(entry.id, entry);
    const key = `${entry.userId}|${entry.date}`;
    const rows = grouped.get(key) ?? [];
    rows.push({ id: entry.id, start: interval.start, end: interval.end });
    grouped.set(key, rows);
  }

  let overlaps = 0;
  for (const rows of grouped.values()) {
    rows.sort((first, second) => first.start - second.start);
    for (let index = 0; index < rows.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < rows.length; compareIndex += 1) {
        const first = rows[index];
        const second = rows[compareIndex];
        if (second.start >= first.end) break;
        const firstEntry = entryById.get(first.id);
        const secondEntry = entryById.get(second.id);
        const touchesProject =
          firstEntry?.projectId === projectId || secondEntry?.projectId === projectId;
        if (!touchesProject) continue;
        const bothTargetProject =
          firstEntry?.projectId === projectId &&
          secondEntry?.projectId === projectId;
        const exactSameInterval =
          first.start === second.start && first.end === second.end;
        if (bothTargetProject && exactSameInterval) continue;
        overlaps += 1;
      }
    }
  }
  return overlaps;
}

function isInactiveInvoiceStatus(status: string) {
  const value = normalize(status);
  return (
    value === "storniert" ||
    value === "stornorechnung" ||
    value === "gel\u00f6scht" ||
    value === "gel\u00c3\u00b6scht"
  );
}

export function diagnoseProjectStamps(
  input: StampDiagnosticInput
): StampDiagnosticResult {
  const now = input.now ?? new Date();
  const todayKey = getBerlinDateKey(now);
  const issues: StampDiagnosticIssue[] = [];
  const entries = input.entries.filter((entry) => entry.projectId === input.projectId);
  const activeSessions = input.activeSessions.filter(
    (session) => session.projectId === input.projectId
  );
  const invalidDateEntries = entries.filter((entry) => !validDateKey(entry.date));
  const invalidTimeEntries = entries.filter((entry) => !intervalForEntry(entry));
  const nonPositiveEntries = entries.filter(
    (entry) => numberValue(entry.durationMs) <= 0
  );
  const futureEntries = entries.filter(
    (entry) => validDateKey(entry.date) && entry.date > todayKey
  );
  const invalidPauseEntries = entries.filter(
    (entry) => numberValue(entry.pauseMs) < 0
  );
  const pausedEntries = entries.filter((entry) => numberValue(entry.pauseMs) > 0);
  const inconsistentDurationEntries = entries.filter((entry) => {
    const interval = intervalForEntry(entry);
    if (!interval || numberValue(entry.pauseMs) > 0) return false;
    const expectedDuration = Math.max(
      0,
      interval.elapsedMs - numberValue(entry.pauseMs)
    );
    return Math.abs(expectedDuration - numberValue(entry.durationMs)) > 5 * 60_000;
  });
  const excessiveDurationEntries = entries.filter(
    (entry) => numberValue(entry.durationMs) > 16 * 3_600_000
  );
  const missingEmployeeEntries = entries.filter(
    (entry) => !entry.userId || !entry.employee
  );
  const wrongModeEntries = entries.filter((entry) => entry.mode !== "project");
  const stampedWithoutCompletion = entries.filter(
    (entry) =>
      entry.entrySource === "stamped" &&
      !["finished", "interrupted"].includes(entry.completionStatus ?? "")
  );
  const pendingOvertimeEntries = entries.filter(
    (entry) => entry.overtimeApprovalStatus === "pending"
  );
  const invalidApprovedOvertimeEntries = entries.filter(
    (entry) =>
      entry.overtimeApprovalStatus === "approved" &&
      (!entry.overtimeApprovedByUserId ||
        !entry.overtimeApprovedByName ||
        !entry.overtimeApprovedAt)
  );
  const duplicateEntries = countExactDuplicates(entries);
  const overlappingPairs = countOverlappingPairs(
    input.projectId,
    entries,
    input.comparisonEntries
  );

  addIssue(issues, {
    id: "stamp-invalid-date",
    severity: "critical",
    area: "Stempelzeit",
    title: "Ungültiges Stempeldatum",
    evidence: `${invalidDateEntries.length} Zeiteintrag/Zeiteinträge besitzen kein gültiges Kalenderdatum.`,
    recommendation: "Datum der betroffenen Einträge anhand der Historie und Einsatzunterlagen korrigieren.",
  }, invalidDateEntries.length > 0);

  addIssue(issues, {
    id: "stamp-invalid-time",
    severity: "critical",
    area: "Stempelzeit",
    title: "Start- oder Endzeit ist ungültig",
    evidence: `${invalidTimeEntries.length} Zeiteintrag/Zeiteinträge können zeitlich nicht ausgewertet werden.`,
    recommendation: "Start- und Endzeit der betroffenen Einträge prüfen.",
  }, invalidTimeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-duration-non-positive",
    severity: "critical",
    area: "Stempelzeit",
    title: "Gespeicherte Arbeitsdauer ist nicht positiv",
    evidence: `${nonPositiveEntries.length} Eintrag/Einträge haben keine verwertbare Arbeitsdauer.`,
    recommendation: "Die Einträge anhand der Bearbeitungshistorie korrigieren oder fachlich begründet löschen.",
  }, nonPositiveEntries.length > 0);

  addIssue(issues, {
    id: "stamp-future-date",
    severity: "critical",
    area: "Stempelzeit",
    title: "Zeiteinträge liegen in der Zukunft",
    evidence: `${futureEntries.length} Eintrag/Einträge sind nach dem heutigen Berliner Datum gespeichert.`,
    recommendation: "Datum prüfen; zukünftige Arbeit gehört in die Planung und nicht in abgeschlossene Zeiten.",
  }, futureEntries.length > 0);

  addIssue(issues, {
    id: "stamp-pause-invalid",
    severity: "critical",
    area: "Pausenlogik",
    title: "Pausendauer ist zeitlich unmöglich",
    evidence: `${invalidPauseEntries.length} Eintrag/Einträge haben eine negative Pausendauer.`,
    recommendation: "Pausenwert und Zeitspanne anhand der Historie korrigieren.",
  }, invalidPauseEntries.length > 0);

  addIssue(issues, {
    id: "stamp-duration-inconsistent",
    severity: "warning",
    area: "Zeitberechnung",
    title: "Zeitspanne und Arbeitsdauer widersprechen sich",
    evidence: `${inconsistentDurationEntries.length} Eintrag/Einträge weichen nach Abzug der Pause um mehr als fünf Minuten ab.`,
    recommendation: "Start, Ende, Pause und gespeicherte Dauer gemeinsam prüfen.",
  }, inconsistentDurationEntries.length > 0);

  addIssue(issues, {
    id: "stamp-duration-excessive",
    severity: "critical",
    area: "Stempelzeit",
    title: "Ungewöhnlich lange Einzelstempelung",
    evidence: `${excessiveDurationEntries.length} Eintrag/Einträge überschreiten 16 Arbeitsstunden.`,
    recommendation: "Prüfen, ob eine Stempelung nicht beendet oder über einen Tageswechsel falsch erfasst wurde.",
  }, excessiveDurationEntries.length > 0);

  addIssue(issues, {
    id: "stamp-employee-missing",
    severity: "critical",
    area: "Mitarbeiterzuordnung",
    title: "Mitarbeiterzuordnung fehlt",
    evidence: `${missingEmployeeEntries.length} Eintrag/Einträge besitzen keine vollständige Mitarbeiter-ID und -anzeige.`,
    recommendation: "Den richtigen aktiven Mitarbeiter anhand der Historie zuordnen.",
  }, missingEmployeeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-mode-conflict",
    severity: "critical",
    area: "Projektzuordnung",
    title: "Unproduktive Zeit ist einem Projekt zugeordnet",
    evidence: `${wrongModeEntries.length} Eintrag/Einträge liegen in der Projektakte, sind aber nicht als Projektzeit gespeichert.`,
    recommendation: "Modus und Projektzuordnung fachlich prüfen.",
  }, wrongModeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-completion-missing",
    severity: "warning",
    area: "Abschlusslogik",
    title: "Gestempelte Arbeit hat keinen Abschlussstatus",
    evidence: `${stampedWithoutCompletion.length} gestempelte Eintragung/Eintragungen sind weder als fertig noch als unterbrochen markiert.`,
    recommendation: "Prüfen, wie die Arbeit beendet wurde, und den Abschlussstatus nachvollziehbar ergänzen.",
  }, stampedWithoutCompletion.length > 0);

  addIssue(issues, {
    id: "stamp-duplicate",
    severity: "critical",
    area: "Doppelbuchung",
    title: "Mögliche doppelte Stempelungen",
    evidence: `${duplicateEntries} Eintrag/Einträge wiederholen Mitarbeiter, Datum, Zeitspanne und Dauer exakt.`,
    recommendation: "Die Bearbeitungshistorien vergleichen und nur die tatsächlich geleistete Zeit bestehen lassen.",
  }, duplicateEntries > 0);

  addIssue(issues, {
    id: "stamp-overlap",
    severity: "critical",
    area: "Zeitüberschneidung",
    title: "Parallele Projektzeiten eines Mitarbeiters",
    evidence: `${overlappingPairs} Zeitpaar/Zeitpaare überschneiden sich am selben Arbeitstag${input.crossProjectComparisonPerformed ? " – projektübergreifend geprüft" : " innerhalb des freigegebenen Projektumfangs"}.`,
    recommendation: "Die betroffenen Zeiträume und Projektzuordnungen des Mitarbeiters prüfen.",
  }, overlappingPairs > 0);

  addIssue(issues, {
    id: "stamp-overtime-pending",
    severity: "warning",
    area: "Überstunden",
    title: "Überstundenfreigaben sind offen",
    evidence: `${pendingOvertimeEntries.length} Eintrag/Einträge warten auf eine Freigabe.`,
    recommendation: "Überstunden im Mitarbeiterbereich fachlich prüfen und freigeben oder korrigieren.",
  }, pendingOvertimeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-overtime-approval-invalid",
    severity: "critical",
    area: "Überstunden",
    title: "Freigabenachweis ist unvollständig",
    evidence: `${invalidApprovedOvertimeEntries.length} genehmigte Eintragung/Eintragungen haben keinen vollständigen Freigabezeitpunkt oder Freigebenden.`,
    recommendation: "Freigabenachweis prüfen; keine Genehmigung ohne nachvollziehbare Identität übernehmen.",
  }, invalidApprovedOvertimeEntries.length > 0);

  const planningById = new Map(
    input.planningEntries.map((planningEntry) => [planningEntry.id, planningEntry])
  );
  const missingPlanningLinks = entries.filter(
    (entry) =>
      Boolean(entry.planningEntryId) &&
      !planningById.has(entry.planningEntryId ?? "")
  );
  const conflictingPlanningLinks = entries.filter((entry) => {
    if (!entry.planningEntryId) return false;
    const planningEntry = planningById.get(entry.planningEntryId);
    return Boolean(
      planningEntry &&
      (planningEntry.projectId !== input.projectId ||
        (planningEntry.userId && entry.userId && planningEntry.userId !== entry.userId) ||
        planningEntry.date !== entry.date)
    );
  });
  addIssue(issues, {
    id: "stamp-planning-link-missing",
    severity: "warning",
    area: "Planungsverknüpfung",
    title: "Verknüpfter Termin wurde nicht gefunden",
    evidence: `${missingPlanningLinks.length} Eintrag/Einträge verweisen auf einen nicht vorhandenen Planungseintrag.`,
    recommendation: "Terminverknüpfung anhand von Datum, Mitarbeiter und Projekt neu prüfen.",
  }, missingPlanningLinks.length > 0);
  addIssue(issues, {
    id: "stamp-planning-link-conflict",
    severity: "critical",
    area: "Planungsverknüpfung",
    title: "Termin und Stempelung passen nicht zusammen",
    evidence: `${conflictingPlanningLinks.length} Verknüpfung/Verknüpfungen widersprechen bei Projekt, Mitarbeiter oder Datum.`,
    recommendation: "Die falsche Terminverknüpfung korrigieren, ohne die geleistete Zeit still zu verändern.",
  }, conflictingPlanningLinks.length > 0);

  for (const session of activeSessions) {
    const ageMs = now.getTime() - session.createdAt.getTime();
    addIssue(issues, {
      id: `active-session-future-${session.id}`,
      severity: "critical",
      area: "Aktive Stempelung",
      title: "Aktive Stempelung beginnt in der Zukunft",
      evidence: `Die laufende Sitzung von ${session.employee || "unbekanntem Mitarbeiter"} hat einen zukünftigen Startzeitpunkt.`,
      recommendation: "Sitzung und Serverzeit prüfen, bevor sie beendet wird.",
    }, session.startedAt.getTime() > now.getTime() + 60_000);
    addIssue(issues, {
      id: `active-session-too-long-${session.id}`,
      severity: "critical",
      area: "Aktive Stempelung",
      title: "Aktive Stempelung läuft ungewöhnlich lange",
      evidence: `Die Sitzung von ${session.employee || "unbekanntem Mitarbeiter"} besteht seit mehr als 16 Stunden.`,
      recommendation: "Prüfen, ob die Arbeit vergessen wurde zu beenden; nicht ungeprüft automatisch schließen.",
    }, ageMs > 16 * 3_600_000);
    addIssue(issues, {
      id: `active-session-comment-${session.id}`,
      severity: "critical",
      area: "Aktive Stempelung",
      title: "Tätigkeitsbeschreibung der aktiven Stempelung fehlt",
      evidence: `Die Sitzung von ${session.employee || "unbekanntem Mitarbeiter"} enthält keinen Arbeitskommentar.`,
      recommendation: "Vor dem Abschluss eine nachvollziehbare Tätigkeitsbeschreibung ergänzen.",
    }, !session.comment);
    addIssue(issues, {
      id: `active-session-hourly-context-${session.id}`,
      severity: "critical",
      area: "Aktive Stundenabrechnung",
      title: "Aktive Stundenabrechnung ist unvollständig",
      evidence: `Bei ${session.employee || "einer aktiven Sitzung"} fehlen Gewerk oder Abrechnungsleistung.`,
      recommendation: "Stempelung kontrolliert beenden und die Abrechnungszuordnung vor der Faktura korrigieren.",
    }, input.isHourlyRecurring &&
      (!session.trade ||
        !session.billingCatalogItemId ||
        !session.billingCatalogItemLabel));
  }

  if (input.verifyInterruptionTasks) {
    const taskDescriptions = input.interruptionTaskDescriptions ?? [];
    const interruptedWithoutTask = entries.filter(
      (entry) =>
        entry.completionStatus === "interrupted" &&
        !taskDescriptions.some((description) =>
          description.includes(`Stempelung: ${entry.id}`)
        )
    );
    addIssue(issues, {
      id: "stamp-interruption-task-missing",
      severity: "critical",
      area: "Unterbrechungsautomatik",
      title: "Folgeaufgabe zur Arbeitsunterbrechung fehlt",
      evidence: `${interruptedWithoutTask.length} unterbrochene Stempelung/Stempelungen besitzen keine nachweisbare Klärungsaufgabe.`,
      recommendation: "Unterbrechungsgrund prüfen und eine eindeutig mit der Stempelung verknüpfte Aufgabe anlegen.",
    }, interruptedWithoutTask.length > 0);
  }

  if (input.isHourlyRecurring && input.invoices && input.invoiceLines && input.invoiceLaborItems) {
    const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
    const hourlyInvoiceIds = new Set(
      input.invoices
        .filter((invoice) => invoice.billingSource === "hourly-recurring")
        .map((invoice) => invoice.id)
    );
    const hourlyInvoiceLines = input.invoiceLines.filter((line) =>
      hourlyInvoiceIds.has(line.invoiceId)
    );
    const hourlyInvoiceLaborItems = input.invoiceLaborItems.filter((labor) =>
      hourlyInvoiceIds.has(labor.invoiceId)
    );
    const positiveHourlyEntries = entries.filter(
      (entry) => numberValue(entry.durationMs) > 0
    );
    const missingHourlyTrade = positiveHourlyEntries.filter((entry) => !entry.trade);
    const missingHourlyItem = positiveHourlyEntries.filter(
      (entry) => !entry.billingCatalogItemId || !entry.billingCatalogItemLabel
    );
    const missingInvoiceLink = positiveHourlyEntries.filter((entry) => !entry.invoiceId);
    const invalidInvoiceLinks = positiveHourlyEntries.filter((entry) => {
      if (!entry.invoiceId) return false;
      const invoice = invoiceById.get(entry.invoiceId);
      return Boolean(
        !invoice ||
        invoice.projectId !== input.projectId ||
        invoice.billingSource !== "hourly-recurring" ||
        isInactiveInvoiceStatus(invoice.status)
      );
    });
    const wrongInvoiceMonthLinks = positiveHourlyEntries.filter((entry) => {
      if (!entry.invoiceId) return false;
      const invoice = invoiceById.get(entry.invoiceId);
      return Boolean(
        invoice &&
        invoice.billingSource === "hourly-recurring" &&
        invoice.plannedExecutionMonth &&
        invoice.plannedExecutionMonth !== entry.date.slice(0, 7)
      );
    });

    addIssue(issues, {
      id: "hourly-trade-missing",
      severity: "critical",
      area: "Stundenabrechnung",
      title: "Stempelungen ohne Gewerk",
      evidence: `${missingHourlyTrade.length} Zeiteintrag/Zeiteinträge können keinem Leistungsgewerk sicher zugeordnet werden.`,
      recommendation: "Die betroffenen Zeiteinträge prüfen und das korrekte Gewerk ergänzen.",
    }, missingHourlyTrade.length > 0);
    addIssue(issues, {
      id: "hourly-billing-item-missing",
      severity: "critical",
      area: "Stundenabrechnung",
      title: "Abrechnungsleistung fehlt",
      evidence: `${missingHourlyItem.length} Zeiteintrag/Zeiteinträge besitzen keine vollständige abrechenbare Stundenleistung.`,
      recommendation: "Bei den betroffenen Einträgen die zum Gewerk passende Abrechnungsleistung auswählen.",
    }, missingHourlyItem.length > 0);
    addIssue(issues, {
      id: "hourly-invoice-link-missing",
      severity: "warning",
      area: "Abrechnungsautomatik",
      title: "Stunden sind noch keinem Rechnungsentwurf zugeordnet",
      evidence: `${missingInvoiceLink.length} Zeiteintrag/Zeiteinträge sind ohne Rechnungsverknüpfung.`,
      recommendation: "Prüfen, ob der Monatsentwurf vorhanden ist und die Automatik fehlerfrei gelaufen ist.",
    }, missingInvoiceLink.length > 0);
    addIssue(issues, {
      id: "hourly-invoice-link-invalid",
      severity: "critical",
      area: "Abrechnungsautomatik",
      title: "Rechnungsverknüpfung ist ungültig",
      evidence: `${invalidInvoiceLinks.length} Zeiteintrag/Zeiteinträge verweisen auf eine fehlende, stornierte oder fremde Rechnung.`,
      recommendation: "Verknüpfung und Rechnungshistorie prüfen; keine neue Rechnung erzeugen, bevor die Ursache geklärt ist.",
    }, invalidInvoiceLinks.length > 0);
    addIssue(issues, {
      id: "hourly-invoice-month-conflict",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Stempelmonat und Rechnungsmonat widersprechen sich",
      evidence: `${wrongInvoiceMonthLinks.length} Zeiteintrag/Zeiteinträge sind einem anderen Leistungsmonat zugeordnet.`,
      recommendation: "Rechnungsmonat und betroffene Stempelungen anhand des Leistungsdatums prüfen.",
    }, wrongInvoiceMonthLinks.length > 0);

    const invoiceIdsByMonth = new Map<string, Set<string>>();
    for (const entry of positiveHourlyEntries) {
      if (!entry.invoiceId) continue;
      const month = entry.date.slice(0, 7);
      const ids = invoiceIdsByMonth.get(month) ?? new Set<string>();
      ids.add(entry.invoiceId);
      invoiceIdsByMonth.set(month, ids);
    }
    const splitMonths = [...invoiceIdsByMonth.entries()].filter(
      ([, ids]) => ids.size > 1
    );
    addIssue(issues, {
      id: "hourly-month-split-invoices",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Ein Monatslauf ist auf mehrere Rechnungen verteilt",
      evidence: `${splitMonths.length} Monat/Monate verwenden mehr als eine Rechnung für die Stundenabrechnung.`,
      recommendation: "Rechnungsentwürfe und Zeitverknüpfungen zusammenführen beziehungsweise fachlich bereinigen.",
    }, splitMonths.length > 0);

    const draftsByMonth = new Map<string, number>();
    for (const invoice of input.invoices) {
      if (
        invoice.billingSource === "hourly-recurring" &&
        invoice.status === "Entwurf"
      ) {
        draftsByMonth.set(
          invoice.plannedExecutionMonth,
          (draftsByMonth.get(invoice.plannedExecutionMonth) ?? 0) + 1
        );
      }
    }
    const duplicateDraftMonths = [...draftsByMonth.values()].filter(
      (count) => count > 1
    ).length;
    addIssue(issues, {
      id: "hourly-duplicate-month-drafts",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Mehrere Stundenentwürfe im selben Monat",
      evidence: `${duplicateDraftMonths} Monat/Monate besitzen mehr als einen automatischen Rechnungsentwurf.`,
      recommendation: "Entwürfe nicht fakturieren, bevor doppelte Monatsentwürfe fachlich bereinigt wurden.",
    }, duplicateDraftMonths > 0);

    const linesByInvoiceAndCatalog = new Map<string, StampDiagnosticInvoiceLine[]>();
    for (const line of hourlyInvoiceLines) {
      const key = `${line.invoiceId}|${line.catalogItemId}`;
      const lines = linesByInvoiceAndCatalog.get(key) ?? [];
      lines.push(line);
      linesByInvoiceAndCatalog.set(key, lines);
    }
    const duplicateServiceGroups = [...linesByInvoiceAndCatalog.values()].filter(
      (lines) => lines.length > 1
    ).length;
    addIssue(issues, {
      id: "hourly-duplicate-service-lines",
      severity: "warning",
      area: "Rechnungspositionen",
      title: "Abrechnungsleistung ist mehrfach aufgeteilt",
      evidence: `${duplicateServiceGroups} Leistung/Leistungen erscheinen mehrfach in derselben Stundenrechnung.`,
      recommendation: "Prüfen, ob die Positionen bewusst getrennt wurden oder zusammengeführt werden müssen.",
    }, duplicateServiceGroups > 0);

    let entriesWithoutInvoiceLine = 0;
    const expectedHoursByLineAndUser = new Map<string, number>();
    for (const entry of positiveHourlyEntries) {
      if (!entry.invoiceId || !entry.billingCatalogItemId) continue;
      const lines = linesByInvoiceAndCatalog.get(
        `${entry.invoiceId}|${entry.billingCatalogItemId}`
      );
      const line = lines?.[0];
      if (!line) {
        entriesWithoutInvoiceLine += 1;
        continue;
      }
      const key = `${line.id}|${entry.userId ?? ""}`;
      expectedHoursByLineAndUser.set(
        key,
        (expectedHoursByLineAndUser.get(key) ?? 0) +
          roundedHours(entry.durationMs, input.roundingFactorHours)
      );
    }
    addIssue(issues, {
      id: "hourly-invoice-line-missing",
      severity: "critical",
      area: "Rechnungspositionen",
      title: "Stempelung fehlt in den Rechnungspositionen",
      evidence: `${entriesWithoutInvoiceLine} verknüpfte Zeiteintragung/Zeiteintragungen haben keine passende Leistungsposition.`,
      recommendation: "Betroffene Rechnung und Abrechnungsleistung prüfen und die Position kontrolliert ergänzen.",
    }, entriesWithoutInvoiceLine > 0);

    const actualHoursByLineAndUser = new Map<string, number>();
    for (const labor of hourlyInvoiceLaborItems) {
      const key = `${labor.invoiceLineId}|${labor.userId}`;
      actualHoursByLineAndUser.set(
        key,
        (actualHoursByLineAndUser.get(key) ?? 0) + Number(labor.plannedHours || 0)
      );
    }
    const laborHourMismatches = [...expectedHoursByLineAndUser.entries()].filter(
      ([key, expectedHours]) =>
        Math.abs(expectedHours - (actualHoursByLineAndUser.get(key) ?? 0)) > 0.01
    ).length;
    addIssue(issues, {
      id: "hourly-labor-hours-mismatch",
      severity: "critical",
      area: "Rechnungsstunden",
      title: "Gerundete Stempelstunden und Rechnungsstunden weichen ab",
      evidence: `${laborHourMismatches} Mitarbeiter-/Leistungsgruppe stimmt nicht mit den gerundeten Einzelstempelungen überein.`,
      recommendation: "Stempelungen, Rundungsfaktor und Rechnungsstunden positionsweise vergleichen.",
    }, laborHourMismatches > 0);

    const laborHoursByLine = new Map<string, number>();
    for (const labor of hourlyInvoiceLaborItems) {
      laborHoursByLine.set(
        labor.invoiceLineId,
        (laborHoursByLine.get(labor.invoiceLineId) ?? 0) +
          Number(labor.plannedHours || 0)
      );
    }
    const lineQuantityMismatches = hourlyInvoiceLines.filter(
      (line) =>
        Math.abs(
          Number(line.quantity || 0) - (laborHoursByLine.get(line.id) ?? 0)
        ) > 0.01
    );
    addIssue(issues, {
      id: "hourly-line-quantity-mismatch",
      severity: "critical",
      area: "Rechnungsstunden",
      title: "Positionsmenge und Mitarbeiterstunden weichen ab",
      evidence: `${lineQuantityMismatches.length} Rechnungsposition/Positionen entsprechen nicht der Summe ihrer Stundenzeilen.`,
      recommendation: "Positionsmenge und Stundenzeilen vor einer Fakturierung neu berechnen.",
    }, lineQuantityMismatches.length > 0);

    const lineTotalsByInvoice = new Map<string, number>();
    for (const line of hourlyInvoiceLines) {
      lineTotalsByInvoice.set(
        line.invoiceId,
        round((lineTotalsByInvoice.get(line.invoiceId) ?? 0) + Number(line.totalNet || 0))
      );
    }
    const invoiceTotalMismatches = input.invoices.filter(
      (invoice) =>
        invoice.billingSource === "hourly-recurring" &&
        Math.abs(
          Number(invoice.netTotal || 0) - (lineTotalsByInvoice.get(invoice.id) ?? 0)
        ) > 0.02
    );
    addIssue(issues, {
      id: "hourly-invoice-total-mismatch",
      severity: "critical",
      area: "Rechnungssumme",
      title: "Rechnungssumme entspricht nicht den Positionen",
      evidence: `${invoiceTotalMismatches.length} automatische Stundenrechnung/Stundenrechnungen haben eine Summenabweichung.`,
      recommendation: "Rechnung vor dem Versand neu berechnen und Positionssummen prüfen.",
    }, invoiceTotalMismatches.length > 0);
  }

  return {
    issues,
    metrics: {
      entries: entries.length,
      totalHours: round(
        entries.reduce(
          (sum, entry) => sum + numberValue(entry.durationMs),
          0
        ) / 3_600_000
      ),
      employees: new Set(entries.map((entry) => entry.userId).filter(Boolean)).size,
      activeSessions: activeSessions.length,
      duplicateEntries,
      overlappingPairs,
      invoicedEntries: entries.filter((entry) => Boolean(entry.invoiceId)).length,
      openOvertimeApprovals: pendingOvertimeEntries.length,
    },
    checkedRules: [
      pausedEntries.length > 0
        ? "Zeitmathematik, Pausen und Tagesgrenzen; pausierte Zeiten anhand der gespeicherten Dauer bewertet, weil die Startanzeige nach einer Wiederaufnahme nur eingeschränkt rekonstruierbar ist"
        : "Zeitmathematik, Pausen und Tagesgrenzen",
      input.crossProjectComparisonPerformed
        ? "Doppelungen und projektübergreifende Überschneidungen je Mitarbeiter"
        : "Doppelungen und Überschneidungen innerhalb des Projekts",
      "Mitarbeiter-, Projekt- und Planungsverknüpfungen",
      "Aktive Sitzungen und Abschlussstatus",
      "Unterbrechungs- und Überstundenlogik",
      ...(input.isHourlyRecurring && input.invoices
        ? [
            "Dauerläufer-Monatsentwürfe und Rechnungsverknüpfungen",
            "Abrechnungsleistungen, Rundung, Stundenzeilen und Rechnungssummen",
          ]
        : []),
    ],
  };
}
