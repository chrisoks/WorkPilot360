import { Prisma, Role, TaskStatus } from "@prisma/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import { canManageProjectTimeEntries } from "@/lib/permissions";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  createJarvisDialogChoice,
  type JarvisDialogChoice,
} from "@/lib/jarvis/dialog";
import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";
import {
  analyzeJarvisQuestion,
  isJarvisTimeToInvoiceQuestion,
} from "@/lib/jarvis/question-semantics";
import {
  canAccessJarvisTask,
  getJarvisTaskActorWhere,
  type JarvisReadResponse,
} from "@/lib/jarvis/read-model";
import {
  authorizeJarvisQuestion,
  canAccessJarvisDataClass,
  type JarvisAccessProfile,
} from "@/lib/jarvis/security";
import {
  diagnoseProjectStamps,
  type StampDiagnosticResult,
} from "@/lib/jarvis/stamp-diagnostics";
import {
  diagnoseRecurringProjectMonths,
  type RecurringMonthDiagnosticResult,
} from "@/lib/jarvis/recurring-month-diagnostics";
import {
  diagnoseProjectProcess,
  type ProjectProcessDiagnosticResult,
} from "@/lib/jarvis/project-process-diagnostics";
import {
  analyzeProjectMaterials,
  type ProjectMaterialAnalysis,
  type ProjectMaterialInvoice,
} from "@/lib/jarvis/project-material-analysis";
import {
  analyzeProjectServiceRates,
  type ProjectServiceRateAnalysis,
  type ProjectServiceRateCatalogItem,
  type ProjectServiceRateInvoice,
} from "@/lib/jarvis/project-service-rate-analysis";
import {
  diagnoseJarvisProjectLogic,
  resolveJarvisProjectLogic,
} from "@/lib/jarvis/project-logic";
import { getJarvisProjectConsumptionGuidance } from "@/lib/jarvis/project-consumption-guidance";
import { getJarvisProjectServiceRateGuidance } from "@/lib/jarvis/project-service-rate-guidance";
import {
  resolveJarvisProjectDialogIntent,
  type JarvisProjectDialogIntent,
} from "@/lib/jarvis/project-dialog-intent";

type ProjectHealthSeverity = "critical" | "warning";

export type ProjectHealthIssue = {
  id: string;
  severity: ProjectHealthSeverity;
  area: string;
  title: string;
  evidence: string;
  recommendation: string;
};

type ProjectHealthRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  status: string;
  description: string | null;
  contactId: string | null;
  contactPersonId: string | null;
  addressContactId: string | null;
  objectAddressId: string | null;
  projectType: string | null;
  projectKind: string | null;
  projectRuntimeFrom: string | null;
  projectRuntimeUntil: string | null;
  billingInterval: string | null;
  recurringBillingMode: string | null;
  forecastBillingType: string | null;
  forecastNetAmount: string | null;
  trade: string | null;
  branch: string | null;
  volume: string | null;
  address: string | null;
  resolvedAddress?: string | null;
  responsibleName: string | null;
  timeBudgetEnabled: boolean;
  timeBudgetHours: string | null;
  timeBudgetAllocations: Prisma.JsonValue;
  autoBillingEnabled: boolean;
  autoBillingNetAmount: string | null;
  autoBillingStartMonth: string | null;
  autoBillingEndMonth: string | null;
  reviewStatus: string;
  reviewedAt: Date | null;
  reviewedByName: string | null;
  reviewedProjectStatus: string | null;
  updatedAt: Date;
};

export type ProjectHealthSnapshot = {
  project: ProjectHealthRow;
  stableCustomerReferenceValid?: boolean;
  timeEntryCount: number;
  manualOneTimeEntriesWithoutOffer: number;
  timeEntriesWithoutCostSnapshot?: number;
  futurePlanningCount: number;
  visibleOpenTaskCount?: number;
  visibleOverdueTaskCount?: number;
  offerCount?: number;
  invoiceCount?: number;
  draftInvoiceCount?: number;
  logbookEntryCount: number;
  evaluationDateKey: string;
  stampDiagnostics?: StampDiagnosticResult;
  recurringMonthDiagnostics?: RecurringMonthDiagnosticResult;
  processDiagnostics?: ProjectProcessDiagnosticResult;
  materialAnalysis?: ProjectMaterialAnalysis;
  serviceRateAnalysis?: ProjectServiceRateAnalysis;
  checkedAreas: string[];
  restrictedAreas: string[];
};

export type ProjectHealthEvaluation = {
  score: number;
  status: "healthy" | "attention" | "critical";
  issues: ProjectHealthIssue[];
  automationSummary: string[];
  areaAssessments: ProjectHealthAreaAssessment[];
};

type ProjectHealthAreaAssessment = {
  area: string;
  score: number;
  status: "healthy" | "attention" | "critical";
  criticalIssues: number;
  warningIssues: number;
};

const HEALTH_AREAS = {
  masterData: "Stammdaten & Verantwortung",
  planning: "Planung & Terminverknüpfungen",
  stamps: "Stempelungen, Zeitmathematik & Status",
  customer: "Kunden- & Objektverknüpfung",
  commercial: "Angebote, Rechnungen & Abrechnungsautomatik",
  recurring: "Dauerläufer-Monatskette",
  process: "Sollprozess & Leistungsnachweise",
  materials: "Material, Pakete & Lagerabgleich",
  tasks: "Aufgaben & Unterbrechungen",
  profitability: "Wirtschaftlichkeit & Kostensatzqualität",
} as const;

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type FocusedInvoiceRecord = {
  id: string;
  status: string;
  billingSource: string;
  plannedExecutionMonth: string;
  serviceDate: string;
  createdAt: Date;
};

type FocusedTimeEntryRecord = {
  date: string;
  durationMs: number | bigint;
  trade: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  invoiceId: string | null;
};

function getMonthKey(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 7);
  }
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return "";
  return new Date(Date.UTC(year, month - 1 + amount, 1))
    .toISOString()
    .slice(0, 7);
}

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function isFocusedInvoiceMonthQuestion(question: string) {
  const semantics = analyzeJarvisQuestion(question);
  return (
    semantics.explicitMonths.length === 1 &&
    semantics.answerDepth === "focused" &&
    (
      semantics.relation === "invoice_month" ||
      semantics.relation === "time_to_invoice"
    )
  );
}

function getFocusedInvoiceMonth(invoice: FocusedInvoiceRecord) {
  return (
    getMonthKey(invoice.serviceDate) ||
    getMonthKey(invoice.plannedExecutionMonth) ||
    getMonthKey(invoice.createdAt)
  );
}

function buildFocusedInvoiceMonthResponse(input: {
  question: string;
  project: ProjectHealthRow;
  invoices: FocusedInvoiceRecord[];
  timeEntries: FocusedTimeEntryRecord[];
}): JarvisReadResponse | undefined {
  if (!isFocusedInvoiceMonthQuestion(input.question)) return undefined;
  const semantics = analyzeJarvisQuestion(input.question);
  const monthKey = semantics.explicitMonths[0]?.key ?? "";
  const monthLabel = formatMonthKey(monthKey);
  const previousMonthKey = shiftMonth(monthKey, -1);
  const previousMonthLabel = formatMonthKey(previousMonthKey);
  const monthInvoices = input.invoices.filter(
    (invoice) => getFocusedInvoiceMonth(invoice) === monthKey
  );
  const draftInvoices = monthInvoices.filter(
    (invoice) => normalize(invoice.status) === "entwurf"
  );
  const finalInvoices = monthInvoices.filter(
    (invoice) => normalize(invoice.status) !== "entwurf"
  );
  const previousFinalInvoice = input.invoices.find(
    (invoice) =>
      getFocusedInvoiceMonth(invoice) === previousMonthKey &&
      normalize(invoice.status) !== "entwurf"
  );
  const monthlyFlat = input.project.recurringBillingMode === "monthlyFlat";
  const hourlyDraftOnMonthlyFlat = draftInvoices.some(
    (invoice) => invoice.billingSource === "hourly-recurring"
  ) && monthlyFlat;
  const autoBillingPeriodMissing =
    monthlyFlat &&
    input.project.autoBillingEnabled &&
    (!getMonthKey(input.project.autoBillingStartMonth) ||
      !getMonthKey(input.project.autoBillingEndMonth));
  const reference = input.project.projectNumber || input.project.title;
  const projectLabel = [reference, input.project.title]
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
    .join(" · ");

  if (isJarvisTimeToInvoiceQuestion(input.question)) {
    const monthEntries = input.timeEntries.filter(
      (entry) => getMonthKey(entry.date) === monthKey
    );
    const stampedHours =
      Math.round(
        monthEntries.reduce(
          (sum, entry) => sum + Math.max(0, Number(entry.durationMs) || 0),
          0
        ) / 36_000
      ) / 100;
    const entriesWithoutTrade = monthEntries.filter(
      (entry) => !entry.trade?.trim()
    ).length;
    const entriesWithoutBillingItem = monthEntries.filter(
      (entry) =>
        !entry.billingCatalogItemId?.trim() &&
        !entry.billingCatalogItemLabel?.trim()
    ).length;
    const linkedEntries = monthEntries.filter((entry) =>
      entry.invoiceId?.trim()
    ).length;
    const hourlyRecurring =
      input.project.recurringBillingMode === "hourly";
    const monthDrafts = monthInvoices.filter(
      (invoice) => normalize(invoice.status) === "entwurf"
    );
    const monthFinals = monthInvoices.filter(
      (invoice) => normalize(invoice.status) !== "entwurf"
    );
    const hoursLabel = `${new Intl.NumberFormat("de-DE", {
      maximumFractionDigits: 2,
    }).format(stampedHours)} Std.`;
    let timeSummary = "";
    let timeStatus = "";
    const timeFindings: string[] = [];
    let timeNextStep = "";

    if (!hourlyRecurring) {
      timeStatus = "Keine Stunden-Dauerläufer-Abrechnung";
      timeSummary =
        `${reference} ist nicht als Dauerläufer mit Stundenabrechnung eingerichtet. Deshalb erzeugen Stempelungen hier keinen monatlichen Rechnungsentwurf.`;
      timeFindings.push(
        monthEntries.length === 0
          ? `Für ${monthLabel} wurden außerdem keine Stempelungen gefunden.`
          : `Für ${monthLabel} wurden ${monthEntries.length} Stempelung/Stempelungen mit insgesamt ${hoursLabel} gefunden; die automatische Monatslogik für Stunden-Dauerläufer gilt für diese Projektart dennoch nicht.`
      );
      timeNextStep =
        `Prüfe zuerst in den Projektinformationen und im gültigen Angebot, ob ${reference} tatsächlich ein einmaliges Projekt bleiben soll. Ist das korrekt, erfolgt die Abrechnung über den Angebots- und Rechnungsweg des einmaligen Projekts. Ändere die Projektart nicht nur, um einen Entwurf zu erzwingen.`;
    } else if (monthFinals.length > 0) {
      timeStatus = "Fertige Rechnung vorhanden";
      timeSummary =
        `Für ${monthLabel} ist bereits eine fertige Rechnung vorhanden.`;
      timeFindings.push(
        `${linkedEntries} von ${monthEntries.length} Stempelung/Stempelungen sind mit einer Rechnung verknüpft.`
      );
      timeNextStep =
        `Öffne die Rechnung für ${monthLabel} und vergleiche die abgerechneten Leistungen mit den Stempelungen.`;
    } else if (monthDrafts.length > 0) {
      timeStatus = "Rechnungsentwurf vorhanden";
      timeSummary =
        `Für ${monthLabel} ist bereits ein Rechnungsentwurf vorhanden.`;
      timeFindings.push(
        `${linkedEntries} von ${monthEntries.length} Stempelung/Stempelungen sind mit einer Rechnung verknüpft.`
      );
      timeNextStep =
        `Öffne den vorhandenen Entwurf und prüfe Gewerk, Abrechnungsleistung und enthaltene Zeiten. Lege keinen zweiten Entwurf für denselben Monat an.`;
    } else if (monthEntries.length === 0) {
      timeStatus = "Keine Stempelungen vorhanden";
      timeSummary =
        `Für ${monthLabel} gibt es keine Stempelung. Deshalb konnte noch kein monatlicher Rechnungsentwurf aus Arbeitszeiten entstehen.`;
      timeNextStep =
        `Prüfe unter „Termine & Stempelungen“, ob im richtigen Monat und auf dem richtigen Projekt gearbeitet wurde. Lege keine Stempelung nur zum Auslösen einer Rechnung an.`;
    } else if (entriesWithoutTrade > 0 || entriesWithoutBillingItem > 0) {
      timeStatus = "Stempelungen nicht vollständig abrechenbar";
      timeSummary =
        `Für ${monthLabel} sind Stempelungen vorhanden, aber nicht alle enthalten die Angaben, die WorkPilot360 für den Rechnungsentwurf benötigt.`;
      if (entriesWithoutTrade > 0) {
        timeFindings.push(
          `${entriesWithoutTrade} Stempelung/Stempelungen haben kein Gewerk.`
        );
      }
      if (entriesWithoutBillingItem > 0) {
        timeFindings.push(
          `${entriesWithoutBillingItem} Stempelung/Stempelungen haben keine Abrechnungsleistung.`
        );
      }
      timeNextStep =
        `Öffne die betroffenen Einträge unter „Termine & Stempelungen“ und ergänze nur die fachlich richtige Zuordnung. Prüfe danach, ob der vorhandene Monatsentwurf aktualisiert wurde; lege keinen doppelten Entwurf an.`;
    } else {
      timeStatus = "Auslösung nicht nachvollziehbar";
      timeSummary =
        `Für ${monthLabel} sind ${monthEntries.length} abrechenbare Stempelung/Stempelungen mit insgesamt ${hoursLabel} vorhanden, aber es wurde kein Rechnungsentwurf gefunden.`;
      timeFindings.push(
        "Nach der vorgesehenen Dauerläuferlogik hätte bereits die erste passende Stempelung genau einen Monatsentwurf anlegen müssen."
      );
      timeNextStep =
        `Öffne „Termine & Stempelungen“ und prüfe die erste Stempelung des Monats sowie ihre Projekt-, Gewerk- und Abrechnungsleistungszuordnung. Erstelle nicht vorschnell manuell einen Entwurf, damit keine Doppelabrechnung entsteht.`;
    }

    return {
      type: "answer",
      topicId: "project.invoice.from-time",
      message: timeSummary,
      structured: {
        title: `Stempelungen & Rechnung ${monthLabel} · ${reference}`,
        subtitle: `${input.project.customer || "Ohne Kundenanzeige"} · ${input.project.status || "Ohne Status"}`,
        summary: timeSummary,
        facts: [
          { label: "Stempelungen", value: `${monthEntries.length} · ${hoursLabel}` },
          {
            label: "Stand",
            value: timeStatus,
            tone:
              monthFinals.length > 0 || monthDrafts.length > 0
                ? "positive"
                : "warning",
          },
        ],
        sections: [
          ...(timeFindings.length > 0
            ? [{
                title: "Festgestellt",
                items: timeFindings.slice(0, 2),
                tone: "warning" as const,
              }]
            : []),
          {
            title: "Nächster Schritt",
            items: [timeNextStep],
          },
        ],
      },
      records: [{
        id: `project-invoice-from-time-${input.project.id}-${monthKey}`,
        kind: "project",
        title: projectLabel,
        subtitle: input.project.customer || input.project.projectType || "Projekt",
        summary: `${monthLabel} · ${timeStatus}`,
        status: input.project.status,
        target: { kind: "project", id: input.project.id },
      }],
      deterministic: true,
    };
  }

  let summary = "";
  let status = "";
  const findings: string[] = [];
  let nextStep = "";

  if (finalInvoices.length > 0) {
    status = `Fertige Rechnung vorhanden (${finalInvoices[0].status})`;
    summary = `Für ${monthLabel} ist bereits eine fertige Rechnung vorhanden.`;
    findings.push(
      `Die gespeicherten Projektdaten widersprechen deshalb der Annahme, dass für diesen Monat keine fertige Rechnung existiert.`
    );
    nextStep =
      `Öffne im Projekt unter „Rechnungen“ die Rechnung für ${monthLabel} und prüfe dort Rechnungsnummer, Status und Leistungsmonat.`;
  } else if (draftInvoices.length > 0) {
    status =
      draftInvoices.length === 1
        ? "Entwurf vorhanden"
        : `${draftInvoices.length} Entwürfe vorhanden`;
    summary =
      `Für ${monthLabel} wurde bereits eine Rechnung angelegt, aber sie ist noch nicht fertiggestellt.`;
    findings.push(
      `Der vorhandene Rechnungsdatensatz steht weiterhin auf „Entwurf“. Ein gespeicherter Grund, warum er nicht fertiggestellt wurde, ist nicht vorhanden.`
    );
    if (hourlyDraftOnMonthlyFlat) {
      findings.push(
        `Der Entwurf wurde über die Stundenabrechnung erzeugt, obwohl ${reference} als Dauerläufer mit Monatspauschale eingerichtet ist. Diese Abrechnungsarten passen nicht zusammen.`
      );
    } else if (autoBillingPeriodMissing) {
      findings.push(
        "Die automatische Monatsabrechnung ist aktiviert, aber Start- und Endmonat sind nicht vollständig hinterlegt."
      );
    }
    nextStep =
      `Öffne im Projekt unter „Rechnungen“ den vorhandenen Entwurf für ${monthLabel}. Prüfe zuerst Angebot, Abrechnungsart und Positionen und stelle anschließend genau diesen Entwurf fertig. Lege keine zweite Rechnung für denselben Monat an.`;
  } else {
    status = "Keine aktive Rechnung vorhanden";
    summary = `Für ${monthLabel} wurde weder eine fertige Rechnung noch ein aktiver Entwurf gefunden.`;
    if (monthlyFlat && !input.project.autoBillingEnabled) {
      findings.push(
        "Die automatische Monatsabrechnung ist für dieses Projekt nicht aktiviert."
      );
    } else if (monthlyFlat && autoBillingPeriodMissing) {
      findings.push(
        "Die automatische Monatsabrechnung ist aktiviert, aber ihr Start- oder Endmonat fehlt. Dadurch ist nicht eindeutig festgelegt, für welche Monate sie laufen soll."
      );
    } else if (monthlyFlat && !previousFinalInvoice) {
      findings.push(
        `Für ${previousMonthLabel} fehlt ebenfalls eine fertige Rechnung. Ohne diese Vorlage darf WorkPilot360 die automatische Monatskette nicht überspringen.`
      );
    } else if (monthlyFlat && previousFinalInvoice) {
      findings.push(
        `Die fertige Rechnung für ${previousMonthLabel} ist als Vorlage vorhanden. Aus den gespeicherten Projektdaten ist jedoch kein ausgeführter oder fehlgeschlagener Rechnungslauf für ${monthLabel} ersichtlich.`
      );
    } else {
      findings.push(
        "Aus den gespeicherten Projektdaten ist kein genauer technischer oder organisatorischer Grund für die fehlende Rechnung ersichtlich."
      );
    }
    nextStep =
      `Öffne im Projekt unter „Rechnungen“ und prüfe zuerst den Vormonat sowie die Einstellungen der Abrechnung. Erstelle eine neue Rechnung erst, wenn ausgeschlossen ist, dass bereits ein Entwurf oder eine Abrechnung vorhanden ist.`;
  }

  return {
    type: "answer",
    topicId: "project.invoice.month",
    message: `${summary} ${findings[0] ?? ""}`.trim(),
    structured: {
      title: `Rechnung ${monthLabel} · ${reference}`,
      subtitle: `${input.project.customer || "Ohne Kundenanzeige"} · ${input.project.status || "Ohne Status"}`,
      summary,
      facts: [
        { label: "Rechnungsmonat", value: monthLabel },
        {
          label: "Stand",
          value: status,
          tone: finalInvoices.length > 0 ? "positive" : "warning",
        },
      ],
      sections: [
        {
          title: "Festgestellt",
          items: findings.slice(0, 2),
          tone: finalInvoices.length > 0 ? "positive" : "warning",
        },
        {
          title: "Nächster Schritt",
          items: [nextStep],
        },
      ],
    },
    records: [{
      id: `project-invoice-month-${input.project.id}-${monthKey}`,
      kind: "project",
      title: projectLabel,
      subtitle: input.project.customer || input.project.projectType || "Projekt",
      summary: `${monthLabel} · ${status}`,
      status: input.project.status,
      target: { kind: "project", id: input.project.id },
    }],
    deterministic: true,
  };
}

