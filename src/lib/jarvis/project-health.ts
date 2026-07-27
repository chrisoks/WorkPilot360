import { Prisma, Role, TaskStatus } from "@prisma/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import { canManageProjectTimeEntries } from "@/lib/permissions";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";
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
  address: string | null;
  responsibleName: string | null;
  timeBudgetEnabled: boolean;
  timeBudgetHours: string | null;
  autoBillingEnabled: boolean;
  autoBillingNetAmount: string | null;
  autoBillingStartMonth: string | null;
  autoBillingEndMonth: string | null;
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
  stampDiagnostics?: StampDiagnosticResult;
  checkedAreas: string[];
  restrictedAreas: string[];
};

export type ProjectHealthEvaluation = {
  score: number;
  status: "healthy" | "attention" | "critical";
  issues: ProjectHealthIssue[];
  automationSummary: string[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveNumber(value: string | null | undefined) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
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

function isRecurringProject(projectKind: string | null) {
  return normalize(projectKind).includes("dauerl");
}

function isRecognizedProjectKind(projectKind: string | null) {
  const value = normalize(projectKind);
  return value.includes("dauerl") || value.includes("einmal");
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
  context?: JarvisSurfaceContext
) {
  const value = normalize(question);
  const projectContext = context?.recordType === "project";
  const stampDiagnosticQuestion =
    projectContext &&
    /(stempel|zeiteintrag|stunden|rechnung)/.test(value) &&
    /(pruf|check|fehl|falsch|stimm|doppelt|uberschneid|warum)/.test(value);
  if (stampDiagnosticQuestion) return true;
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
  const recurring = isRecurringProject(project.projectKind);
  const hourlyRecurring = recurring && project.recurringBillingMode === "hourly";
  const monthlyRecurring = recurring && project.recurringBillingMode === "monthlyFlat";
  const operational = isOperationalProject(project.status);
  const closed = isClosedProject(project.status);
  const hasStableCustomerReference = Boolean(
    project.contactId || project.contactPersonId || project.addressContactId
  );

  addIssue(issues, {
    id: "customer-reference-missing",
    severity: "warning",
    area: "Kundenzuordnung",
    title: "Stabile Kunden-ID fehlt",
    evidence: project.customer
      ? `Das Projekt zeigt „${project.customer}“, ist aber nur über einen Namen zugeordnet.`
      : "Weder ein Kundenname noch eine stabile Kunden-ID ist gepflegt.",
    recommendation:
      "In den Projektinformationen den richtigen Kunden auswählen und die stabile Verknüpfung speichern.",
  }, !hasStableCustomerReference);

  addIssue(issues, {
    id: "customer-reference-invalid",
    severity: "critical",
    area: "Kundenzuordnung",
    title: "Gespeicherte Kundenverknüpfung ist nicht mehr gültig",
    evidence: "Mindestens eine gespeicherte Kontakt-ID gehört nicht mehr zu einem vorhandenen Kontakt dieses Mandanten.",
    recommendation:
      "Die Kundenzuordnung in den Projektinformationen erneut auswählen und speichern.",
  }, hasStableCustomerReference && snapshot.stableCustomerReferenceValid === false);

  addIssue(issues, {
    id: "project-kind-missing",
    severity: "critical",
    area: "Projektlogik",
    title: "Projektart ist nicht eindeutig",
    evidence: "WorkPilot360 kann nicht sicher zwischen einmaligem Projekt und Dauerläufer unterscheiden.",
    recommendation:
      "In den Projektinformationen „Einmaliges Projekt“ oder „Dauerläufer-Projekt“ festlegen.",
  }, !isRecognizedProjectKind(project.projectKind));

  addIssue(issues, {
    id: "project-company-type-missing",
    severity: "warning",
    area: "Projektlogik",
    title: "Unternehmensbereich ist nicht gepflegt",
    evidence: "Die Zuordnung zu OK solutions oder OK immocare ist nicht belastbar hinterlegt.",
    recommendation: "Den passenden Projekt-/Unternehmensbereich in den Projektinformationen auswählen.",
  }, !project.projectType && !project.branch);

  addIssue(issues, {
    id: "responsible-missing",
    severity: "warning",
    area: "Verantwortung",
    title: "Projektverantwortung fehlt",
    evidence: "Für das aktive Projekt ist keine verantwortliche Person hinterlegt.",
    recommendation: "Eine verantwortliche Person in den Projektinformationen festlegen.",
  }, !closed && !project.responsibleName);

  addIssue(issues, {
    id: "trade-missing",
    severity: "warning",
    area: "Ausführung",
    title: "Projektgewerk fehlt",
    evidence: "Das Projekt befindet sich in einer operativen Phase, hat aber kein Projektgewerk.",
    recommendation: "Das führende Gewerk in den Projektinformationen ergänzen.",
  }, operational && !project.trade);

  addIssue(issues, {
    id: "address-missing",
    severity: "warning",
    area: "Ausführung",
    title: "Ausführungsort ist nicht eindeutig",
    evidence: "Weder eine Objektadresse noch eine freie Projektadresse ist hinterlegt.",
    recommendation: "Eine vorhandene Objektadresse auswählen oder die Projektadresse ergänzen.",
  }, operational && !project.objectAddressId && !project.address);

  addIssue(issues, {
    id: "recurring-billing-mode-missing",
    severity: "critical",
    area: "Abrechnung",
    title: "Abrechnungsmodell des Dauerläufers fehlt",
    evidence: "Der Dauerläufer ist weder als Stundenabrechnung noch als Monatspauschale eindeutig konfiguriert.",
    recommendation: "Das Abrechnungsmodell in den Projektinformationen festlegen.",
  }, recurring && !hourlyRecurring && !monthlyRecurring);

  addIssue(issues, {
    id: "recurring-runtime-missing",
    severity: "warning",
    area: "Laufzeit",
    title: "Laufzeit des Dauerläufers ist unvollständig",
    evidence: "Start- oder Endmonat fehlt. Forecast, Vorgabezeiten und Monatslogik können dadurch unvollständig sein.",
    recommendation: "Ausführungszeitraum von und bis vollständig pflegen.",
  }, recurring && (!project.projectRuntimeFrom || !project.projectRuntimeUntil));

  addIssue(issues, {
    id: "one-time-offer-link-missing",
    severity: "critical",
    area: "Leistungszuordnung",
    title: "Manuelle Zeiten ohne Angebotszuweisung",
    evidence: `${snapshot.manualOneTimeEntriesWithoutOffer} manuelle Zeiteintragung/Zeiteintragungen sind keinem Angebot zugewiesen.`,
    recommendation: "Bei den betroffenen Zeiteinträgen das passende Projektangebot auswählen.",
  }, !recurring && snapshot.manualOneTimeEntriesWithoutOffer > 0);

  addIssue(issues, {
    id: "cost-snapshot-missing",
    severity: "warning",
    area: "Projektgewinn",
    title: "Projektgewinn ist nicht vollständig belastbar",
    evidence: `${snapshot.timeEntriesWithoutCostSnapshot} Zeiteintrag/Zeiteinträge enthalten keinen Mitarbeiterkostensatz-Snapshot.`,
    recommendation:
      "Die betroffenen Stempelungen fachlich prüfen. Kostensätze nicht automatisch rückwirkend überschreiben.",
  }, typeof snapshot.timeEntriesWithoutCostSnapshot === "number" && snapshot.timeEntriesWithoutCostSnapshot > 0);

  addIssue(issues, {
    id: "time-budget-invalid",
    severity: "warning",
    area: "Zeitbudget",
    title: "Aktiviertes Zeitbudget hat keinen gültigen Stundenwert",
    evidence: "Die Zeitbudgetsteuerung ist eingeschaltet, aber das Gesamtbudget ist leer oder null.",
    recommendation: "Ein belastbares Stundenbudget eintragen oder die Budgetsteuerung bewusst deaktivieren.",
  }, project.timeBudgetEnabled && !positiveNumber(project.timeBudgetHours));

  addIssue(issues, {
    id: "auto-billing-amount-invalid",
    severity: "critical",
    area: "Abrechnungsautomatik",
    title: "Automatische Pauschalabrechnung ist unvollständig",
    evidence: "Die Automatik ist aktiviert, aber der Nettoabrechnungsbetrag ist leer oder null.",
    recommendation: "Nettoabrechnungsbetrag und Rechnungsvorlage vor dem nächsten Lauf prüfen.",
  }, monthlyRecurring && project.autoBillingEnabled && !positiveNumber(project.autoBillingNetAmount));

  addIssue(issues, {
    id: "auto-billing-period-missing",
    severity: "warning",
    area: "Abrechnungsautomatik",
    title: "Abrechnungszeitraum der Automatik fehlt",
    evidence: "Start- oder Endmonat der automatischen Pauschalabrechnung ist nicht gepflegt.",
    recommendation: "Start- und Endmonat passend zur Projektlaufzeit ergänzen.",
  }, monthlyRecurring && project.autoBillingEnabled &&
    (!project.autoBillingStartMonth || !project.autoBillingEndMonth));

  addIssue(issues, {
    id: "planned-without-planning",
    severity: "warning",
    area: "Planung",
    title: "Projektstatus und Terminplanung passen nicht zusammen",
    evidence: "Das Projekt steht auf „Geplant“, hat aber keinen zukünftigen, nicht gelöschten Planungseintrag.",
    recommendation: "Einen Termin anlegen oder den Projektstatus fachlich korrigieren.",
  }, normalize(project.status) === "geplant" && snapshot.futurePlanningCount === 0);

  addIssue(issues, {
    id: "offer-status-without-offer",
    severity: "warning",
    area: "Angebot",
    title: "Angebotsstatus ohne Angebotsdatensatz",
    evidence: "Das Projekt steht in der Angebotsphase, aber es wurde kein sichtbares, nicht gelöschtes Angebot gefunden.",
    recommendation: "Angebot anlegen oder den Projektstatus korrigieren.",
  }, normalize(project.status) === "angebot" && snapshot.offerCount === 0);

  addIssue(issues, {
    id: "billing-check-without-draft",
    severity: "warning",
    area: "Abrechnung",
    title: "Abrechnungsprüfung ohne Rechnungsentwurf",
    evidence: "Das Projekt steht in der Abrechnungsprüfung, aber es ist kein Rechnungsentwurf vorhanden.",
    recommendation: "Nachweise und Leistungen prüfen und anschließend einen Rechnungsentwurf anlegen.",
  }, normalize(project.status).includes("abrechnungsprufung") &&
    snapshot.invoiceCount !== undefined &&
    snapshot.draftInvoiceCount === 0);

  addIssue(issues, {
    id: "overdue-visible-tasks",
    severity: "warning",
    area: "Aufgaben",
    title: "Überfällige Projektaufgaben sind offen",
    evidence: `${snapshot.visibleOverdueTaskCount} für deine Rolle sichtbare Aufgabe/Aufgaben sind überfällig.`,
    recommendation: "Verantwortung, Termin und nächsten Arbeitsschritt der betroffenen Aufgaben klären.",
  }, typeof snapshot.visibleOverdueTaskCount === "number" && snapshot.visibleOverdueTaskCount > 0);

  for (const stampIssue of snapshot.stampDiagnostics?.issues ?? []) {
    if (!issues.some((issue) => issue.id === stampIssue.id)) {
      issues.push(stampIssue);
    }
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.length - criticalCount;
  const score = Math.max(0, 100 - criticalCount * 22 - warningCount * 8);
  const status =
    criticalCount > 0 || score < 60
      ? "critical"
      : warningCount > 0 || score < 90
        ? "attention"
        : "healthy";
  const automationSummary = recurring
    ? hourlyRecurring
      ? [
          "Dauerläufer mit Stundenabrechnung: Die erste passende Monatsstempelung soll genau einen Rechnungsentwurf erzeugen.",
          "Weitere Monatsstempelungen werden nach Gewerk und Abrechnungsleistung an denselben Entwurf angehängt.",
        ]
      : monthlyRecurring
        ? [
            "Dauerläufer mit Monatspauschale: Stunden benötigen keine einzelne Abrechnungsleistung.",
            project.autoBillingEnabled
              ? "Die automatische Pauschalabrechnung ist für dieses Projekt aktiviert."
              : "Die automatische Pauschalabrechnung ist für dieses Projekt nicht aktiviert.",
          ]
        : ["Die Dauerläufer-Abrechnungslogik kann erst nach Wahl des Abrechnungsmodells sicher arbeiten."]
    : [
        "Einmaliges Projekt: Manuelle Zeiten benötigen eine Angebotszuweisung auf Angebotsebene.",
        "Der Projektabschluss folgt der einmaligen Projektpipeline und nicht der monatlichen Dauerläufer-Faktura.",
      ];

  return { score, status, issues, automationSummary };
}

function extractProjectReference(question: string) {
  const candidates = question.match(/\b(?:[A-ZÄÖÜ]{2,}[- ]?\d{2,}|\d{5,})\b/giu);
  return candidates?.[0]?.trim() ?? "";
}

async function findProject(
  organizationId: string,
  question: string,
  context?: JarvisSurfaceContext
) {
  if (context?.recordType === "project" && context.recordId) {
    const rows = await prisma.$queryRaw<ProjectHealthRow[]>(Prisma.sql`
      SELECT *
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${organizationId}
        AND "id" = ${context.recordId}
      LIMIT 1
    `);
    return rows[0];
  }

  const reference = extractProjectReference(question);
  if (!reference) return undefined;
  const rows = await prisma.$queryRaw<ProjectHealthRow[]>(Prisma.sql`
    SELECT *
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND (
        "projectNumber" ILIKE ${reference}
        OR "id" = ${reference}
      )
    ORDER BY "updatedAt" DESC
    LIMIT 2
  `);
  return rows.length === 1 ? rows[0] : undefined;
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
}): Promise<JarvisReadResponse | undefined> {
  if (!resolveJarvisProjectHealthIntent(input.question, input.context)) return undefined;

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
    input.context
  );
  if (!project) {
    return {
      type: "unknown",
      topicId: "project.health.context-required",
      message:
        "Für den Gesundheitscheck brauche ich ein eindeutiges Projekt. Öffne die Projektakte und frage „Prüfe dieses Projekt“ oder nenne die vollständige Projektnummer.",
      deterministic: true,
    };
  }

  const offerDecision = getJarvisActionDecision("offer.read", input.accessProfile);
  const invoiceDecision = getJarvisActionDecision("invoice.read", input.accessProfile);
  const taskDecision = getJarvisActionDecision("task.read", input.accessProfile);
  const contactDecision = getJarvisActionDecision("contact.read", input.accessProfile);
  const canReadCosts = canAccessJarvisDataClass(input.accessProfile, "payroll");
  const canVerifyInterruptionTasks =
    taskDecision.executable && canVerifyAllProjectTasks(input.accessProfile);
  const canInspectCrossProjectTimes =
    canManageProjectTimeEntries(input.accessProfile.sessionActor) &&
    canManageProjectTimeEntries(input.accessProfile.effectiveActor);
  const stableContactIds = [
    project.contactId,
    project.contactPersonId,
    project.addressContactId,
  ].filter((value): value is string => Boolean(value));

  const [
    timeEntries,
    activeSessions,
    futurePlanningCount,
    logbookEntryCount,
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
    prisma.planningEntry.count({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
        deletedAt: null,
        date: { gte: getBerlinDateKey() },
      },
    }),
    prisma.projectLogbookEntry.count({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
      },
    }),
    offerDecision.executable
      ? prisma.offer.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: project.id,
            status: { notIn: ["Gelöscht", "Gel\u00c3\u00b6scht"] },
          },
          select: { id: true, projectId: true, status: true },
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
            status: true,
            billingSource: true,
            plannedExecutionMonth: true,
            netTotal: true,
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
  const [linkedPlanningEntries, invoiceLines, invoiceLaborItems] = await Promise.all([
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
            quantity: true,
            unitPrice: true,
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
  const recurring = isRecurringProject(project.projectKind);
  const hourlyRecurring = recurring && project.recurringBillingMode === "hourly";
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
  const activeInvoices = invoices?.filter(
    (invoice) =>
      ![
        "Gelöscht",
        "Gel\u00c3\u00b6scht",
        "Storniert",
        "Stornorechnung",
      ].includes(invoice.status)
  );
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
    futurePlanningCount,
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
    stampDiagnostics,
    checkedAreas,
    restrictedAreas,
  };
  const evaluation = evaluateProjectHealth(snapshot);
  const criticalIssues = evaluation.issues.filter(
    (issue) => issue.severity === "critical"
  );
  const warningIssues = evaluation.issues.filter(
    (issue) => issue.severity === "warning"
  );
  const topIssue = criticalIssues[0] ?? warningIssues[0];
  const projectLabel = [project.projectNumber, project.title].filter(Boolean).join(" · ");

  return {
    type: "answer",
    topicId: "project.health",
    message: topIssue
      ? `${projectLabel} erreicht im freigegebenen Prüfumfang ${evaluation.score} von 100 Punkten. Wichtigster Prüfpunkt: ${topIssue.title}. ${topIssue.recommendation}`
      : `${projectLabel} erreicht im freigegebenen Prüfumfang 100 von 100 Punkten. In den geprüften Bereichen wurde kein konkreter Daten- oder Logikfehler gefunden.`,
    structured: {
      title: `Projekt-Gesundheitscheck · ${project.projectNumber || project.title}`,
      subtitle: `${project.customer || "Ohne Kundenanzeige"} · ${project.status || "Ohne Status"}`,
      summary:
        evaluation.status === "healthy"
          ? `Die ${snapshot.checkedAreas.length} freigegebenen Prüfbereiche sind aktuell schlüssig.`
          : `${criticalIssues.length} kritische und ${warningIssues.length} weitere Prüfungen wurden nachvollziehbar erkannt.`,
      facts: [
        {
          label: "Prüfwert",
          value: `${evaluation.score} / 100`,
          tone: evaluation.status === "healthy" ? "positive" : "warning",
        },
        {
          label: "Einordnung",
          value: formatHealthStatus(evaluation.status),
          tone: evaluation.status === "healthy" ? "positive" : "warning",
        },
        {
          label: "Prüfumfang",
          value: `${snapshot.checkedAreas.length} / 7 Bereiche`,
        },
        {
          label: "Stempelungen",
          value: `${stampDiagnostics.metrics.entries} · ${stampDiagnostics.metrics.totalHours} Std.`,
        },
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
          title: "Geprüfter Umfang",
          items: [
            ...snapshot.checkedAreas,
            ...stampDiagnostics.checkedRules.map((rule) => `Stempeldiagnose: ${rule}`),
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
      ],
    },
    records: [{
      id: `project-health-${project.id}`,
      kind: "project",
      title: projectLabel,
      subtitle: project.customer || project.projectType || "Projekt",
      summary: `${formatHealthStatus(evaluation.status)} · ${evaluation.issues.length} Prüfpunkt/Prüfpunkte`,
      status: project.status,
      target: { kind: "project", id: project.id },
    }],
    deterministic: true,
  };
}
