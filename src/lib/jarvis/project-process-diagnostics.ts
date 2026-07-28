import {
  resolveJarvisProjectLogic,
  type JarvisProjectLogicInput,
} from "@/lib/jarvis/project-logic";

export type ProjectProcessIssue = {
  id: string;
  severity: "critical" | "warning";
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

export type ProjectProcessOffer = {
  id: string;
  status: string;
  wonAt?: Date | null;
};

export type ProjectProcessInvoice = {
  id: string;
  status: string;
  billingSource: string;
  plannedExecutionMonth: string;
  serviceDate: string;
  createdAt: Date;
};

export type ProjectProcessLogbookEntry = {
  title: string | null;
  projectMonth: string | null;
  attachments: unknown;
  createdAt: Date;
};

export type ProjectProcessDiagnosticResult = {
  issues: ProjectProcessIssue[];
  checkedRules: string[];
  summary: string[];
};

type ProjectProcessInput = {
  project: JarvisProjectLogicInput & {
    projectNumber: string;
    projectType: string | null;
    status: string;
  };
  evaluationDateKey: string;
  offers?: ProjectProcessOffer[];
  invoices?: ProjectProcessInvoice[];
  logbookEntries: ProjectProcessLogbookEntry[];
  timeEntryDates: string[];
};

const INACTIVE_INVOICE_MARKERS = ["geloscht", "storn"];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function monthKey(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 7);
  }
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function isInactiveInvoice(invoice: ProjectProcessInvoice) {
  const status = normalize(invoice.status);
  return INACTIVE_INVOICE_MARKERS.some((marker) => status.includes(marker));
}

function isFinalInvoice(invoice: ProjectProcessInvoice) {
  return !isInactiveInvoice(invoice) && normalize(invoice.status) !== "entwurf";
}

function getInvoiceMonth(invoice: ProjectProcessInvoice) {
  return (
    monthKey(invoice.serviceDate) ||
    monthKey(invoice.plannedExecutionMonth) ||
    monthKey(invoice.createdAt)
  );
}

function isActiveFinalOffer(offer: ProjectProcessOffer) {
  const status = normalize(offer.status);
  return (
    status !== "entwurf" &&
    !status.includes("verloren") &&
    !status.includes("geloscht")
  );
}

function isClosedStatus(status: string) {
  const value = normalize(status);
  return value === "abgeschlossen" || value === "archiviert";
}

function isOperationalStatus(status: string) {
  const value = normalize(status);
  return [
    "zur planung bereit",
    "geplant",
    "umsetzung",
    "arbeit unterbrochen",
    "abrechnungsprufung",
    "zur abrechnung bereit",
    "abgeschlossen",
    "archiviert",
  ].includes(value);
}

function isBillingStatus(status: string) {
  const value = normalize(status);
  return (
    value.includes("abrechnungsprufung") ||
    value === "zur abrechnung bereit" ||
    isClosedStatus(value)
  );
}

function isImmocareProject(project: ProjectProcessInput["project"]) {
  return (
    normalize(project.projectType).includes("immocare") ||
    normalize(project.projectNumber).startsWith("oki")
  );
}

function attachmentTypes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const type = (item as Record<string, unknown>).type;
    return typeof type === "string" ? [type] : [];
  });
}

function getEntryMonth(entry: ProjectProcessLogbookEntry) {
  return monthKey(entry.projectMonth) || monthKey(entry.createdAt);
}

function countEvidence(
  entries: ProjectProcessLogbookEntry[],
  title: string,
  attachmentType: string,
  targetMonth: string,
  monthly: boolean
) {
  return entries.filter(
    (entry) =>
      entry.title === title &&
      (!monthly || getEntryMonth(entry) === targetMonth) &&
      attachmentTypes(entry.attachments).includes(attachmentType)
  ).length;
}

function addIssue(
  issues: ProjectProcessIssue[],
  condition: boolean,
  issue: ProjectProcessIssue
) {
  if (condition) issues.push(issue);
}

