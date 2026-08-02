import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  evaluateProjectStatusChange,
  executeProjectStatusChange,
  ProjectStatusServiceError,
} from "@/lib/projects/project-status-service";
import { shouldOfferStampImplementationTransition } from "@/lib/projects/stamp-status-automation";
import {
  StampSessionServiceError,
  toStampSessionSnapshot,
  type StampSessionSnapshot,
} from "@/lib/time/stamp-session-service";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export type StampSessionStartInput = {
  mode: "project" | "unproductive";
  projectId?: string;
  unproductiveLabel?: string;
  comment: string;
  trade?: string;
  planningEntryId?: string;
  planningBillingGroupId?: string;
  billingCatalogItemId?: string;
  marketingContentItemId?: string;
  marketingContentTitle?: string;
  marketingContentType?: string;
  confirmImplementationStatus?: boolean;
};

export type StampSessionStartEvaluation = {
  action: "start";
  requested: StampSessionStartInput;
  effective: {
    mode: "project" | "unproductive";
    projectId: string;
    projectLabel: string;
    comment: string;
    trade: string;
    planningEntryId: string;
    planningBillingGroupId: string;
    billingCatalogItemId: string;
    billingCatalogItemLabel: string;
    marketingContentItemId: string;
    marketingContentTitle: string;
    marketingContentType: string;
    confirmImplementationStatus: boolean;
  };
  project: null | {
    id: string;
    projectNumber: string;
    title: string;
    customer: string;
    status: string;
    projectKind: string;
    recurringBillingMode: string;
    trade: string;
    updatedAt: string;
  };
  billingCatalogItem: null | {
    id: string;
    number: string;
    name: string;
    trade: string;
    unit: string;
    salesPrice: number;
    updatedAt: string;
  };
  planningSource: null | {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    updatedAt: string;
  };
  existingSession: StampSessionSnapshot | null;
  isHourlyRecurring: boolean;
  statusTransition: null | {
    fromStatus: string;
    toStatus: "Umsetzung";
    fingerprint: string;
  };
  fingerprint: string;
  warnings: string[];
  blockingIssues: string[];
};

function clean(value: unknown, max = 1000) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function normalize(value: unknown) {
  return clean(value, 500)
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function berlinDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function berlinMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value ?? 0);
}

function timeMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isHourlyProject(project: { projectKind: string | null; recurringBillingMode: string | null }) {
  return project.recurringBillingMode === "hourly" &&
    normalize(project.projectKind).includes("dauerl");
}

async function findPlanningContext(
  db: DatabaseClient,
  organizationId: string,
  userId: string,
  projectId: string,
  now: Date
) {
  const rows = await db.planningEntry.findMany({
    where: {
      organizationId,
      userId,
      projectId,
      date: berlinDateKey(now),
      deletedAt: null,
      approvalStatus: "confirmed",
      planningTrade: { not: "" },
      billingCatalogItemId: { not: null },
    },
    orderBy: { startTime: "asc" },
  });
  if (!rows.length) return null;
  const current = berlinMinutes(now);
  return rows.find((row) => {
    const start = timeMinutes(row.startTime);
    const end = timeMinutes(row.endTime);
    return start !== null && end !== null && current >= start && current <= end;
  }) ?? rows[0];
}

export function getStampSessionStartConfirmationText(evaluation: Pick<StampSessionStartEvaluation, "project" | "effective">) {
  return evaluation.effective.mode === "project"
    ? `STEMPELUNG STARTEN ${evaluation.project?.projectNumber ?? "PROJEKT"}`
    : "STEMPELUNG STARTEN UNPRODUKTIV";
}

export function matchesStampSessionStartConfirmation(
  evaluation: Pick<StampSessionStartEvaluation, "project" | "effective">,
  value: string
) {
  return value.trim() === getStampSessionStartConfirmationText(evaluation);
}