function formatMaterialQuantity(value: number, unit: string) {
  const quantity = new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value);
  return `${quantity} ${unit || "Einheiten"}`;
}

function buildFocusedProjectMaterialResponse(input: {
  question: string;
  project: ProjectHealthRow;
  analysis: ProjectMaterialAnalysis;
}): JarvisReadResponse | undefined {
  const semantics = analyzeJarvisQuestion(input.question);
  if (semantics.relation !== "project_materials") return undefined;
  const periodLabel =
    semantics.explicitMonths.length === 1
      ? semantics.explicitMonths[0].label
      : "Gesamtes Projekt";
  const asksForPhysicalConsumption =
    /\b(verbraucht|verbrauch|eingesetzt|verwendet|gebraucht)\w*\b/.test(
      semantics.normalized
    );
  const consumptionGuidance = getJarvisProjectConsumptionGuidance(input.project);
  const projectDataApproved = normalize(input.project.reviewStatus) === "approved";
  const projectTypeExplanation = projectDataApproved
    ? consumptionGuidance.explanation
    : `Das Projekt ist noch nicht fachlich freigegeben. Die aktuell gespeicherte Zuordnung lautet „${consumptionGuidance.projectTypeLabel}“, kann im Vor-Live-Bestand aber noch falsch sein. ${consumptionGuidance.explanation}`;

  const reference = input.project.projectNumber || input.project.title;
  const projectLabel = [reference, input.project.title]
    .filter(
      (value, index, values) =>
        Boolean(value) && values.indexOf(value) === index
    )
    .join(" · ");
  const materials = input.analysis.materials;
  const storedDataSummary =
    input.analysis.finalInvoiceCount === 0
      ? `Für ${reference} wurde noch keine fertige Rechnung gefunden. Deshalb kann JARVIS derzeit keine abgerechneten Materialmengen auswerten.`
      : materials.length === 0
        ? input.analysis.finalInvoiceCount === 1
          ? `Für ${reference} wurde eine fertige Rechnung ausgewertet. Darin wurde keine Materialposition gefunden.`
          : `Für ${reference} wurden ${input.analysis.finalInvoiceCount} fertige Rechnungen ausgewertet. Darin wurde keine Materialposition gefunden.`
        : `Für ${reference} wurden die fertigen Rechnungen positionsweise ausgewertet. Dabei ${materials.length === 1 ? "wurde eine Materialart" : `wurden ${materials.length} Materialarten`} gefunden.`;
  const summary = asksForPhysicalConsumption
    ? `Der tatsächliche physische Materialverbrauch bei ${reference} ist in WorkPilot360 mit den vorhandenen Rechnungs- und Lagerdaten nicht sicher belegt. ${storedDataSummary}`
    : storedDataSummary;
  const materialItems = materials.slice(0, 8).map((material) => {
    const sources = [
      material.directQuantity > 0
        ? `${formatMaterialQuantity(material.directQuantity, material.unit)} direkt`
        : "",
      material.packageQuantity > 0
        ? `${formatMaterialQuantity(material.packageQuantity, material.unit)} aus Paketen`
        : "",
    ].filter(Boolean);
    return `${material.title}: ${formatMaterialQuantity(material.quantity, material.unit)}${sources.length > 0 ? ` (${sources.join(", ")})` : ""}.`;
  });
  const inventoryStatus =
    input.analysis.inventoryComparedMaterialCount === 0
      ? "Kein belastbarer Vergleich"
      : input.analysis.inventoryMatchedMaterialCount ===
          input.analysis.inventoryComparedMaterialCount
        ? "Abgerechnete Mengen und Lagerbuchungen stimmen überein"
        : `${input.analysis.inventoryMatchedMaterialCount} von ${input.analysis.inventoryComparedMaterialCount} Materialarten stimmen überein`;
  const issueItems = input.analysis.issues
    .slice(0, 3)
    .map((issue) => `${issue.title}: ${issue.evidence}`);
  const nextStep =
    input.analysis.issues.length > 0
      ? "Öffne zuerst die genannten fertigen Rechnungen und vergleiche anschließend die Lagerbewegungshistorie der betroffenen Artikel. Korrigiere weder Rechnung noch Lagerbestand, bevor die Ursache der Abweichung geklärt ist."
      : "Wenn du den tatsächlichen physischen Verbrauch bewerten möchtest, muss dieser getrennt von Rechnung und automatischer Lagerentnahme nachvollziehbar erfasst sein.";

  return {
    type: "answer",
    topicId: "project.materials",
    message: summary,
    structured: {
      title: `Materialanalyse · ${reference}`,
      subtitle: `${input.project.customer || "Ohne Kundenanzeige"} · ${input.project.status || "Ohne Status"}`,
      summary,
      facts: [
        {
          label: "Zeitraum",
          value: periodLabel,
        },
        {
          label: "Projektart",
          value: consumptionGuidance.projectTypeLabel,
          tone:
            projectDataApproved && consumptionGuidance.projectTypeVerified
            ? "neutral"
            : "warning",
        },
        {
          label: "Projektdaten",
          value: projectDataApproved
            ? "Fachlich freigegeben"
            : "Noch nicht fachlich freigegeben",
          tone: projectDataApproved ? "positive" : "warning",
        },
        ...(asksForPhysicalConsumption
          ? [{
              label: "Physischer Verbrauch",
              value: "Nicht separat belegt",
              tone: "warning" as const,
            }]
          : []),
        {
          label: "Fertige Rechnungen",
          value: String(input.analysis.finalInvoiceCount),
        },
        {
          label: "Materialpositionen",
          value: String(input.analysis.materialPositionCount),
        },
        {
          label: "Lagerabgleich",
          value: inventoryStatus,
          tone:
            input.analysis.issues.some(
              (issue) => issue.id === "project-material-inventory-mismatch"
            )
              ? "warning"
              : "positive",
        },
      ],
      sections: [
        ...(materialItems.length > 0
          ? [{ title: "Abgerechnete Materialien", items: materialItems }]
          : []),
        ...(issueItems.length > 0
          ? [{
              title: "Danach prüfen",
              items: issueItems,
              tone: "warning" as const,
            }]
          : []),
        {
          title: "Datenbasis",
          items: [projectTypeExplanation, input.analysis.basisNote],
        },
        {
          title: "Nächster Schritt",
          items: [nextStep],
        },
      ],
    },
    records: [{
      id: `project-materials-${input.project.id}`,
      kind: "project",
      title: projectLabel,
      subtitle: input.project.customer || input.project.projectType || "Projekt",
      summary: `${materials.length} Materialarten · ${inventoryStatus}`,
      status: input.project.status,
      target: { kind: "project", id: input.project.id },
    }],
    deterministic: true,
  };
}

