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

const INTERRUPTION_TASK_AUTOMATION_START_DATE = "2026-06-27";

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
    title: "Bei Stempelungen ist das Datum fehlerhaft",
    evidence: `${invalidDateEntries.length} Zeiteintrag/Zeiteinträge enthalten kein gültiges Kalenderdatum und können deshalb keinem Arbeitstag zugeordnet werden.`,
    recommendation: "Öffne die betroffenen Stempelungen und vergleiche das Datum mit Einsatzplanung und Bearbeitungshistorie, bevor du es korrigierst.",
  }, invalidDateEntries.length > 0);

  addIssue(issues, {
    id: "stamp-invalid-time",
    severity: "critical",
    area: "Stempelzeit",
    title: "Bei Stempelungen fehlt eine gültige Start- oder Endzeit",
    evidence: `${invalidTimeEntries.length} Zeiteintrag/Zeiteinträge können nicht zeitlich ausgewertet werden, weil Start oder Ende fehlt beziehungsweise ungültig ist.`,
    recommendation: "Öffne die betroffenen Stempelungen und prüfe Start- und Endzeit anhand der Einsatzunterlagen und Bearbeitungshistorie.",
  }, invalidTimeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-duration-non-positive",
    severity: "critical",
    area: "Stempelzeit",
    title: "Eine Stempelung enthält keine abrechenbare Arbeitszeit",
    evidence: `${nonPositiveEntries.length} Eintrag/Einträge haben eine Dauer von 0 Stunden oder einen negativen Wert. Diese Zeit kann weder für das Projekt noch für eine Abrechnung verwendet werden.`,
    recommendation: "Prüfe die betroffenen Einträge anhand der Bearbeitungshistorie. Korrigiere sie auf die tatsächlich geleistete Zeit oder lösche sie nur mit nachvollziehbarer Begründung.",
  }, nonPositiveEntries.length > 0);

  addIssue(issues, {
    id: "stamp-future-date",
    severity: "critical",
    area: "Stempelzeit",
    title: "Zeiteinträge liegen in der Zukunft",
    evidence: `${futureEntries.length} Zeiteintrag/Zeiteinträge sind mit einem zukünftigen Datum als bereits geleistete Arbeit gespeichert.`,
    recommendation: "Prüfe das Datum der betroffenen Stempelungen. Zukünftige Einsätze müssen unter „Termine & Stempelungen“ geplant und dürfen noch nicht als geleistete Zeit gespeichert werden.",
  }, futureEntries.length > 0);

  addIssue(issues, {
    id: "stamp-pause-invalid",
    severity: "critical",
    area: "Pausenlogik",
    title: "Bei Stempelungen ist eine negative Pause gespeichert",
    evidence: `${invalidPauseEntries.length} Zeiteintrag/Zeiteinträge enthalten eine Pausendauer kleiner als 0 Minuten. Dadurch wird die Arbeitszeit falsch berechnet.`,
    recommendation: "Öffne die betroffenen Stempelungen und korrigiere die Pause anhand des tatsächlichen Arbeitsverlaufs.",
  }, invalidPauseEntries.length > 0);

  addIssue(issues, {
    id: "stamp-duration-inconsistent",
    severity: "warning",
    area: "Zeitberechnung",
    title: "Berechnete und gespeicherte Arbeitszeit passen nicht zusammen",
    evidence: `Bei ${inconsistentDurationEntries.length} Zeiteintrag/Zeiteinträgen weicht die gespeicherte Dauer nach Abzug der Pause um mehr als fünf Minuten von Start bis Ende ab.`,
    recommendation: "Vergleiche bei den betroffenen Stempelungen Startzeit, Endzeit, Pause und gespeicherte Arbeitsdauer und korrigiere nur den nachweislich falschen Wert.",
  }, inconsistentDurationEntries.length > 0);

  addIssue(issues, {
    id: "stamp-duration-excessive",
    severity: "critical",
    area: "Stempelzeit",
    title: "Ungewöhnlich lange Einzelstempelung",
    evidence: `${excessiveDurationEntries.length} einzelne Stempelung/Stempelungen enthalten mehr als 16 Arbeitsstunden. Das deutet häufig auf eine nicht beendete oder falsch über Mitternacht erfasste Stempelung hin.`,
    recommendation: "Prüfe den tatsächlichen Arbeitsbeginn, das Arbeitsende und einen möglichen Tageswechsel. Kürze die Zeit nicht pauschal, sondern nur anhand eines nachvollziehbaren Nachweises.",
  }, excessiveDurationEntries.length > 0);

  addIssue(issues, {
    id: "stamp-employee-missing",
    severity: "critical",
    area: "Mitarbeiterzuordnung",
    title: "Mitarbeiterzuordnung fehlt",
    evidence: `${missingEmployeeEntries.length} Zeiteintrag/Zeiteinträge sind keinem eindeutig gespeicherten Mitarbeiter zugeordnet. Dadurch können Arbeitszeit, Kosten und Auswertungen der falschen Person zugerechnet werden oder ganz fehlen.`,
    recommendation: "Öffne die betroffenen Stempelungen und ordne anhand der Bearbeitungshistorie den richtigen aktiven Mitarbeiter zu.",
  }, missingEmployeeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-mode-conflict",
    severity: "critical",
    area: "Projektzuordnung",
    title: "Zeitart und Projektzuordnung passen nicht zusammen",
    evidence: `${wrongModeEntries.length} Zeiteintrag/Zeiteinträge werden in dieser Projektakte angezeigt, sind aber als nicht projektbezogene Zeit gespeichert. Dadurch können Projektstunden und Kosten falsch ausgewertet werden.`,
    recommendation: "Prüfe bei den betroffenen Einträgen, ob es tatsächlich Projektarbeit war. Korrigiere anschließend entweder die Zeitart oder die Projektzuordnung.",
  }, wrongModeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-completion-missing",
    severity: "warning",
    area: "Abschlusslogik",
    title: "Bei gestempelter Arbeit fehlt die Angabe zum Arbeitsergebnis",
    evidence: `${stampedWithoutCompletion.length} gestempelte Eintragung/Eintragungen sind weder als fertig noch als unterbrochen gekennzeichnet. Dadurch bleibt offen, ob weitere Arbeit erforderlich ist.`,
    recommendation: "Prüfe den tatsächlichen Stand der ausgeführten Arbeit und ergänze bei der Stempelung „Fertig“ oder „Unterbrochen“ mit einer nachvollziehbaren Begründung.",
  }, stampedWithoutCompletion.length > 0);

  addIssue(issues, {
    id: "stamp-duplicate",
    severity: "critical",
    area: "Doppelbuchung",
    title: "Mögliche doppelte Stempelungen",
    evidence: `${duplicateEntries} Zeiteintrag/Zeiteinträge stimmen bei Mitarbeiter, Datum, Start, Ende und Dauer vollständig mit einem weiteren Eintrag überein. Die Arbeitszeit könnte dadurch doppelt gezählt werden.`,
    recommendation: "Vergleiche die Bearbeitungshistorien der betroffenen Stempelungen und lasse nur die nachweislich tatsächlich geleistete Zeit bestehen.",
  }, duplicateEntries > 0);

  addIssue(issues, {
    id: "stamp-overlap",
    severity: "critical",
    area: "Zeitüberschneidung",
    title: "Parallele Projektzeiten eines Mitarbeiters",
    evidence: `${overlappingPairs} Paar/Paare von Stempelungen überschneiden sich beim selben Mitarbeiter am selben Arbeitstag${input.crossProjectComparisonPerformed ? " – auch über andere freigegebene Projekte hinweg geprüft" : " innerhalb dieses freigegebenen Projekts"}. Der Mitarbeiter wäre damit zur gleichen Zeit mehrfach gebucht.`,
    recommendation: "Vergleiche die betroffenen Zeiträume, Tätigkeiten und Projektzuordnungen. Korrigiere nur die Stempelung, deren Zeit oder Projekt nachweislich falsch ist.",
  }, overlappingPairs > 0);

  addIssue(issues, {
    id: "stamp-overtime-pending",
    severity: "warning",
    area: "Überstunden",
    title: "Überstundenfreigaben sind offen",
    evidence: `${pendingOvertimeEntries.length} Überstundeneintrag/Überstundeneinträge wurden noch nicht von einer berechtigten Person geprüft und freigegeben.`,
    recommendation: "Öffne im Mitarbeiterbereich die betroffenen Überstunden, vergleiche sie mit Einsatz und Arbeitszeit und gib sie anschließend frei oder korrigiere sie.",
  }, pendingOvertimeEntries.length > 0);

  addIssue(issues, {
    id: "stamp-overtime-approval-invalid",
    severity: "critical",
    area: "Überstunden",
    title: "Bei freigegebenen Überstunden fehlt der Nachweis der Freigabe",
    evidence: `${invalidApprovedOvertimeEntries.length} bereits genehmigte Überstundeneintragung/Überstundeneintragungen enthalten keinen vollständigen Freigabezeitpunkt oder keine eindeutig freigebende Person.`,
    recommendation: "Prüfe die Freigabehistorie. Eine Überstunde darf nur als genehmigt gelten, wenn Zeitpunkt und berechtigte freigebende Person nachvollziehbar gespeichert sind.",
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
    title: "Der zur Stempelung gehörende Termin wurde nicht gefunden",
    evidence: `${missingPlanningLinks.length} Zeiteintrag/Zeiteinträge verweisen auf einen Termin, der im Planungsboard nicht mehr vorhanden ist. Dadurch ist der Weg von der Planung zur ausgeführten Arbeit unterbrochen.`,
    recommendation: "Vergleiche Datum, Mitarbeiter und Projekt mit dem Planungsboard und stelle die richtige Terminverknüpfung wieder her, ohne die geleistete Zeit zu verändern.",
  }, missingPlanningLinks.length > 0);
  addIssue(issues, {
    id: "stamp-planning-link-conflict",
    severity: "critical",
    area: "Planungsverknüpfung",
    title: "Termin und Stempelung passen nicht zusammen",
    evidence: `${conflictingPlanningLinks.length} Terminverknüpfung/Terminverknüpfungen stimmen bei Projekt, Mitarbeiter oder Datum nicht mit der zugehörigen Stempelung überein.`,
    recommendation: "Vergleiche Termin und Stempelung und verknüpfe den richtigen Termin. Ändere die tatsächlich geleistete Zeit dabei nicht unbemerkt mit.",
  }, conflictingPlanningLinks.length > 0);

  for (const session of activeSessions) {
    const ageMs = now.getTime() - session.createdAt.getTime();
    addIssue(issues, {
      id: `active-session-future-${session.id}`,
      severity: "critical",
      area: "Aktive Stempelung",
      title: "Aktive Stempelung beginnt in der Zukunft",
      evidence: `Die laufende Stempelung von ${session.employee || "einem unbekannten Mitarbeiter"} beginnt laut System erst in der Zukunft. Dadurch kann keine korrekte Arbeitsdauer berechnet werden.`,
      recommendation: "Prüfe Startzeit, Datum und Systemzeit, bevor die Stempelung beendet oder korrigiert wird.",
    }, session.startedAt.getTime() > now.getTime() + 60_000);
    addIssue(issues, {
      id: `active-session-too-long-${session.id}`,
      severity: "critical",
      area: "Aktive Stempelung",
      title: "Aktive Stempelung läuft ungewöhnlich lange",
      evidence: `Die laufende Stempelung von ${session.employee || "einem unbekannten Mitarbeiter"} ist seit mehr als 16 Stunden aktiv. Möglicherweise wurde das Ausstempeln vergessen.`,
      recommendation: "Kläre die tatsächliche Arbeitszeit mit der betroffenen Person und beende die Stempelung nicht ungeprüft mit der aktuellen Uhrzeit.",
    }, ageMs > 16 * 3_600_000);
    addIssue(issues, {
      id: `active-session-comment-${session.id}`,
      severity: "critical",
      area: "Aktive Stempelung",
      title: "Tätigkeitsbeschreibung der aktiven Stempelung fehlt",
      evidence: `Die laufende Stempelung von ${session.employee || "einem unbekannten Mitarbeiter"} enthält keine Beschreibung der ausgeführten Tätigkeit. Dadurch ist die Leistung später nicht nachvollziehbar.`,
      recommendation: "Ergänze vor dem Beenden der Stempelung eine verständliche Beschreibung der tatsächlich ausgeführten Arbeit.",
    }, !session.comment);
    addIssue(issues, {
      id: `active-session-hourly-context-${session.id}`,
      severity: "critical",
      area: "Aktive Stundenabrechnung",
      title: "Bei der laufenden Stempelung fehlen Angaben für die Stundenabrechnung",
      evidence: `Bei ${session.employee || "einer laufenden Stempelung"} fehlt das Gewerk oder die konkrete Abrechnungsleistung. Die Zeit kann dadurch nicht korrekt auf die spätere Monatsrechnung übernommen werden.`,
      recommendation: "Prüfe vor dem Beenden der Stempelung das richtige Gewerk und die dazugehörige Abrechnungsleistung. Kontrolliere die Zuordnung nochmals, bevor die Rechnung fertiggestellt wird.",
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
    const legacyInterruptedWithoutTask = interruptedWithoutTask.filter(
      (entry) => entry.date < INTERRUPTION_TASK_AUTOMATION_START_DATE
    );
    const currentInterruptedWithoutTask =
      interruptedWithoutTask.length - legacyInterruptedWithoutTask.length;
    const interruptionEvidence =
      legacyInterruptedWithoutTask.length > 0 &&
      currentInterruptedWithoutTask === 0
        ? `${legacyInterruptedWithoutTask.length} unterbrochene Stempelung/Stempelungen stammen aus der Zeit vor Einführung der automatischen Klärungsaufgabe am 27.06.2026. Für diese Altbestände wurde rückwirkend keine Aufgabe angelegt; die Unterbrechung ist deshalb weiterhin ohne dokumentierte Klärung.`
        : `${interruptedWithoutTask.length} unterbrochene Stempelung/Stempelungen haben keine verknüpfte Aufgabe.${
            legacyInterruptedWithoutTask.length > 0
              ? ` Davon stammen ${legacyInterruptedWithoutTask.length} aus der Zeit vor Einführung der Aufgabenautomatik am 27.06.2026.`
              : ""
          } Dadurch kann der Unterbrechungsgrund vergessen werden und die Arbeit offen bleiben.`;
    addIssue(issues, {
      id: "stamp-interruption-task-missing",
      severity: "critical",
      area: "Unterbrechungsautomatik",
      title:
        legacyInterruptedWithoutTask.length === interruptedWithoutTask.length
          ? "Für eine ältere Arbeitsunterbrechung fehlt die Klärungsaufgabe"
          : "Nach einer Arbeitsunterbrechung fehlt die notwendige Klärungsaufgabe",
      evidence: interruptionEvidence,
      recommendation:
        "Prüfe, ob die unterbrochene Arbeit noch offen ist. Lege nur dann eine Aufgabe mit Verantwortlichem, Termin und eindeutigem Bezug zur betroffenen Stempelung an; bereits anderweitig erledigte Arbeit darf nicht als offen dargestellt werden.",
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
      title: "Bei Stempelungen fehlt das Gewerk für die Abrechnung",
      evidence: `${missingHourlyTrade.length} Zeiteintrag/Zeiteinträge haben kein Gewerk. WorkPilot360 kann dadurch nicht sicher erkennen, zu welcher Leistungsgruppe die Stunden gehören.`,
      recommendation: "Öffne die betroffenen Einträge unter „Termine & Stempelungen“ und wähle das Gewerk aus, in dem die Arbeit tatsächlich ausgeführt wurde.",
    }, missingHourlyTrade.length > 0);
    addIssue(issues, {
      id: "hourly-billing-item-missing",
      severity: "critical",
      area: "Stundenabrechnung",
      title: "Bei Stempelungen fehlt die Leistung für die Rechnung",
      evidence: `${missingHourlyItem.length} Zeiteintrag/Zeiteinträge haben keine vollständige Abrechnungsleistung. Die Stunden können dadurch nicht der richtigen Rechnungsposition zugeordnet werden.`,
      recommendation: "Öffne die betroffenen Einträge unter „Termine & Stempelungen“ und wähle die zum Gewerk und zum gültigen Angebot passende Abrechnungsleistung aus.",
    }, missingHourlyItem.length > 0);
    addIssue(issues, {
      id: "hourly-invoice-link-missing",
      severity: "warning",
      area: "Abrechnungsautomatik",
      title: "Gestempelte Stunden wurden noch nicht in den Monatsentwurf übernommen",
      evidence: `${missingInvoiceLink.length} Zeiteintrag/Zeiteinträge sind noch mit keinem Rechnungsentwurf verknüpft. Diese Stunden könnten bei der Monatsabrechnung fehlen.`,
      recommendation: "Öffne im Projekt „Rechnungen“ und prüfe, ob für den Leistungsmonat genau ein Entwurf vorhanden ist. Kontrolliere anschließend die Abrechnungsleistung und den Automatikverlauf, bevor du eine neue Rechnung anlegst.",
    }, missingInvoiceLink.length > 0);
    addIssue(issues, {
      id: "hourly-invoice-link-invalid",
      severity: "critical",
      area: "Abrechnungsautomatik",
      title: "Gestempelte Stunden sind mit der falschen oder nicht mehr vorhandenen Rechnung verknüpft",
      evidence: `${invalidInvoiceLinks.length} Zeiteintrag/Zeiteinträge verweisen auf eine fehlende, stornierte oder zu einem anderen Projekt gehörende Rechnung. Dadurch kann die Leistung falsch oder gar nicht abgerechnet werden.`,
      recommendation: "Prüfe unter „Rechnungen“ die betroffene Rechnung und ihre Historie. Erzeuge keine neue Rechnung, bevor eindeutig geklärt ist, wohin die Stunden gehören.",
    }, invalidInvoiceLinks.length > 0);
    addIssue(issues, {
      id: "hourly-invoice-month-conflict",
      severity: "critical",
      area: "Monatsabrechnung",
      title: "Gestempelte Stunden sind dem falschen Rechnungsmonat zugeordnet",
      evidence: `${wrongInvoiceMonthLinks.length} Zeiteintrag/Zeiteinträge gehören laut Arbeitsdatum in einen anderen Monat als die verknüpfte Rechnung. Dadurch kann die Monatsabrechnung falsch sein.`,
      recommendation: "Vergleiche bei den betroffenen Stempelungen das Leistungsdatum mit dem Monat der Rechnung und korrigiere die Verknüpfung nur anhand der tatsächlich erbrachten Leistung.",
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
      title: "Die Stunden eines Monats sind auf mehrere Rechnungen verteilt",
      evidence: `In ${splitMonths.length} Monat/Monaten sind die gestempelten Stunden mit mehr als einer Stundenrechnung verknüpft. Pro Projekt und Monat soll genau ein gemeinsamer Rechnungsentwurf verwendet werden.`,
      recommendation: "Öffne die Rechnungen des betroffenen Monats und vergleiche Entwürfe, Positionen und verknüpfte Zeiten. Führe die Zuordnung erst nach der Prüfung in einem richtigen Monatsentwurf zusammen.",
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
      title: "Für denselben Monat wurden mehrere Stundenrechnungsentwürfe erstellt",
      evidence: `In ${duplicateDraftMonths} Monat/Monaten gibt es mehr als einen automatischen Rechnungsentwurf. Dadurch könnten dieselben Stunden doppelt abgerechnet werden.`,
      recommendation: "Stelle keinen dieser Entwürfe fertig und versende nichts, bevor du die Entwürfe, ihre Positionen und die zugeordneten Stempelungen vollständig verglichen hast.",
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
      title: "Dieselbe Abrechnungsleistung erscheint mehrfach in einer Stundenrechnung",
      evidence: `${duplicateServiceGroups} Leistung/Leistungen wurden innerhalb derselben Rechnung auf mehrere Positionen verteilt. Das kann beabsichtigt sein, kann aber auch zu einer unübersichtlichen oder doppelten Berechnung führen.`,
      recommendation: "Vergleiche die betroffenen Rechnungspositionen mit Angebot, Gewerk und Stempelungen. Führe sie zusammen, wenn es keinen nachvollziehbaren Grund für die Trennung gibt.",
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
      title: "Verknüpfte Stempelungen fehlen als Position in der Rechnung",
      evidence: `${entriesWithoutInvoiceLine} bereits mit einer Rechnung verknüpfte Zeiteintragung/Zeiteintragungen haben dort keine passende Leistungsposition. Die Stunden sind damit verknüpft, werden aber nicht sichtbar berechnet.`,
      recommendation: "Öffne die betroffene Rechnung und prüfe die Abrechnungsleistung der Stempelung. Ergänze die richtige Position kontrolliert und vergleiche danach Stunden und Betrag erneut.",
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
      title: "Die Stunden in der Rechnung stimmen nicht mit den gerundeten Stempelungen überein",
      evidence: `Bei ${laborHourMismatches} Kombination/Kombinationen aus Mitarbeiter und Leistung weicht die Summe der Rechnungsstunden von den nach der eingestellten Regel gerundeten Einzelstempelungen ab.`,
      recommendation: "Vergleiche für jede betroffene Rechnungsposition die einzelnen Stempelungen, die eingestellte Rundung und die ausgewiesenen Rechnungsstunden.",
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
      title: "Stundenzahl der Rechnungsposition passt nicht zu den Mitarbeiterstunden",
      evidence: `Bei ${lineQuantityMismatches.length} Rechnungsposition/Positionen stimmt die ausgewiesene Menge nicht mit der Summe der darunter gespeicherten Mitarbeiterstunden überein.`,
      recommendation: "Berechne vor dem Fertigstellen der Rechnung die Mitarbeiterstunden und die Menge der betroffenen Position erneut und kläre die Abweichung.",
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
      title: "Gesamtsumme der Stundenrechnung passt nicht zu ihren Positionen",
      evidence: `Bei ${invoiceTotalMismatches.length} automatisch erzeugter Stundenrechnung/erzeugten Stundenrechnungen stimmt die Nettogesamtsumme nicht mit der Summe der einzelnen Positionen überein.`,
      recommendation: "Versende die Rechnung noch nicht. Berechne sie neu und vergleiche anschließend jede Positionssumme mit der angezeigten Nettogesamtsumme.",
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