export async function evaluateStampSessionStart(input: {
  db?: DatabaseClient;
  organizationId: string;
  userId: string;
  start: StampSessionStartInput;
  replaceActiveSessionId?: string;
  now?: Date;
}): Promise<StampSessionStartEvaluation> {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const requested: StampSessionStartInput = {
    mode: input.start.mode === "unproductive" ? "unproductive" : "project",
    projectId: clean(input.start.projectId, 120),
    unproductiveLabel: clean(input.start.unproductiveLabel, 240),
    comment: clean(input.start.comment, 2000),
    trade: clean(input.start.trade, 240),
    planningEntryId: clean(input.start.planningEntryId, 120),
    planningBillingGroupId: clean(input.start.planningBillingGroupId, 120),
    billingCatalogItemId: clean(input.start.billingCatalogItemId, 120),
    marketingContentItemId: clean(input.start.marketingContentItemId, 120),
    marketingContentTitle: clean(input.start.marketingContentTitle, 500),
    marketingContentType: clean(input.start.marketingContentType, 120),
    confirmImplementationStatus: input.start.confirmImplementationStatus === true,
  };
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  if (!input.organizationId || !input.userId) {
    throw new StampSessionServiceError("invalid_input", "Organisation und persönliche Benutzeridentität müssen eindeutig feststehen.", 400);
  }
  if (!requested.comment) blockingIssues.push("Bitte kurz angeben, was du gerade machst.");

  const existing = await db.activeStampSession.findUnique({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
  });
  const replacesExpectedSession = Boolean(
    existing && input.replaceActiveSessionId && existing.id === input.replaceActiveSessionId,
  );
  const existingSession = existing && !replacesExpectedSession
    ? toStampSessionSnapshot(existing, now.getTime())
    : null;
  if (existingSession) blockingIssues.push("Es läuft bereits eine persönliche Stempelung. Bitte zuerst pausieren, fortsetzen, wechseln oder stoppen.");

  const project = requested.mode === "project" && requested.projectId
    ? await db.workPilotProject.findFirst({ where: { organizationId: input.organizationId, id: requested.projectId } })
    : null;
  if (requested.mode === "project" && !requested.projectId) blockingIssues.push("Bitte ein eindeutiges Projekt angeben.");
  if (requested.mode === "project" && requested.projectId && !project) blockingIssues.push("Das Projekt wurde in dieser Organisation nicht gefunden.");
  if (project && ["abgeschlossen", "archiviert"].includes(normalize(project.status))) {
    blockingIssues.push(`Auf ein ${project.status}es Projekt kann keine neue Stempelung gestartet werden.`);
  }
  if (requested.mode === "unproductive" && !requested.unproductiveLabel) {
    blockingIssues.push("Bitte die unproduktive Tätigkeit eindeutig benennen.");
  }

  const hourly = Boolean(project && isHourlyProject(project));
  const planning = hourly && project
    ? await findPlanningContext(db, input.organizationId, input.userId, project.id, now)
    : null;
  const effectiveTrade = hourly
    ? requested.trade || clean(planning?.planningTrade) || clean(project?.trade)
    : clean(requested.trade || project?.trade);
  const catalogId = hourly
    ? requested.billingCatalogItemId || clean(planning?.billingCatalogItemId, 120)
    : "";
  const catalog = catalogId
    ? await db.catalogItem.findFirst({ where: { organizationId: input.organizationId, id: catalogId } })
    : null;
  if (hourly && !effectiveTrade) blockingIssues.push("Für diesen Stunden-Dauerläufer fehlt das bestätigte Gewerk.");
  if (hourly && !catalogId) blockingIssues.push("Für diesen Stunden-Dauerläufer fehlt die Abrechnungsleistung.");
  if (hourly && catalogId && !catalog) blockingIssues.push("Die ausgewählte Abrechnungsleistung wurde nicht gefunden.");
  if (catalog) {
    if (!catalog.isActive || catalog.type !== "service" || normalize(catalog.unit) !== "std" || Number(catalog.salesPrice) <= 0) {
      blockingIssues.push("Die Abrechnungsleistung muss aktiv, vom Typ Leistung, in Stunden und mit positivem Verkaufspreis gepflegt sein.");
    }
    if (effectiveTrade && normalize(catalog.trade) !== normalize(effectiveTrade)) {
      blockingIssues.push("Die ausgewählte Abrechnungsleistung passt nicht zum bestätigten Gewerk.");
    }
  }

  let statusTransition: StampSessionStartEvaluation["statusTransition"] = null;
  if (project && requested.confirmImplementationStatus) {
    if (!shouldOfferStampImplementationTransition(project.status)) {
      blockingIssues.push(`Der Projektstatus ${project.status} darf durch einen Stempelstart nicht auf Umsetzung geändert werden.`);
    } else {
      const status = await evaluateProjectStatusChange({
        db,
        organizationId: input.organizationId,
        projectId: project.id,
        targetStatus: "Umsetzung",
        reason: "Ausdrücklich bestätigter persönlicher Stempelstart.",
      });
      blockingIssues.push(...status.blockingIssues);
      warnings.push(...status.warnings);
      statusTransition = { fromStatus: project.status, toStatus: "Umsetzung", fingerprint: status.fingerprint };
    }
  } else if (project && shouldOfferStampImplementationTransition(project.status)) {
    warnings.push(`Der Projektstatus bleibt bei „${project.status}“. Eine Änderung auf „Umsetzung“ wurde nicht ausdrücklich beauftragt.`);
  }

  const effective = {
    mode: requested.mode,
    projectId: requested.mode === "project" ? project?.id ?? requested.projectId ?? "" : "__unproductive__",
    projectLabel: requested.mode === "project"
      ? project ? `${project.projectNumber} | ${project.title}` : ""
      : requested.unproductiveLabel || "Unproduktiv",
    comment: requested.comment,
    trade: effectiveTrade,
    planningEntryId: clean(requested.planningEntryId || planning?.id, 120),
    planningBillingGroupId: clean(requested.planningBillingGroupId || planning?.billingGroupId, 120),
    billingCatalogItemId: catalog?.id ?? catalogId,
    billingCatalogItemLabel: catalog ? `${catalog.number} | ${catalog.name}` : clean(planning?.billingCatalogItemLabel),
    marketingContentItemId: requested.marketingContentItemId ?? "",
    marketingContentTitle: requested.marketingContentTitle ?? "",
    marketingContentType: requested.marketingContentType ?? "",
    confirmImplementationStatus: requested.confirmImplementationStatus === true,
  };
  const projectSnapshot = project ? {
    id: project.id,
    projectNumber: project.projectNumber,
    title: project.title,
    customer: project.customer ?? "",
    status: project.status,
    projectKind: project.projectKind ?? "",
    recurringBillingMode: project.recurringBillingMode ?? "",
    trade: project.trade ?? "",
    updatedAt: project.updatedAt.toISOString(),
  } : null;
  const billingCatalogItem = catalog ? {
    id: catalog.id,
    number: catalog.number,
    name: catalog.name,
    trade: catalog.trade,
    unit: catalog.unit,
    salesPrice: Number(catalog.salesPrice),
    updatedAt: catalog.updatedAt.toISOString(),
  } : null;
  const planningSource = planning ? {
    id: planning.id,
    date: planning.date,
    startTime: planning.startTime,
    endTime: planning.endTime,
    updatedAt: planning.updatedAt.toISOString(),
  } : null;
  const fingerprint = hash({ version: 1, userId: input.userId, requested, effective, project: projectSnapshot, billingCatalogItem, planningSource, existingSession, statusTransition });
  return { action: "start", requested, effective, project: projectSnapshot, billingCatalogItem, planningSource, existingSession, isHourlyRecurring: hourly, statusTransition, fingerprint, warnings: [...new Set(warnings)], blockingIssues: [...new Set(blockingIssues)] };
}

