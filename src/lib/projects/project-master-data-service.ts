import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  getProjectReviewStatusAfterEdit,
  hasProjectReviewRelevantChange,
} from "@/lib/projects/review-status";

type ProjectMasterDataDb = Prisma.TransactionClient | typeof prisma;

export const PROJECT_MASTER_DATA_FIELDS = [
  "title",
  "description",
  "projectRuntimeFrom",
  "projectRuntimeUntil",
  "trade",
  "address",
  "participants",
  "responsibleName",
  "deputyName",
  "deputyFrom",
  "deputyUntil",
] as const;

export type ProjectMasterDataField = (typeof PROJECT_MASTER_DATA_FIELDS)[number];
export type ProjectMasterDataChanges = Partial<Record<ProjectMasterDataField, string>>;

const FIELD_LABELS: Record<ProjectMasterDataField, string> = {
  title: "Projekttitel",
  description: "Beschreibung",
  projectRuntimeFrom: "Laufzeit von",
  projectRuntimeUntil: "Laufzeit bis",
  trade: "Gewerk",
  address: "Adresse",
  participants: "Beteiligte",
  responsibleName: "Projektverantwortung",
  deputyName: "Vertretung",
  deputyFrom: "Vertretung von",
  deputyUntil: "Vertretung bis",
};

const MONTH_FIELDS = new Set<ProjectMasterDataField>([
  "projectRuntimeFrom",
  "projectRuntimeUntil",
  "deputyFrom",
  "deputyUntil",
]);

export class ProjectMasterDataServiceError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_input"
      | "stale_context"
      | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ProjectMasterDataServiceError";
  }
}