function formatServiceHours(value: number) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value)} Std.`;
}

function formatServiceEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildFocusedProjectServiceRateResponse(input: {
  question: string;
  project: ProjectHealthRow;
  analysis: ProjectServiceRateAnalysis;
}): JarvisReadResponse | undefined {
  const semantics = analyzeJarvisQuestion(input.question);
  if (semantics.relation !== "project_service_rates") return undefined;
  const periodLabel =
    semantics.explicitMonths.length === 1
      ? semantics.explicitMonths[0].label
      : "Gesamtes Projekt";

  const reference = input.project.projectNumber || input.project.title;
  const projectLabel = [reference, input.project.title]
    .filter(
      (value, index, values) =>
        Boolean(value) && values.indexOf(value) === index
    )
    .join(" · ");
  const services = input.analysis.services;
  const totalBilledHours = services.reduce(
    (sum, service) => sum + service.billedHours,
    0
  );
  const totalStampedHours = services.reduce(
    (sum, service) => sum + service.stampedHours,
    0
  );
  const sufficientServices = services.filter(
    (service) => service.recommendationBasisSufficient
  );
  const projectApproved = normalize(input.project.reviewStatus) === "approved";
  const serviceRateGuidance =
    getJarvisProjectServiceRateGuidance(input.project);
  const approvedServices = services.filter(
    (service) => service.catalogApproved
  );
  const storedRateSummary =
    input.analysis.finalInvoiceCount === 0
      ? `Für ${reference} wurde noch keine fertige Rechnung gefunden. Deshalb kann JARVIS noch keinen tatsächlich berechneten Stundenverrechnungssatz ermitteln.`
      : services.length === 0
        ? `Für ${reference} wurden fertige Rechnungen gefunden, aber keine eindeutig als Stundenleistung auswertbare Position.`
        : services.length === 1
          ? `Für ${reference} wurde eine Stundenleistung aus fertigen Rechnungen und eindeutig zugeordneten Stempelungen ausgewertet.`
          : `Für ${reference} wurden ${services.length} Stundenleistungen aus fertigen Rechnungen und eindeutig zugeordneten Stempelungen ausgewertet.`;
  const summary =
    serviceRateGuidance.hasContractualHourlyBilling
      ? storedRateSummary
      : `${serviceRateGuidance.explanation} ${storedRateSummary}`;
  const serviceItems = services.slice(0, 6).map((service) => {
    const parts = [
      `${formatServiceHours(service.billedHours)} abgerechnet`,
      `${formatServiceHours(service.stampedHours)} eindeutig gestempelt`,
      service.realizedBilledRate > 0
        ? serviceRateGuidance.hasContractualHourlyBilling
          ? `${formatServiceEuro(service.realizedBilledRate)} tatsächlich je abgerechneter Stunde berechnet`
          : `${formatServiceEuro(service.realizedBilledRate)} rechnerisch je gespeicherter Stundenkomponente`
        : "",
      service.revenuePerStampedHour > 0
        ? `${formatServiceEuro(service.revenuePerStampedHour)} Nettoerlös je gestempelter Stunde`
        : "",
      service.currentSalesRate > 0
        ? service.catalogApproved
          ? `${formatServiceEuro(service.currentSalesRate)} aktueller fachlich freigegebener Stammdatenpreis`
          : `${formatServiceEuro(service.currentSalesRate)} aktueller, noch nicht fachlich freigegebener Stammdatenpreis`
        : "",
      input.analysis.includeCosts &&
      service.costBasisComplete &&
      service.stampedHours > 0
        ? `${formatServiceEuro(service.laborCostPerStampedHour)} gespeicherte Mitarbeiterkosten je gestempelter Stunde`
        : "",
    ].filter(Boolean);
    return `${service.title}: ${parts.join("; ")}.`;
  });
  const issueItems = input.analysis.issues
    .slice(0, 4)
    .map((issue) => `${issue.title}: ${issue.evidence}`);
  const recommendation =
    services.length === 0
      ? "Prüfe, ob die abgerechneten Leistungen in „Artikel & Leistungen“ als Stundenleistungen gepflegt und die Rechnungspositionen mit diesen Leistungen verknüpft sind."
      : !serviceRateGuidance.projectTypeConfigured
        ? "Lege zuerst Projektart und Abrechnungsmodell in den Projektinformationen eindeutig fest. Bis dahin bestätigt JARVIS keinen projektartgerechten Stundensatz."
      : !serviceRateGuidance.hasContractualHourlyBilling
        ? "Bewerte die Monatspauschale nicht wie einen berechneten Stundenauftrag. Für eine belastbare Wirtschaftlichkeitsanalyse müssen der vollständige Monatsnettoerlös, alle zugehörigen Arbeitsstunden und die freigegebenen Kosten gemeinsam betrachtet werden."
      : !projectApproved
        ? "Die Projektdaten sind noch nicht fachlich freigegeben. JARVIS kann die vorhandenen Rechnungen und Zeiten zur Prüfung auswerten, leitet daraus aber noch keine Preisempfehlung ab. Prüfe zuerst die Projektart, den Abrechnungsweg und das gültige Angebot in der Projektakte."
      : approvedServices.length === 0
        ? "Keine ausgewertete Stundenleistung ist fachlich freigegeben. Prüfe zuerst die Leistung im Bereich „Artikel & Leistungen“. Bis dahin verwendet JARVIS den hinterlegten Stammdatenpreis nur als Prüfhinweis und nicht als Grundlage für eine Preisempfehlung."
      : sufficientServices.length === 0
        ? "Die Datenmenge reicht noch nicht für eine belastbare allgemeine Preisempfehlung. JARVIS nennt deshalb bewusst keinen erfundenen neuen Stundensatz. Sammle zunächst mehrere fertige Rechnungen mit mindestens zehn abgerechneten und eindeutig zugeordneten gestempelten Stunden."
        : input.analysis.issues.length > 0
          ? "Kläre zuerst die genannten Abweichungen bei Stunden, Preisen und Kosten. Erst danach sollte entschieden werden, ob der Stammdatenpreis erhöht, ein Rabatt korrigiert oder der Arbeitsablauf verbessert werden muss."
          : "Aus diesem Projekt ergibt sich derzeit kein belegter Grund für eine sofortige Preisänderung. Für eine allgemeine Empfehlung sollten zusätzlich weitere Projekte, Material-, Fahrzeug- und Gemeinkosten sowie ein festgelegtes Margenziel verglichen werden.";

  return {
    type: "answer",
    topicId: "project.service-rates",
    message: summary,
    structured: {
      title: `Leistungen & Stundenverrechnungssätze · ${reference}`,
      subtitle: `${input.project.customer || "Ohne Kundenanzeige"} · ${input.project.status || "Ohne Status"}`,
      summary,
      facts: [
        {
          label: "Zeitraum",
          value: periodLabel,
        },
        {
          label: "Projektart",
          value: serviceRateGuidance.projectTypeLabel,
          tone:
            projectApproved && serviceRateGuidance.projectTypeConfigured
              ? "neutral"
              : "warning",
        },
        {
          label: "Fertige Rechnungen",
          value: String(input.analysis.finalInvoiceCount),
        },
        {
          label: "Abgerechnete Stunden",
          value: formatServiceHours(totalBilledHours),
        },
        {
          label: "Zugeordnete Stempelstunden",
          value: formatServiceHours(totalStampedHours),
        },
        {
          label: "Projektdaten",
          value: projectApproved
            ? "Fachlich freigegeben"
            : "Noch nicht fachlich freigegeben",
          tone: projectApproved ? "positive" : "warning",
        },
        {
          label: "Freigegebene Leistungen",
          value: `${approvedServices.length} von ${services.length}`,
          tone:
            services.length > 0 && approvedServices.length === services.length
              ? "positive"
              : "warning",
        },
      ],
      sections: [
        ...(serviceItems.length > 0
          ? [{ title: "Ausgewertete Stundenleistungen", items: serviceItems }]
          : []),
        ...(issueItems.length > 0
          ? [{
              title: "Danach prüfen",
              items: issueItems,
              tone: "warning" as const,
            }]
          : []),
        {
          title: "Nächster Schritt",
          items: [recommendation, input.analysis.basisNote],
        },
      ],
    },
    records: [{
      id: `project-service-rates-${input.project.id}`,
      kind: "project",
      title: projectLabel,
      subtitle: input.project.customer || input.project.projectType || "Projekt",
      summary: `${services.length} Stundenleistungen · ${formatServiceHours(totalBilledHours)} abgerechnet`,
      status: input.project.status,
      target: { kind: "project", id: input.project.id },
    }],
    deterministic: true,
  };
}

function positiveNumber(value: string | null | undefined) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
}

function resolveIssueHealthArea(
  issue: ProjectHealthIssue,
  checkedAreas: string[]
) {
  const id = issue.id;
  const area = normalize(issue.area);
  const choose = (...candidates: string[]) =>
    candidates.find((candidate) => checkedAreas.includes(candidate));

  const resolved =
    (id === "cost-snapshot-missing" || area.includes("projektgewinn")
      ? choose(HEALTH_AREAS.profitability)
      : undefined) ??
    (id === "stamp-interruption-task-missing" ||
    id === "overdue-visible-tasks" ||
    area.includes("aufgabe") ||
    area.includes("unterbrech") ||
    area.includes("uberstunden")
      ? choose(HEALTH_AREAS.tasks)
      : undefined) ??
    (id.startsWith("recurring-") &&
    !id.includes("invoice") &&
    !id.includes("billing") &&
    !id.includes("runtime")
      ? choose(HEALTH_AREAS.recurring, HEALTH_AREAS.planning)
      : undefined) ??
    (area.includes("planung") || area.includes("vorausplanung")
      ? choose(HEALTH_AREAS.planning, HEALTH_AREAS.recurring)
      : undefined) ??
    (id.startsWith("stamp-") ||
    area.includes("stempel") ||
    area.includes("pause") ||
    area.includes("zeitberechnung") ||
    area.includes("doppelbuch") ||
    area.includes("zeituberschneid") ||
    area.includes("mitarbeiterzuordnung") ||
    area.includes("aktive stunden")
      ? choose(HEALTH_AREAS.stamps)
      : undefined) ??
    (id.startsWith("process-") ||
    id.startsWith("immocare-") ||
    area.includes("leistungsnachweis") ||
    area.includes("bildnachweis") ||
    area.includes("tatigkeitsbericht") ||
    area.includes("projektabschluss") ||
    area.includes("statusautomatik")
      ? choose(HEALTH_AREAS.process, HEALTH_AREAS.commercial)
      : undefined) ??
    (id.startsWith("project-material-") ||
    id.startsWith("project-package-material-") ||
    area.includes("material") ||
    area.includes("lager") ||
    area.includes("paket")
      ? choose(
          HEALTH_AREAS.materials,
          HEALTH_AREAS.commercial,
          HEALTH_AREAS.profitability
        )
      : undefined) ??
    (id.startsWith("service-rate-") ||
    area.includes("stundenverrechnung")
      ? choose(HEALTH_AREAS.profitability, HEALTH_AREAS.commercial)
      : undefined) ??
    (id.includes("offer") ||
    id.includes("invoice") ||
    id.includes("billing") ||
    id.startsWith("hourly-") ||
    area.includes("angebot") ||
    area.includes("abrechnung") ||
    area.includes("rechnung") ||
    area.includes("leistungszuordnung")
      ? choose(HEALTH_AREAS.commercial, HEALTH_AREAS.process)
      : undefined) ??
    (id.startsWith("customer-") ||
    id === "address-missing" ||
    area.includes("kundenzuordnung") ||
    area.includes("ausfuhrung")
      ? choose(HEALTH_AREAS.customer, HEALTH_AREAS.masterData)
      : undefined) ??
    (area.includes("laufzeit") && checkedAreas.includes(HEALTH_AREAS.recurring)
      ? HEALTH_AREAS.recurring
      : undefined) ??
    choose(HEALTH_AREAS.masterData);

  return resolved ?? checkedAreas[0];
}

function evaluateProjectHealthAreas(
  issues: ProjectHealthIssue[],
  checkedAreas: string[]
) {
  if (checkedAreas.length === 0) {
    return {
      score: 0,
      status: "critical" as const,
      areaAssessments: [] as ProjectHealthAreaAssessment[],
    };
  }

  const issuesByArea = new Map<string, ProjectHealthIssue[]>();
  for (const issue of issues) {
    const healthArea = resolveIssueHealthArea(issue, checkedAreas);
    if (!healthArea) continue;
    const areaIssues = issuesByArea.get(healthArea) ?? [];
    areaIssues.push(issue);
    issuesByArea.set(healthArea, areaIssues);
  }

  const areaAssessments = checkedAreas.map<ProjectHealthAreaAssessment>((area) => {
    const areaIssues = issuesByArea.get(area) ?? [];
    const criticalIssues = areaIssues.filter(
      (issue) => issue.severity === "critical"
    ).length;
    const warningIssues = areaIssues.length - criticalIssues;
    if (criticalIssues > 0) {
      return {
        area,
        score: Math.max(15, 30 - (criticalIssues - 1) * 5),
        status: "critical",
        criticalIssues,
        warningIssues,
      };
    }
    if (warningIssues > 0) {
      return {
        area,
        score: Math.max(55, 70 - (warningIssues - 1) * 5),
        status: "attention",
        criticalIssues,
        warningIssues,
      };
    }
    return {
      area,
      score: 100,
      status: "healthy",
      criticalIssues: 0,
      warningIssues: 0,
    };
  });

  const criticalAreas = areaAssessments.filter(
    (assessment) => assessment.status === "critical"
  ).length;
  const warningAreas = areaAssessments.filter(
    (assessment) => assessment.status === "attention"
  ).length;
  const status: ProjectHealthEvaluation["status"] =
    criticalAreas > 0
      ? "critical"
      : warningAreas > 0
        ? "attention"
        : "healthy";
  const averageScore = Math.round(
    areaAssessments.reduce((sum, assessment) => sum + assessment.score, 0) /
      areaAssessments.length
  );
  const score =
    criticalAreas === areaAssessments.length
      ? 0
      : status === "critical"
        ? Math.min(69, averageScore)
        : status === "attention"
          ? Math.min(89, averageScore)
          : 100;

  return { score, status, areaAssessments };
}

function getBerlinDateKey(value = new Date()) {
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

function isClosedProject(status: string) {
  const value = normalize(status);
  return value.includes("abgeschlossen") || value.includes("archiviert");
}

function isOperationalProject(status: string) {
  const value = normalize(status);
  return [
    "zur planung",
    "geplant",
    "umsetzung",
    "unterbrochen",
    "abrechnungsprufung",
    "zur abrechnung",
    "faktura",
  ].some((marker) => value.includes(marker));
}

function addIssue(
  issues: ProjectHealthIssue[],
  issue: ProjectHealthIssue,
  condition: boolean
) {
  if (condition) issues.push(issue);
}

export function resolveJarvisProjectHealthIntent(
  question: string,
  context?: JarvisSurfaceContext,
  conversationContext?: JarvisSurfaceContext
) {
  const value = normalize(question);
  const projectReference = extractProjectReference(question);
  const projectContext =
    context?.recordType === "project" ||
    conversationContext?.recordType === "project" ||
    Boolean(projectReference);
  if (
    resolveJarvisProjectDialogIntent({
      question,
      hasProjectContext: projectContext,
    })
  ) {
    return true;
  }
  const stampDiagnosticQuestion =
    projectContext &&
    /(stempel|zeiteintrag|stunden|rechnung)/.test(value) &&
    /(pruf|check|fehl|falsch|stimm|doppelt|uberschneid|warum)/.test(value);
  if (stampDiagnosticQuestion) return true;
  const referentialDiagnosticQuestion =
    projectContext &&
    /^(?:pruf|check|analysier|untersuch|kontrollier)\w*\s+(?:das|dies|dort|hier)\b/.test(
      value
    );
  if (referentialDiagnosticQuestion) return true;
  if (projectContext && resolveProjectHealthScope(question)) return true;
  if (
    projectReference &&
    /(pruf|check|analysier|untersuch|kontrollier)/.test(value)
  ) {
    return true;
  }
  if (projectReference && value.split(/\s+/).filter(Boolean).length <= 6) {
    return true;
  }
  if (!value.includes("projekt") && !value.includes("akte")) return false;
  return [
    /gesundheitscheck/,
    /projektcheck/,
    /projekt check/,
    /pruf.*projekt/,
    /check.*projekt/,
    /analysier.*projekt/,
    /was fehlt.*projekt/,
    /projekt.*was fehlt/,
    /projekt.*vollstandig/,
    /projekt.*datenqualitat/,
    /projekt.*auffallig/,
    /projekt.*verbesser/,
    /stimmt.*projekt.*nicht/,
  ].some((pattern) => pattern.test(value));
}

export function evaluateProjectHealth(
  snapshot: ProjectHealthSnapshot
): ProjectHealthEvaluation {
  const { project } = snapshot;
  const issues: ProjectHealthIssue[] = [];
  const projectLogic = diagnoseJarvisProjectLogic(project);
  const recurring = projectLogic.profile.isRecurring;
  const monthlyRecurring = projectLogic.profile.isMonthlyFlatRecurring;
  const operational = isOperationalProject(project.status);
  const closed = isClosedProject(project.status);
  const evaluationMonth = snapshot.evaluationDateKey.slice(0, 7);
  const recurringRuntimeEndMonth = project.projectRuntimeUntil?.slice(0, 7) ?? "";
  const recurringStillActive =
    !recurringRuntimeEndMonth || recurringRuntimeEndMonth >= evaluationMonth;
  const recurringNextMonthPlanningExplained =
    snapshot.recurringMonthDiagnostics?.issues.some((issue) =>
      [
        "recurring-next-month-underplanned",
        "recurring-next-month-unplanned",
      ].includes(issue.id)
    ) ?? false;
  const hasStableCustomerReference = Boolean(
    project.contactId || project.contactPersonId || project.addressContactId
  );
  issues.push(...projectLogic.issues);

  addIssue(issues, {
    id: "project-review-pending",
    severity: "warning",
    area: HEALTH_AREAS.masterData,
    title: "Die Projektdaten sind noch nicht fachlich freigegeben",
    evidence:
      normalize(project.reviewStatus) === "needs_review"
        ? "Das Projekt wurde als prüfbedürftig markiert oder wichtige Projektdaten wurden nach einer früheren Freigabe geändert. Deshalb müssen Projektart, Abrechnung, Kunde, Gewerk und Verantwortlichkeit fachlich kontrolliert werden."
        : "Dieses Projekt wurde noch nicht vollständig fachlich geprüft. Da WorkPilot360 noch vorbereitet und Altdaten übernommen werden, können scheinbar vollständig ausgefüllte Angaben trotzdem falsch sein.",
    recommendation:
      "Öffne die Projektinformationen und führe dort die fachliche Projektprüfung durch. Prüfe besonders Projektart, Abrechnungsmodell, Kunde, Gewerk, Niederlassung, Verantwortlichkeit und das gültige Angebot.",
  }, normalize(project.reviewStatus) !== "approved");

  addIssue(issues, {
    id: "customer-reference-missing",
    severity: "warning",
    area: "Kundenzuordnung",
    title: "Kunde ist nicht sicher mit dem Projekt verknüpft",
    evidence: project.customer
      ? `Im Projekt wird „${project.customer}“ angezeigt. Gespeichert ist aber nur der Name und keine eindeutige Verknüpfung zur Kundenakte. Dadurch kann JARVIS Projekte oder Auswertungen dem falschen Kunden zuordnen.`
      : "Im Projekt ist weder ein Kunde angezeigt noch eine eindeutige Verknüpfung zu einer Kundenakte gespeichert.",
    recommendation:
      "Öffne die Projektinformationen, wähle den richtigen Kunden erneut aus der Kundensuche aus und speichere das Projekt.",
  }, !hasStableCustomerReference);

  addIssue(issues, {
    id: "customer-reference-invalid",
    severity: "critical",
    area: "Kundenzuordnung",
    title: "Die verknüpfte Kundenakte wurde nicht gefunden",
    evidence: "Das Projekt verweist auf eine Kunden- oder Ansprechpartnerakte, die in diesem Unternehmensbereich nicht mehr vorhanden ist. Dadurch kann JARVIS die zugehörigen Kundeninformationen nicht zuverlässig zusammenführen.",
    recommendation:
      "Öffne die Projektinformationen, wähle den richtigen Kunden und gegebenenfalls den Ansprechpartner erneut aus und speichere die Zuordnung.",
  }, hasStableCustomerReference && snapshot.stableCustomerReferenceValid === false);

  addIssue(issues, {
    id: "project-company-type-missing",
    severity: "warning",
    area: "Projektlogik",
    title: "Unternehmensbereich des Projekts fehlt",
    evidence: "Es ist nicht eindeutig hinterlegt, ob das Projekt zu OK solutions oder OK immocare gehört. Davon hängen unter anderem Abläufe und erforderliche Nachweise ab.",
    recommendation: "Öffne die Projektinformationen und wähle dort den richtigen Unternehmensbereich aus.",
  }, !project.projectType && !project.branch);

  addIssue(issues, {
    id: "responsible-missing",
    severity: "warning",
    area: "Verantwortung",
    title: "Projektverantwortung fehlt",
    evidence: "Für das aktive Projekt ist keine verantwortliche Person hinterlegt.",
    recommendation: "Öffne die Projektinformationen und lege fest, wer für dieses Projekt verantwortlich ist.",
  }, !closed && !project.responsibleName);

  addIssue(issues, {
    id: "trade-missing",
    severity: "warning",
    area: "Ausführung",
    title: "Projektgewerk fehlt",
    evidence: "Das Projekt befindet sich bereits in der Planung oder Ausführung, aber es ist noch kein führendes Gewerk hinterlegt. Dadurch sind Planung und Leistungszuordnung nicht eindeutig.",
    recommendation: "Öffne die Projektinformationen und ergänze das Gewerk, das den Schwerpunkt des Projekts beschreibt.",
  }, operational && !project.trade);

  addIssue(issues, {
    id: "address-missing",
    severity: "warning",
    area: "Ausführung",
    title: "Ausführungsort ist nicht eindeutig",
    evidence: "Im Projekt ist keine Objekt- oder Projektadresse hinterlegt. Mitarbeitende können dadurch nicht eindeutig erkennen, wo die Leistung ausgeführt werden soll.",
    recommendation: "Wähle in den Projektinformationen eine vorhandene Objektadresse aus oder ergänze die vollständige Einsatzadresse.",
  }, operational && !project.objectAddressId && !project.address);

  addIssue(issues, {
    id: "one-time-offer-link-missing",
    severity: "critical",
    area: "Leistungszuordnung",
    title: "Manuelle Zeiten ohne Angebotszuweisung",
    evidence: `${snapshot.manualOneTimeEntriesWithoutOffer} manuell erfasste Zeiteintragung/Zeiteintragungen sind keinem Angebot dieses Projekts zugeordnet. Dadurch ist nicht nachvollziehbar, zu welcher vereinbarten Leistung die Arbeitszeit gehört.`,
    recommendation: "Öffne im Projekt „Termine & Stempelungen“ und wähle bei den betroffenen manuellen Zeiteinträgen das passende gültige Angebot aus.",
  }, !recurring && snapshot.manualOneTimeEntriesWithoutOffer > 0);

  addIssue(issues, {
    id: "cost-snapshot-missing",
    severity: "warning",
    area: "Projektgewinn",
    title: "Für die Berechnung des Projektgewinns fehlen Kosten",
    evidence: `Bei ${snapshot.timeEntriesWithoutCostSnapshot} Zeiteintrag/Zeiteinträgen wurde kein Mitarbeiterkostensatz zum Zeitpunkt der Arbeit gespeichert. Der angezeigte Projektgewinn kann deshalb zu hoch oder unvollständig sein.`,
    recommendation:
      "Prüfe die betroffenen Stempelungen und den damals gültigen Mitarbeiterkostensatz. Übernimm aktuelle Kostensätze nicht ungeprüft rückwirkend, weil dies historische Auswertungen verfälschen kann.",
  }, typeof snapshot.timeEntriesWithoutCostSnapshot === "number" && snapshot.timeEntriesWithoutCostSnapshot > 0);

  addIssue(issues, {
    id: "time-budget-invalid",
    severity: "warning",
    area: "Zeitbudget",
    title: "Zeitbudget ist aktiviert, aber es fehlen Budgetstunden",
    evidence: "Die Überwachung des Zeitbudgets ist eingeschaltet, obwohl keine nutzbare Gesamtstundenzahl hinterlegt ist. WorkPilot360 kann deshalb nicht zuverlässig vor einer Überschreitung warnen.",
    recommendation: "Trage in den Projektinformationen die vereinbarten Budgetstunden ein oder deaktiviere die Zeitbudget-Überwachung bewusst.",
  }, project.timeBudgetEnabled && !positiveNumber(project.timeBudgetHours));

  addIssue(issues, {
    id: "auto-billing-amount-invalid",
    severity: "critical",
    area: "Abrechnungsautomatik",
    title: "Der automatischen Monatsrechnung fehlt der Rechnungsbetrag",
    evidence: "Die automatische Abrechnung der Monatspauschale ist aktiviert, aber der Nettobetrag ist leer oder 0 Euro. Die nächste Monatsrechnung könnte dadurch falsch oder gar nicht erstellt werden.",
    recommendation: "Prüfe im Projekt die Einstellungen der automatischen Abrechnung, den vereinbarten Nettobetrag und die Rechnungsvorlage, bevor der nächste Abrechnungslauf startet.",
  }, monthlyRecurring && project.autoBillingEnabled && !positiveNumber(project.autoBillingNetAmount));

  addIssue(issues, {
    id: "auto-billing-period-missing",
    severity: "warning",
    area: "Abrechnungsautomatik",
    title: "Zeitraum für die automatischen Monatsrechnungen fehlt",
    evidence: "Für die automatische Abrechnung der Monatspauschale fehlt der Start- oder Endmonat. Dadurch ist nicht eindeutig, für welche Monate Rechnungen erzeugt werden dürfen.",
    recommendation: "Ergänze in den Projekteinstellungen Start- und Endmonat der automatischen Abrechnung passend zur vereinbarten Projektlaufzeit.",
  }, monthlyRecurring && project.autoBillingEnabled &&
    (!project.autoBillingStartMonth || !project.autoBillingEndMonth));

  addIssue(issues, {
    id: "planned-without-planning",
    severity: "warning",
    area: "Planung",
    title: "Projektstatus und Terminplanung passen nicht zusammen",
    evidence: "Der Projektstatus lautet „Geplant“, aber es ist kein zukünftiger Termin vorhanden. Mitarbeitende können daher nicht erkennen, wann und durch wen die nächste Leistung ausgeführt werden soll.",
    recommendation: "Öffne „Termine & Stempelungen“ und plane den nächsten Einsatz. Falls noch kein Termin vereinbart ist, korrigiere den Projektstatus passend zum tatsächlichen Stand.",
  }, normalize(project.status) === "geplant" && snapshot.futurePlanningCount === 0);

  addIssue(issues, {
    id: "recurring-without-future-planning",
    severity: "warning",
    area: "Planung",
    title: "Für den laufenden Dauerläufer ist kein nächster Einsatz geplant",
    evidence:
      "Die Projektlaufzeit ist noch nicht beendet, aber es wurde kein zukünftiger Termin gefunden. Dadurch ist offen, wann die nächste vereinbarte Leistung ausgeführt wird.",
    recommendation:
      "Prüfe unter „Termine & Stempelungen“ den nächsten Leistungsmonat und plane die benötigten Einsätze. Wird die Leistung nur bei Bedarf abgerufen, dokumentiere nachvollziehbar, warum aktuell kein Termin erforderlich ist.",
  }, recurring &&
    !closed &&
    recurringStillActive &&
    snapshot.futurePlanningCount === 0 &&
    !recurringNextMonthPlanningExplained);

  addIssue(issues, {
    id: "offer-status-without-offer",
    severity: "warning",
    area: "Angebot",
    title: "Projekt steht auf „Angebot“, aber es ist kein Angebot vorhanden",
    evidence: "Der Projektstatus zeigt die Angebotsphase, im Projekt wurde jedoch kein vorhandenes Angebot gefunden. Dadurch fehlt die Grundlage für die vereinbarten Leistungen.",
    recommendation: "Öffne im Projekt „Angebote“ und lege das richtige Angebot an. Falls die Angebotsphase bereits abgeschlossen ist, stelle den Projektstatus auf den tatsächlichen Stand.",
  }, normalize(project.status) === "angebot" && snapshot.offerCount === 0);

  addIssue(issues, {
    id: "billing-check-without-draft",
    severity: "warning",
    area: "Abrechnung",
    title: "Projekt steht in der Abrechnungsprüfung, aber ein Rechnungsentwurf fehlt",
    evidence: "Der Projektstatus zeigt, dass die Abrechnung geprüft werden soll. Im Projekt ist jedoch noch kein Rechnungsentwurf vorhanden, der geprüft werden könnte.",
    recommendation: "Prüfe zuerst Angebot, ausgeführte Leistungen und erforderliche Nachweise. Lege anschließend unter „Rechnungen“ den passenden Rechnungsentwurf an.",
  }, normalize(project.status).includes("abrechnungsprufung") &&
    snapshot.invoiceCount !== undefined &&
    snapshot.draftInvoiceCount === 0);

  addIssue(issues, {
    id: "overdue-visible-tasks",
    severity: "warning",
    area: "Aufgaben",
    title: "Überfällige Projektaufgaben sind offen",
    evidence: `${snapshot.visibleOverdueTaskCount} für dich sichtbare Projektaufgabe/Projektaufgaben haben ihr Fälligkeitsdatum überschritten und sind noch nicht erledigt.`,
    recommendation: "Öffne die betroffenen Aufgaben und kläre jeweils die verantwortliche Person, einen realistischen Termin und den nächsten konkreten Arbeitsschritt.",
  }, typeof snapshot.visibleOverdueTaskCount === "number" && snapshot.visibleOverdueTaskCount > 0);

  for (const stampIssue of snapshot.stampDiagnostics?.issues ?? []) {
    if (!issues.some((issue) => issue.id === stampIssue.id)) {
      issues.push(stampIssue);
    }
  }
  for (const monthIssue of snapshot.recurringMonthDiagnostics?.issues ?? []) {
    if (!issues.some((issue) => issue.id === monthIssue.id)) {
      issues.push(monthIssue);
    }
  }
  for (const processIssue of snapshot.processDiagnostics?.issues ?? []) {
    if (!issues.some((issue) => issue.id === processIssue.id)) {
      issues.push(processIssue);
    }
  }
  for (const materialIssue of snapshot.materialAnalysis?.issues ?? []) {
    if (!issues.some((issue) => issue.id === materialIssue.id)) {
      issues.push(materialIssue);
    }
  }
  for (const serviceRateIssue of snapshot.serviceRateAnalysis?.issues ?? []) {
    if (!issues.some((issue) => issue.id === serviceRateIssue.id)) {
      issues.push(serviceRateIssue);
    }
  }

  const areaEvaluation = evaluateProjectHealthAreas(
    issues,
    snapshot.checkedAreas
  );
  const automationSummary = [...projectLogic.profile.processSummary];
  if (monthlyRecurring) {
    automationSummary.push(
      project.autoBillingEnabled
        ? "Die automatische Pauschalabrechnung ist für dieses Projekt aktiviert."
        : "Die automatische Pauschalabrechnung ist für dieses Projekt nicht aktiviert."
    );
  }
  automationSummary.push(...(snapshot.recurringMonthDiagnostics?.summary ?? []));
  automationSummary.push(...(snapshot.processDiagnostics?.summary ?? []));

  return { ...areaEvaluation, issues, automationSummary };
}

function extractProjectReference(question: string) {
  const candidates = question.match(
    /\b(?:[\p{L}]{2,}-\d+|[A-ZÄÖÜ]{2,}\s+\d+|\d{5,})\b/gu
  );
  return candidates?.[0]?.trim() ?? "";
}

function refersToCurrentProjectSurface(question: string) {
  const value = normalize(question);
  return (
    /dies(?:es|em) projekt/.test(value) ||
    /aktuell geoffnete[sn]? projekt/.test(value) ||
    /projekt hier/.test(value)
  );
}

type ProjectHealthScope =
  | "full"
  | "stamps"
  | "planning"
  | "tasks"
  | "commercial"
  | "automation"
  | "improvements";

function resolveProjectHealthScope(question: string): ProjectHealthScope | undefined {
  const scopes = analyzeJarvisQuestion(question).projectScopes;
  return scopes.length === 1 ? scopes[0] : undefined;
}

const PROJECT_HEALTH_SCOPE_LABELS: Record<ProjectHealthScope, string> = {
  full: "Vollständiger Projektcheck",
  stamps: "Stempelungen & Arbeitszeiten",
  planning: "Planung & Termine",
  tasks: "Aufgaben & offene Punkte",
  commercial: "Angebote & Rechnungen",
  automation: "Automatik & Zusammenhänge",
  improvements: "Auffälligkeiten & Verbesserungen",
};

function scopeProjectHealthEvaluation(
  evaluation: ProjectHealthEvaluation,
  snapshot: ProjectHealthSnapshot,
  scope: ProjectHealthScope
): ProjectHealthEvaluation {
  if (scope === "full" || scope === "improvements") return evaluation;
  const stampIssueIds = new Set(
    snapshot.stampDiagnostics?.issues.map((issue) => issue.id) ?? []
  );
  const processIssueIds = new Set(
    snapshot.processDiagnostics?.issues.map((issue) => issue.id) ?? []
  );
  const materialIssueIds = new Set(
    snapshot.materialAnalysis?.issues.map((issue) => issue.id) ?? []
  );
  const serviceRateIssueIds = new Set(
    snapshot.serviceRateAnalysis?.issues.map((issue) => issue.id) ?? []
  );
  const issues = evaluation.issues.filter((issue) => {
    const issueArea = normalize(issue.area);
    if (scope === "stamps") {
      return (
        stampIssueIds.has(issue.id) ||
        [
          "one-time-offer-link-missing",
          "cost-snapshot-missing",
          "time-budget-invalid",
        ].includes(issue.id)
      );
    }
    if (scope === "planning") {
      return (
        issueArea.includes("planung") ||
        issueArea.includes("laufzeit") ||
        issue.id === "time-budget-invalid"
      );
    }
    if (scope === "tasks") {
      return (
        issueArea.includes("aufgabe") ||
        issueArea.includes("unterbrech") ||
        issueArea.includes("uberstunden")
      );
    }
    if (scope === "commercial") {
      return (
        processIssueIds.has(issue.id) ||
        materialIssueIds.has(issue.id) ||
        serviceRateIssueIds.has(issue.id) ||
        issueArea.includes("angebot") ||
        issueArea.includes("abrechnung") ||
        issueArea.includes("rechnung") ||
        issueArea.includes("leistungszuordnung") ||
        issueArea.includes("projektgewinn")
      );
    }
    return (
      [
        "invoice-source-project-type-conflict",
        "one-time-final-invoice-status-open",
        "recurring-runtime-ended-status-open",
      ].includes(issue.id) ||
      issueArea.includes("automatik") ||
      issueArea.includes("projektlogik") ||
      issueArea.includes("laufzeit") ||
      issueArea.includes("stapelabrechnung")
    );
  });
  const areaEvaluation = evaluateProjectHealthAreas(
    issues,
    checkedAreasForScope(snapshot, scope)
  );
  return {
    ...evaluation,
    issues,
    ...areaEvaluation,
  };
}

function checkedAreasForScope(snapshot: ProjectHealthSnapshot, scope: ProjectHealthScope) {
  if (scope === "full" || scope === "improvements") return snapshot.checkedAreas;
  const markers: Record<Exclude<ProjectHealthScope, "full" | "improvements">, string[]> = {
    stamps: ["Stempelungen", "Wirtschaftlichkeit"],
    planning: ["Planung", "Dauerläufer-Monatskette"],
    tasks: ["Aufgaben"],
    commercial: [
      "Angebote",
      "Kunden-",
      "Dauerläufer-Monatskette",
      "Material",
    ],
    automation: ["Stammdaten", "Dauerläufer-Monatskette"],
  };
  if (scope === "commercial" || scope === "automation") {
    markers[scope].push("Sollprozess");
  }
  return snapshot.checkedAreas.filter((area) =>
    markers[scope].some((marker) => area.includes(marker))
  );
}

function getProjectDialogIntent(
  question: string,
  context?: JarvisSurfaceContext,
  conversationContext?: JarvisSurfaceContext
) {
  return resolveJarvisProjectDialogIntent({
    question,
    hasProjectContext:
      Boolean(extractProjectReference(question)) ||
      context?.recordType === "project" ||
      conversationContext?.recordType === "project",
  });
}

function getProjectBillingLabel(
  variant: ReturnType<typeof resolveJarvisProjectLogic>["variant"]
) {
  if (variant === "oneTime") return "Projektbezogene Schlussrechnung";
  if (variant === "recurringMonthlyFlat") return "Monatspauschale";
  if (variant === "recurringHourly") return "Stundenabrechnung";
  return "Nicht eindeutig gepflegt";
}

function formatProjectFactDate(value: Date | null) {
  if (!value) return "Nicht dokumentiert";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatProjectVolume(value: string | null) {
  if (!value?.trim()) return "Nicht hinterlegt";
  const numeric = value.replace(/[^\d,.-]/g, "");
  const parsed = Number(
    numeric.includes(",")
      ? numeric.replace(/\./g, "").replace(",", ".")
      : numeric
  );
  if (!Number.isFinite(parsed)) return value;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(parsed);
}

function buildProjectFactExplanation(
  project: ProjectHealthRow,
  intent:
    | "explainIdentity"
    | "explainTitle"
    | "explainCustomer"
    | "explainAddress"
    | "explainTrade"
    | "explainBranch"
    | "explainVolume"
    | "explainStatus"
    | "explainResponsibility"
    | "explainReviewStatus"
    | "explainLastChange"
): JarvisReadResponse {
  const reference = project.projectNumber || project.title;
  const reviewLabel =
    normalize(project.reviewStatus) === "approved"
      ? "Fachlich freigegeben"
      : normalize(project.reviewStatus) === "needs_review"
        ? "Prüfung notwendig"
        : "Noch nicht fachlich geprüft";
  const facts = {
    explainIdentity: {
      title: "Projektnummer",
      value: project.projectNumber || "Nicht hinterlegt",
      message: project.projectNumber
        ? `Die Projektnummer des geöffneten Projekts lautet ${project.projectNumber}.`
        : "Für das geöffnete Projekt ist keine Projektnummer hinterlegt.",
    },
    explainTitle: {
      title: "Projektname",
      value: project.title || "Nicht hinterlegt",
      message: project.title
        ? `Das geöffnete Projekt heißt „${project.title}“.`
        : "Für das geöffnete Projekt ist kein Projektname hinterlegt.",
    },
    explainCustomer: {
      title: "Projektkunde",
      value: project.customer || "Nicht hinterlegt",
      message: project.customer
        ? `${project.customer} ist als Kunde von ${reference} hinterlegt.`
        : `Für ${reference} ist aktuell kein Kunde hinterlegt.`,
    },
    explainAddress: {
      title: "Projektadresse",
      value: project.resolvedAddress || project.address || "Nicht hinterlegt",
      message: project.resolvedAddress || project.address
        ? `Für ${reference} ist die Projektadresse „${project.resolvedAddress || project.address}“ hinterlegt.`
        : `Für ${reference} ist aktuell keine Projektadresse hinterlegt.`,
    },
    explainTrade: {
      title: "Gewerk",
      value: project.trade || "Nicht hinterlegt",
      message: project.trade
        ? `Für ${reference} ist das Gewerk „${project.trade}“ hinterlegt.`
        : `Für ${reference} ist aktuell kein Gewerk hinterlegt.`,
    },
    explainBranch: {
      title: "Niederlassung",
      value: project.branch || "Nicht hinterlegt",
      message: project.branch
        ? `Für ${reference} ist die Niederlassung „${project.branch}“ hinterlegt.`
        : `Für ${reference} ist aktuell keine Niederlassung hinterlegt.`,
    },
    explainVolume: {
      title: "Projektvolumen",
      value: formatProjectVolume(project.volume),
      message: project.volume?.trim()
        ? `Für ${reference} ist ein Projektvolumen von ${formatProjectVolume(project.volume)} hinterlegt.`
        : `Für ${reference} ist aktuell kein Projektvolumen hinterlegt.`,
    },
    explainStatus: {
      title: "Projektstatus",
      value: project.status || "Nicht gepflegt",
      message: `${reference} hat aktuell den Projektstatus „${project.status || "Nicht gepflegt"}“.`,
    },
    explainResponsibility: {
      title: "Projektverantwortung",
      value: project.responsibleName || "Nicht hinterlegt",
      message: project.responsibleName
        ? `Für ${reference} ist ${project.responsibleName} als projektverantwortliche Person hinterlegt.`
        : `Für ${reference} ist aktuell keine projektverantwortliche Person hinterlegt.`,
    },
    explainReviewStatus: {
      title: "Fachlicher Prüfstand",
      value: reviewLabel,
      message:
        normalize(project.reviewStatus) === "approved"
          ? `${reference} ist fachlich freigegeben.`
          : `${reference} ist ${reviewLabel.toLocaleLowerCase("de-DE")}. Die vorhandenen Projektdaten sind deshalb noch keine bestätigte Sollwahrheit.`,
    },
    explainLastChange: {
      title: "Letzte gespeicherte Änderung",
      value: formatProjectFactDate(project.updatedAt),
      message: `${reference} wurde zuletzt am ${formatProjectFactDate(project.updatedAt)} gespeichert. Der genaue geänderte Inhalt lässt sich aus diesem Zeitstempel allein nicht sicher ableiten; dafür muss das Logbuch geprüft werden.`,
    },
  } as const;
  const fact = facts[intent];
  return {
    type: "answer",
    topicId: `project.fact.${intent}`,
    message: fact.message,
    structured: {
      title: `${fact.title} · ${reference}`,
      subtitle: project.customer || "Ohne Kundenanzeige",
      facts: [{ label: fact.title, value: fact.value }],
    },
    records: [{
      id: `project-fact-${project.id}`,
      kind: "project",
      title: [project.projectNumber, project.title].filter(Boolean).join(" · "),
      subtitle: project.customer || "Projekt",
      summary: fact.value,
      status: project.status,
      target: { kind: "project", id: project.id },
    }],
    deterministic: true,
  };
}

function buildProjectOverviewExplanation(
  project: ProjectHealthRow
): JarvisReadResponse {
  const reference = [project.projectNumber, project.title]
    .filter(Boolean)
    .join(" · ");
  const address = project.resolvedAddress || project.address;
  const details = [
    project.customer ? `Kunde: ${project.customer}` : "Kunde: nicht hinterlegt",
    `Status: ${project.status || "nicht gepflegt"}`,
    project.projectType
      ? `Projektart: ${project.projectType}`
      : "Projektart: nicht eindeutig gepflegt",
    project.trade ? `Gewerk: ${project.trade}` : "Gewerk: nicht hinterlegt",
    project.responsibleName
      ? `Verantwortlich: ${project.responsibleName}`
      : "Verantwortung: nicht hinterlegt",
    address ? `Adresse: ${address}` : "Adresse: nicht hinterlegt",
  ];
  return {
    type: "answer",
    topicId: "project.overview",
    message: `${reference} ist das aktuell geöffnete Projekt. ${details.join(
      ". "
    )}. Für eine Qualitäts- oder Risikobewertung muss ich das Projekt zusätzlich gezielt prüfen.`,
    deterministic: true,
  };
}

function buildProjectLogicExplanation(
  project: ProjectHealthRow,
  intent: "explainProjectType" | "explainBilling" | "explainProcess"
): JarvisReadResponse {
  const diagnosis = diagnoseJarvisProjectLogic(project);
  const profile = diagnosis.profile;
  const reference = project.projectNumber || project.title;
  const focus =
    intent === "explainProjectType"
      ? "Projektart"
      : intent === "explainBilling"
        ? "Abrechnung"
        : "Sollprozess";
  const summary =
    profile.variant === "unknown" || profile.variant === "recurringUnknown"
      ? `${reference} ist noch nicht eindeutig genug konfiguriert, um Projektart und Abrechnungslogik vollständig festzulegen.`
      : `${reference} ist als „${profile.label}“ konfiguriert.`;

  return {
    type: "answer",
    topicId: "project.logic.explanation",
    message: `${summary} Bewertet wird ${
      profile.evaluationScope === "month"
        ? "jeder Leistungsmonat"
        : profile.evaluationScope === "project"
          ? "das Gesamtprojekt"
          : "erst nach eindeutiger Pflege"
    }.`,
    structured: {
      title: `${focus} · ${reference}`,
      subtitle: `${project.customer || "Ohne Kundenanzeige"} · ${project.status || "Ohne Status"}`,
      summary,
      facts: [
        {
          label: "Projektart",
          value: profile.label,
          tone:
            profile.variant === "unknown" ||
            profile.variant === "recurringUnknown"
              ? "warning"
              : "positive",
        },
        {
          label: "Abrechnung",
          value: getProjectBillingLabel(profile.variant),
        },
        {
          label: "Bewertung",
          value:
            profile.evaluationScope === "month"
              ? "Monatsbezogen"
              : profile.evaluationScope === "project"
                ? "Gesamtprojekt"
                : "Noch nicht eindeutig",
        },
        {
          label: "Status",
          value: project.status || "Nicht gepflegt",
        },
      ],
      sections: [
        {
          title: "So funktioniert dieses Projekt",
          items: profile.processSummary,
          tone:
            diagnosis.issues.length > 0 ? "neutral" : "positive",
        },
        ...(diagnosis.issues.length > 0
          ? [{
              title: "Konfiguration prüfen",
              tone: "warning" as const,
              items: diagnosis.issues.map(
                (issue) =>
                  `${issue.title}: ${issue.evidence} Nächster Schritt: ${issue.recommendation}`
              ),
            }]
          : []),
      ],
    },
    records: [{
      id: `project-logic-${project.id}`,
      kind: "project",
      title: [project.projectNumber, project.title].filter(Boolean).join(" · "),
      subtitle: project.customer || project.projectType || "Projekt",
      summary: `${profile.label} · ${project.status || "Ohne Status"}`,
      status: project.status,
      target: { kind: "project", id: project.id },
    }],
    deterministic: true,
  };
}

function buildProjectHealthClarification(
  project: ProjectHealthRow,
  accessProfile: JarvisAccessProfile
): JarvisReadResponse {
  const reference = project.projectNumber || project.title;
  const choices: JarvisDialogChoice[] = [
    createJarvisDialogChoice(
      `project-logic-explain-${project.id}`,
      "Projektart & Abrechnung",
      `Erkläre Projektart, Abrechnung und Sollprozess für ${reference}.`
    ),
    createJarvisDialogChoice(
      `project-health-full-${project.id}`,
      "Vollständiger Projektcheck",
      `Führe den vollständigen Projekt-Gesundheitscheck für ${reference} aus.`
    ),
    createJarvisDialogChoice(
      `project-health-stamps-${project.id}`,
      "Stempelungen & Arbeitszeiten",
      `Prüfe Stempelungen und Arbeitszeiten für ${reference}.`
    ),
    createJarvisDialogChoice(
      `project-health-planning-${project.id}`,
      "Planung & Termine",
      `Prüfe Planung und Termine für ${reference}.`
    ),
  ];

  if (getJarvisActionDecision("task.read", accessProfile).executable) {
    choices.push(
      createJarvisDialogChoice(
        `project-health-tasks-${project.id}`,
        "Aufgaben & offene Punkte",
        `Prüfe Aufgaben und offene Punkte für ${reference}.`
      )
    );
  }
  const canReadOffers = getJarvisActionDecision("offer.read", accessProfile).executable;
  const canReadInvoices = getJarvisActionDecision("invoice.read", accessProfile).executable;
  if (canReadOffers || canReadInvoices) {
    const commercialLabel =
      canReadOffers && canReadInvoices
        ? "Angebote & Rechnungen"
        : canReadOffers
          ? "Angebote"
          : "Rechnungen";
    choices.push(
      createJarvisDialogChoice(
        `project-health-commercial-${project.id}`,
        commercialLabel,
        `Prüfe ${commercialLabel.toLowerCase()} für ${reference}.`
      )
    );
  }
  choices.push(
    createJarvisDialogChoice(
      `project-health-automation-${project.id}`,
      "Automatik & Zusammenhänge",
      `Prüfe und erkläre Automatik und Zusammenhänge für ${reference}.`
    ),
    createJarvisDialogChoice(
      `project-health-improvements-${project.id}`,
      "Auffälligkeiten & Verbesserungen",
      `Prüfe Auffälligkeiten und Verbesserungspotenzial für ${reference}.`
    )
  );

  return {
    type: "clarification",
    topicId: "project.health.clarification",
    message: `Ich habe ${reference} eindeutig gefunden. Was möchtest du zu diesem Projekt wissen oder prüfen?`,
    choices,
    records: [{
      id: `project-health-choice-${project.id}`,
      kind: "project",
      title: [project.projectNumber, project.title].filter(Boolean).join(" · "),
      subtitle: project.customer || project.projectType || "Projekt",
      summary: project.status,
      status: project.status,
      target: { kind: "project", id: project.id },
    }],
    deterministic: true,
  };
}

async function findProject(
  organizationId: string,
  question: string,
  context?: JarvisSurfaceContext,
  conversationContext?: JarvisSurfaceContext
) {
  const reference = extractProjectReference(question);
  if (reference) {
    const rows = await prisma.$queryRaw<ProjectHealthRow[]>(Prisma.sql`
      SELECT project.*,
        COALESCE(
          NULLIF(project."address", ''),
          NULLIF(CONCAT_WS(
            ', ',
            NULLIF(object_address."street", ''),
            NULLIF(CONCAT_WS(
              ' ',
              NULLIF(object_address."postalCode", ''),
              NULLIF(object_address."city", '')
            ), '')
          ), '')
        ) AS "resolvedAddress"
      FROM "WorkPilotProject" project
      LEFT JOIN "ObjectAddress" object_address
        ON object_address."id" = project."objectAddressId"
        AND object_address."organizationId" = project."organizationId"
      WHERE project."organizationId" = ${organizationId}
        AND (
          project."projectNumber" ILIKE ${reference}
          OR project."id" = ${reference}
        )
      ORDER BY project."updatedAt" DESC
      LIMIT 2
    `);
    return rows.length === 1 ? rows[0] : undefined;
  }

  if (
    refersToCurrentProjectSurface(question) &&
    context?.recordType === "project" &&
    context.recordId
  ) {
    const rows = await prisma.$queryRaw<ProjectHealthRow[]>(Prisma.sql`
      SELECT project.*,
        COALESCE(
          NULLIF(project."address", ''),
          NULLIF(CONCAT_WS(
            ', ',
            NULLIF(object_address."street", ''),
            NULLIF(CONCAT_WS(
              ' ',
              NULLIF(object_address."postalCode", ''),
              NULLIF(object_address."city", '')
            ), '')
          ), '')
        ) AS "resolvedAddress"
      FROM "WorkPilotProject" project
      LEFT JOIN "ObjectAddress" object_address
        ON object_address."id" = project."objectAddressId"
        AND object_address."organizationId" = project."organizationId"
      WHERE project."organizationId" = ${organizationId}
        AND project."id" = ${context.recordId}
      LIMIT 1
    `);
    return rows[0];
  }

  if (
    conversationContext?.recordType === "project" &&
    conversationContext.recordId
  ) {
    const rows = await prisma.$queryRaw<ProjectHealthRow[]>(Prisma.sql`
      SELECT project.*,
        COALESCE(
          NULLIF(project."address", ''),
          NULLIF(CONCAT_WS(
            ', ',
            NULLIF(object_address."street", ''),
            NULLIF(CONCAT_WS(
              ' ',
              NULLIF(object_address."postalCode", ''),
              NULLIF(object_address."city", '')
            ), '')
          ), '')
        ) AS "resolvedAddress"
      FROM "WorkPilotProject" project
      LEFT JOIN "ObjectAddress" object_address
        ON object_address."id" = project."objectAddressId"
        AND object_address."organizationId" = project."organizationId"
      WHERE project."organizationId" = ${organizationId}
        AND project."id" = ${conversationContext.recordId}
      LIMIT 1
    `);
    if (rows[0]) return rows[0];
  }

  if (context?.recordType === "project" && context.recordId) {
    const rows = await prisma.$queryRaw<ProjectHealthRow[]>(Prisma.sql`
      SELECT project.*,
        COALESCE(
          NULLIF(project."address", ''),
          NULLIF(CONCAT_WS(
            ', ',
            NULLIF(object_address."street", ''),
            NULLIF(CONCAT_WS(
              ' ',
              NULLIF(object_address."postalCode", ''),
              NULLIF(object_address."city", '')
            ), '')
          ), '')
        ) AS "resolvedAddress"
      FROM "WorkPilotProject" project
      LEFT JOIN "ObjectAddress" object_address
        ON object_address."id" = project."objectAddressId"
        AND object_address."organizationId" = project."organizationId"
      WHERE project."organizationId" = ${organizationId}
        AND project."id" = ${context.recordId}
      LIMIT 1
    `);
    return rows[0];
  }

  return undefined;
}

function formatHealthStatus(status: ProjectHealthEvaluation["status"]) {
  if (status === "healthy") return "Stabil";
  if (status === "attention") return "Prüfen";
  return "Kritisch";
}

function canVerifyAllProjectTasks(profile: JarvisAccessProfile) {
  const permittedRoles = new Set<Role>([Role.ADMIN, Role.GESCHAEFTSFUEHRER]);
  return (
    permittedRoles.has(profile.sessionActor.role) &&
    permittedRoles.has(profile.effectiveActor.role)
  );
}

export async function resolveJarvisProjectHealthRequest(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  context?: JarvisSurfaceContext;
  conversationContext?: JarvisSurfaceContext;
}): Promise<JarvisReadResponse | undefined> {
  if (
    !resolveJarvisProjectHealthIntent(
      input.question,
      input.context,
      input.conversationContext
    )
  ) {
    return undefined;
  }

  const authorization = authorizeJarvisQuestion(input.question, input.accessProfile);
  const projectDecision = getJarvisActionDecision("project.read", input.accessProfile);
  if (!authorization.allowed || !projectDecision.executable) {
    return {
      type: "refusal",
      topicId: "project.health.refused",
      message: "Diese Projektprüfung ist für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      deterministic: true,
    };
  }

  const project = await findProject(
    input.organizationId,
    input.question,
    input.context,
    input.conversationContext
  );
  if (!project) {
    const reference = extractProjectReference(input.question);
    if (reference) {
      const choices = [
        ...(input.context?.recordType === "project" && input.context.recordId
          ? [
              createJarvisDialogChoice(
                "project-health-use-current",
                "Geöffnetes Projekt verwenden",
                "Prüfe das aktuell geöffnete Projekt vollständig."
              ),
            ]
          : []),
        createJarvisDialogChoice(
          "project-health-find-project",
          "Projekt suchen",
          "Wie finde und öffne ich das richtige Projekt?"
        ),
      ];
      return {
        type: "clarification",
        topicId: "project.health.project-not-found",
        message: `Ich konnte ${reference} nicht eindeutig als Projekt finden. Prüfe bitte die Projektnummer oder wähle den nächsten Schritt.`,
        choices,
        deterministic: true,
      };
    }
    return {
      type: "unknown",
      topicId: "project.health.context-required",
      message:
        "Für den Gesundheitscheck brauche ich ein eindeutiges Projekt. Öffne die Projektakte und frage „Prüfe dieses Projekt“ oder nenne die vollständige Projektnummer.",
      deterministic: true,
    };
  }

  const projectDialogIntent = getProjectDialogIntent(
    input.question,
    input.context,
    input.conversationContext
  );
  if (projectDialogIntent === "ambiguousProjectQuestion") {
    return buildProjectOverviewExplanation(project);
  }
  if (
    projectDialogIntent &&
    ![
      "explainPlanning",
      "explainRisk",
      "explainNextStep",
      "explainEvidence",
    ].includes(projectDialogIntent)
  ) {
    return [
      "explainIdentity",
      "explainTitle",
      "explainCustomer",
      "explainAddress",
      "explainTrade",
      "explainBranch",
      "explainVolume",
      "explainStatus",
      "explainResponsibility",
      "explainReviewStatus",
      "explainLastChange",
    ].includes(projectDialogIntent)
      ? buildProjectFactExplanation(
          project,
          projectDialogIntent as
            | "explainIdentity"
            | "explainTitle"
            | "explainCustomer"
            | "explainAddress"
            | "explainTrade"
            | "explainBranch"
            | "explainVolume"
            | "explainStatus"
            | "explainResponsibility"
            | "explainReviewStatus"
            | "explainLastChange"
        )
      : buildProjectLogicExplanation(
          project,
          projectDialogIntent as
            | "explainProjectType"
            | "explainBilling"
            | "explainProcess"
        );
  }

  let requestedScope = resolveProjectHealthScope(input.question);
  if (projectDialogIntent === "explainPlanning") requestedScope = "planning";
  if (projectDialogIntent === "explainRisk") requestedScope = "improvements";
  if (projectDialogIntent === "explainNextStep") requestedScope = "improvements";
  if (projectDialogIntent === "explainEvidence") requestedScope = "full";
  if (
    !requestedScope &&
    (
      Boolean(extractProjectReference(input.question)) ||
      /\b(?:das|dort|hier)\b/.test(normalize(input.question))
    ) &&
    /\b(?:pruf|check|analysier|untersuch|kontrollier)\w*\b/.test(
      normalize(input.question)
    )
  ) {
    requestedScope = "full";
  }
  if (!requestedScope) {
    return buildProjectHealthClarification(project, input.accessProfile);
  }

  const offerDecision = getJarvisActionDecision("offer.read", input.accessProfile);
  const invoiceDecision = getJarvisActionDecision("invoice.read", input.accessProfile);
  const taskDecision = getJarvisActionDecision("task.read", input.accessProfile);
  const contactDecision = getJarvisActionDecision("contact.read", input.accessProfile);
  const questionSemantics = analyzeJarvisQuestion(input.question);
  const asksForProjectMaterials =
    questionSemantics.relation === "project_materials";
  if (asksForProjectMaterials && !invoiceDecision.executable) {
    return {
      type: "refusal",
      topicId: "project.materials.refused",
      message:
        "Die projektbezogene Materialauswertung verwendet fertige Rechnungspositionen und Lagerbuchungen. Diese Finanzdaten sind für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      deterministic: true,
    };
  }
  const asksForProjectServiceRates =
    questionSemantics.relation === "project_service_rates";
  if (asksForProjectServiceRates && !invoiceDecision.executable) {
    return {
      type: "refusal",
      topicId: "project.service-rates.refused",
      message:
        "Die Analyse von Leistungen und Stundenverrechnungssätzen verwendet fertige Rechnungspositionen und zugeordnete Arbeitszeiten. Diese Finanzdaten sind für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      deterministic: true,
    };
  }
  const canReadCosts = canAccessJarvisDataClass(input.accessProfile, "payroll");
  const canVerifyInterruptionTasks =
    taskDecision.executable && canVerifyAllProjectTasks(input.accessProfile);
  const canInspectCrossProjectTimes =
    canManageProjectTimeEntries(input.accessProfile.sessionActor) &&
    canManageProjectTimeEntries(input.accessProfile.effectiveActor);
  const timeEntryActorFilters: Prisma.ProjectTimeEntryWhereInput[] = [
    ...(!canManageProjectTimeEntries(input.accessProfile.sessionActor)
      ? [{ userId: input.accessProfile.sessionActor.id }]
      : []),
    ...(!canManageProjectTimeEntries(input.accessProfile.effectiveActor)
      ? [{ userId: input.accessProfile.effectiveActor.id }]
      : []),
  ];
  const activeSessionActorFilters: Prisma.ActiveStampSessionWhereInput[] = [
    ...(!canManageProjectTimeEntries(input.accessProfile.sessionActor)
      ? [{ userId: input.accessProfile.sessionActor.id }]
      : []),
    ...(!canManageProjectTimeEntries(input.accessProfile.effectiveActor)
      ? [{ userId: input.accessProfile.effectiveActor.id }]
      : []),
  ];
  const stableContactIds = [
    project.contactId,
    project.contactPersonId,
    project.addressContactId,
  ].filter((value): value is string => Boolean(value));
  const healthCheckDateKey = getBerlinDateKey();

  const [
    timeEntries,
    activeSessions,
    projectPlanningEntries,
    logbookEntryCount,
    processLogbookEntries,
    offers,
    invoices,
    tasks,
    validContactCount,
    deadlineSettings,
  ] = await Promise.all([
    prisma.projectTimeEntry.findMany({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
        deletedAt: null,
        ...(timeEntryActorFilters.length > 0
          ? { AND: timeEntryActorFilters }
          : {}),
      },
      select: {
        id: true,
        mode: true,
        projectId: true,
        trade: true,
        planningEntryId: true,
        billingCatalogItemId: true,
        billingCatalogItemLabel: true,
        offerId: true,
        userId: true,
        employee: true,
        entrySource: true,
        date: true,
        startTime: true,
        endTime: true,
        pauseMs: true,
        invoiceId: true,
        durationMs: true,
        laborCostRateSnapshot: true,
        laborCostSnapshot: true,
        costSnapshotAt: true,
        comment: true,
        completionStatus: true,
        overtimeApprovalStatus: true,
        overtimeApprovedByUserId: true,
        overtimeApprovedByName: true,
        overtimeApprovedAt: true,
      },
    }),
    prisma.activeStampSession.findMany({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
        ...(activeSessionActorFilters.length > 0
          ? { AND: activeSessionActorFilters }
          : {}),
      },
      select: {
        id: true,
        mode: true,
        projectId: true,
        userId: true,
        employee: true,
        trade: true,
        planningEntryId: true,
        billingCatalogItemId: true,
        billingCatalogItemLabel: true,
        comment: true,
        startedAt: true,
        pauseStartedAt: true,
        createdAt: true,
      },
    }),
    prisma.planningEntry.findMany({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        date: true,
        durationMinutes: true,
        approvalStatus: true,
        deletedAt: true,
      },
    }),
    prisma.projectLogbookEntry.count({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
      },
    }),
    prisma.projectLogbookEntry.findMany({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
        title: {
          in: [
            "Dokumente: Endkontrolle",
            "Bilder: Vorherbilder",
            "Bilder: Nachherbilder",
            "Dokumente: Tätigkeitsberichte",
          ],
        },
      },
      select: {
        title: true,
        projectMonth: true,
        attachments: true,
        createdAt: true,
      },
    }),
    offerDecision.executable
      ? prisma.offer.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: project.id,
            status: { notIn: ["Gelöscht", "Gel\u00c3\u00b6scht"] },
          },
          select: { id: true, projectId: true, status: true, wonAt: true },
        })
      : Promise.resolve(undefined),
    invoiceDecision.executable
      ? prisma.invoice.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: project.id,
          },
          select: {
            id: true,
            projectId: true,
            invoiceNumber: true,
            projectNumber: true,
            projectTitle: true,
            customerName: true,
            status: true,
            billingSource: true,
            plannedExecutionMonth: true,
            serviceDate: true,
            netTotal: true,
            createdAt: true,
          },
        })
      : Promise.resolve(undefined),
    taskDecision.executable
      ? prisma.task.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: project.id,
            AND: [
              getJarvisTaskActorWhere(input.accessProfile.sessionActor),
              getJarvisTaskActorWhere(input.accessProfile.effectiveActor),
            ],
          },
          select: {
            status: true,
            description: true,
            deadline: true,
            ownerId: true,
            teamId: true,
            createdById: true,
            participants: { select: { userId: true } },
          },
        })
      : Promise.resolve(undefined),
    contactDecision.executable && stableContactIds.length > 0
      ? prisma.contact.count({
          where: {
            organizationId: input.organizationId,
            id: { in: stableContactIds },
          },
        })
      : Promise.resolve(undefined),
    getDeadlineSettings(input.organizationId),
  ]);

  const asksForNextAppointment =
    /\b(?:gibt es|wann ist|welcher ist|was ist)\b.*\b(?:nachste[nr]?|kommende[nr]?)\b.*\b(?:termin|planung)\b/.test(
      normalize(input.question)
    );
  if (asksForNextAppointment) {
    const nextPlanningEntry = projectPlanningEntries
      .filter((entry) => entry.date >= healthCheckDateKey)
      .sort((first, second) => first.date.localeCompare(second.date))[0];
    const projectLabel = [project.projectNumber, project.title]
      .filter(Boolean)
      .join(" · ");
    const nextDate = nextPlanningEntry
      ? new Intl.DateTimeFormat("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Europe/Berlin",
        }).format(new Date(`${nextPlanningEntry.date}T12:00:00.000Z`))
      : undefined;
    const value = nextPlanningEntry
      ? `${nextDate} · ${nextPlanningEntry.durationMinutes} Minuten`
      : "Kein zukünftiger Termin";
    return {
      type: "answer",
      topicId: "project.fact.nextAppointment",
      message: nextPlanningEntry
        ? `Der nächste hinterlegte Termin für ${project.projectNumber || project.title} ist am ${nextDate} und dauert ${nextPlanningEntry.durationMinutes} Minuten.`
        : `Für ${project.projectNumber || project.title} ist aktuell kein zukünftiger Termin hinterlegt.`,
      structured: {
        title: `Nächster Termin · ${project.projectNumber || project.title}`,
        subtitle: project.customer || "Projekt",
        facts: [{ label: "Nächster Termin", value }],
      },
      records: [{
        id: `project-next-appointment-${project.id}`,
        kind: "project",
        title: projectLabel,
        subtitle: project.customer || "Projekt",
        summary: value,
        status: project.status,
        target: { kind: "project", id: project.id },
      }],
      deterministic: true,
    };
  }

  const comparedUserIds = [
    ...new Set(
      timeEntries
        .map((entry) => entry.userId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const comparedDates = [...new Set(timeEntries.map((entry) => entry.date))];
  const comparisonTimeEntries =
    canInspectCrossProjectTimes &&
    comparedUserIds.length > 0 &&
    comparedDates.length > 0
      ? await prisma.projectTimeEntry.findMany({
          where: {
            organizationId: input.organizationId,
            deletedAt: null,
            userId: { in: comparedUserIds },
            date: { in: comparedDates },
          },
          select: {
            id: true,
            mode: true,
            projectId: true,
            trade: true,
            planningEntryId: true,
            billingCatalogItemId: true,
            billingCatalogItemLabel: true,
            offerId: true,
            userId: true,
            employee: true,
            entrySource: true,
            date: true,
            startTime: true,
            endTime: true,
            pauseMs: true,
            invoiceId: true,
            durationMs: true,
            laborCostRateSnapshot: true,
            laborCostSnapshot: true,
            costSnapshotAt: true,
            comment: true,
            completionStatus: true,
            overtimeApprovalStatus: true,
            overtimeApprovedByUserId: true,
            overtimeApprovedByName: true,
            overtimeApprovedAt: true,
          },
        })
      : [];

  const planningEntryIds = [
    ...new Set(
      timeEntries
        .map((entry) => entry.planningEntryId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const invoiceIds = invoices?.map((invoice) => invoice.id) ?? [];
  const [
    linkedPlanningEntries,
    invoiceLines,
    invoiceLaborItems,
    inventoryMovements,
  ] = await Promise.all([
    planningEntryIds.length > 0
      ? prisma.planningEntry.findMany({
          where: {
            organizationId: input.organizationId,
            id: { in: planningEntryIds },
          },
          select: {
            id: true,
            projectId: true,
            userId: true,
            date: true,
            deletedAt: true,
          },
        })
      : Promise.resolve([]),
    invoiceDecision.executable && invoiceIds.length > 0
      ? prisma.invoiceLine.findMany({
          where: {
            organizationId: input.organizationId,
            invoiceId: { in: invoiceIds },
          },
          select: {
            id: true,
            invoiceId: true,
            catalogItemId: true,
            catalogType: true,
            position: true,
            quantity: true,
            unit: true,
            title: true,
            unitPrice: true,
            discountPercent: true,
            materialCostSnapshot: true,
            laborCostSnapshot: true,
            packageComponentsSnapshot: true,
            catalogCostSnapshotVersion: true,
            costSnapshotAt: true,
            totalNet: true,
          },
        })
      : Promise.resolve(undefined),
    invoiceDecision.executable && invoiceIds.length > 0
      ? prisma.invoiceLineLabor.findMany({
          where: {
            organizationId: input.organizationId,
            invoiceId: { in: invoiceIds },
          },
          select: {
            invoiceId: true,
            invoiceLineId: true,
            userId: true,
            plannedHours: true,
            totalCost: true,
          },
        })
      : Promise.resolve(undefined),
    invoiceDecision.executable && invoiceIds.length > 0
      ? prisma.catalogInventoryMovement.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: project.id,
            invoiceId: { in: invoiceIds },
          },
          select: {
            catalogItemId: true,
            movementType: true,
            quantityDelta: true,
            invoiceId: true,
          },
        })
      : Promise.resolve(undefined),
  ]);

  const visibleTasks = tasks?.filter((task) =>
    canAccessJarvisTask(input.accessProfile, {
      ownerId: task.ownerId,
      teamId: task.teamId,
      createdById: task.createdById,
      participantUserIds: task.participants.map((participant) => participant.userId),
    })
  );
  const now = new Date();
  const projectLogic = resolveJarvisProjectLogic(project);
  const recurring = projectLogic.isRecurring;
  const hourlyRecurring = projectLogic.isHourlyRecurring;
  const stampDiagnostics = diagnoseProjectStamps({
    projectId: project.id,
    isHourlyRecurring: hourlyRecurring,
    entries: timeEntries,
    comparisonEntries: comparisonTimeEntries,
    crossProjectComparisonPerformed: canInspectCrossProjectTimes,
    activeSessions,
    planningEntries: linkedPlanningEntries,
    invoices,
    invoiceLines,
    invoiceLaborItems,
    interruptionTaskDescriptions: canVerifyInterruptionTasks
      ? tasks?.map((task) => task.description)
      : undefined,
    verifyInterruptionTasks: canVerifyInterruptionTasks,
    roundingFactorHours: deadlineSettings.hourlyBillingRoundingFactorHours,
    now,
  });
  const recurringMonthDiagnostics = recurring
    ? diagnoseRecurringProjectMonths({
        project,
        planningEntries: projectPlanningEntries,
        timeEntries,
        invoices,
        evaluationDateKey: healthCheckDateKey,
      })
    : undefined;
  const processDiagnostics = diagnoseProjectProcess({
    project,
    evaluationDateKey: healthCheckDateKey,
    offers,
    invoices,
    logbookEntries: processLogbookEntries,
    timeEntryDates: timeEntries.map((entry) => entry.date),
  });
  const materialInvoices: ProjectMaterialInvoice[] = (invoices ?? []).map(
    (invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber || invoice.id,
      status: invoice.status,
      projectId: invoice.projectId,
      projectNumber: invoice.projectNumber || project.projectNumber,
      projectTitle: invoice.projectTitle || project.title,
      customerName: invoice.customerName || project.customer || "",
      serviceDate: invoice.serviceDate,
      createdAt: invoice.createdAt.toISOString(),
      lines: (invoiceLines ?? [])
        .filter((line) => line.invoiceId === invoice.id)
        .map((line) => ({
          id: line.id,
          catalogItemId: line.catalogItemId,
          catalogType: line.catalogType,
          quantity: line.quantity,
          unit: line.unit,
          title: line.title,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          materialCostSnapshot: line.materialCostSnapshot,
          laborCostSnapshot: line.laborCostSnapshot,
          packageComponentsSnapshot: Array.isArray(
            line.packageComponentsSnapshot
          )
            ? line.packageComponentsSnapshot as NonNullable<
                ProjectMaterialInvoice["lines"][number]["packageComponentsSnapshot"]
              >
            : [],
          catalogCostSnapshotVersion: line.catalogCostSnapshotVersion,
          costSnapshotAt: line.costSnapshotAt?.toISOString(),
          laborItems: (invoiceLaborItems ?? [])
            .filter((item) => item.invoiceLineId === line.id)
            .map((item) => ({ totalCost: item.totalCost })),
      })),
    })
  );
  const analysisMonthKey =
    questionSemantics.explicitMonths.length === 1
      ? questionSemantics.explicitMonths[0].key
      : "";
  const analysisInvoiceIds = new Set(
    (invoices ?? [])
      .filter(
        (invoice) =>
          !analysisMonthKey ||
          getFocusedInvoiceMonth(invoice) === analysisMonthKey
      )
      .map((invoice) => invoice.id)
  );
  const materialAnalysis =
    invoiceDecision.executable && invoices && invoiceLines
      ? analyzeProjectMaterials({
          invoices: materialInvoices.filter(
            (invoice) =>
              !analysisMonthKey || analysisInvoiceIds.has(invoice.id)
          ),
          inventoryMovements: (inventoryMovements ?? []).filter(
            (movement) =>
              !analysisMonthKey || analysisInvoiceIds.has(movement.invoiceId)
          ),
          includeCosts: canReadCosts,
        })
      : undefined;
  const serviceCatalogItemIds = [
    ...new Set([
      ...(invoiceLines ?? [])
        .filter((line) => line.catalogType === "service")
        .map((line) => line.catalogItemId),
      ...(invoiceLines ?? []).flatMap((line) =>
        Array.isArray(line.packageComponentsSnapshot)
          ? (line.packageComponentsSnapshot as Array<{
              componentItemId?: string;
              componentType?: string;
            }>)
              .filter((component) => component.componentType === "service")
              .map((component) => component.componentItemId ?? "")
          : []
      ),
      ...timeEntries.map((entry) => entry.billingCatalogItemId ?? ""),
    ].filter(Boolean)),
  ];
  const serviceCatalogItems: ProjectServiceRateCatalogItem[] =
    invoiceDecision.executable && serviceCatalogItemIds.length > 0
      ? await prisma.catalogItem.findMany({
          where: {
            organizationId: input.organizationId,
            id: { in: serviceCatalogItemIds },
            type: "service",
          },
          select: {
            id: true,
            number: true,
            name: true,
            unit: true,
            salesPrice: true,
            isActive: true,
            reviewStatus: true,
          },
        })
      : [];
  const serviceRateAnalysis =
    invoiceDecision.executable && invoices && invoiceLines
      ? analyzeProjectServiceRates({
          invoices: materialInvoices.filter(
            (invoice) =>
              !analysisMonthKey || analysisInvoiceIds.has(invoice.id)
          ) as ProjectServiceRateInvoice[],
          timeEntries: timeEntries
            .filter(
              (entry) =>
                !analysisMonthKey || getMonthKey(entry.date) === analysisMonthKey
            )
            .map((entry) => ({
            billingCatalogItemId: entry.billingCatalogItemId,
            billingCatalogItemLabel: entry.billingCatalogItemLabel,
            durationMs: entry.durationMs,
            laborCostSnapshot: canReadCosts
              ? entry.laborCostSnapshot
              : 0,
            costSnapshotAt: canReadCosts ? entry.costSnapshotAt : null,
            })),
          catalogItems: serviceCatalogItems,
          includeCosts: canReadCosts,
          scope: analysisMonthKey ? "project_month" : "project",
        })
      : undefined;
  const activeInvoices = invoices?.filter(
    (invoice) =>
      ![
        "Gelöscht",
        "Gel\u00c3\u00b6scht",
        "Storniert",
        "Stornorechnung",
      ].includes(invoice.status)
  );
  const focusedInvoiceMonthResponse =
    invoiceDecision.executable && activeInvoices
      ? buildFocusedInvoiceMonthResponse({
          question: input.question,
          project,
          invoices: activeInvoices,
          timeEntries,
        })
      : undefined;
  if (focusedInvoiceMonthResponse) return focusedInvoiceMonthResponse;
  const focusedProjectMaterialResponse =
    materialAnalysis
      ? buildFocusedProjectMaterialResponse({
          question: input.question,
          project,
          analysis: materialAnalysis,
        })
      : undefined;
  if (focusedProjectMaterialResponse) return focusedProjectMaterialResponse;
  const focusedProjectServiceRateResponse =
    serviceRateAnalysis
      ? buildFocusedProjectServiceRateResponse({
          question: input.question,
          project,
          analysis: serviceRateAnalysis,
        })
      : undefined;
  if (focusedProjectServiceRateResponse) {
    return focusedProjectServiceRateResponse;
  }
  const closedTaskStatuses = new Set<TaskStatus>([
    TaskStatus.ERLEDIGT,
    TaskStatus.ABGELEHNT,
    TaskStatus.ARCHIVIERT,
  ]);
  const openVisibleTasks = visibleTasks?.filter(
    (task) => !closedTaskStatuses.has(task.status)
  );
  const checkedAreas = [
    "Stammdaten & Verantwortung",
    "Planung & Terminverknüpfungen",
    "Stempelungen, Zeitmathematik & Status",
    ...(contactDecision.executable ? ["Kunden- & Objektverknüpfung"] : []),
    ...(offerDecision.executable && invoiceDecision.executable
      ? ["Angebote, Rechnungen & Abrechnungsautomatik"]
      : []),
    ...(recurring ? ["Dauerläufer-Monatskette"] : []),
    "Sollprozess & Leistungsnachweise",
    ...(materialAnalysis &&
    (
      materialAnalysis.materialPositionCount > 0 ||
      materialAnalysis.packagePositionCount > 0 ||
      materialAnalysis.issues.length > 0
    )
      ? ["Material, Pakete & Lagerabgleich"]
      : []),
    ...(taskDecision.executable ? ["Aufgaben & Unterbrechungen"] : []),
    ...(canReadCosts ? ["Wirtschaftlichkeit & Kostensatzqualität"] : []),
  ];
  const restrictedAreas = [
    ...(!contactDecision.executable ? ["Kunden- & Objektverknüpfung"] : []),
    ...(!offerDecision.executable || !invoiceDecision.executable
      ? ["Angebote, Rechnungen & Abrechnungsautomatik"]
      : []),
    ...(!taskDecision.executable ? ["Aufgaben & Unterbrechungen"] : []),
    ...(!canReadCosts ? ["Wirtschaftlichkeit & Kostensatzqualität"] : []),
  ];
  const snapshot: ProjectHealthSnapshot = {
    project,
    stableCustomerReferenceValid:
      typeof validContactCount === "number"
        ? validContactCount === new Set(stableContactIds).size
        : undefined,
    timeEntryCount: timeEntries.length,
    manualOneTimeEntriesWithoutOffer: timeEntries.filter(
      (entry) =>
        Number(entry.durationMs) > 0 &&
        entry.entrySource === "manual" &&
        !entry.offerId
    ).length,
    timeEntriesWithoutCostSnapshot: canReadCosts
      ? timeEntries.filter(
          (entry) =>
            Number(entry.durationMs) > 0 &&
            Number(entry.laborCostRateSnapshot) <= 0
        ).length
      : undefined,
    futurePlanningCount: projectPlanningEntries.filter(
      (entry) => entry.date >= healthCheckDateKey
    ).length,
    visibleOpenTaskCount: openVisibleTasks?.length,
    visibleOverdueTaskCount: openVisibleTasks?.filter(
      (task) =>
        task.deadline.getTime() < now.getTime() ||
        task.status === TaskStatus.UEBERFAELLIG
    ).length,
    offerCount: offers?.length,
    invoiceCount: activeInvoices?.length,
    draftInvoiceCount: activeInvoices?.filter((invoice) => invoice.status === "Entwurf").length,
    logbookEntryCount,
    evaluationDateKey: healthCheckDateKey,
    stampDiagnostics,
    recurringMonthDiagnostics,
    processDiagnostics,
    materialAnalysis,
    serviceRateAnalysis,
    checkedAreas,
    restrictedAreas,
  };
  const normalizedQuestion = normalize(input.question);
  const noEvidenceLabel =
    requestedScope === "stamps" && timeEntries.length === 0
      ? "Stempelungen"
      : requestedScope === "planning" &&
          !recurring &&
          projectPlanningEntries.filter(
            (entry) => entry.date >= healthCheckDateKey
          ).length === 0 &&
          /\b(?:(?:nachste|nachsten|kommenden)\s+monat|folgemonat)\b/.test(
            normalizedQuestion
          )
        ? "Planung im Folgemonat"
      : requestedScope === "tasks" && (visibleTasks?.length ?? 0) === 0
        ? "Aufgaben"
        : requestedScope === "commercial" &&
            /\bangebot\w*\b/.test(normalizedQuestion) &&
            !/\brechnung\w*\b/.test(normalizedQuestion) &&
            (offers?.length ?? 0) === 0
          ? "Angebote"
          : requestedScope === "commercial" &&
              /\brechnung\w*\b/.test(normalizedQuestion) &&
              !/\bangebot\w*\b/.test(normalizedQuestion) &&
              (activeInvoices?.length ?? 0) === 0
            ? "Rechnungen"
            : undefined;
  if (noEvidenceLabel) {
    const projectLabel = [project.projectNumber, project.title]
      .filter(Boolean)
      .join(" · ");
    return {
      type: "answer",
      topicId: "project.scope.no-evidence",
      message: `Für ${project.projectNumber || project.title} wurden keine ${noEvidenceLabel} gefunden. Deshalb gibt JARVIS für diesen Bereich keinen Prüfwert und keine Qualitätsbewertung aus.`,
      structured: {
        title: `${PROJECT_HEALTH_SCOPE_LABELS[requestedScope]} · ${project.projectNumber || project.title}`,
        subtitle: `${project.customer || "Ohne Kundenanzeige"} · ${project.status || "Ohne Status"}`,
        summary: `Keine ${noEvidenceLabel} als belastbare Auswertungsgrundlage vorhanden.`,
        facts: [
          { label: "Datenbasis", value: `0 ${noEvidenceLabel}` },
          { label: "Bewertung", value: "Nicht bewertbar" },
        ],
        sections: [
          {
            title: "Einordnung",
            items: [
              `Ohne vorhandene ${noEvidenceLabel} kann JARVIS weder Fehlerfreiheit noch eine vollständige Prüfung dieses Bereichs bestätigen.`,
            ],
          },
        ],
      },
      records: [{
        id: `project-scope-no-evidence-${project.id}`,
        kind: "project",
        title: projectLabel,
        subtitle: project.customer || project.projectType || "Projekt",
        summary: `${noEvidenceLabel}: keine Datenbasis`,
        status: project.status,
        target: { kind: "project", id: project.id },
      }],
      deterministic: true,
    };
  }
  const fullEvaluation = evaluateProjectHealth(snapshot);
  const evaluation = scopeProjectHealthEvaluation(
    fullEvaluation,
    snapshot,
    requestedScope
  );
  const scopeLabel =
    requestedScope === "commercial"
      ? offerDecision.executable && invoiceDecision.executable
        ? "Angebote & Rechnungen"
        : offerDecision.executable
          ? "Angebote"
          : "Rechnungen"
      : PROJECT_HEALTH_SCOPE_LABELS[requestedScope];
  const isPartialScope =
    requestedScope !== "full" && requestedScope !== "improvements";
  const scopedCheckedAreas = checkedAreasForScope(snapshot, requestedScope);
  const criticalIssues = evaluation.issues.filter(
    (issue) => issue.severity === "critical"
  );
  const warningIssues = evaluation.issues.filter(
    (issue) => issue.severity === "warning"
  );
  const topIssue = criticalIssues[0] ?? warningIssues[0];
  const projectLabel = [project.projectNumber, project.title].filter(Boolean).join(" · ");
  const asksForEconomicHealth =
    /\b(?:wirtschaftlich gesund|wirtschaftliche gesundheit|rentabel)\b/.test(
      normalizedQuestion
    );
  const asksForNextStep =
    projectDialogIntent === "explainNextStep" ||
    /\b(?:wichtigste[rn]?|nachste[rn]?)\s+(?:sinnvolle[nr]?\s+)?schritt\w*\b/.test(
      normalizedQuestion
    );
  const asksForEvidence = projectDialogIntent === "explainEvidence";

  if (projectDialogIntent === "explainRisk") {
    return {
      type: "answer",
      topicId: "project.health.risk",
      message: topIssue
        ? `Das aktuell größte belegte Risiko bei ${projectLabel} ist „${topIssue.title}“. ${topIssue.evidence} Empfohlener nächster Schritt: ${topIssue.recommendation}`
        : `Für ${projectLabel} wurde im freigegebenen Prüfumfang aktuell kein konkretes Projektrisiko gefunden. Das ist keine Garantie für nicht geprüfte oder rollenbedingt gesperrte Bereiche.`,
      deterministic: true,
    };
  }
  if (asksForEconomicHealth) {
    return {
      type: "answer",
      topicId: "project.health.economic",
      message: topIssue
        ? `Die wirtschaftliche Gesundheit von ${projectLabel} ist derzeit nicht belastbar bestätigt. Der Projektcheck erreicht ${evaluation.score} von 100 Punkten; der wichtigste belegte Prüfpunkt ist „${topIssue.title}“. Das ist ein Daten- oder Prozessrisiko und noch keine vollständige Gewinnrechnung. ${topIssue.recommendation}`
        : `Im freigegebenen Prüfumfang erreicht ${projectLabel} ${evaluation.score} von 100 Punkten. Eine belastbare Aussage zur Wirtschaftlichkeit setzt zusätzlich vollständige Erlös-, Leistungs- und Kostendaten voraus.`,
      deterministic: true,
    };
  }
  if (asksForNextStep) {
    return {
      type: "answer",
      topicId: "project.health.next-step",
      message: topIssue
        ? `Der sinnvollste nächste Schritt bei ${projectLabel} ist: ${topIssue.recommendation} Priorität hat das, weil „${topIssue.title}“ aktuell der wichtigste belegte Prüfpunkt ist.`
        : `Für ${projectLabel} wurde im freigegebenen Prüfumfang kein konkreter Fehler gefunden. Der nächste sinnvolle Schritt ist deshalb die fachliche Endkontrolle der noch ungeprüften oder rollenbedingt nicht sichtbaren Bereiche.`,
      deterministic: true,
    };
  }
  if (asksForEvidence) {
    const checked = snapshot.checkedAreas.join(", ");
    const restricted =
      snapshot.restrictedAreas.length > 0
        ? ` Rollenbedingt nicht geladen wurden: ${snapshot.restrictedAreas.join(", ")}.`
        : " Es gab in diesem Lauf keinen rollenbedingt gesperrten Prüfbereich.";
    return {
      type: "answer",
      topicId: "project.health.evidence",
      message:
        `Die Empfehlung zu ${projectLabel} basiert ausschließlich auf den aktuell organisationsgebunden geladenen WorkPilot360-Daten: Projektstammdaten und fachlicher Prüfstatus sowie ${checked}. ` +
        `Dabei wurden ${snapshot.timeEntryCount} Zeiteinträge, ${snapshot.futurePlanningCount} künftige Planungen, ${snapshot.offerCount ?? 0} Angebote, ${snapshot.invoiceCount ?? 0} Rechnungen, ${snapshot.visibleOpenTaskCount ?? 0} sichtbare offene Aufgaben und ${snapshot.logbookEntryCount} Logbucheinträge berücksichtigt.${restricted} Fehlende oder ungeprüfte Grundlagen bleiben als Unsicherheit sichtbar.`,
      deterministic: true,
    };
  }

  return {
    type: "answer",
    topicId: "project.health",
    message: topIssue
      ? `${projectLabel} erreicht im freigegebenen Prüfumfang ${evaluation.score} von 100 Punkten. Wichtigster Prüfpunkt: ${topIssue.title}. ${topIssue.recommendation}`
      : `${projectLabel} erreicht im freigegebenen Prüfumfang 100 von 100 Punkten. In den geprüften Bereichen wurde kein konkreter Daten- oder Logikfehler gefunden.`,
    structured: {
      title: `${scopeLabel} · ${project.projectNumber || project.title}`,
      subtitle: `${project.customer || "Ohne Kundenanzeige"} · ${project.status || "Ohne Status"}`,
      summary:
        evaluation.status === "healthy"
          ? `Die ${scopedCheckedAreas.length} ausgewählten, freigegebenen Prüfbereiche sind aktuell schlüssig.`
          : `${criticalIssues.length} kritische und ${warningIssues.length} weitere Prüfungen wurden nachvollziehbar erkannt.`,
      facts: [
        {
          label: isPartialScope ? "Teilprüfwert" : "Prüfwert",
          value: `${evaluation.score} / 100`,
          tone: evaluation.status === "healthy" ? "positive" : "warning",
        },
        {
          label: "Einordnung",
          value:
            isPartialScope && evaluation.status === "healthy"
              ? "Im gewählten Umfang stabil"
              : formatHealthStatus(evaluation.status),
          tone: evaluation.status === "healthy" ? "positive" : "warning",
        },
        {
          label: "Datenbasis",
          value:
            normalize(project.reviewStatus) === "approved"
              ? "Fachlich freigegeben"
              : normalize(project.reviewStatus) === "needs_review"
                ? "Prüfung notwendig"
                : "Noch nicht fachlich geprüft",
          tone:
            normalize(project.reviewStatus) === "approved"
              ? "positive"
              : "warning",
        },
        requestedScope === "full" || requestedScope === "improvements"
          ? {
              label: "Prüfumfang",
              value:
                `${snapshot.checkedAreas.length} / ` +
                `${snapshot.checkedAreas.length + snapshot.restrictedAreas.length} Bereiche`,
            }
          : {
              label: "Auswahl",
              value: scopeLabel,
            },
        ...(requestedScope === "full" || requestedScope === "stamps"
          ? [{
              label: "Stempelungen",
              value: `${stampDiagnostics.metrics.entries} · ${stampDiagnostics.metrics.totalHours} Std.`,
            }]
          : []),
      ],
      sections: [
        ...(criticalIssues.length > 0
          ? [{
              title: "Zuerst beheben",
              tone: "warning" as const,
              items: criticalIssues.map(
                (issue) =>
                  `${issue.title}: ${issue.evidence} Nächster Schritt: ${issue.recommendation}`
              ),
            }]
          : []),
        ...(warningIssues.length > 0
          ? [{
              title: "Danach prüfen",
              tone: "warning" as const,
              items: warningIssues.map(
                (issue) =>
                  `${issue.title}: ${issue.evidence} Nächster Schritt: ${issue.recommendation}`
              ),
            }]
          : []),
        {
          title: "Bewertung nach Bereichen",
          items: evaluation.areaAssessments.map((assessment) => {
            const statusLabel =
              assessment.status === "critical"
                ? "Kritisch"
                : assessment.status === "attention"
                  ? "Prüfen"
                  : "Stabil";
            const findings = [
              assessment.criticalIssues > 0
                ? `${assessment.criticalIssues} kritisch`
                : "",
              assessment.warningIssues > 0
                ? `${assessment.warningIssues} weiterer Prüfpunkt/weitere Prüfpunkte`
                : "",
            ].filter(Boolean);
            return (
              `${assessment.area}: ${statusLabel} · ${assessment.score} / 100` +
              (findings.length > 0
                ? ` · ${findings.join(", ")}`
                : " · keine Auffälligkeit")
            );
          }),
          tone: evaluation.status === "healthy" ? "positive" : "neutral",
        },
        {
          title: "Geprüfter Umfang",
          items: [
            ...scopedCheckedAreas,
            ...(requestedScope === "full" || requestedScope === "stamps"
              ? stampDiagnostics.checkedRules.map(
                  (rule) => `Stempeldiagnose: ${rule}`
                )
              : []),
          ],
          tone: evaluation.status === "healthy" ? "positive" : "neutral",
        },
        {
          title: "Erkannte Automatik",
          items: evaluation.automationSummary,
          tone: evaluation.status === "healthy" ? "positive" : "neutral",
        },
        ...(snapshot.restrictedAreas.length > 0
          ? [{
              title: "Rollenbedingter Prüfumfang",
              items: [
                `Nicht geprüft: ${snapshot.restrictedAreas.join(", ")}.`,
                "Gesperrte Finanz-, Aufgaben-, Kontakt- oder Lohndaten wurden nicht aus der Datenbank geladen.",
              ],
            }]
          : []),
        ...(isPartialScope
          ? [{
              title: "Abgrenzung",
              items: [
                "Dieser Teilprüfwert bewertet nur die ausgewählte Frage. Der Zustand des Gesamtprojekts wurde damit nicht vollständig bewertet.",
              ],
            }]
          : []),
      ],
    },
    records: [{
      id: `project-health-${project.id}`,
      kind: "project",
      title: projectLabel,
      subtitle: project.customer || project.projectType || "Projekt",
      summary: `${isPartialScope ? "Teilprüfung" : formatHealthStatus(evaluation.status)} · ${evaluation.issues.length} Prüfpunkt/Prüfpunkte`,
      status: project.status,
      target: { kind: "project", id: project.id },
    }],
    deterministic: true,
  };
}