async function executeInTransaction(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  actorName: string;
  start: StampSessionStartInput;
  expectedFingerprint?: string;
  requestId: string;
  source: "ui" | "jarvis";
  sessionId?: string;
  now: Date;
}) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`stamp-session:${input.organizationId}:${input.userId}`}, 0))`;
  const evaluation = await evaluateStampSessionStart({ db: input.tx, organizationId: input.organizationId, userId: input.userId, start: input.start, now: input.now });
  if (input.expectedFingerprint && evaluation.fingerprint !== input.expectedFingerprint) {
    throw new StampSessionServiceError("stale_context", "Projekt, Planung, Abrechnungsleistung oder Stempelzustand haben sich seit der Vorschau geändert.", 409);
  }
  if (evaluation.blockingIssues.length) {
    throw new StampSessionServiceError("conflict", evaluation.blockingIssues.join(" · "), 409);
  }
  if (evaluation.statusTransition && evaluation.project) {
    try {
      await executeProjectStatusChange({
        tx: input.tx,
        organizationId: input.organizationId,
        projectId: evaluation.project.id,
        targetStatus: "Umsetzung",
        reason: "Ausdrücklich bestätigter persönlicher Stempelstart.",
        actorId: input.userId,
        actorName: input.actorName,
        requestId: `${input.requestId}:project-status`,
        expectedFingerprint: evaluation.statusTransition.fingerprint,
        source: input.source,
      });
    } catch (error) {
      if (error instanceof ProjectStatusServiceError) {
        throw new StampSessionServiceError(error.code === "stale_context" ? "stale_context" : "conflict", error.message, 409);
      }
      throw error;
    }
  }
  const session = await input.tx.activeStampSession.create({ data: {
    id: input.sessionId || randomUUID(), organizationId: input.organizationId, userId: input.userId,
    employee: input.actorName, mode: evaluation.effective.mode,
    projectId: evaluation.effective.projectId, projectLabel: evaluation.effective.projectLabel,
    trade: evaluation.effective.trade || null, planningEntryId: evaluation.effective.planningEntryId || null,
    planningBillingGroupId: evaluation.effective.planningBillingGroupId || null,
    billingCatalogItemId: evaluation.effective.billingCatalogItemId || null,
    billingCatalogItemLabel: evaluation.effective.billingCatalogItemLabel || null,
    marketingContentItemId: evaluation.effective.marketingContentItemId || null,
    marketingContentTitle: evaluation.effective.marketingContentTitle || null,
    marketingContentType: evaluation.effective.marketingContentType || null,
    comment: evaluation.effective.comment, startedAt: input.now, accumulatedMs: 0,
    pauseStartedAt: null, pauseMs: 0, createdAt: input.now, updatedAt: input.now,
  } });
  return { session: toStampSessionSnapshot(session, input.now.getTime()), evaluation };
}

export async function executeStampSessionStart(input: {
  db?: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  actorName: string;
  start: StampSessionStartInput;
  expectedFingerprint?: string;
  requestId: string;
  source: "ui" | "jarvis";
  sessionId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.db) return executeInTransaction({ ...input, tx: input.db, now });
  return prisma.$transaction((tx) => executeInTransaction({ ...input, tx, now }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
