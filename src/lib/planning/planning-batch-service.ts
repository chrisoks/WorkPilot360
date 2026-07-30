import { createHash, randomUUID } from "crypto";
import { Prisma, Role, type User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { canManagePlanningEntries } from "@/lib/permissions";
import {
  generatePlanningDateKeys,
  getNetPlanningMinutes,
  planningWeekdayKey,
  resolvePlanningActionVariant,
  type PlanningActionVariant,
  type SharedPlanningRequest,
} from "@/lib/planning/shared-planning";

type PlanningActor = Pick<
  User,
  "id" | "email" | "firstName" | "lastName" | "role" | "organizationId"
>;

type PlanningUser = Pick<
  User,
  | "id"
  | "email"
  | "firstName"
  | "lastName"
  | "role"
  | "isActive"
  | "planningBoard"
  | "planningGroup"
  | "planningBreakWindows"
  | "planningResponsibleFor"
>;

type ProjectRow = {
  id: string;
  organizationId: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  address: string | null;
  projectKind: string | null;
  recurringBillingMode: string | null;
  trade: string | null;
  timeBudgetAllocations: unknown;
  updatedAt: Date;
};

type OfferRow = {
  id: string;
  offerNumber: string;
  status: string;
  plannedExecutionMonth: string;
  totalMinutes: number;
};

type OfferPlanningLineRow = {
  quantity: number;
  isLaborPosition: boolean;
  plannedLaborHours: number;
};

type CatalogRow = {
  id: string;
  name: string;
  trade: string | null;
};

type PlanningDb = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

type PlannedItem = {
  id: string;
  user: PlanningUser;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

type OverbookingDetail = {
  kind: "offer" | "monthly";
  label: string;
  month: string;
  availableMinutes: number;
  requestedMinutes: number;
  exceededMinutes: number;
};

export type PlanningBatchEvaluation = {
  variant: PlanningActionVariant;
  project: {
    id: string;
    label: string;
    updatedAt: string;
  };
  offer: null | {
    id: string;
    label: string;
    executionMonth: string;
    totalMinutes: number;
    alreadyPlannedMinutes: number;
    availableMinutes: number;
  };
  billingCatalogItem: null | {
    id: string;
    label: string;
  };
  dates: string[];
  assignees: Array<{ id: string; name: string }>;
  entryCount: number;
  requestedMinutes: number;
  monthlyAvailability: Array<{
    month: string;
    totalMinutes: number;
    alreadyPlannedMinutes: number;
    requestedMinutes: number;
    availableMinutes: number;
  }>;
  overbooking: {
    required: boolean;
    fingerprint: string | null;
    details: OverbookingDetail[];
  };
};

export type PlanningBatchResult = {
  batchId: string;
  requestId: string;
  replayed: boolean;
  approvalStatus: "confirmed" | "requested";
  entryIds: string[];
  entryCount: number;
  evaluation: PlanningBatchEvaluation;
};

class PlanningBatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export function isPlanningBatchError(error: unknown): error is PlanningBatchError {
  return error instanceof PlanningBatchError;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function userName(user: { firstName: string; lastName: string; email: string }) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function parseMonthBudgets(value: unknown) {
  const allocations = Array.isArray(value) ? value : [];
  const result = new Map<string, number>();
  for (const allocation of allocations) {
    if (!allocation || typeof allocation !== "object") continue;
    const row = allocation as Record<string, unknown>;
    const month = clean(row.month);
    const hours = Number(row.hours);
    if (/^\d{4}-\d{2}$/.test(month) && Number.isFinite(hours) && hours >= 0) {
      result.set(month, Math.round(hours * 60));
    }
  }
  return result;
}

function dateTimeParts(value: string, timezone: string) {
  const hasExplicitZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!hasExplicitZone) {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
    if (match) return { date: match[1], time: match[2] };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PlanningBatchError("Der Terminzeitraum ist ungültig.", 400, "invalid_datetime");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function getBreakWindow(user: PlanningUser, dateKey: string) {
  const raw =
    user.planningBreakWindows && typeof user.planningBreakWindows === "object"
      ? (user.planningBreakWindows as Record<string, unknown>)
      : {};
  const weekday = planningWeekdayKey(dateKey);
  const row = weekday ? raw[weekday] : undefined;
  if (!row || typeof row !== "object") return null;
  const values = row as Record<string, unknown>;
  const start = clean(values.start);
  const end = clean(values.end);
  return start && end ? { start, end } : null;
}

function deterministicId(prefix: string, ...parts: string[]) {
  return `${prefix}-${createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 32)}`;
}

async function ensurePlanningBatchStorage() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "PlanningBatch" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "requestId" TEXT NOT NULL,
      "payloadHash" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "source" TEXT NOT NULL DEFAULT 'manual',
      "actorUserId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "approvalStatus" TEXT NOT NULL,
      "overbookingKind" TEXT,
      "overbookingReason" TEXT,
      "overbookingFingerprint" TEXT,
      "resultJson" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      CONSTRAINT "PlanningBatch_org_request_key" UNIQUE ("organizationId", "requestId")
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "PlanningEntry"
    ADD COLUMN IF NOT EXISTS "batchId" TEXT,
    ADD COLUMN IF NOT EXISTS "overbookingKind" TEXT,
    ADD COLUMN IF NOT EXISTS "overbookingReason" TEXT
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "PlanningEntry_org_batch_idx"
    ON "PlanningEntry" ("organizationId", "batchId")
  `;
}

async function getProject(db: PlanningDb, organizationId: string, projectId: string) {
  const rows = await db.$queryRaw<ProjectRow[]>`
    SELECT
      "id", "organizationId", "projectNumber", "title", "customer", "address",
      "projectKind", "recurringBillingMode", "trade", "timeBudgetAllocations", "updatedAt"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  const project = rows[0];
  if (!project) {
    throw new PlanningBatchError("Das ausgewählte Projekt ist ungültig.", 400, "project_not_found");
  }
  return project;
}

export function resolveOfferPlanningMinutes(lines: OfferPlanningLineRow[]) {
  const totalHours = lines.reduce((sum, line) => {
    if (!line.isLaborPosition) return sum;
    const assignedHours = Number(line.plannedLaborHours) || 0;
    const fallbackQuantity = Number(line.quantity) || 0;
    return sum + Math.max(0, assignedHours > 0 ? assignedHours : fallbackQuantity);
  }, 0);
  return Math.round(totalHours * 60);
}

async function getOffer(db: PlanningDb, organizationId: string, projectId: string, offerId: string) {
  const rows = await db.$queryRaw<Array<Omit<OfferRow, "totalMinutes">>>`
    SELECT
      o."id",
      o."offerNumber",
      o."status",
      o."plannedExecutionMonth"
    FROM "Offer" o
    WHERE o."organizationId" = ${organizationId}
      AND o."projectId" = ${projectId}
      AND o."id" = ${offerId}
    LIMIT 1
  `;
  const header = rows[0];
  if (
    !header ||
    ["Entwurf", "Verloren", "Angebot verloren", "Gelöscht"].includes(
      header.status
    )
  ) {
    throw new PlanningBatchError(
      "Bitte ein finales, gültiges Angebot auswählen.",
      400,
      "final_offer_required"
    );
  }
  if (!/^\d{4}-\d{2}$/.test(header.plannedExecutionMonth)) {
    throw new PlanningBatchError(
      "Im finalen Angebot fehlt der Ausführungsmonat.",
      409,
      "offer_execution_month_missing"
    );
  }
  const planningLines = await db.$queryRaw<OfferPlanningLineRow[]>`
    SELECT
      line."quantity",
      line."isLaborPosition",
      COALESCE(SUM(labor."plannedHours"), 0)::double precision AS "plannedLaborHours"
    FROM "OfferLine" line
    LEFT JOIN "OfferLineLabor" labor
      ON labor."organizationId" = line."organizationId"
      AND labor."offerId" = line."offerId"
      AND labor."offerLineId" = line."id"
    WHERE line."organizationId" = ${organizationId}
      AND line."offerId" = ${offerId}
    GROUP BY line."id"
    ORDER BY line."position", line."id"
  `;
  const offer: OfferRow = {
    ...header,
    totalMinutes: resolveOfferPlanningMinutes(planningLines),
  };
  if (offer.totalMinutes <= 0) {
    throw new PlanningBatchError(
      "Das finale Angebot enthält kein planbares Stundenkontingent.",
      409,
      "offer_quota_missing"
    );
  }
  return offer;
}

async function getCatalogItem(db: PlanningDb, organizationId: string, catalogItemId: string) {
  const rows = await db.$queryRaw<CatalogRow[]>`
    SELECT "id", "name", "trade"
    FROM "CatalogItem"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${catalogItemId}
      AND "isActive" = true
      AND "isPlanningRelevant" = true
    LIMIT 1
  `;
  const item = rows[0];
  if (!item) {
    throw new PlanningBatchError(
      "Bitte eine aktive, planungsrelevante Abrechnungsleistung auswählen.",
      400,
      "billing_service_required"
    );
  }
  return item;
}

async function evaluateInternal(input: {
  organizationId: string;
  timezone: string;
  actor: PlanningActor;
  users: PlanningUser[];
  request: SharedPlanningRequest;
  db?: PlanningDb;
}) {
  const { organizationId, actor, request, users, timezone } = input;
  const db = input.db ?? prisma;
  const actorCanManage = canManagePlanningEntries(actor);
  if (!actorCanManage) {
    if (
      request.approvalStatus !== "requested" ||
      request.assigneeIds.length !== 1 ||
      request.assigneeIds[0] !== actor.id
    ) {
      throw new PlanningBatchError(
        "Du darfst nur eigene Terminwünsche anlegen.",
        403,
        "planning_scope_forbidden"
      );
    }
  }

  const project = await getProject(db, organizationId, request.projectId);
  if (project.updatedAt.toISOString() !== new Date(request.expectedProjectUpdatedAt).toISOString()) {
    throw new PlanningBatchError(
      "Das Projekt wurde zwischenzeitlich geändert. Bitte die Planung neu prüfen.",
      409,
      "stale_project"
    );
  }

  const variant = resolvePlanningActionVariant(project);
  if (variant === "single" && request.recurrence.type !== "once") {
    throw new PlanningBatchError(
      "Einmalprojekte werden als Einzeltermin geplant.",
      400,
      "single_project_recurrence_forbidden"
    );
  }

  const assignees = request.assigneeIds.map((id) => users.find((user) => user.id === id));
  if (assignees.some((user) => !user?.isActive)) {
    throw new PlanningBatchError(
      "Mindestens ein ausgewählter Mitarbeiter ist nicht aktiv oder gehört nicht zur Organisation.",
      400,
      "assignee_invalid"
    );
  }
  const activeAssignees = assignees as PlanningUser[];
  for (const user of activeAssignees) {
    if (!clean(user.planningBoard) || !clean(user.planningGroup)) {
      throw new PlanningBatchError(
        `${userName(user)} ist keiner vollständigen Planungsgruppe zugeordnet.`,
        409,
        "assignee_planning_group_missing"
      );
    }
  }

  const start = dateTimeParts(request.startAt, timezone);
  const end = dateTimeParts(request.endAt, timezone);
  if (start.date !== end.date || start.time >= end.time) {
    throw new PlanningBatchError(
      "Beginn und Ende müssen am selben Tag liegen; das Ende muss nach dem Beginn liegen.",
      400,
      "invalid_time_range"
    );
  }
  const dates = generatePlanningDateKeys({
    startDate: start.date,
    recurrence: request.recurrence,
  });
  const items: PlannedItem[] = [];
  for (const date of dates) {
    for (const user of activeAssignees) {
      items.push({
        id: deterministicId("planning", organizationId, request.requestId, user.id, date),
        user,
        date,
        startTime: start.time,
        endTime: end.time,
        durationMinutes: getNetPlanningMinutes({
          startTime: start.time,
          endTime: end.time,
          breakWindow: getBreakWindow(user, date),
        }),
      });
    }
  }
  if (items.some((item) => item.durationMinutes <= 0)) {
    throw new PlanningBatchError(
      "Der Termin enthält nach Abzug der Pause keine planbare Arbeitszeit.",
      400,
      "empty_net_duration"
    );
  }

  const blockingAbsences = await db.$queryRaw<Array<{ userId: string; date: Date }>>`
    SELECT "userId", "date"
    FROM "Absence"
    WHERE "organizationId" = ${organizationId}
      AND "userId" IN (${Prisma.join(request.assigneeIds)})
      AND "date"::text IN (${Prisma.join(dates)})
      AND "deletedAt" IS NULL
      AND "status" = 'genehmigt'
      AND "type" IN ('urlaub', 'krank', 'ueberstundenabbau')
      AND (
        COALESCE("dayPart", 'full') = 'full'
        OR ("dayPart" = 'first-half' AND ${start.time} < '12:00')
        OR ("dayPart" = 'second-half' AND ${end.time} > '12:00')
      )
  `;
  if (blockingAbsences.length > 0) {
    throw new PlanningBatchError(
      "Mindestens ein ausgewählter Mitarbeiter ist im Planungszeitraum genehmigt abwesend.",
      409,
      "assignee_absent",
      blockingAbsences
    );
  }

  const duplicates = await db.$queryRaw<Array<{ userId: string; date: string }>>`
    SELECT "userId", "date"
    FROM "PlanningEntry"
    WHERE "organizationId" = ${organizationId}
      AND "projectId" = ${project.id}
      AND "userId" IN (${Prisma.join(request.assigneeIds)})
      AND "date" IN (${Prisma.join(dates)})
      AND "deletedAt" IS NULL
  `;
  if (duplicates.length > 0) {
    throw new PlanningBatchError(
      "Mindestens ein Mitarbeiter ist an einem gewählten Tag bereits auf dieses Projekt geplant.",
      409,
      "duplicate_project_day",
      duplicates
    );
  }

  let offer: OfferRow | null = null;
  let catalogItem: CatalogRow | null = null;
  if (variant === "single") {
    if (!request.offerId) {
      throw new PlanningBatchError(
        "Für ein Einmalprojekt ist das finale Angebot Pflicht.",
        400,
        "final_offer_required"
      );
    }
    offer = await getOffer(db, organizationId, project.id, request.offerId);
    if (dates.some((date) => date.slice(0, 7) !== offer?.plannedExecutionMonth)) {
      throw new PlanningBatchError(
        `Der Termin muss im Ausführungsmonat ${offer.plannedExecutionMonth} des Angebots liegen.`,
        409,
        "offer_execution_month_mismatch",
        { executionMonth: offer.plannedExecutionMonth }
      );
    }
  } else if (variant === "recurring_hourly") {
    if (!request.planningTrade) {
      throw new PlanningBatchError(
        "Für einen Stunden-Dauerläufer ist das Termin-Gewerk Pflicht.",
        400,
        "planning_trade_required"
      );
    }
    if (!request.billingCatalogItemId) {
      throw new PlanningBatchError(
        "Für einen Stunden-Dauerläufer ist die Abrechnungsleistung Pflicht.",
        400,
        "billing_service_required"
      );
    }
    catalogItem = await getCatalogItem(db, organizationId, request.billingCatalogItemId);
    const normalizeTrade = (value: string | null | undefined) =>
      clean(value).toLocaleLowerCase("de-DE");
    if (normalizeTrade(catalogItem.trade) !== normalizeTrade(request.planningTrade)) {
      throw new PlanningBatchError(
        "Die ausgewählte Abrechnungsleistung gehört nicht zum Termin-Gewerk.",
        400,
        "billing_service_trade_mismatch"
      );
    }
  }

  const requestedMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const overbookingDetails: OverbookingDetail[] = [];
  let offerContext: PlanningBatchEvaluation["offer"] = null;
  const monthlyAvailability: PlanningBatchEvaluation["monthlyAvailability"] = [];

  if (offer) {
    const plannedRows = await db.$queryRaw<Array<{ minutes: number }>>`
      SELECT COALESCE(SUM("durationMinutes"), 0)::integer AS "minutes"
      FROM "PlanningEntry"
      WHERE "organizationId" = ${organizationId}
        AND "offerId" = ${offer.id}
        AND "deletedAt" IS NULL
    `;
    const alreadyPlannedMinutes = plannedRows[0]?.minutes ?? 0;
    const availableMinutes = Math.max(0, offer.totalMinutes - alreadyPlannedMinutes);
    offerContext = {
      id: offer.id,
      label: offer.offerNumber,
      executionMonth: offer.plannedExecutionMonth,
      totalMinutes: offer.totalMinutes,
      alreadyPlannedMinutes,
      availableMinutes,
    };
    if (requestedMinutes > availableMinutes) {
      overbookingDetails.push({
        kind: "offer",
        label: offer.offerNumber,
        month: offer.plannedExecutionMonth,
        availableMinutes,
        requestedMinutes,
        exceededMinutes: requestedMinutes - availableMinutes,
      });
    }
  }

  if (variant === "recurring_flat") {
    const budgets = parseMonthBudgets(project.timeBudgetAllocations);
    const months = [...new Set(dates.map((date) => date.slice(0, 7)))].sort();
    if (months.some((month) => !budgets.has(month))) {
      throw new PlanningBatchError(
        "Für mindestens einen Serienmonat ist noch kein Monatskontingent hinterlegt.",
        409,
        "monthly_quota_missing",
        { months: months.filter((month) => !budgets.has(month)) }
      );
    }
    const plannedRows = await db.$queryRaw<Array<{ month: string; minutes: number }>>`
      SELECT LEFT("date", 7) AS "month", COALESCE(SUM("durationMinutes"), 0)::integer AS "minutes"
      FROM "PlanningEntry"
      WHERE "organizationId" = ${organizationId}
        AND "projectId" = ${project.id}
        AND "deletedAt" IS NULL
        AND LEFT("date", 7) IN (${Prisma.join(months)})
      GROUP BY LEFT("date", 7)
    `;
    const plannedByMonth = new Map(plannedRows.map((row) => [row.month, row.minutes]));
    for (const month of months) {
      const totalMinutes = budgets.get(month) ?? 0;
      const alreadyPlannedMinutes = plannedByMonth.get(month) ?? 0;
      const monthRequestedMinutes = items
        .filter((item) => item.date.startsWith(month))
        .reduce((sum, item) => sum + item.durationMinutes, 0);
      const availableMinutes = Math.max(0, totalMinutes - alreadyPlannedMinutes);
      monthlyAvailability.push({
        month,
        totalMinutes,
        alreadyPlannedMinutes,
        requestedMinutes: monthRequestedMinutes,
        availableMinutes,
      });
      if (monthRequestedMinutes > availableMinutes) {
        overbookingDetails.push({
          kind: "monthly",
          label: project.title,
          month,
          availableMinutes,
          requestedMinutes: monthRequestedMinutes,
          exceededMinutes: monthRequestedMinutes - availableMinutes,
        });
      }
    }
  }

  const fingerprint =
    overbookingDetails.length > 0
      ? sha256({
          organizationId,
          projectId: project.id,
          projectUpdatedAt: project.updatedAt.toISOString(),
          offerId: offer?.id ?? null,
          assigneeIds: [...request.assigneeIds].sort(),
          dates,
          startTime: start.time,
          endTime: end.time,
          details: overbookingDetails,
        })
      : null;

  const evaluation: PlanningBatchEvaluation = {
    variant,
    project: {
      id: project.id,
      label: `${project.projectNumber} · ${project.title}`,
      updatedAt: project.updatedAt.toISOString(),
    },
    offer: offerContext,
    billingCatalogItem: catalogItem
      ? { id: catalogItem.id, label: catalogItem.name }
      : null,
    dates,
    assignees: activeAssignees.map((user) => ({ id: user.id, name: userName(user) })),
    entryCount: items.length,
    requestedMinutes,
    monthlyAvailability,
    overbooking: {
      required: overbookingDetails.length > 0,
      fingerprint,
      details: overbookingDetails,
    },
  };

  return {
    evaluation,
    project,
    offer,
    catalogItem,
    items,
    actorCanManage,
  };
}

export async function evaluatePlanningBatch(input: {
  organizationId: string;
  timezone: string;
  actor: PlanningActor;
  users: PlanningUser[];
  request: SharedPlanningRequest;
}) {
  await ensurePlanningBatchStorage();
  return (await evaluateInternal(input)).evaluation;
}

export async function executePlanningBatch(input: {
  organizationId: string;
  timezone: string;
  actor: PlanningActor;
  users: PlanningUser[];
  request: SharedPlanningRequest;
  source: "manual" | "jarvis";
}): Promise<PlanningBatchResult> {
  await ensurePlanningBatchStorage();
  const payloadHash = sha256(input.request);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
    async (transaction) => {
      const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "PlanningBatch" (
          "id", "organizationId", "requestId", "payloadHash", "source",
          "actorUserId", "projectId", "approvalStatus"
        )
        VALUES (
          ${randomUUID()}, ${input.organizationId}, ${input.request.requestId}, ${payloadHash},
          ${input.source}, ${input.actor.id}, ${input.request.projectId}, ${input.request.approvalStatus}
        )
        ON CONFLICT ("organizationId", "requestId") DO NOTHING
        RETURNING "id"
      `;

      if (inserted.length === 0) {
        const existing = await transaction.$queryRaw<
          Array<{ payloadHash: string; status: string; resultJson: unknown }>
        >`
          SELECT "payloadHash", "status", "resultJson"
          FROM "PlanningBatch"
          WHERE "organizationId" = ${input.organizationId}
            AND "requestId" = ${input.request.requestId}
          FOR UPDATE
        `;
        const row = existing[0];
        if (!row || row.payloadHash !== payloadHash) {
          throw new PlanningBatchError(
            "Diese Vorgangs-ID wurde bereits mit anderen Planungsdaten verwendet.",
            409,
            "idempotency_conflict"
          );
        }
        if (row.status === "completed" && row.resultJson) {
          return {
            ...(row.resultJson as PlanningBatchResult),
            replayed: true,
          };
        }
        throw new PlanningBatchError(
          "Der Planungsvorgang wird bereits verarbeitet.",
          409,
          "planning_batch_pending"
        );
      }

      const batchId = inserted[0].id;
      const evaluated = await evaluateInternal({ ...input, db: transaction });
      const { evaluation, project, offer, catalogItem, items } = evaluated;
      const approval = input.request.overbookingApproval;
      if (evaluation.overbooking.required) {
        if (
          !approval ||
          approval.fingerprint !== evaluation.overbooking.fingerprint ||
          approval.reason.trim().length < 10
        ) {
          throw new PlanningBatchError(
            "Die Überplanung muss mit aktuellem Prüfstand und nachvollziehbarer Begründung bestätigt werden.",
            409,
            "overbooking_confirmation_required",
            evaluation
          );
        }
      }

      const recurrenceId =
        input.request.recurrence.type === "once"
          ? null
          : deterministicId("series", input.organizationId, input.request.requestId);
      const recurrenceRule =
        input.request.recurrence.type === "once"
          ? null
          : stableJson(input.request.recurrence);
      const overbookingKind = evaluation.overbooking.required
        ? [...new Set(evaluation.overbooking.details.map((detail) => detail.kind))].join(",")
        : null;
      const actorLabel = userName(input.actor);

      for (const item of items) {
        await transaction.$executeRaw`
          INSERT INTO "PlanningEntry" (
            "id", "organizationId", "source", "board", "groupName", "userId", "employeeName",
            "date", "startTime", "endTime", "durationMinutes", "title", "description",
            "customer", "projectId", "projectLabel", "planningTrade",
            "billingCatalogItemId", "billingCatalogItemLabel", "offerId", "offerLabel",
            "offerTotalMinutes", "offerPlannedMinutes", "recurrenceId", "recurrenceRule",
            "approvalStatus", "requestedByUserId", "requestedByName", "approvedByUserId",
            "approvedAt", "batchId", "overbookingKind", "overbookingReason"
          )
          VALUES (
            ${item.id}, ${input.organizationId}, ${offer ? "offer" : "manual"},
            ${clean(item.user.planningBoard)}, ${clean(item.user.planningGroup)}, ${item.user.id},
            ${userName(item.user)}, ${item.date}, ${item.startTime}, ${item.endTime},
            ${item.durationMinutes}, ${input.request.title}, ${input.request.description},
            ${project.customer}, ${project.id}, ${`${project.projectNumber} · ${project.title}`},
            ${input.request.planningTrade ?? project.trade ?? ""},
            ${catalogItem?.id ?? null}, ${catalogItem?.name ?? null},
            ${offer?.id ?? null}, ${offer?.offerNumber ?? null},
            ${evaluation.offer?.totalMinutes ?? null},
            ${evaluation.offer
              ? evaluation.offer.alreadyPlannedMinutes + evaluation.requestedMinutes
              : null},
            ${recurrenceId}, ${recurrenceRule}, ${input.request.approvalStatus}, ${input.actor.id},
            ${actorLabel}, ${input.request.approvalStatus === "confirmed" ? input.actor.id : null},
            ${input.request.approvalStatus === "confirmed" ? new Date() : null}, ${batchId},
            ${overbookingKind}, ${approval?.reason ?? null}
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "PlanningEntryHistory" (
            "id", "organizationId", "planningEntryId", "projectId", "eventType",
            "actorUserId", "actorName", "toStatus", "note"
          )
          VALUES (
            ${randomUUID()}, ${input.organizationId}, ${item.id}, ${project.id},
            ${input.request.approvalStatus === "requested" ? "requested" : "created"},
            ${input.actor.id}, ${actorLabel}, ${input.request.approvalStatus},
            ${evaluation.overbooking.required
              ? `Planung mit bestätigter Überplanung: ${approval?.reason}`
              : input.request.approvalStatus === "requested"
                ? "Terminwunsch als Planungs-Batch angelegt"
                : "Planungstermin als Planungs-Batch angelegt"}
          )
        `;
      }

      const recipientIds = new Set<string>();
      if (input.request.approvalStatus === "requested") {
        for (const user of input.users) {
          const scopes = Array.isArray(user.planningResponsibleFor)
            ? user.planningResponsibleFor.filter(
                (scope): scope is string => typeof scope === "string"
              )
            : [];
          if (
            canManagePlanningEntries(user) &&
            items.some((item) =>
              scopes.includes(
                `${clean(item.user.planningBoard)}:${clean(item.user.planningGroup)}`
              )
            )
          ) {
            recipientIds.add(user.id);
          }
        }
      }
      if (evaluation.overbooking.required) {
        for (const user of input.users) {
          if (
            user.role === Role.ADMIN ||
            user.role === Role.GESCHAEFTSFUEHRER ||
            user.role === Role.FUEHRUNGSKRAFT
          ) {
            recipientIds.add(user.id);
          }
        }
      }
      if (input.request.approvalStatus === "confirmed") {
        for (const assigneeId of input.request.assigneeIds) {
          if (assigneeId !== input.actor.id) recipientIds.add(assigneeId);
        }
      }
      for (const recipientId of recipientIds) {
        const isOverbooking = evaluation.overbooking.required;
        const isRequest = input.request.approvalStatus === "requested";
        await transaction.$executeRaw`
          INSERT INTO "Notification" (
            "id", "organizationId", "userId", "channel", "subject", "body",
            "linkTarget", "linkTargetId", "linkLabel"
          )
          SELECT
            ${randomUUID()}, ${input.organizationId}, ${recipientId}, 'app',
            ${isOverbooking
              ? isRequest
                ? "Terminwunsch über Kontingent"
                : "Planung über Kontingent"
              : isRequest
                ? "Terminwunsch freigeben"
                : "Neuer bestätigter Planungstermin"},
            ${isOverbooking
              ? `${actorLabel} hat ${project.title} überplant${isRequest ? " und zur Freigabe angefragt" : ""}. Begründung: ${approval?.reason}`
              : isRequest
                ? `${actorLabel} hat ${items.length} Terminwunsch-Einträge für ${project.title} angelegt.`
                : `${actorLabel} hat einen bestätigten Termin für ${project.title} eingeplant.`},
            'planning-batch', ${batchId}, 'Planung öffnen'
          WHERE NOT EXISTS (
            SELECT 1 FROM "Notification"
            WHERE "organizationId" = ${input.organizationId}
              AND "userId" = ${recipientId}
              AND "linkTarget" = 'planning-batch'
              AND "linkTargetId" = ${batchId}
          )
        `;
      }

      const result: PlanningBatchResult = {
        batchId,
        requestId: input.request.requestId,
        replayed: false,
        approvalStatus: input.request.approvalStatus,
        entryIds: items.map((item) => item.id),
        entryCount: items.length,
        evaluation,
      };
      await transaction.$executeRaw`
        UPDATE "PlanningBatch"
        SET "status" = 'completed',
            "overbookingKind" = ${overbookingKind},
            "overbookingReason" = ${approval?.reason ?? null},
            "overbookingFingerprint" = ${approval?.fingerprint ?? null},
            "resultJson" = ${JSON.stringify(result)}::jsonb,
            "completedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${batchId}
      `;
      return result;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    }
      );
    } catch (error) {
      if (
        attempt < 3 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new PlanningBatchError(
    "Die Planung konnte wegen gleichzeitiger Änderungen nicht serialisiert werden.",
    409,
    "planning_concurrency_conflict"
  );
}
