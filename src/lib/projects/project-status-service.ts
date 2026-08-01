import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type ProjectStatusDb = Prisma.TransactionClient | typeof prisma;

export const PROJECT_OPERATIONAL_STATUSES = [
  "Lead / Klärung",
  "Angebot",
  "Warten auf Kunde",
  "Zur Planung bereit",
  "Geplant",
  "Umsetzung",
  "Arbeit unterbrochen",
  "Abrechnungsprüfung",
  "Zur Abrechnung bereit",
  "Abgeschlossen",
] as const;

export type ProjectOperationalStatus = (typeof PROJECT_OPERATIONAL_STATUSES)[number];

const STATUS_INDEX = new Map(PROJECT_OPERATIONAL_STATUSES.map((status, index) => [status, index]));
const INACTIVE_OFFER_MARKERS = ["entwurf", "verloren", "abgelehnt", "storniert", "gelöscht", "deleted"];

export class ProjectStatusServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "blocked" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ProjectStatusServiceError";
  }
}

export type ProjectStatusEvaluation = {
  reason: string;
  targetStatus: ProjectOperationalStatus;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    customer: string;
    currentStatus: string;
    projectKind: string;
    projectType: string;
    runtimeUntil: string;
    responsibleName: string;
    updatedAt: string;
  };
  evidence: {
    activeOffers: number;
    confirmedPlanningEntries: number;
    projectTimeEntries: number;
    runningStampSessions: number;
    finalInspections: number;
    activeFinalInvoices: number;
    openTasks: number;
  };
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeComparison(value: unknown) {
  return cleanText(value, 180)
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeProjectOperationalStatus(value: unknown): ProjectOperationalStatus | "" {
  const normalized = normalizeComparison(value);
  const aliases: Record<string, ProjectOperationalStatus> = {
    "lead / klarung": "Lead / Klärung",
    "lead & klarung": "Lead / Klärung",
    lead: "Lead / Klärung",
    angebot: "Angebot",
    "warten auf kunde": "Warten auf Kunde",
    "zur planung bereit": "Zur Planung bereit",
    geplant: "Geplant",
    umsetzung: "Umsetzung",
    "in umsetzung": "Umsetzung",
    "arbeit unterbrochen": "Arbeit unterbrochen",
    unterbrochen: "Arbeit unterbrochen",
    abrechnungsprufung: "Abrechnungsprüfung",
    endkontrolle: "Abrechnungsprüfung",
    "zur abrechnung bereit": "Zur Abrechnung bereit",
    abgeschlossen: "Abgeschlossen",
  };
  return aliases[normalized] || "";
}

export function getProjectStatusConfirmationText(projectNumber: string, targetStatus: ProjectOperationalStatus) {
  return `PROJEKTSTATUS ${cleanText(projectNumber, 120)} AUF ${targetStatus}`;
}

export function matchesProjectStatusConfirmation(
  projectNumber: string,
  targetStatus: ProjectOperationalStatus,
  confirmationText: string
) {
  return confirmationText.trim() === getProjectStatusConfirmationText(projectNumber, targetStatus);
}

function isRecurringProject(projectKind: string) {
  const normalized = normalizeComparison(projectKind);
  return normalized.includes("dauerl") || normalized.includes("wiederkehr");
}

function runtimeIsInFuture(runtimeUntil: string) {
  if (!/^\d{4}-\d{2}/.test(runtimeUntil)) return false;
  return runtimeUntil.slice(0, 7) > new Date().toISOString().slice(0, 7);
}

export async function evaluateProjectStatusChange(input: {
  organizationId: string;
  projectId: string;
  targetStatus: string;
  reason?: string;
  db?: ProjectStatusDb;
}): Promise<ProjectStatusEvaluation> {
  const db = input.db ?? prisma;
  const reason = cleanText(input.reason, 500);
  const targetStatus = normalizeProjectOperationalStatus(input.targetStatus);
  if (!targetStatus) {
    throw new ProjectStatusServiceError("invalid_input", "Der gewünschte Projektstatus ist nicht als operativer WorkPilot-Status freigegeben.");
  }
  const project = await db.workPilotProject.findFirst({
    where: { id: input.projectId, organizationId: input.organizationId },
    select: {
      id: true,
      projectNumber: true,
      title: true,
      customer: true,
      status: true,
      projectKind: true,
      projectType: true,
      projectRuntimeUntil: true,
      responsibleName: true,
      timeBudgetEnabled: true,
      autoBillingEnabled: true,
      updatedAt: true,
    },
  });
  if (!project) {
    throw new ProjectStatusServiceError("not_found", "Das Projekt wurde in der aktuellen Organisation nicht gefunden.");
  }

  const currentStatus = normalizeProjectOperationalStatus(project.status);
  const [offers, confirmedPlanningEntries, projectTimeEntries, runningStampSessions, finalInspections, activeFinalInvoices, openTasks, currentTimeline] = await Promise.all([
    db.offer.findMany({
      where: { organizationId: input.organizationId, projectId: project.id },
      select: { id: true, status: true, updatedAt: true },
    }),
    db.planningEntry.count({
      where: { organizationId: input.organizationId, projectId: project.id, approvalStatus: "confirmed", deletedAt: null },
    }),
    db.projectTimeEntry.count({
      where: { organizationId: input.organizationId, projectId: project.id, mode: "project", deletedAt: null },
    }),
    db.activeStampSession.count({ where: { organizationId: input.organizationId, projectId: project.id } }),
    db.projectLogbookEntry.count({
      where: { organizationId: input.organizationId, projectId: project.id, title: "Dokumente: Endkontrolle" },
    }),
    db.invoice.count({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
        status: { in: ["Fakturiert", "Bezahlt"] },
        sourceInvoiceId: "",
      },
    }),
    db.task.count({
      where: {
        organizationId: input.organizationId,
        projectId: project.id,
        status: { notIn: ["ERLEDIGT", "ABGELEHNT", "ARCHIVIERT"] },
      },
    }),
    db.statusTimelineEntry.findFirst({
      where: { organizationId: input.organizationId, entityType: "project", entityId: project.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, toStatus: true, startedAt: true },
    }),
  ]);
  const activeOffers = offers.filter((offer) => {
    const status = normalizeComparison(offer.status);
    return !INACTIVE_OFFER_MARKERS.some((marker) => status.includes(marker));
  }).length;
  const evidence = {
    activeOffers,
    confirmedPlanningEntries,
    projectTimeEntries,
    runningStampSessions,
    finalInspections,
    activeFinalInvoices,
    openTasks,
  };

  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  if (reason.length < 3) blockingIssues.push("Bitte dokumentiere einen nachvollziehbaren Grund mit mindestens 3 Zeichen.");
  if (!currentStatus) blockingIssues.push(`Der aktuelle Projektstatus „${project.status}“ ist nicht eindeutig als operativer WorkPilot-Status erkannt.`);
  if (normalizeComparison(project.status) === "archiviert") blockingIssues.push("Archivierte Projekte müssen über den separaten Wiederherstellungsprozess behandelt werden.");
  if (currentStatus === targetStatus) blockingIssues.push(`Das Projekt befindet sich bereits im Status „${targetStatus}“.`);
  if (targetStatus === "Geplant" && confirmedPlanningEntries === 0) {
    blockingIssues.push("Für den Status „Geplant“ ist mindestens ein bestätigter, nicht gelöschter Planungstermin erforderlich.");
  }
  if (targetStatus === "Abrechnungsprüfung" && projectTimeEntries === 0 && finalInspections === 0) {
    blockingIssues.push("Für die Abrechnungsprüfung fehlt ein Arbeits- oder Endkontrollnachweis.");
  }
  if (targetStatus === "Zur Abrechnung bereit" && finalInspections === 0) {
    blockingIssues.push("Für „Zur Abrechnung bereit“ ist eine dokumentierte Endkontrolle erforderlich.");
  }
  if (targetStatus === "Abgeschlossen" && activeFinalInvoices === 0) {
    blockingIssues.push("Ein Projekt darf erst mit einer aktiven fakturierten oder bezahlten Abschlussrechnung abgeschlossen werden.");
  }
  if (targetStatus === "Abgeschlossen" && isRecurringProject(project.projectKind || "") && runtimeIsInFuture(project.projectRuntimeUntil || "")) {
    blockingIssues.push("Der Dauerläufer besitzt noch eine zukünftige Projektlaufzeit und darf nicht vorzeitig abgeschlossen werden.");
  }
  if (targetStatus === "Warten auf Kunde" && activeOffers === 0) {
    warnings.push("Im Projekt ist kein aktives finales Angebot belegt. Prüfe, auf welche Kundenrückmeldung tatsächlich gewartet wird.");
  }
  if (targetStatus === "Zur Planung bereit" && activeOffers === 0 && !project.timeBudgetEnabled && !project.autoBillingEnabled) {
    warnings.push("Es ist weder ein aktives Angebot noch ein gepflegtes Zeit-/Pauschalbudget als Planungsgrundlage belegt.");
  }
  if (targetStatus === "Arbeit unterbrochen" && projectTimeEntries === 0 && runningStampSessions === 0) {
    warnings.push("Es ist noch keine Arbeitszeit als Ausführungsnachweis vorhanden. Der Unterbrechungsgrund muss deshalb besonders klar dokumentiert sein.");
  }
  const currentIndex = currentStatus ? STATUS_INDEX.get(currentStatus) : undefined;
  const targetIndex = STATUS_INDEX.get(targetStatus);
  if (currentIndex !== undefined && targetIndex !== undefined && targetIndex < currentIndex) {
    warnings.push(`Der Status wird rückwärts von „${currentStatus}“ auf „${targetStatus}“ gesetzt. Vorhandene Fachbelege werden dadurch nicht zurückgenommen.`);
  }
  warnings.push("Angebote, Rechnungen, Aufgaben, Termine, Zeiten, Dateien und Kundenbezüge bleiben unverändert.");
  warnings.push("JARVIS entscheidet den Projektstatus niemals automatisch; ausgeführt wird ausschließlich der ausdrücklich bestätigte Zielstatus.");

  const checks: ProjectStatusEvaluation["checks"] = [
    {
      key: "transition",
      label: "Statuswechsel",
      status: blockingIssues.length ? "blocked" : "ok",
      detail: blockingIssues.length ? blockingIssues.join(" · ") : `„${project.status}“ kann kontrolliert auf „${targetStatus}“ geändert werden.`,
    },
    {
      key: "reason",
      label: "Begründung",
      status: reason.length >= 3 ? "ok" : "blocked",
      detail: reason || "Grund fehlt.",
    },
    {
      key: "planning",
      label: "Planung",
      status: targetStatus === "Geplant" && confirmedPlanningEntries === 0 ? "blocked" : confirmedPlanningEntries ? "ok" : "warning",
      detail: `${confirmedPlanningEntries} bestätigte Planung(en).`,
    },
    {
      key: "execution",
      label: "Ausführungsnachweise",
      status: (targetStatus === "Abrechnungsprüfung" && projectTimeEntries === 0 && finalInspections === 0) || (targetStatus === "Zur Abrechnung bereit" && finalInspections === 0) ? "blocked" : projectTimeEntries || finalInspections ? "ok" : "warning",
      detail: `${projectTimeEntries} Zeiteintrag/-einträge, ${runningStampSessions} laufende Stempelung(en), ${finalInspections} Endkontrolle(n).`,
    },
    {
      key: "billing",
      label: "Abschlussrechnung",
      status: targetStatus === "Abgeschlossen" && activeFinalInvoices === 0 ? "blocked" : activeFinalInvoices ? "ok" : "warning",
      detail: `${activeFinalInvoices} aktive fakturierte oder bezahlte Abschlussrechnung(en).`,
    },
  ];
  const fingerprint = stableHash({
    project: {
      id: project.id,
      status: project.status,
      updatedAt: project.updatedAt.toISOString(),
      projectRuntimeUntil: project.projectRuntimeUntil || "",
      timeBudgetEnabled: project.timeBudgetEnabled,
      autoBillingEnabled: project.autoBillingEnabled,
    },
    targetStatus,
    reason,
    evidence,
    offers: offers.map((offer) => ({ id: offer.id, status: offer.status, updatedAt: offer.updatedAt.toISOString() })),
    currentTimeline: currentTimeline ? { id: currentTimeline.id, toStatus: currentTimeline.toStatus, startedAt: currentTimeline.startedAt.toISOString() } : null,
  });

  return {
    reason,
    targetStatus,
    project: {
      id: project.id,
      projectNumber: project.projectNumber,
      title: project.title,
      customer: project.customer || "",
      currentStatus: project.status,
      projectKind: project.projectKind || "",
      projectType: project.projectType || "",
      runtimeUntil: project.projectRuntimeUntil || "",
      responsibleName: project.responsibleName || "",
      updatedAt: project.updatedAt.toISOString(),
    },
    evidence,
    checks,
    warnings: [...new Set(warnings)],
    blockingIssues: [...new Set(blockingIssues)],
    fingerprint,
  };
}

