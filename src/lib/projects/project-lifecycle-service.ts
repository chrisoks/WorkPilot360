import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { normalizeProjectOperationalStatus, type ProjectOperationalStatus } from "@/lib/projects/project-status-service";

type ProjectLifecycleDb = Prisma.TransactionClient | typeof prisma;
export type ProjectLifecycleAction = "archive" | "restore";

export class ProjectLifecycleServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "blocked" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ProjectLifecycleServiceError";
  }
}

export type ProjectLifecycleEvaluation = {
  lifecycleAction: ProjectLifecycleAction;
  reason: string;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    customer: string;
    currentStatus: string;
    projectKind: string;
    responsibleName: string;
    restoreStatus: ProjectOperationalStatus | "";
    updatedAt: string;
  };
  evidence: {
    offers: number;
    activeOffers: number;
    invoices: number;
    unpaidInvoices: number;
    planningEntries: number;
    futureConfirmedPlanningEntries: number;
    projectTimeEntries: number;
    runningStampSessions: number;
    openTasks: number;
    storedFiles: number;
    onlineRequests: number;
  };
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalized(value: unknown) {
  return cleanText(value, 180).toLocaleLowerCase("de-DE").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeProjectLifecycleAction(value: unknown): ProjectLifecycleAction | "" {
  const valueNormalized = normalized(value);
  if (["archive", "archivieren", "archiviert"].includes(valueNormalized)) return "archive";
  if (["restore", "wiederherstellen", "reaktivieren"].includes(valueNormalized)) return "restore";
  return "";
}

export function getProjectLifecycleConfirmationText(
  projectNumber: string,
  lifecycleAction: ProjectLifecycleAction
) {
  return lifecycleAction === "archive"
    ? `PROJEKT ARCHIVIEREN ${cleanText(projectNumber, 120)}`
    : `PROJEKT WIEDERHERSTELLEN ${cleanText(projectNumber, 120)}`;
}

export function matchesProjectLifecycleConfirmation(
  projectNumber: string,
  lifecycleAction: ProjectLifecycleAction,
  confirmationText: string
) {
  return confirmationText.trim() === getProjectLifecycleConfirmationText(projectNumber, lifecycleAction);
}

const INACTIVE_OFFER_MARKERS = ["entwurf", "verloren", "abgelehnt", "storniert", "geloscht", "deleted"];
const CLOSED_TASK_STATUSES = ["ERLEDIGT", "ABGELEHNT", "ARCHIVIERT"];

export async function evaluateProjectLifecycle(input: {
  organizationId: string;
  projectId: string;
  lifecycleAction: string;
  reason?: string;
  db?: ProjectLifecycleDb;
}): Promise<ProjectLifecycleEvaluation> {
  const db = input.db ?? prisma;
  const lifecycleAction = normalizeProjectLifecycleAction(input.lifecycleAction);
  if (!lifecycleAction) throw new ProjectLifecycleServiceError("invalid_input", "Die Projektaktion ist nicht eindeutig.");
  const reason = cleanText(input.reason, 500);
  const project = await db.workPilotProject.findFirst({
    where: { id: input.projectId, organizationId: input.organizationId },
    select: { id: true, projectNumber: true, title: true, customer: true, status: true, projectKind: true, responsibleName: true, updatedAt: true },
  });
  if (!project) throw new ProjectLifecycleServiceError("not_found", "Das Projekt wurde in der aktuellen Organisation nicht gefunden.");

  const today = new Date().toISOString().slice(0, 10);
  const [offers, invoices, planningEntries, futureConfirmedPlanningEntries, projectTimeEntries, runningStampSessions, openTasks, storedFiles, onlineRequests, currentTimeline] = await Promise.all([
    db.offer.findMany({ where: { organizationId: input.organizationId, projectId: project.id }, select: { id: true, status: true, updatedAt: true } }),
    db.invoice.findMany({ where: { organizationId: input.organizationId, projectId: project.id }, select: { id: true, status: true, isPaid: true, updatedAt: true } }),
    db.planningEntry.count({ where: { organizationId: input.organizationId, projectId: project.id, deletedAt: null } }),
    db.planningEntry.count({ where: { organizationId: input.organizationId, projectId: project.id, deletedAt: null, approvalStatus: "confirmed", date: { gte: today } } }),
    db.projectTimeEntry.count({ where: { organizationId: input.organizationId, projectId: project.id, deletedAt: null } }),
    db.activeStampSession.count({ where: { organizationId: input.organizationId, projectId: project.id } }),
    db.task.count({ where: { organizationId: input.organizationId, projectId: project.id, status: { notIn: CLOSED_TASK_STATUSES as never } } }),
    db.storedFile.count({ where: { organizationId: input.organizationId, ownerType: "project", ownerId: project.id, deletedAt: null } }),
    db.onlineRequest.count({ where: { organizationId: input.organizationId, convertedProjectId: project.id } }),
    db.statusTimelineEntry.findFirst({
      where: { organizationId: input.organizationId, entityType: "project", entityId: project.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, fromStatus: true, toStatus: true, startedAt: true },
    }),
  ]);
  const activeOffers = offers.filter((offer) => !INACTIVE_OFFER_MARKERS.some((marker) => normalized(offer.status).includes(marker))).length;
  const unpaidInvoices = invoices.filter((invoice) => !invoice.isPaid && !["storniert", "geloscht", "deleted"].some((marker) => normalized(invoice.status).includes(marker))).length;
  const restoreStatus = lifecycleAction === "restore" && currentTimeline?.toStatus === "Archiviert"
    ? normalizeProjectOperationalStatus(currentTimeline.fromStatus)
    : "";
  const evidence = {
    offers: offers.length,
    activeOffers,
    invoices: invoices.length,
    unpaidInvoices,
    planningEntries,
    futureConfirmedPlanningEntries,
    projectTimeEntries,
    runningStampSessions,
    openTasks,
    storedFiles,
    onlineRequests,
  };
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  if (reason.length < 3) blockingIssues.push("Bitte dokumentiere einen nachvollziehbaren Grund mit mindestens 3 Zeichen.");
  if (lifecycleAction === "archive") {
    if (project.status === "Archiviert") blockingIssues.push("Das Projekt ist bereits archiviert.");
    if (!normalizeProjectOperationalStatus(project.status)) blockingIssues.push(`Der aktuelle Status „${project.status}“ ist kein sicher wiederherstellbarer operativer Projektstatus.`);
    if (runningStampSessions > 0) blockingIssues.push(`${runningStampSessions} laufende Stempelung(en) müssen vor der Archivierung beendet werden.`);
    if (futureConfirmedPlanningEntries > 0) blockingIssues.push(`${futureConfirmedPlanningEntries} zukünftige bestätigte Planung(en) müssen vor der Archivierung geklärt werden.`);
    if (openTasks > 0) blockingIssues.push(`${openTasks} offene Aufgabe(n) müssen vor der Archivierung abgeschlossen, abgelehnt oder archiviert werden.`);
  } else {
    if (project.status !== "Archiviert") blockingIssues.push("Nur ein aktuell archiviertes Projekt kann wiederhergestellt werden.");
    if (!currentTimeline || currentTimeline.toStatus !== "Archiviert" || !restoreStatus) {
      blockingIssues.push("Der vorherige operative Status ist nicht revisionssicher belegt. Eine automatische Wiederherstellung ist deshalb gesperrt.");
    }
  }
  if (activeOffers) warnings.push(`${activeOffers} aktive(s) Angebot(e) bleiben unverändert mit dem Projekt verknüpft.`);
  if (unpaidInvoices) warnings.push(`${unpaidInvoices} unbezahlte aktive Rechnung(en) bleiben unverändert und weiter nachverfolgbar.`);
  warnings.push("Planungen, Aufgaben, Angebote, Rechnungen, Zeiten, Dateien und Online-Anfragen werden weder gelöscht noch umgehängt.");
  warnings.push(lifecycleAction === "archive"
    ? "Die Archivierung blendet das Projekt aus den operativen Ansichten aus und kann kontrolliert rückgängig gemacht werden."
    : `Das Projekt wird exakt in den belegten vorherigen Status „${restoreStatus || "unbekannt"}“ zurückversetzt.`);

  const checks: ProjectLifecycleEvaluation["checks"] = [
    { key: "reason", label: "Begründung", status: reason.length >= 3 ? "ok" : "blocked", detail: reason || "Grund fehlt." },
    { key: "running-time", label: "Laufende Stempelungen", status: runningStampSessions ? "blocked" : "ok", detail: `${runningStampSessions} laufende Stempelung(en).` },
    { key: "planning", label: "Zukünftige Planung", status: lifecycleAction === "archive" && futureConfirmedPlanningEntries ? "blocked" : planningEntries ? "warning" : "ok", detail: `${planningEntries} Planung(en), davon ${futureConfirmedPlanningEntries} zukünftig bestätigt.` },
    { key: "tasks", label: "Aufgaben", status: lifecycleAction === "archive" && openTasks ? "blocked" : openTasks ? "warning" : "ok", detail: `${openTasks} offene Aufgabe(n).` },
    { key: "documents", label: "Belege und Dateien", status: activeOffers || unpaidInvoices ? "warning" : "ok", detail: `${offers.length} Angebot(e), ${invoices.length} Rechnung(en), ${storedFiles} Datei(en), ${onlineRequests} Online-Anfrage(n).` },
    { key: "restore-proof", label: "Wiederherstellungsstatus", status: lifecycleAction === "restore" ? (restoreStatus ? "ok" : "blocked") : "ok", detail: lifecycleAction === "restore" ? (restoreStatus || "Nicht revisionssicher belegt.") : project.status },
  ];
  const fingerprint = stableHash({
    project: { id: project.id, status: project.status, updatedAt: project.updatedAt.toISOString() },
    lifecycleAction, reason, evidence,
    offers: offers.map((item) => ({ id: item.id, status: item.status, updatedAt: item.updatedAt.toISOString() })),
    invoices: invoices.map((item) => ({ id: item.id, status: item.status, isPaid: item.isPaid, updatedAt: item.updatedAt.toISOString() })),
    currentTimeline: currentTimeline ? { ...currentTimeline, startedAt: currentTimeline.startedAt.toISOString() } : null,
  });
  return {
    lifecycleAction, reason,
    project: { id: project.id, projectNumber: project.projectNumber, title: project.title, customer: project.customer || "", currentStatus: project.status, projectKind: project.projectKind || "", responsibleName: project.responsibleName || "", restoreStatus, updatedAt: project.updatedAt.toISOString() },
    evidence, checks, warnings: [...new Set(warnings)], blockingIssues: [...new Set(blockingIssues)], fingerprint,
  };
}

export async function executeProjectLifecycle(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  projectId: string;
  lifecycleAction: ProjectLifecycleAction;
  reason: string;
  actorId: string;
  actorName: string;
  requestId: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  const requestId = cleanText(input.requestId, 120);
  if (!requestId) throw new ProjectLifecycleServiceError("invalid_input", "Eine eindeutige Ausführungs-ID fehlt.");
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:project-lifecycle:${input.organizationId}:${input.projectId}`}))`;
  const source = `project-${input.lifecycleAction}`;
  const previousExecution = await input.tx.projectLogbookEntry.findFirst({ where: { organizationId: input.organizationId, projectId: input.projectId, source, callReference: requestId }, select: { id: true } });
  if (previousExecution) {
    const project = await input.tx.workPilotProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId } });
    if (!project) throw new ProjectLifecycleServiceError("not_found", "Das bereits verarbeitete Projekt wurde nicht gefunden.");
    return { project, replayed: true };
  }
  const evaluation = await evaluateProjectLifecycle({ ...input, db: input.tx });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluation.fingerprint) throw new ProjectLifecycleServiceError("stale_context", "Projekt oder Verknüpfungen haben sich geändert. Bitte öffne eine neue Vorschau.");
  if (evaluation.blockingIssues.length) throw new ProjectLifecycleServiceError("blocked", evaluation.blockingIssues.join(" · "));
  const targetStatus = input.lifecycleAction === "archive" ? "Archiviert" : evaluation.project.restoreStatus;
  if (!targetStatus) throw new ProjectLifecycleServiceError("blocked", "Der Wiederherstellungsstatus ist nicht sicher belegt.");
  const changedAt = new Date();
  const changed = await input.tx.workPilotProject.updateMany({
    where: { id: input.projectId, organizationId: input.organizationId, status: evaluation.project.currentStatus, updatedAt: new Date(evaluation.project.updatedAt) },
    data: { status: targetStatus, updatedAt: changedAt },
  });
  if (changed.count !== 1) throw new ProjectLifecycleServiceError("conflict", "Das Projekt wurde zwischenzeitlich verändert.");
  const verb = input.lifecycleAction === "archive" ? "archiviert" : "wiederhergestellt";
  const note = `${input.source === "jarvis" ? "Durch JARVIS " : ""}kontrolliert ${verb}: ${evaluation.project.currentStatus} -> ${targetStatus}. Grund: ${evaluation.reason}.`;
  await input.tx.$executeRaw`
    UPDATE "StatusTimelineEntry" SET "endedAt" = ${changedAt}, "durationMinutes" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${changedAt} - "startedAt")) / 60)::INTEGER)
    WHERE "organizationId" = ${input.organizationId} AND "entityType" = 'project' AND "entityId" = ${input.projectId} AND "endedAt" IS NULL
  `;
  await input.tx.statusTimelineEntry.create({ data: { id: randomUUID(), organizationId: input.organizationId, entityType: "project", entityId: input.projectId, entityLabel: `${evaluation.project.projectNumber} | ${evaluation.project.title}`, fromStatus: evaluation.project.currentStatus, toStatus: targetStatus, startedAt: changedAt, actorUserId: input.actorId, actorName: input.actorName, note } });
  await input.tx.projectLogbookEntry.create({ data: { id: randomUUID(), organizationId: input.organizationId, projectId: input.projectId, title: input.lifecycleAction === "archive" ? "Projekt archiviert" : "Projekt wiederhergestellt", body: note, author: input.actorName, authorUserId: input.actorId, source, callReference: requestId } });
  await input.tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: `project.${input.lifecycleAction}d`, entityType: "project", entityId: input.projectId, payload: { fromStatus: evaluation.project.currentStatus, toStatus: targetStatus, reason: evaluation.reason, source: input.source, requestId } } });
  await input.tx.statusEscalationEvent.updateMany({ where: { organizationId: input.organizationId, entityType: "project", entityId: input.projectId, resolvedAt: null, status: { not: targetStatus } }, data: { resolvedAt: changedAt } });
  const project = await input.tx.workPilotProject.findFirstOrThrow({ where: { id: input.projectId, organizationId: input.organizationId } });
  return { project, replayed: false };
}