export function diagnoseProjectProcess(
  input: ProjectProcessInput
): ProjectProcessDiagnosticResult {
  const issues: ProjectProcessIssue[] = [];
  const profile = resolveJarvisProjectLogic(input.project);
  const evaluationMonth = monthKey(input.evaluationDateKey);
  const runtimeEnd = monthKey(input.project.projectRuntimeUntil);
  const canInspectCommercial = Array.isArray(input.offers) && Array.isArray(input.invoices);
  const offers = input.offers ?? [];
  const invoices = (input.invoices ?? []).filter((invoice) => !isInactiveInvoice(invoice));
  const finalInvoices = invoices.filter(isFinalInvoice);
  const draftInvoices = invoices.filter(
    (invoice) => normalize(invoice.status) === "entwurf"
  );
  const activeFinalOffers = offers.filter(isActiveFinalOffer);
  const closed = isClosedStatus(input.project.status);
  const operational = isOperationalStatus(input.project.status);

  if (canInspectCommercial) {
    addIssue(
      issues,
      activeFinalOffers.length === 0,
      {
        id: "project-valid-offer-missing",
        severity: operational ? "critical" : "warning",
        area: "Angebot",
        title: "Gültiges Angebot fehlt",
        evidence:
          "Für dieses Projekt wurde noch kein gültiges Angebot im Projekt hinterlegt. Dadurch ist für JARVIS nicht eindeutig, welche Leistungen der Kunde beauftragt hat.",
        recommendation:
          "Bitte prüfe im Projekt unter „Angebote“, ob das richtige Angebot vorhanden und nicht nur als Entwurf gespeichert ist. Angebote sind in WorkPilot360 der verpflichtende Grundbaustein jedes Projekts – ohne gültiges Angebot darf der weitere Projektprozess nicht als vollständig bewertet werden.",
      }
    );

    addIssue(
      issues,
      profile.variant === "oneTime" && closed && finalInvoices.length === 0,
      {
        id: "one-time-closed-without-final-invoice",
        severity: "critical",
        area: "Projektabschluss",
        title: "Projekt ist abgeschlossen, aber eine fertige Rechnung fehlt",
        evidence:
          "Das einmalige Projekt ist als abgeschlossen oder archiviert markiert. Im Projekt wurde jedoch keine aktive, fertiggestellte Rechnung gefunden. Dadurch ist nicht nachvollziehbar, ob die ausgeführte Leistung vollständig abgerechnet wurde.",
        recommendation:
          "Öffne im Projekt „Rechnungen“ und prüfe das gültige Angebot, die Leistungsnachweise sowie vorhandene Entwürfe. Behalte den Abschlussstatus nur bei, wenn die Leistung vollständig und korrekt abgerechnet wurde.",
      }
    );

    addIssue(
      issues,
      profile.variant === "oneTime" &&
        finalInvoices.length > 0 &&
        !closed &&
        isBillingStatus(input.project.status),
      {
        id: "one-time-final-invoice-status-open",
        severity: "warning",
        area: "Statusautomatik",
        title: "Rechnung ist fertig, aber das einmalige Projekt ist noch nicht abgeschlossen",
        evidence:
          "Mindestens eine Rechnung wurde bereits fertiggestellt, das einmalige Projekt steht aber weiterhin in der Abrechnungsphase. Dadurch bleibt der Projektablauf unnötig offen.",
        recommendation:
          "Prüfe Rechnung, Endkontrolle und alle erforderlichen Leistungsnachweise. Wenn alles vollständig ist, führe anschließend den vorgesehenen Projektabschluss durch.",
      }
    );

    addIssue(
      issues,
      closed && draftInvoices.length > 0,
      {
        id: "closed-project-has-draft",
        severity: "warning",
        area: "Rechnungsstatus",
        title: "Im abgeschlossenen Projekt ist noch ein offener Rechnungsentwurf vorhanden",
        evidence: `Obwohl das Projekt abgeschlossen ist, wurde noch ${draftInvoices.length} aktiver Rechnungsentwurf/aktive Rechnungsentwürfe gefunden. Der Entwurf könnte versehentlich später zusätzlich berechnet werden.`,
        recommendation:
          "Öffne im Projekt „Rechnungen“ und vergleiche den Entwurf mit den bereits fertiggestellten Rechnungen. Lösche, storniere oder stelle den Entwurf nicht ungeprüft fertig.",
      }
    );

    const conflictingInvoiceSources = invoices.filter((invoice) => {
      if (profile.variant === "oneTime") {
        return ["batch", "hourly-recurring"].includes(invoice.billingSource);
      }
      if (profile.variant === "recurringMonthlyFlat") {
        return invoice.billingSource === "hourly-recurring";
      }
      if (profile.variant === "recurringHourly") {
        return invoice.billingSource === "batch";
      }
      return false;
    });
    addIssue(
      issues,
      conflictingInvoiceSources.length > 0,
      {
        id: "invoice-source-project-type-conflict",
        severity: "critical",
        area: "Abrechnungsweg",
        title: "Mindestens eine Rechnung wurde mit der falschen Abrechnungsautomatik erzeugt",
        evidence: `${conflictingInvoiceSources.length} aktive Rechnung/Rechnungen stammen aus einer Automatik, die nicht zur gespeicherten Projektart passt. Dadurch können falsche oder doppelte Abrechnungen entstehen.`,
        recommendation:
          "Prüfe zuerst in den Projektinformationen die Projektart und die vereinbarte Abrechnung. Vergleiche anschließend unter „Rechnungen“ den bisherigen Verlauf. Starte keine weitere Abrechnungsautomatik, bevor die Ursache geklärt ist.",
      }
    );

    addIssue(
      issues,
      profile.isRecurring &&
        Boolean(runtimeEnd) &&
        runtimeEnd < evaluationMonth &&
        finalInvoices.some((invoice) => getInvoiceMonth(invoice) === runtimeEnd) &&
        !closed,
      {
        id: "recurring-runtime-ended-status-open",
        severity: "warning",
        area: "Projektabschluss",
        title: "Die Laufzeit des Dauerläufers ist beendet, das Projekt aber noch offen",
        evidence:
          "Der letzte vereinbarte Projektmonat ist vorbei und für diesen Monat liegt eine aktive Rechnung vor. Der Projektstatus wurde jedoch noch nicht auf abgeschlossen gesetzt.",
        recommendation:
          "Prüfe den letzten Leistungsmonat, die erforderlichen Nachweise und die Rechnung. Wenn keine weitere Leistung offen ist, schließe anschließend das gesamte Dauerläufer-Projekt ab.",
      }
    );
  }

  const monthly = profile.isRecurring;
  const evidenceMonths = new Set<string>();
  if (monthly) {
    for (const date of input.timeEntryDates) {
      const month = monthKey(date);
      if (month && month < evaluationMonth) evidenceMonths.add(month);
    }
    for (const invoice of finalInvoices) {
      const month = getInvoiceMonth(invoice);
      if (month && month < evaluationMonth) evidenceMonths.add(month);
    }
  } else if (
    isBillingStatus(input.project.status) ||
    (canInspectCommercial && finalInvoices.length > 0)
  ) {
    evidenceMonths.add(evaluationMonth);
  }

  const missingFinalInspectionMonths: string[] = [];
  const missingBeforeImageMonths: string[] = [];
  const missingAfterImageMonths: string[] = [];
  const missingActivityReportMonths: string[] = [];
  const immocare = isImmocareProject(input.project);
  for (const month of evidenceMonths) {
    if (
      countEvidence(
        input.logbookEntries,
        "Dokumente: Endkontrolle",
        "Dokument",
        month,
        monthly
      ) === 0
    ) {
      missingFinalInspectionMonths.push(month);
    }
    if (!immocare) continue;
    if (
      countEvidence(
        input.logbookEntries,
        "Bilder: Vorherbilder",
        "Bild",
        month,
        monthly
      ) === 0
    ) {
      missingBeforeImageMonths.push(month);
    }
    if (
      countEvidence(
        input.logbookEntries,
        "Bilder: Nachherbilder",
        "Bild",
        month,
        monthly
      ) === 0
    ) {
      missingAfterImageMonths.push(month);
    }
    if (
      countEvidence(
        input.logbookEntries,
        "Dokumente: Tätigkeitsberichte",
        "Dokument",
        month,
        monthly
      ) === 0
    ) {
      missingActivityReportMonths.push(month);
    }
  }

  addIssue(
    issues,
    missingFinalInspectionMonths.length > 0,
    {
      id: "process-final-inspection-missing",
      severity: "critical",
      area: "Leistungsnachweis",
      title: monthly
        ? "Endkontrollen fehlen in abgeschlossenen Leistungsmonaten"
        : "Endkontrolle vor dem Projektabschluss fehlt",
      evidence: monthly
        ? `Für ${missingFinalInspectionMonths.length} abgeschlossenen Leistungsmonat/abgeschlossene Leistungsmonate wurde keine dokumentierte Endkontrolle gefunden: ${missingFinalInspectionMonths.sort().join(", ")}.`
        : "Für das einmalige Projekt wurde keine dokumentierte Endkontrolle gefunden. Dadurch fehlt der Nachweis, dass die ausgeführte Leistung vor Abschluss geprüft wurde.",
      recommendation:
        "Prüfe die tatsächlich ausgeführte Leistung und dokumentiere die Endkontrolle im Logbuch des richtigen Projektmonats. Erstelle keine nachträglichen Schein-Nachweise und datiere nichts rückwirkend um.",
    }
  );

  addIssue(
    issues,
    missingBeforeImageMonths.length > 0 || missingAfterImageMonths.length > 0,
    {
      id: "immocare-image-evidence-missing",
      severity: "critical",
      area: "Bildnachweise",
      title: "Erforderliche Vorher- oder Nachherbilder fehlen",
      evidence:
        `In ${missingBeforeImageMonths.length} geprüftem Monat/geprüften Monaten fehlt ein Vorherbild und in ` +
        `${missingAfterImageMonths.length} geprüftem Monat/geprüften Monaten ein Nachherbild. Dadurch ist die ausgeführte Leistung nicht vollständig bildlich belegt.`,
      recommendation:
        "Öffne im Projekt die Bildnachweise und ordne vorhandene Originalbilder dem richtigen Leistungsmonat zu. Sind keine Originalbilder vorhanden, kläre den fehlenden Nachweis; erfinde oder dupliziere keine Bilder.",
    }
  );

  addIssue(
    issues,
    missingActivityReportMonths.length > 0,
    {
      id: "immocare-activity-report-missing",
      severity: "warning",
      area: "Tätigkeitsbericht",
      title: "Tätigkeitsbericht für die ausgeführte Leistung fehlt",
      evidence: `Für ${missingActivityReportMonths.length} geprüften Monat/geprüfte Monate wurde kein Tätigkeitsbericht gefunden. Der Kunde kann dadurch nicht vollständig nachvollziehen, welche Arbeiten ausgeführt wurden.`,
      recommendation:
        "Erstelle vor dem Fertigstellen der Rechnung beziehungsweise vor dem Projektabschluss den Tätigkeitsbericht aus den vorhandenen, geprüften Leistungsnachweisen.",
    }
  );

  const offerSummary =
    activeFinalOffers.length === 1
      ? "1 gültiges Angebot"
      : `${activeFinalOffers.length} gültige Angebote`;
  const finalInvoiceSummary =
    finalInvoices.length === 1
      ? "1 fakturierte Rechnung"
      : `${finalInvoices.length} fakturierte Rechnungen`;
  const draftInvoiceSummary =
    draftInvoices.length === 1
      ? "1 Rechnungsentwurf"
      : `${draftInvoices.length} Rechnungsentwürfe`;

  return {
    issues,
    checkedRules: [
      ...(canInspectCommercial
        ? [
            "Gültiges Angebot als verpflichtende Projektgrundlage",
            "Rechnungsquelle passend zur Projektart",
            "Fertige Rechnung, Projektstatus und Gesamtabschluss",
          ]
        : []),
      "Endkontrolle und projektartabhängige Leistungsnachweise",
      ...(immocare
        ? ["OK-immocare-Prozess mit Vorherbild, Nachherbild und Tätigkeitsbericht"]
        : []),
    ],
    summary: [
      `${profile.label}: Der vorgesehene Projektablauf wurde mit den vorhandenen Angaben verglichen.`,
      canInspectCommercial
        ? `${offerSummary}, ${finalInvoiceSummary} und ${draftInvoiceSummary}.`
        : "Angebote und Rechnungen waren für die aktuelle Rolle nicht prüfbar.",
      `${evidenceMonths.size} relevante Leistungsmonat(e) auf erforderliche Nachweise geprüft.`,
    ],
  };
}