export async function executeProjectStatusChange(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  projectId: string;
  targetStatus: string;
  reason: string;
  actorId: string;
  actorName: string;
  requestId: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  const requestId = cleanText(input.requestId, 120);
  if (!requestId) throw new ProjectStatusServiceError("invalid_input", "Eine eindeutige Ausführungs-ID fehlt.");
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:project-status:${input.organizationId}:${input.projectId}`}))`;
  const previousExecution = await input.tx.projectLogbookEntry.findFirst({
    where: { organizationId: input.organizationId, projectId: input.projectId, source: "project-status", callReference: requestId },
    select: { id: true },
  });
  if (previousExecution) {
    const project = await input.tx.workPilotProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId } });
    if (!project) throw new ProjectStatusServiceError("not_found", "Das bereits geänderte Projekt wurde nicht gefunden.");
    return { project, replayed: true };
  }
  const evaluated = await evaluateProjectStatusChange({ ...input, db: input.tx });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new ProjectStatusServiceError("stale_context", "Projekt oder Fachnachweise haben sich geändert. Bitte öffne eine neue Statusvorschau.");
  }
  if (evaluated.blockingIssues.length) throw new ProjectStatusServiceError("blocked", evaluated.blockingIssues.join(" · "));

  const changedAt = new Date();
  const changed = await input.tx.workPilotProject.updateMany({
    where: {
      id: input.projectId,
      organizationId: input.organizationId,
      status: evaluated.project.currentStatus,
      updatedAt: new Date(evaluated.project.updatedAt),
    },
    data: { status: evaluated.targetStatus, updatedAt: changedAt },
  });
  if (changed.count !== 1) throw new ProjectStatusServiceError("conflict", "Das Projekt wurde zwischenzeitlich verändert.");

  const note = `${input.source === "jarvis" ? "Durch JARVIS " : ""}kontrolliert geändert: ${evaluated.project.currentStatus} -> ${evaluated.targetStatus}. Grund: ${evaluated.reason}.`;
  await input.tx.$executeRaw`
    UPDATE "StatusTimelineEntry"
    SET "endedAt" = ${changedAt},
        "durationMinutes" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${changedAt} - "startedAt")) / 60)::INTEGER)
    WHERE "organizationId" = ${input.organizationId}
      AND "entityType" = 'project'
      AND "entityId" = ${input.projectId}
      AND "endedAt" IS NULL
  `;
  await input.tx.statusTimelineEntry.create({ data: {
    id: randomUUID(),
    organizationId: input.organizationId,
    entityType: "project",
    entityId: input.projectId,
    entityLabel: `${evaluated.project.projectNumber} | ${evaluated.project.title}`,
    fromStatus: evaluated.project.currentStatus,
    toStatus: evaluated.targetStatus,
    startedAt: changedAt,
    actorUserId: input.actorId,
    actorName: input.actorName,
    note,
  } });
  await input.tx.projectLogbookEntry.create({ data: {
    id: randomUUID(),
    organizationId: input.organizationId,
    projectId: input.projectId,
    title: "Projektstatus",
    body: note,
    author: input.actorName,
    authorUserId: input.actorId,
    source: "project-status",
    callReference: requestId,
  } });
  await input.tx.auditLog.create({ data: {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "project.status.changed",
    entityType: "project",
    entityId: input.projectId,
    payload: { fromStatus: evaluated.project.currentStatus, toStatus: evaluated.targetStatus, reason: evaluated.reason, source: input.source, requestId },
  } });
  await input.tx.statusEscalationEvent.updateMany({
    where: { organizationId: input.organizationId, entityType: "project", entityId: input.projectId, resolvedAt: null, status: { not: evaluated.targetStatus } },
    data: { resolvedAt: changedAt },
  });
  const project = await input.tx.workPilotProject.findFirstOrThrow({ where: { id: input.projectId, organizationId: input.organizationId } });
  return { project, replayed: false };
}