function cleanSingleLine(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanField(field: ProjectMasterDataField, value: unknown) {
  if (field === "description") return String(value ?? "").trim().slice(0, 4000);
  return cleanSingleLine(value, field === "title" ? 180 : 500);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeChanges(input: ProjectMasterDataChanges) {
  return Object.fromEntries(
    PROJECT_MASTER_DATA_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(input, field)).map(
      (field) => [field, cleanField(field, input[field])]
    )
  ) as ProjectMasterDataChanges;
}

function validateMonth(field: ProjectMasterDataField, value: string) {
  if (value && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ProjectMasterDataServiceError(
      "invalid_input",
      `${FIELD_LABELS[field]} muss als Monat im Format JJJJ-MM angegeben werden.`
    );
  }
}

export function getProjectMasterDataConfirmationText(projectNumber: string) {
  return `PROJEKT ÄNDERN ${cleanSingleLine(projectNumber, 120)}`;
}

export function matchesProjectMasterDataConfirmation(projectNumber: string, confirmationText: string) {
  return confirmationText.trim() === getProjectMasterDataConfirmationText(projectNumber);
}

export type ProjectMasterDataEvaluation = {
  project: {
    id: string;
    projectNumber: string;
    title: string;
    customer: string;
    status: string;
    reviewStatus: string;
    updatedAt: string;
  };
  changes: Array<{ field: ProjectMasterDataField; label: string; before: string; after: string }>;
  reviewWillBeInvalidated: boolean;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

export async function evaluateProjectMasterDataChange(input: {
  organizationId: string;
  projectId: string;
  changes: ProjectMasterDataChanges;
  db?: ProjectMasterDataDb;
}): Promise<ProjectMasterDataEvaluation> {
  const db = input.db ?? prisma;
  const requested = normalizeChanges(input.changes);
  if (!Object.keys(requested).length) {
    throw new ProjectMasterDataServiceError("invalid_input", "Es wurde kein freigegebenes Projektfeld zur Änderung angegeben.");
  }
  for (const field of MONTH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(requested, field)) validateMonth(field, requested[field] || "");
  }
  if (Object.prototype.hasOwnProperty.call(requested, "title") && !requested.title) {
    throw new ProjectMasterDataServiceError("invalid_input", "Der Projekttitel darf nicht leer sein.");
  }

  const project = await db.workPilotProject.findFirst({
    where: { id: input.projectId, organizationId: input.organizationId },
    select: {
      id: true,
      projectNumber: true,
      title: true,
      customer: true,
      status: true,
      reviewStatus: true,
      description: true,
      projectRuntimeFrom: true,
      projectRuntimeUntil: true,
      trade: true,
      address: true,
      participants: true,
      responsibleName: true,
      deputyName: true,
      deputyFrom: true,
      deputyUntil: true,
      updatedAt: true,
    },
  });
  if (!project) throw new ProjectMasterDataServiceError("not_found", "Das Projekt wurde in der aktuellen Organisation nicht gefunden.");
  if (project.status === "Archiviert") {
    throw new ProjectMasterDataServiceError("invalid_input", "Archivierte Projekte müssen vor einer Stammdatenänderung kontrolliert wiederhergestellt werden.");
  }

  const changes = (Object.entries(requested) as Array<[ProjectMasterDataField, string]>).flatMap(
    ([field, after]) => {
      const before = cleanField(field, project[field]);
      return before === after ? [] : [{ field, label: FIELD_LABELS[field], before, after }];
    }
  );
  const blockingIssues: string[] = [];
  if (!changes.length) blockingIssues.push("Die gewünschten Werte entsprechen bereits dem aktuellen Projektstand.");
  const merged = { ...project, ...requested } as Record<string, unknown>;
  if (
    merged.projectRuntimeFrom &&
    merged.projectRuntimeUntil &&
    String(merged.projectRuntimeFrom) > String(merged.projectRuntimeUntil)
  ) {
    blockingIssues.push("Der Laufzeitbeginn liegt nach dem Laufzeitende.");
  }
  if (merged.deputyFrom && merged.deputyUntil && String(merged.deputyFrom) > String(merged.deputyUntil)) {
    blockingIssues.push("Der Vertretungsbeginn liegt nach dem Vertretungsende.");
  }

  const reviewWillBeInvalidated =
    project.reviewStatus === "approved" &&
    hasProjectReviewRelevantChange(project as unknown as Record<string, unknown>, merged);
  const warnings = [
    "Status, Kunde, Projektnummer, Abrechnung, Budgets, Angebote, Rechnungen, Termine, Aufgaben, Zeiten und Dateien bleiben unverändert.",
    ...(reviewWillBeInvalidated
      ? ["Die fachliche Projektfreigabe wird durch prüfrelevante Änderungen aufgehoben und auf „Prüfung erforderlich“ gesetzt."]
      : []),
  ];
  const checks: ProjectMasterDataEvaluation["checks"] = [
    {
      key: "changes",
      label: "Änderungsumfang",
      status: blockingIssues.length ? "blocked" : "ok",
      detail: changes.length ? `${changes.length} Feld(er) werden genau wie angezeigt geändert.` : blockingIssues[0],
    },
    {
      key: "review",
      label: "Fachliche Freigabe",
      status: reviewWillBeInvalidated ? "warning" : "ok",
      detail: reviewWillBeInvalidated ? "Die bestehende Freigabe wird kontrolliert aufgehoben." : "Der bestehende Prüfstatus bleibt erhalten.",
    },
  ];
  const fingerprint = stableHash({
    project: Object.fromEntries([
      "id",
      "projectNumber",
      "title",
      "status",
      "reviewStatus",
      "description",
      "projectRuntimeFrom",
      "projectRuntimeUntil",
      "trade",
      "address",
      "participants",
      "responsibleName",
      "deputyName",
      "deputyFrom",
      "deputyUntil",
      "updatedAt",
    ].map((key) => [key, key === "updatedAt" ? project.updatedAt.toISOString() : project[key as keyof typeof project] ?? ""])),
    requested,
  });

  return {
    project: {
      id: project.id,
      projectNumber: project.projectNumber,
      title: project.title,
      customer: project.customer || "",
      status: project.status,
      reviewStatus: project.reviewStatus,
      updatedAt: project.updatedAt.toISOString(),
    },
    changes,
    reviewWillBeInvalidated,
    checks,
    warnings,
    blockingIssues,
    fingerprint,
  };
}

export async function executeProjectMasterDataChange(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  projectId: string;
  changes: ProjectMasterDataChanges;
  actorId: string;
  actorName: string;
  requestId: string;
  expectedFingerprint?: string;
  source: "ui" | "jarvis";
}) {
  const requestId = cleanSingleLine(input.requestId, 120);
  if (!requestId) throw new ProjectMasterDataServiceError("invalid_input", "Eine eindeutige Ausführungs-ID fehlt.");
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:project-master-data:${input.organizationId}:${input.projectId}`}))`;
  const previousExecution = await input.tx.projectLogbookEntry.findFirst({
    where: { organizationId: input.organizationId, projectId: input.projectId, source: "project-master-data", callReference: requestId },
    select: { id: true },
  });
  if (previousExecution) {
    const project = await input.tx.workPilotProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId } });
    if (!project) throw new ProjectMasterDataServiceError("not_found", "Das bereits geänderte Projekt wurde nicht gefunden.");
    return { project, replayed: true };
  }
  const evaluated = await evaluateProjectMasterDataChange({ ...input, db: input.tx });
  if (input.expectedFingerprint && input.expectedFingerprint !== evaluated.fingerprint) {
    throw new ProjectMasterDataServiceError("stale_context", "Die Projektdaten haben sich geändert. Bitte öffne eine neue Änderungsvorschau.");
  }
  if (evaluated.blockingIssues.length) throw new ProjectMasterDataServiceError("invalid_input", evaluated.blockingIssues.join(" · "));

  const normalized = normalizeChanges(input.changes);
  const data: Record<string, unknown> = { ...normalized, updatedAt: new Date() };
  if (evaluated.reviewWillBeInvalidated) {
    data.reviewStatus = getProjectReviewStatusAfterEdit({ previousStatus: evaluated.project.reviewStatus, hasRelevantChange: true });
    data.reviewedAt = null;
    data.reviewedByUserId = null;
    data.reviewedByName = null;
    data.reviewNote = null;
    data.reviewedProjectStatus = null;
  }
  const updated = await input.tx.workPilotProject.updateMany({
    where: {
      id: input.projectId,
      organizationId: input.organizationId,
      updatedAt: new Date(evaluated.project.updatedAt),
    },
    data,
  });
  if (updated.count !== 1) throw new ProjectMasterDataServiceError("conflict", "Das Projekt wurde zwischenzeitlich geändert.");
  if (evaluated.reviewWillBeInvalidated) {
    await input.tx.workPilotProjectReviewHistory.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        projectId: input.projectId,
        eventType: "review_invalidated",
        oldStatus: "approved",
        newStatus: "needs_review",
        actorUserId: input.actorId,
        actorName: input.actorName,
        note: "Die fachliche Freigabe wurde durch eine kontrollierte Stammdatenänderung aufgehoben.",
      },
    });
  }
  const summary = evaluated.changes.map((change) => `${change.label}: „${change.before || "–"}“ → „${change.after || "–"}“`).join("; ");
  await input.tx.projectLogbookEntry.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      projectId: input.projectId,
      title: "Projektdaten",
      body: `${input.source === "jarvis" ? "Durch JARVIS " : ""}kontrolliert geändert: ${summary}.`,
      author: input.actorName,
      authorUserId: input.actorId,
      source: "project-master-data",
      callReference: requestId,
    },
  });
  await input.tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "project.master-data.changed",
      entityType: "project",
      entityId: input.projectId,
      payload: { source: input.source, requestId, changes: evaluated.changes, reviewInvalidated: evaluated.reviewWillBeInvalidated },
    },
  });
  const project = await input.tx.workPilotProject.findFirstOrThrow({ where: { id: input.projectId, organizationId: input.organizationId } });
  return { project, replayed: false };
}
