import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  Prisma,
  Role,
  type JarvisActionDraft,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  createJarvisActionPreview,
  type JarvisActionPreview,
  type JarvisActionPreviewPayloadMap,
  type JarvisPlanningActionDraftCheck,
  type JarvisPlanningActionDraftView,
  type JarvisTaskActionDraftView,
  type JarvisWinterCalculationDraftView,
} from "@/lib/jarvis/action-center";
import {
  authorizeJarvisQuestion,
  type JarvisAccessProfile,
} from "@/lib/jarvis/security";
import {
  canAssignTasksToOthers,
  canManagePlanningEntries,
  canManageProjects,
} from "@/lib/permissions";
import {
  evaluatePlanningBatch,
  type PlanningBatchEvaluation,
} from "@/lib/planning/planning-batch-service";
import {
  resolvePlanningActionVariant,
  sharedPlanningRequestSchema,
  type SharedPlanningRequest,
} from "@/lib/planning/shared-planning";
import {
  createJarvisConfirmedTask,
} from "@/lib/services/task-service";
import {
  getGermanHoliday,
  normalizeGermanState,
} from "@/lib/planning/german-holidays";
import {
  calculateWinterService,
  WinterServiceCalculationValidationError,
  type WinterServiceCalculationInput,
  type WinterServiceCalculationResult,
} from "@/lib/winter-service/calculation";

const JARVIS_TASK_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_TASK_DRAFT_MAX_FUTURE_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const JARVIS_PLANNING_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_PLANNING_DRAFT_MAX_FUTURE_MS =
  2 * 365 * 24 * 60 * 60 * 1000;
const JARVIS_WINTER_CALCULATION_DRAFT_TTL_MS = 15 * 60 * 1000;
const OPEN_DRAFT_STATES = ["awaiting_input", "awaiting_confirmation"] as const;

const taskPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(4000).optional(),
    assigneeId: z.string().trim().min(1).max(120).optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
    projectId: z.string().trim().min(1).max(120).optional(),
    customerId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const taskContextSchema = z
  .object({
    recordType: z.literal("project").optional(),
    recordId: z.string().trim().min(1).max(120).optional(),
    recordLabel: z.string().trim().max(240).optional(),
    recordUpdatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const completeDraftSchema = z
  .object({
    revision: z.number().int().min(1),
    description: z.string().trim().max(4000).optional(),
    assigneeId: z.string().trim().min(1).max(120),
    dueAt: z.string().datetime({ offset: true }),
  })
  .strict();

const planningPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    projectId: z.string().trim().min(1).max(120),
    assigneeIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
    approvalStatus: z.enum(["confirmed", "requested"]).default("confirmed"),
    location: z.string().trim().max(500).optional(),
    note: z.string().trim().max(4000).optional(),
    offerId: z.string().trim().min(1).max(120).optional(),
    planningTrade: z.string().trim().max(180).optional(),
    billingCatalogItemId: z.string().trim().min(1).max(120).optional(),
    recurrence: z
      .object({
        type: z.enum(["once", "weekly", "biweekly", "monthly"]),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      })
      .strict()
      .default({ type: "once", weekdays: [] }),
    overbookingApproval: z
      .object({
        fingerprint: z.string().trim().min(16).max(180),
        reason: z.string().trim().min(10).max(1000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (payload) => Date.parse(payload.endAt) > Date.parse(payload.startAt),
    {
      message: "Das Terminende muss nach dem Terminbeginn liegen.",
      path: ["endAt"],
    }
  );

const completePlanningDraftSchema = z
  .object({
    revision: z.number().int().min(1),
    title: z.string().trim().min(1).max(180),
    note: z.string().trim().max(4000),
    assigneeIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    approvalStatus: z.enum(["confirmed", "requested"]),
    offerId: z.string().trim().max(120).optional(),
    planningTrade: z.string().trim().max(180).optional(),
    billingCatalogItemId: z.string().trim().max(120).optional(),
    recurrence: z
      .object({
        type: z.enum(["once", "weekly", "biweekly", "monthly"]),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      })
      .strict(),
    overbookingReason: z.string().trim().max(1000).optional(),
    overbookingFingerprint: z.string().trim().max(180).optional(),
  })
  .strict();

const winterCalculationInputSchema = z
  .object({
    areaSqm: z.number(),
    readinessPricePerSqmPerMonth: z.number(),
    seasonMonths: z.number(),
    expectedDeployments: z.number(),
    baseServiceMinutes: z.number(),
    laborSalesRatePerHour: z.number(),
    saltGramsPerSqm: z.number(),
    saltSalesPricePerKg: z.number(),
    plowTimeIncreasePercent: z.number(),
    plowSaltIncreasePercent: z.number(),
    mixedSpreadingPercent: z.number(),
    mixedPlowingPercent: z.number(),
  })
  .strict();

const winterCalculationPayloadSchema = z
  .object({
    input: winterCalculationInputSchema,
    projectId: z.string().trim().max(120).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

const completeWinterCalculationDraftSchema = z
  .object({
    revision: z.number().int().min(1),
    input: winterCalculationInputSchema,
    projectId: z.string().trim().max(120),
    note: z.string().trim().max(2000),
  })
  .strict();

const winterCalculationContextSchema = z
  .object({
    projectId: z.string().trim().min(1).max(120).optional(),
    projectUpdatedAt: z.string().datetime({ offset: true }).optional(),
    customerId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const EMPTY_WINTER_CALCULATION_INPUT: WinterServiceCalculationInput = {
  areaSqm: 0,
  readinessPricePerSqmPerMonth: 0,
  seasonMonths: 0,
  expectedDeployments: 0,
  baseServiceMinutes: 0,
  laborSalesRatePerHour: 0,
  saltGramsPerSqm: 0,
  saltSalesPricePerKg: 0,
  plowTimeIncreasePercent: 0,
  plowSaltIncreasePercent: 0,
  mixedSpreadingPercent: 0,
  mixedPlowingPercent: 0,
};

export type JarvisTaskDraftBinding = {
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
};

export type CreateJarvisTaskDraftInput = JarvisTaskDraftBinding & {
  preview: JarvisActionPreview<"task.prepare">;
  context: {
    recordType?: string;
    recordId?: string;
  };
  now?: Date;
};

export type CreateJarvisPlanningDraftInput = JarvisTaskDraftBinding & {
  preview: JarvisActionPreview<"planning.prepare">;
  context: {
    recordType?: string;
    recordId?: string;
  };
  now?: Date;
};

export type JarvisPlanningExecutionInput = {
  actorUserId: string;
  planning: SharedPlanningRequest;
};

export class JarvisActionDraftError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "session_required"
      | "scope_mismatch"
      | "role_changed"
      | "integrity_failed"
      | "expired"
      | "invalid_state"
      | "invalid_input"
      | "assignee_forbidden"
      | "stale_context"
      | "conflict"
      | "execution_failed",
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 500
  ) {
    super(message);
    this.name = "JarvisActionDraftError";
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function hashJson(value: unknown) {
  return createHash("sha256").update(canonicalize(value)).digest("base64url");
}

function getIntegritySecret() {
  const secret =
    process.env.JARVIS_ACTION_INTEGRITY_SECRET ||
    process.env.WORKPILOT_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JARVIS_ACTION_INTEGRITY_SECRET_MISSING");
    }
    return "workpilot-local-jarvis-action-integrity-secret";
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("JARVIS_ACTION_INTEGRITY_SECRET_TOO_SHORT");
  }
  return secret;
}

function getActorIds(profile: JarvisAccessProfile) {
  const sessionActorId = profile.sessionActor.id?.trim();
  const effectiveActorId = profile.effectiveActor.id?.trim();
  if (!sessionActorId || !effectiveActorId) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Angemeldeter und wirksamer Benutzer müssen eindeutig feststehen.",
      403
    );
  }
  return { sessionActorId, effectiveActorId };
}

type DraftIntegrityData = {
  id: string;
  organizationId: string;
  sessionId: string;
  sessionActorId: string;
  sessionActorRole: string;
  effectiveActorId: string;
  effectiveActorRole: string;
  impersonating: boolean;
  actionId: string;
  state: string;
  revision: number;
  payloadHash: string;
  contextHash: string;
  expiresAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  executedAt: Date | null;
  resultEntityType: string | null;
  resultEntityId: string | null;
  lastErrorCode: string | null;
};

function createIntegrityTag(draft: DraftIntegrityData) {
  const material = canonicalize({
    version: 1,
    id: draft.id,
    organizationId: draft.organizationId,
    sessionId: draft.sessionId,
    sessionActorId: draft.sessionActorId,
    sessionActorRole: draft.sessionActorRole,
    effectiveActorId: draft.effectiveActorId,
    effectiveActorRole: draft.effectiveActorRole,
    impersonating: draft.impersonating,
    actionId: draft.actionId,
    state: draft.state,
    revision: draft.revision,
    payloadHash: draft.payloadHash,
    contextHash: draft.contextHash,
    expiresAt: draft.expiresAt.toISOString(),
    confirmedAt: draft.confirmedAt?.toISOString() ?? null,
    cancelledAt: draft.cancelledAt?.toISOString() ?? null,
    executedAt: draft.executedAt?.toISOString() ?? null,
    resultEntityType: draft.resultEntityType,
    resultEntityId: draft.resultEntityId,
    lastErrorCode: draft.lastErrorCode,
  });
  return createHmac("sha256", getIntegritySecret())
    .update(`jarvis-action-draft-v1:${material}`)
    .digest("base64url");
}

function integrityMatches(draft: JarvisActionDraft) {
  const expected = Buffer.from(createIntegrityTag(draft));
  const actual = Buffer.from(draft.integrityTag);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validateBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Dieser Entwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung des Entwurfs geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis des Entwurfs ist ungültig. Es wurde nichts ausgeführt.",
      409
    );
  }
  const payload = taskPayloadSchema.safeParse(draft.payload);
  const context = taskContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "task.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Payload oder Kontext des Entwurfs stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function appendAuditEvent(
  tx: Prisma.TransactionClient,
  input: {
    draft: JarvisActionDraft;
    eventType: string;
    reasonCode?: string;
    result?: {
      id: string;
      entityType?: "task" | "planning" | "winterServiceCalculation";
    };
  }
) {
  const last = await tx.jarvisActionDraftAuditEvent.findFirst({
    where: { draftId: input.draft.id },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  await tx.jarvisActionDraftAuditEvent.create({
    data: {
      id: randomUUID(),
      organizationId: input.draft.organizationId,
      draftId: input.draft.id,
      sequence: (last?.sequence ?? 0) + 1,
      eventType: input.eventType,
      revision: input.draft.revision,
      sessionId: input.draft.sessionId,
      sessionActorId: input.draft.sessionActorId,
      effectiveActorId: input.draft.effectiveActorId,
      payloadHash: input.draft.payloadHash,
      contextHash: input.draft.contextHash,
      reasonCode: input.reasonCode,
      resultEntityType: input.result
        ? input.result.entityType ?? "task"
        : undefined,
      resultEntityId: input.result?.id,
    },
  });
}

async function expireDraftIfNeeded(
  draft: JarvisActionDraft,
  now: Date
): Promise<JarvisActionDraft> {
  if (
    !OPEN_DRAFT_STATES.includes(
      draft.state as (typeof OPEN_DRAFT_STATES)[number]
    ) ||
    draft.expiresAt.getTime() > now.getTime()
  ) {
    return draft;
  }
  return prisma.$transaction(async (tx) => {
    const nextData: DraftIntegrityData = {
      ...draft,
      state: "expired",
      lastErrorCode: "expired",
    };
    const integrityTag = createIntegrityTag(nextData);
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "expired",
        lastErrorCode: "expired",
        integrityTag,
      },
    });
    const current = await tx.jarvisActionDraft.findUnique({
      where: { id: draft.id },
    });
    if (!current) {
      throw new JarvisActionDraftError(
        "not_found",
        "Der Entwurf wurde nicht gefunden.",
        404
      );
    }
    if (changed.count === 1) {
      await appendAuditEvent(tx, {
        draft: current,
        eventType: "draft_expired",
        reasonCode: "ttl_elapsed",
      });
    }
    return current;
  });
}

async function loadBoundDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Aufgabenentwurf wurde nicht gefunden.",
      404
    );
  }
  validateBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateBinding(current, binding);
  return { draft: current, ...parsed };
}

function validatePlanningBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Dieser Entwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung des Entwurfs geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis des Entwurfs ist ungültig. Es wurde nichts ausgeführt.",
      409
    );
  }
  const payload = planningPayloadSchema.safeParse(draft.payload);
  const context = taskContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "planning.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Termin-Payload oder Kontext stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Terminentwurf wurde nicht gefunden.",
      404
    );
  }
  validatePlanningBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validatePlanningBinding(current, binding);
  return { draft: current, ...parsed };
}

type PlanningAssigneeOption = {
  id: string;
  label: string;
  board: string;
  groupName: string;
};

async function getPlanningAssigneeOptions(
  binding: JarvisTaskDraftBinding
): Promise<PlanningAssigneeOption[]> {
  const actorId = getActorIds(binding.profile).effectiveActorId;
  const mayManage = canManagePlanningEntries(binding.profile.effectiveActor);
  const users = await prisma.user.findMany({
    where: {
      organizationId: binding.organizationId,
      isActive: true,
      ...(mayManage ? {} : { id: actorId }),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      planningBoard: true,
      planningGroup: true,
    },
  });
  return users.map((user) => ({
    id: user.id,
    label: `${user.firstName} ${user.lastName}`.trim() || user.email,
    board: user.planningBoard?.trim() || "OK solutions",
    groupName: user.planningGroup?.trim() || "",
  }));
}

function berlinDateTimeParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: get("weekday"),
  };
}

function planningCheck(
  code: string,
  label: string,
  status: JarvisPlanningActionDraftCheck["status"],
  detail: string
): JarvisPlanningActionDraftCheck {
  return { code, label, status, detail };
}

async function evaluatePlanningDraft(
  payload: z.infer<typeof planningPayloadSchema>,
  context: z.infer<typeof taskContextSchema>,
  binding: JarvisTaskDraftBinding,
  draftId: string,
  now = new Date()
) {
  const checks: JarvisPlanningActionDraftCheck[] = [];
  const start = new Date(payload.startAt);
  const end = new Date(payload.endAt);
  const startParts = berlinDateTimeParts(payload.startAt);
  const endParts = berlinDateTimeParts(payload.endAt);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const timeValid =
    Number.isFinite(start.getTime()) &&
    Number.isFinite(end.getTime()) &&
    startParts.date === endParts.date &&
    durationMinutes > 0 &&
    durationMinutes <= 24 * 60 &&
    start.getTime() > now.getTime() &&
    start.getTime() <= now.getTime() + JARVIS_PLANNING_DRAFT_MAX_FUTURE_MS;
  checks.push(
    planningCheck(
      "date_time",
      "Datum und Zeit (Berlin)",
      timeValid ? "ok" : "blocked",
      timeValid
        ? `${startParts.date}, ${startParts.time}–${endParts.time} Uhr (${durationMinutes} Minuten).`
        : "Beginn und Ende müssen am selben Berliner Kalendertag, in der Zukunft und innerhalb von zwei Jahren liegen."
    )
  );

  const options = await getPlanningAssigneeOptions(binding);
  const assignees = payload.assigneeIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is PlanningAssigneeOption => Boolean(option));
  const assignee = assignees[0];
  const allAssigneesValid =
    assignees.length === payload.assigneeIds.length &&
    new Set(payload.assigneeIds).size === payload.assigneeIds.length;
  checks.push(
    planningCheck(
      "active_assignee",
      "Aktiver Mitarbeitender",
      allAssigneesValid ? "ok" : "blocked",
      allAssigneesValid
        ? `${assignees.map((entry) => entry.label).join(", ")} sind aktiv und mit der aktuellen Rolle auswählbar.`
        : "Mindestens eine gewählte Person ist in dieser Organisation nicht aktiv, doppelt oder mit der aktuellen Rolle nicht zulässig."
    )
  );
  const boardGroupValid =
    allAssigneesValid &&
    assignees.every((entry) => Boolean(entry.board && entry.groupName));
  checks.push(
    planningCheck(
      "board_group",
      "Planungsboard und -gruppe",
      boardGroupValid ? "ok" : "blocked",
      boardGroupValid
        ? assignees.map((entry) => `${entry.label}: ${entry.board} · ${entry.groupName}`).join("; ")
        : "Für mindestens eine gewählte Person fehlt eine eindeutige Planungsgruppe."
    )
  );

  const mayManage = canManagePlanningEntries(binding.profile.effectiveActor);
  const actorId = getActorIds(binding.profile).effectiveActorId;
  const roleValid =
    mayManage ||
    (payload.approvalStatus === "requested" &&
      payload.assigneeIds.length === 1 &&
      payload.assigneeIds[0] === actorId);
  checks.push(
    planningCheck(
      "role",
      payload.approvalStatus === "requested" ? "Terminwunsch" : "Bestätigter Termin",
      roleValid ? "ok" : "blocked",
      roleValid
        ? mayManage
          ? "Die aktuelle Rolle darf diesen Planungsstatus anlegen."
          : "Eigener Terminwunsch; eine Führungskraft muss ihn später bestätigen."
        : "Diese Rolle darf ausschließlich einen eigenen Terminwunsch anlegen."
    )
  );

  const project = await prisma.workPilotProject.findFirst({
    where: {
      id: payload.projectId,
      organizationId: binding.organizationId,
    },
    select: {
      id: true,
      projectNumber: true,
      title: true,
      updatedAt: true,
      projectKind: true,
      recurringBillingMode: true,
    },
  });
  const contextValid =
    Boolean(project) &&
    context.recordType === "project" &&
    context.recordId === project?.id &&
    context.recordUpdatedAt === project?.updatedAt.toISOString();
  checks.push(
    planningCheck(
      "project_context",
      "Projektbezug",
      contextValid ? "ok" : "blocked",
      contextValid && project
        ? `${project.projectNumber} · ${project.title}`
        : "Das Projekt fehlt, gehört nicht zur Organisation oder wurde seit der Vorschau verändert."
    )
  );

  let duplicate = false;
  let overlap = false;
  let absence: { type: string; dayPart: string } | null = null;
  if (assignee && timeValid) {
    const entries = await prisma.planningEntry.findMany({
      where: {
        organizationId: binding.organizationId,
        userId: assignee.id,
        date: startParts.date,
        deletedAt: null,
        id: { not: draftId },
      },
      select: {
        projectId: true,
        startTime: true,
        endTime: true,
        title: true,
      },
    });
    duplicate = entries.some((entry) => entry.projectId === payload.projectId);
    overlap = entries.some(
      (entry) =>
        entry.startTime < endParts.time && entry.endTime > startParts.time
    );
    absence = await prisma.absence.findFirst({
      where: {
        organizationId: binding.organizationId,
        userId: assignee.id,
        date: new Date(`${startParts.date}T00:00:00.000Z`),
        deletedAt: null,
        status: "genehmigt",
        type: { in: ["urlaub", "krank", "ueberstundenabbau"] },
        OR: [
          { dayPart: "full" },
          ...(startParts.time < "12:00" ? [{ dayPart: "first-half" }] : []),
          ...(endParts.time > "12:00" ? [{ dayPart: "second-half" }] : []),
        ],
      },
      select: { type: true, dayPart: true },
    });
  }
  checks.push(
    planningCheck(
      "duplicate",
      "Vorhandene Projektplanung",
      duplicate ? "blocked" : "ok",
      duplicate
        ? "Diese Person ist an diesem Tag bereits auf dieses Projekt geplant. Bitte den vorhandenen Termin bearbeiten."
        : "Keine gleichartige Projektplanung für diese Person an diesem Tag gefunden."
    )
  );
  checks.push(
    planningCheck(
      "overlap",
      "Zeitliche Überschneidung",
      overlap ? "warning" : "ok",
      overlap
        ? "Es gibt eine andere Planung im selben Zeitfenster. Der bestehende Planning-Service kennzeichnet dies als Warnung."
        : "Keine zeitliche Überschneidung gefunden."
    )
  );
  checks.push(
    planningCheck(
      "absence",
      "Genehmigte Abwesenheit",
      absence ? "blocked" : "ok",
      absence
        ? `Blockiert durch ${absence.type} (${absence.dayPart}).`
        : "Keine blockierende genehmigte Abwesenheit gefunden."
    )
  );

  const holidaySetting = await prisma.organizationSetting.findUnique({
    where: {
      organizationId_key: {
        organizationId: binding.organizationId,
        key: "holiday-state",
      },
    },
    select: { value: true },
  });
  const settingValue = holidaySetting?.value;
  const holidayState = normalizeGermanState(
    settingValue &&
      typeof settingValue === "object" &&
      !Array.isArray(settingValue) &&
      "state" in settingValue
      ? settingValue.state
      : undefined
  );
  const holiday = timeValid
    ? getGermanHoliday(startParts.date, holidayState)
    : null;
  checks.push(
    planningCheck(
      "holiday",
      `Feiertag (${holidayState})`,
      holiday ? "warning" : "ok",
      holiday ? `${holiday}; bewusste Planung erforderlich.` : "Kein gesetzlicher Feiertag."
    )
  );
  const weekend = startParts.weekday === "Sat" || startParts.weekday === "Sun";
  checks.push(
    planningCheck(
      "weekend",
      "Wochenende",
      weekend ? "warning" : "ok",
      weekend ? "Der Termin liegt am Wochenende." : "Der Termin liegt an einem Werktag."
    )
  );
  const variant = resolvePlanningActionVariant(project ?? {});
  const variantFieldsValid =
    Boolean(payload.note?.trim()) &&
    (variant !== "single" || Boolean(payload.offerId)) &&
    (variant !== "recurring_hourly" ||
      Boolean(payload.planningTrade?.trim() && payload.billingCatalogItemId)) &&
    (variant !== "single" || payload.recurrence.type === "once");
  checks.push(
    planningCheck(
      "project_variant_fields",
      "Projektartgerechte Terminmaske",
      variantFieldsValid ? "ok" : "blocked",
      variant === "single"
        ? variantFieldsValid
          ? "Beschreibung, finales Angebot, Ausführungsmonat und Angebotskontingent werden gemeinsam geprüft."
          : "Beschreibung und finales Angebot sind Pflicht; Einmalprojekte werden ohne Terminserie geplant."
        : variant === "recurring_hourly"
          ? variantFieldsValid
            ? "Beschreibung, Termin-Gewerk, Abrechnungsleistung, Mitarbeitende und Serienkontext sind vollständig."
            : "Beschreibung, Termin-Gewerk und Abrechnungsleistung sind für Stunden-Dauerläufer Pflicht."
          : variantFieldsValid
            ? "Beschreibung, Mitarbeitende sowie Monats- und Serienkontext werden gegen das Monatskontingent geprüft."
            : "Für die Monatspauschale ist eine Terminbeschreibung erforderlich."
    )
  );

  let batchEvaluation: PlanningBatchEvaluation | null = null;
  let sharedRequest: SharedPlanningRequest | null = null;
  if (project && context.recordUpdatedAt && variantFieldsValid && timeValid && allAssigneesValid) {
    const parsedRequest = sharedPlanningRequestSchema.safeParse({
      requestId: draftId,
      projectId: project.id,
      expectedProjectUpdatedAt: context.recordUpdatedAt,
      approvalStatus: payload.approvalStatus,
      assigneeIds: payload.assigneeIds,
      title: payload.title,
      description: payload.note,
      startAt: payload.startAt,
      endAt: payload.endAt,
      recurrence: payload.recurrence,
      ...(payload.offerId ? { offerId: payload.offerId } : {}),
      ...(payload.planningTrade ? { planningTrade: payload.planningTrade } : {}),
      ...(payload.billingCatalogItemId
        ? { billingCatalogItemId: payload.billingCatalogItemId }
        : {}),
      ...(payload.overbookingApproval
        ? { overbookingApproval: payload.overbookingApproval }
        : {}),
    });
    if (parsedRequest.success) {
      sharedRequest = parsedRequest.data;
      try {
        const [actor, organizationUsers] = await Promise.all([
          prisma.user.findFirst({
            where: { id: actorId, organizationId: binding.organizationId, isActive: true },
          }),
          prisma.user.findMany({
            where: { organizationId: binding.organizationId, isActive: true },
          }),
        ]);
        if (!actor) throw new Error("Aktiver JARVIS-Akteur nicht gefunden.");
        batchEvaluation = await evaluatePlanningBatch({
          organizationId: binding.organizationId,
          timezone: "Europe/Berlin",
          actor,
          users: organizationUsers,
          request: parsedRequest.data,
        });
        checks.push(
          planningCheck(
            "shared_planning_preflight",
            "Gemeinsamer Planning-Service",
            "ok",
            `${batchEvaluation.entryCount} Eintrag/Einträge für ${batchEvaluation.assignees.length} Mitarbeitende wurden serverseitig geprüft.`
          )
        );
      } catch (error) {
        checks.push(
          planningCheck(
            "shared_planning_preflight",
            "Gemeinsamer Planning-Service",
            "blocked",
            error instanceof Error ? error.message : "Die gemeinsame Planungsprüfung ist fehlgeschlagen."
          )
        );
      }
    }
  }

  if (batchEvaluation?.overbooking.required) {
    const approvalMatches =
      payload.overbookingApproval?.fingerprint ===
        batchEvaluation.overbooking.fingerprint &&
      (payload.overbookingApproval?.reason.trim().length ?? 0) >= 10;
    checks.push(
      planningCheck(
        "overbooking_confirmation",
        "Überplanung bewusst bestätigen",
        approvalMatches ? "warning" : "blocked",
        approvalMatches
          ? `Überplanung ist begründet: ${payload.overbookingApproval?.reason}`
          : batchEvaluation.overbooking.details
              .map(
                (detail) =>
                  `${detail.month}: ${detail.requestedMinutes} Min. geplant, ${detail.availableMinutes} Min. frei.`
              )
              .join(" ")
      )
    );
  } else if (batchEvaluation) {
    checks.push(
      planningCheck(
        "overbooking_confirmation",
        "Verfügbares Kontingent",
        "ok",
        "Die Planung bleibt innerhalb des aktuell verfügbaren Kontingents."
      )
    );
  }
  const [offerOptions, billingCatalogItemOptions] = project
    ? await Promise.all([
        prisma.offer?.findMany({
          where: {
            organizationId: binding.organizationId,
            projectId: project.id,
            status: {
              notIn: [
                "Entwurf",
                "Verloren",
                "Angebot verloren",
                "Gelöscht",
              ],
            },
            lines: { some: { laborItems: { some: { plannedHours: { gt: 0 } } } } },
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            offerNumber: true,
            plannedExecutionMonth: true,
          },
        }) ?? Promise.resolve([]),
        prisma.catalogItem?.findMany({
          where: {
            organizationId: binding.organizationId,
            isActive: true,
            isPlanningRelevant: true,
          },
          orderBy: { name: "asc" },
          select: { id: true, number: true, name: true },
        }) ?? Promise.resolve([]),
      ])
    : [[], []];

  return {
    checks,
    options,
    assignee,
    project,
    variant,
    batchEvaluation,
    offerOptions: offerOptions.map((offer) => ({
      id: offer.id,
      label: offer.offerNumber,
      executionMonth: offer.plannedExecutionMonth,
    })),
    billingCatalogItemOptions: billingCatalogItemOptions.map((item) => ({
      id: item.id,
      label: `${item.number} · ${item.name}`,
    })),
    executable: checks.every((check) => check.status !== "blocked"),
    executionInput:
      sharedRequest && batchEvaluation
        ? ({
            actorUserId: actorId,
            planning: sharedRequest,
          } satisfies JarvisPlanningExecutionInput)
        : null,
  };
}

async function getAssigneeOptions(
  binding: JarvisTaskDraftBinding
): Promise<Array<{ id: string; label: string }>> {
  const effectiveActorId = getActorIds(binding.profile).effectiveActorId;
  const mayAssignOthers = canAssignTasksToOthers(
    binding.profile.effectiveActor
  );
  const users = await prisma.user.findMany({
    where: {
      organizationId: binding.organizationId,
      isActive: true,
      ...(mayAssignOthers ? {} : { id: effectiveActorId }),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });
  return users.map((user) => ({
    id: user.id,
    label:
      `${user.firstName} ${user.lastName}`.trim() ||
      user.email,
  }));
}

function formatDueAt(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function toJarvisTaskActionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisTaskActionDraftView> {
  const { payload, context } = validateBinding(draft, binding);
  const assigneeOptions = await getAssigneeOptions(binding);
  const assignee = assigneeOptions.find(
    (option) => option.id === payload.assigneeId
  );
  const missingFields: string[] = [];
  if (!payload.assigneeId || !assignee) {
    missingFields.push("Verantwortliche Person");
  }
  if (!payload.dueAt) {
    missingFields.push("Fälligkeit");
  }

  const fields: JarvisTaskActionDraftView["fields"] = [
    { label: "Titel", value: payload.title },
  ];
  if (payload.description) {
    fields.push({ label: "Beschreibung", value: payload.description });
  }
  if (assignee) {
    fields.push({ label: "Verantwortlich", value: assignee.label });
  }
  if (payload.dueAt) {
    fields.push({ label: "Fällig", value: formatDueAt(payload.dueAt) });
  }
  if (context.recordLabel) {
    fields.push({ label: "Projektbezug", value: context.recordLabel });
  }

  const state = draft.state as JarvisTaskActionDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const isReady =
    state === "awaiting_confirmation" && missingFields.length === 0;
  const reason: JarvisTaskActionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
          : isReady
            ? "ready"
            : "missing_fields";
  const badge: JarvisTaskActionDraftView["badge"] =
    state === "executed"
      ? "Angelegt"
      : state === "cancelled"
        ? "Abgebrochen"
      : state === "expired"
          ? "Abgelaufen"
          : state === "executing"
            ? "Wird angelegt"
          : isReady
            ? "Bereit"
            : "Entwurf";

  return {
    version: 2,
    previewId: draft.id,
    actionId: "task.prepare",
    title: "Aufgabe vorbereiten",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields,
    editor: {
      description: payload.description ?? "",
      assigneeId: payload.assigneeId ?? "",
      dueAt: payload.dueAt ?? "",
      assigneeOptions,
    },
    confirmation: {
      enabled: isReady,
      reason,
    },
    cancellation: {
      enabled: isOpen,
    },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "task" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "task" as const,
            entityId: draft.resultEntityId,
            label: "Angelegte Aufgabe öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisTaskDraft(
  input: CreateJarvisTaskDraftInput
) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für bestätigbare Aktionen ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  const payload = taskPayloadSchema.parse(input.preview.payload);
  let context: z.infer<typeof taskContextSchema> = {};
  if (
    input.context.recordType === "project" &&
    input.context.recordId &&
    payload.projectId === input.context.recordId
  ) {
    const project = await prisma.workPilotProject.findFirst({
      where: {
        id: input.context.recordId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        projectNumber: true,
        title: true,
        updatedAt: true,
      },
    });
    if (!project) {
      throw new JarvisActionDraftError(
        "stale_context",
        "Das verknüpfte Projekt ist nicht mehr eindeutig verfügbar.",
        409
      );
    }
    context = {
      recordType: "project",
      recordId: project.id,
      recordLabel: `${project.projectNumber} · ${project.title}`.slice(0, 240),
      recordUpdatedAt: project.updatedAt.toISOString(),
    };
  }

  const payloadHash = hashJson(payload);
  const contextHash = hashJson(context);
  const expiresAt = new Date(now.getTime() + JARVIS_TASK_DRAFT_TTL_MS);
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "task.prepare",
    state: "awaiting_input",
    revision: 1,
    payloadHash,
    contextHash,
    expiresAt,
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const integrityTag = createIntegrityTag(draftData);

  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag,
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisTaskActionDraftView(draft, input);
}

export async function getJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundDraft(previewId, binding, now);
  return toJarvisTaskActionDraftView(draft, binding);
}

export async function completeJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Verantwortliche Person und gültige Fälligkeit sind erforderlich.",
      400
    );
  }
  const dueAt = new Date(completed.data.dueAt);
  if (
    dueAt.getTime() <= now.getTime() ||
    dueAt.getTime() > now.getTime() + JARVIS_TASK_DRAFT_MAX_FUTURE_MS
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Fälligkeit muss in der Zukunft und innerhalb von fünf Jahren liegen.",
      400
    );
  }

  const { draft, payload, context } = await loadBoundDraft(
    previewId,
    binding,
    now
  );
  if (draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Entwurf kann nicht mehr ergänzt werden.",
      draft.state === "expired" ? 410 : 409
    );
  }

  const options = await getAssigneeOptions(binding);
  if (!options.some((option) => option.id === completed.data.assigneeId)) {
    throw new JarvisActionDraftError(
      "assignee_forbidden",
      "Diese Person darf mit der aktuellen Rolle nicht als verantwortlich gewählt werden.",
      403
    );
  }
  const { description: _previousDescription, ...payloadWithoutDescription } =
    payload;
  const nextPayload = taskPayloadSchema.parse({
    ...payloadWithoutDescription,
    ...(completed.data.description
      ? { description: completed.data.description }
      : {}),
    assigneeId: completed.data.assigneeId,
    dueAt: dueAt.toISOString(),
  });
  const validation = createJarvisActionPreview({
    previewId: draft.id,
    actionId: "task.prepare",
    payload: nextPayload,
    organizationId: binding.organizationId,
    profile: binding.profile,
    createdAt: now.toISOString(),
  });
  if (!validation.ok) {
    throw new JarvisActionDraftError(
      "invalid_input",
      validation.message,
      400
    );
  }

  const payloadHash = hashJson(nextPayload);
  const revision = draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "awaiting_confirmation",
    revision,
    payloadHash,
    lastErrorCode: null,
  };
  const integrityTag = createIntegrityTag(nextData);
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "awaiting_confirmation",
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        payloadHash,
        integrityTag,
        lastErrorCode: null,
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde zwischenzeitlich verändert. Bitte lade ihn neu.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_completed",
    });
    return current;
  });
  taskContextSchema.parse(context);
  return toJarvisTaskActionDraftView(updated, binding);
}

export async function cancelJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    if (draft.state === "cancelled") {
      return toJarvisTaskActionDraftView(draft, binding);
    }
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Entwurf kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const integrityTag = createIntegrityTag(nextData);
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag,
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisTaskActionDraftView(cancelled, binding);
}

async function verifyCurrentProjectContext(
  tx: Prisma.TransactionClient,
  organizationId: string,
  context: z.infer<typeof taskContextSchema>
) {
  if (!context.recordId || !context.recordUpdatedAt) return;
  const project = await tx.workPilotProject.findFirst({
    where: {
      id: context.recordId,
      organizationId,
    },
    select: { updatedAt: true },
  });
  if (
    !project ||
    project.updatedAt.toISOString() !== context.recordUpdatedAt
  ) {
    throw new JarvisActionDraftError(
      "stale_context",
      "Das verknüpfte Projekt wurde seit der Vorschau geändert. Bitte erstelle den Entwurf neu.",
      409
    );
  }
}

function executionErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "JARVIS_ACTOR_STALE") return "actor_stale";
  if (message === "JARVIS_OWNER_INVALID") return "owner_invalid";
  if (message === "JARVIS_OWNER_FORBIDDEN") return "owner_forbidden";
  if (message === "JARVIS_PROJECT_STALE") return "project_stale";
  if (message === "JARVIS_DEADLINE_INVALID") return "deadline_invalid";
  if (message === "JARVIS_TITLE_INVALID") return "title_invalid";
  return "task_creation_failed";
}

async function recordExecutionFailure(
  draft: JarvisActionDraft,
  code: string
) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: draft.id },
      });
      if (
        !current ||
        current.state !== "awaiting_confirmation" ||
        !integrityMatches(current)
      ) {
        return;
      }
      const nextData: DraftIntegrityData = {
        ...current,
        lastErrorCode: code,
      };
      const integrityTag = createIntegrityTag(nextData);
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          lastErrorCode: code,
          integrityTag,
        },
      });
      if (changed.count !== 1) return;
      const updated = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: current.id },
      });
      await appendAuditEvent(tx, {
        draft: updated,
        eventType: "execution_failed",
        reasonCode: code,
      });
    });
  } catch {
    // The original failure remains authoritative. Audit failure must not turn a
    // failed write into a reported success.
  }
}

export async function confirmJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisTaskActionDraftView(loaded.draft, binding);
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    loaded.draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Nur ein vollständiger, offener Entwurf darf bestätigt werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (!loaded.payload.assigneeId || !loaded.payload.dueAt) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Verantwortliche Person und Fälligkeit fehlen.",
      400
    );
  }

  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: loaded.draft.id },
      });
      if (!current) {
        throw new JarvisActionDraftError(
          "not_found",
          "Der Entwurf wurde nicht gefunden.",
          404
        );
      }
      const parsed = validateBinding(current, binding);
      if (current.state === "executed") return current;
      if (
        current.state !== "awaiting_confirmation" ||
        current.expiresAt.getTime() <= now.getTime()
      ) {
        throw new JarvisActionDraftError(
          current.expiresAt.getTime() <= now.getTime()
            ? "expired"
            : "conflict",
          "Der Entwurf ist nicht mehr ausführbar.",
          current.expiresAt.getTime() <= now.getTime() ? 410 : 409
        );
      }
      if (!parsed.payload.assigneeId || !parsed.payload.dueAt) {
        throw new JarvisActionDraftError(
          "invalid_input",
          "Der Entwurf ist unvollständig.",
          400
        );
      }
      await verifyCurrentProjectContext(
        tx,
        binding.organizationId,
        parsed.context
      );

      const confirmedData: DraftIntegrityData = {
        ...current,
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
      };
      const confirmedTag = createIntegrityTag(confirmedData);
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
          integrityTag: confirmedTag,
        },
      });
      if (claimed.count !== 1) {
        throw new JarvisActionDraftError(
          "conflict",
          "Der Entwurf wird bereits verarbeitet.",
          409
        );
      }

      const result = await createJarvisConfirmedTask(tx, {
        organizationId: binding.organizationId,
        previewId: current.id,
        payloadHash: current.payloadHash,
        actor: {
          id: current.effectiveActorId,
          role: current.effectiveActorRole as Role,
        },
        title: parsed.payload.title,
        description: parsed.payload.description,
        ownerId: parsed.payload.assigneeId,
        deadline: new Date(parsed.payload.dueAt),
        projectId: parsed.payload.projectId,
      });

      const executedAt = new Date();
      const executedData: DraftIntegrityData = {
        ...confirmedData,
        state: "executed",
        executedAt,
        resultEntityType: "task",
        resultEntityId: result.id,
      };
      const executedTag = createIntegrityTag(executedData);
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "task",
          resultEntityId: result.id,
          integrityTag: executedTag,
        },
      });
      await appendAuditEvent(tx, {
        draft: finalDraft,
        eventType: "draft_confirmed_and_executed",
        result,
      });
      return finalDraft;
    });
    return toJarvisTaskActionDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundDraft(previewId, binding, now);
      if (latest.draft.state === "executed") {
        return toJarvisTaskActionDraftView(latest.draft, binding);
      }
    }
    await recordExecutionFailure(
      loaded.draft,
      executionErrorCode(error)
    );
    if (error instanceof JarvisActionDraftError) throw error;
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Aufgabe wurde nicht angelegt. Der Entwurf bleibt zur Prüfung erhalten.",
      500
    );
  }
}

export async function toJarvisPlanningActionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding,
  now = new Date()
): Promise<JarvisPlanningActionDraftView> {
  const { payload, context } = validatePlanningBinding(draft, binding);
  const evaluation = await evaluatePlanningDraft(
    payload,
    context,
    binding,
    draft.id,
    now
  );
  const assignees = payload.assigneeIds
    .map((id) => evaluation.options.find((option) => option.id === id))
    .filter((option): option is PlanningAssigneeOption => Boolean(option));
  const missingFields = evaluation.checks
    .filter((check) => check.status === "blocked")
    .map((check) => check.label);
  const state = draft.state as JarvisPlanningActionDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const isReady =
    state === "awaiting_confirmation" && evaluation.executable;
  const reason: JarvisPlanningActionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : isReady
              ? "ready"
              : "missing_fields";
  const badge: JarvisPlanningActionDraftView["badge"] =
    state === "executed"
      ? "Angelegt"
      : state === "executing"
        ? "Wird angelegt"
        : state === "cancelled"
          ? "Abgebrochen"
          : state === "expired"
            ? "Abgelaufen"
            : isReady
              ? "Bereit"
              : "Entwurf";
  const fields: JarvisPlanningActionDraftView["fields"] = [
    { label: "Titel", value: payload.title },
    {
      label:
        payload.approvalStatus === "requested" ? "Art" : "Status",
      value:
        payload.approvalStatus === "requested"
          ? "Terminwunsch"
          : "Bestätigter Termin",
    },
    {
      label: "Zeitfenster",
      value: `${formatDueAt(payload.startAt)} bis ${new Intl.DateTimeFormat(
        "de-DE",
        {
          timeZone: "Europe/Berlin",
          timeStyle: "short",
        }
      ).format(new Date(payload.endAt))} Uhr`,
    },
  ];
  if (assignees.length > 0) {
    fields.push({
      label: assignees.length === 1 ? "Mitarbeitend" : "Mitarbeitende",
      value: assignees.map((entry) => entry.label).join(", "),
    });
  }
  if (context.recordLabel) {
    fields.push({ label: "Projektbezug", value: context.recordLabel });
  }
  if (payload.note) fields.push({ label: "Beschreibung", value: payload.note });
  fields.push({
    label: "Projektart",
    value:
      evaluation.variant === "single"
        ? "Einmalprojekt"
        : evaluation.variant === "recurring_hourly"
          ? "Stunden-Dauerläufer"
          : "Monatspauschale",
  });
  if (evaluation.batchEvaluation?.offer) {
    fields.push({
      label: "Finales Angebot / Ausführung",
      value: `${evaluation.batchEvaluation.offer.label} · ${evaluation.batchEvaluation.offer.executionMonth}`,
    });
  }

  return {
    version: 2,
    previewId: draft.id,
    actionId: "planning.prepare",
    title:
      payload.approvalStatus === "requested"
        ? "Terminwunsch vorbereiten"
        : "Termin vorbereiten",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields,
    checks: evaluation.checks,
    editor: {
      title: payload.title,
      note: payload.note ?? "",
      assigneeIds: payload.assigneeIds,
      startAt: payload.startAt,
      endAt: payload.endAt,
      approvalStatus: payload.approvalStatus,
      variant: evaluation.variant,
      offerId: payload.offerId ?? "",
      planningTrade: payload.planningTrade ?? "",
      billingCatalogItemId: payload.billingCatalogItemId ?? "",
      recurrence: {
        type: payload.recurrence.type,
        until: payload.recurrence.until ?? "",
        weekdays: payload.recurrence.weekdays,
      },
      overbooking: {
        required: Boolean(evaluation.batchEvaluation?.overbooking.required),
        fingerprint:
          evaluation.batchEvaluation?.overbooking.fingerprint ?? "",
        reason: payload.overbookingApproval?.reason ?? "",
        detail:
          evaluation.batchEvaluation?.overbooking.details
            .map(
              (detail) =>
                `${detail.month}: ${detail.requestedMinutes} Min. geplant, ${detail.availableMinutes} Min. frei`
            )
            .join("; ") ?? "",
      },
      approvalStatusOptions: canManagePlanningEntries(
        binding.profile.effectiveActor
      )
        ? [
            { value: "confirmed", label: "Bestätigter Termin" },
            { value: "requested", label: "Terminwunsch" },
          ]
        : [{ value: "requested", label: "Terminwunsch" }],
      assigneeOptions: evaluation.options.map(({ id, label }) => ({
        id,
        label,
      })),
      offerOptions: evaluation.offerOptions,
      billingCatalogItemOptions: evaluation.billingCatalogItemOptions,
    },
    confirmation: { enabled: isReady, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "planning" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "planning" as const,
            entityId: draft.resultEntityId,
            label: "Angelegten Termin öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisPlanningDraft(
  input: CreateJarvisPlanningDraftInput
) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für bestätigbare Aktionen ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  const payload = planningPayloadSchema.parse(input.preview.payload);
  const project = await prisma.workPilotProject.findFirst({
    where: {
      id: payload.projectId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      projectNumber: true,
      title: true,
      updatedAt: true,
    },
  });
  if (!project) {
    throw new JarvisActionDraftError(
      "stale_context",
      "Das verknüpfte Projekt ist nicht mehr eindeutig verfügbar.",
      409
    );
  }
  if (
    input.context.recordType !== "project" ||
    input.context.recordId !== project.id
  ) {
    throw new JarvisActionDraftError(
      "stale_context",
      "Ein Terminentwurf benötigt den eindeutigen aktuellen Projektkontext.",
      409
    );
  }
  const context = taskContextSchema.parse({
    recordType: "project",
    recordId: project.id,
    recordLabel: `${project.projectNumber} · ${project.title}`.slice(0, 240),
    recordUpdatedAt: project.updatedAt.toISOString(),
  });
  const payloadHash = hashJson(payload);
  const contextHash = hashJson(context);
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "planning.prepare",
    state: "awaiting_confirmation",
    revision: 1,
    payloadHash,
    contextHash,
    expiresAt: new Date(now.getTime() + JARVIS_PLANNING_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisPlanningActionDraftView(draft, input, now);
}

export async function getJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundPlanningDraft(previewId, binding, now);
  return toJarvisPlanningActionDraftView(draft, binding, now);
}

export async function getJarvisActionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const draft = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
    select: { actionId: true },
  });
  if (draft?.actionId === "planning.prepare") {
    return getJarvisPlanningDraft(previewId, binding, now);
  }
  if (draft?.actionId === "winter-calculation.prepare") {
    return getJarvisWinterCalculationDraft(previewId, binding, now);
  }
  return getJarvisTaskDraft(previewId, binding, now);
}

export async function completeJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completePlanningDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Titel, Person, Terminart sowie ein gültiger Beginn und ein gültiges Ende sind erforderlich.",
      400
    );
  }
  const parsedPayload = planningPayloadSchema.safeParse({
    title: completed.data.title,
    note: completed.data.note,
    assigneeIds: completed.data.assigneeIds,
    startAt: completed.data.startAt,
    endAt: completed.data.endAt,
    approvalStatus: completed.data.approvalStatus,
    recurrence: completed.data.recurrence,
    ...(completed.data.offerId ? { offerId: completed.data.offerId } : {}),
    ...(completed.data.planningTrade
      ? { planningTrade: completed.data.planningTrade }
      : {}),
    ...(completed.data.billingCatalogItemId
      ? { billingCatalogItemId: completed.data.billingCatalogItemId }
      : {}),
    projectId: "temporary",
  });
  if (!parsedPayload.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Das Terminende muss nach dem Beginn liegen; beide Werte benötigen eine eindeutige Zeitzone.",
      400
    );
  }
  const loaded = await loadBoundPlanningDraft(previewId, binding, now);
  if (loaded.draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Terminentwurf kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  const nextPayload = planningPayloadSchema.parse({
    ...loaded.payload,
    title: completed.data.title,
    note: completed.data.note || undefined,
    assigneeIds: completed.data.assigneeIds,
    startAt: completed.data.startAt,
    endAt: completed.data.endAt,
    approvalStatus: completed.data.approvalStatus,
    offerId: completed.data.offerId || undefined,
    planningTrade: completed.data.planningTrade || undefined,
    billingCatalogItemId: completed.data.billingCatalogItemId || undefined,
    recurrence: completed.data.recurrence,
    overbookingApproval:
      completed.data.overbookingFingerprint &&
      completed.data.overbookingReason
        ? {
            fingerprint: completed.data.overbookingFingerprint,
            reason: completed.data.overbookingReason,
          }
        : undefined,
  });
  const previewValidation = createJarvisActionPreview({
    previewId: loaded.draft.id,
    actionId: "planning.prepare",
    payload: nextPayload,
    organizationId: binding.organizationId,
    profile: binding.profile,
    createdAt: now.toISOString(),
  });
  if (!previewValidation.ok) {
    throw new JarvisActionDraftError(
      "invalid_input",
      previewValidation.message,
      400
    );
  }
  const evaluation = await evaluatePlanningDraft(
    nextPayload,
    loaded.context,
    binding,
    loaded.draft.id,
    now
  );
  const revision = loaded.draft.revision + 1;
  const payloadHash = hashJson(nextPayload);
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: "awaiting_confirmation",
    revision,
    payloadHash,
    lastErrorCode: evaluation.executable ? null : "preflight_blocked",
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: "awaiting_confirmation",
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        payloadHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde zwischenzeitlich verändert. Bitte lade ihn neu.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_rechecked",
      reasonCode: evaluation.executable ? "ready" : "preflight_blocked",
    });
    return current;
  });
  return toJarvisPlanningActionDraftView(updated, binding, now);
}

export async function cancelJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundPlanningDraft(previewId, binding, now);
  if (draft.state === "cancelled") {
    return toJarvisPlanningActionDraftView(draft, binding, now);
  }
  if (
    !OPEN_DRAFT_STATES.includes(draft.state as never) ||
    draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "conflict",
      "Dieser Terminentwurf ist nicht mehr abbrechbar oder wurde zwischenzeitlich verändert.",
      draft.state === "expired" ? 410 : 409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisPlanningActionDraftView(cancelled, binding, now);
}

async function finalizePlanningDraft(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding,
  resultId: string,
  now: Date
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    validatePlanningBinding(current, binding);
    if (current.state === "executed") return current;
    if (current.state !== "executing") {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Terminentwurf befindet sich nicht mehr in Ausführung.",
        409
      );
    }
    const executedData: DraftIntegrityData = {
      ...current,
      state: "executed",
      executedAt: now,
      resultEntityType: "planning",
      resultEntityId: resultId,
      lastErrorCode: null,
    };
    const executed = await tx.jarvisActionDraft.update({
      where: { id: current.id },
      data: {
        state: "executed",
        executedAt: now,
        resultEntityType: "planning",
        resultEntityId: resultId,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(executedData),
      },
    });
    await appendAuditEvent(tx, {
      draft: executed,
      eventType: "draft_executed",
      result: { id: resultId, entityType: "planning" },
    });
    return executed;
  });
}

export async function confirmJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  execute: (input: JarvisPlanningExecutionInput) => Promise<{ id: string }>,
  now = new Date()
) {
  const loaded = await loadBoundPlanningDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisPlanningActionDraftView(loaded.draft, binding, now);
  }
  if (loaded.draft.state === "executing") {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "PlanningBatch"
      WHERE "organizationId" = ${binding.organizationId}
        AND "requestId" = ${loaded.draft.id}
        AND "status" = 'completed'
      LIMIT 1
    `;
    const legacyEntry =
      existing.length === 0
        ? await prisma.planningEntry.findFirst({
            where: {
              id: loaded.draft.id,
              organizationId: binding.organizationId,
              deletedAt: null,
            },
            select: { id: true },
          })
        : null;
    const existingResultId = existing[0]?.id ?? legacyEntry?.id;
    if (existingResultId) {
      const finalized = await finalizePlanningDraft(
        loaded.draft,
        binding,
        existingResultId,
        now
      );
      return toJarvisPlanningActionDraftView(finalized, binding, now);
    }
    throw new JarvisActionDraftError(
      "conflict",
      "Der Termin wird bereits verarbeitet. Es wurde kein zweiter Schreibvorgang gestartet.",
      409
    );
  }
  if (
    loaded.draft.state !== "awaiting_confirmation" ||
    loaded.draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "conflict",
      "Der Terminentwurf ist nicht mehr aktuell oder nicht bestätigbar.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  const evaluation = await evaluatePlanningDraft(
    loaded.payload,
    loaded.context,
    binding,
    loaded.draft.id,
    now
  );
  if (!evaluation.executable || !evaluation.executionInput) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die fachliche Vorprüfung blockiert das Speichern. Bitte bearbeite und prüfe den Entwurf erneut.",
      409
    );
  }

  const executing = await prisma.$transaction(async (tx) => {
    await verifyCurrentProjectContext(
      tx,
      binding.organizationId,
      loaded.context
    );
    const nextData: DraftIntegrityData = {
      ...loaded.draft,
      state: "executing",
      confirmedAt: now,
      lastErrorCode: null,
    };
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: "awaiting_confirmation",
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Termin wird bereits verarbeitet.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_confirmed",
    });
    return current;
  });

  try {
    const result = await execute(evaluation.executionInput);
    const finalized = await finalizePlanningDraft(
      executing,
      binding,
      result.id,
      new Date()
    );
    return toJarvisPlanningActionDraftView(finalized, binding, now);
  } catch (error) {
    if (error instanceof JarvisActionDraftError) throw error;
    await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: executing.id },
      });
      if (!current || current.state !== "executing" || !integrityMatches(current)) {
        return;
      }
      const nextData: DraftIntegrityData = {
        ...current,
        state: "awaiting_confirmation",
        lastErrorCode: "planning_service_failed",
      };
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          state: "executing",
          revision: current.revision,
          integrityTag: current.integrityTag,
        },
        data: {
          state: "awaiting_confirmation",
          lastErrorCode: "planning_service_failed",
          integrityTag: createIntegrityTag(nextData),
        },
      });
      if (changed.count === 1) {
        const reverted = await tx.jarvisActionDraft.findUniqueOrThrow({
          where: { id: current.id },
        });
        await appendAuditEvent(tx, {
          draft: reverted,
          eventType: "execution_failed",
          reasonCode: "planning_service_failed",
        });
      }
    });
    throw new JarvisActionDraftError(
      "execution_failed",
      error instanceof Error
        ? `Der Planning-Service hat den Termin nicht angelegt: ${error.message}`
        : "Der Planning-Service hat den Termin nicht angelegt.",
      500
    );
  }
}

type WinterCalculationPayload = z.infer<
  typeof winterCalculationPayloadSchema
>;
type WinterCalculationContext = z.infer<
  typeof winterCalculationContextSchema
>;

const WINTER_INPUT_LABELS: Record<
  keyof WinterServiceCalculationInput | "mixedShares",
  string
> = {
  areaSqm: "Fläche",
  readinessPricePerSqmPerMonth: "Bereitschaftspreis",
  seasonMonths: "Saisonmonate",
  expectedDeployments: "Erwartete Einsätze",
  baseServiceMinutes: "Einsatzzeit",
  laborSalesRatePerHour: "Stundenverrechnungssatz",
  saltGramsPerSqm: "Streugutmenge",
  saltSalesPricePerKg: "Streugutpreis",
  plowTimeIncreasePercent: "Zeitaufschlag Räumen",
  plowSaltIncreasePercent: "Streugutaufschlag Räumen",
  mixedSpreadingPercent: "Mischanteil Streuen",
  mixedPlowingPercent: "Mischanteil Räumen",
  mixedShares: "Mischanteile",
};

function validateWinterCalculationBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Kalkulation gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung der Kalkulation geändert. Bitte starte eine neue Kalkulation.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Kalkulation ist ungültig. Es wurde nichts gespeichert.",
      409
    );
  }
  const payload = winterCalculationPayloadSchema.safeParse(draft.payload);
  const context = winterCalculationContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "winter-calculation.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Kalkulationswerte oder Projektkontext stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Winterdienst-Kalkulationsentwurf wurde nicht gefunden.",
      404
    );
  }
  validateWinterCalculationBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateWinterCalculationBinding(current, binding);
  return { draft: current, ...parsed };
}

function maySaveWinterCalculation(binding: JarvisTaskDraftBinding) {
  return (
    canManageProjects(binding.profile.sessionActor) &&
    canManageProjects(binding.profile.effectiveActor)
  );
}

function evaluateWinterCalculation(input: WinterServiceCalculationInput) {
  try {
    return {
      result: calculateWinterService(input),
      invalidFields: [] as string[],
    };
  } catch (error) {
    if (error instanceof WinterServiceCalculationValidationError) {
      return {
        result: undefined,
        invalidFields: Object.keys(error.fields).map(
          (field) =>
            WINTER_INPUT_LABELS[
              field as keyof typeof WINTER_INPUT_LABELS
            ] || field
        ),
      };
    }
    throw error;
  }
}

async function getWinterCalculationProjectOptions(
  binding: JarvisTaskDraftBinding
) {
  if (!maySaveWinterCalculation(binding)) return [];
  const projects = await prisma.workPilotProject.findMany({
    where: {
      organizationId: binding.organizationId,
      contactId: { not: null },
    },
    orderBy: [{ projectNumber: "asc" }],
    take: 500,
    select: {
      id: true,
      projectNumber: true,
      title: true,
      customer: true,
      contactId: true,
    },
  });
  const contactIds = Array.from(
    new Set(
      projects
        .map((project) => project.contactId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const contacts =
    contactIds.length === 0
      ? []
      : await prisma.contact.findMany({
          where: {
            organizationId: binding.organizationId,
            id: { in: contactIds },
          },
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            customerNumber: true,
          },
        });
  const contactLabels = new Map(
    contacts.map((contact) => [
      contact.id,
      contact.companyName?.trim() ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        contact.customerNumber,
    ])
  );
  return projects.map((project) => ({
    id: project.id,
    label: `${project.projectNumber} · ${project.title}`.slice(0, 240),
    customerLabel:
      (project.contactId && contactLabels.get(project.contactId)) ||
      project.customer?.trim() ||
      "Kunde nicht benannt",
    contactId: project.contactId!,
  }));
}

function winterResultView(
  result: WinterServiceCalculationResult
): NonNullable<JarvisWinterCalculationDraftView["calculation"]> {
  const labels = {
    mixed: "Pauschalpreis pro Einsatz",
    spreading: "Winterdienst – Streuen",
    spreadingAndPlowing: "Winterdienst – Streuen und Schieben",
  } as const;
  return {
    readiness: result.readiness,
    variants: (
      ["mixed", "spreading", "spreadingAndPlowing"] as const
    ).map((key) => {
      const variant = result.variants[key];
      return {
        key,
        label: labels[key],
        serviceMinutes: variant.serviceMinutes,
        laborHours: variant.laborHours,
        laborAmount: variant.laborAmount,
        saltKg: variant.saltKg,
        saltAmount: variant.saltAmount,
        readinessAmountPerDeployment:
          variant.readinessAmountPerDeployment,
        effortAmountPerDeployment: variant.effortAmountPerDeployment,
        pricePerDeployment: variant.pricePerDeployment,
        plannedSeasonRevenue: variant.plannedSeasonRevenue,
        monthlyReadinessRevenue:
          variant.monthlyReadinessModel.plannedSeasonRevenue,
      };
    }),
  };
}

function formatWinterCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export async function toJarvisWinterCalculationDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisWinterCalculationDraftView> {
  const { payload } = validateWinterCalculationBinding(draft, binding);
  const evaluation = evaluateWinterCalculation(
    payload.input as WinterServiceCalculationInput
  );
  const projectOptions = await getWinterCalculationProjectOptions(binding);
  const selectedProject = payload.projectId
    ? projectOptions.find((project) => project.id === payload.projectId)
    : undefined;
  const savePermitted = maySaveWinterCalculation(binding);
  const missingFields = [
    ...evaluation.invalidFields,
    ...(evaluation.result && savePermitted && !selectedProject
      ? ["Projekt zum dauerhaften Speichern"]
      : []),
    ...(evaluation.result && !savePermitted
      ? ["Dauerhaftes Speichern ist für diese Rolle nicht freigegeben"]
      : []),
  ];
  const state = draft.state as JarvisWinterCalculationDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const isReady =
    state === "awaiting_confirmation" &&
    Boolean(evaluation.result) &&
    Boolean(selectedProject) &&
    savePermitted;
  const reason: JarvisWinterCalculationDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !savePermitted
              ? "not_permitted"
              : isReady
                ? "ready"
                : "missing_fields";
  const badge: JarvisWinterCalculationDraftView["badge"] =
    state === "executed"
      ? "Gespeichert"
      : state === "executing"
        ? "Wird gespeichert"
        : state === "cancelled"
          ? "Abgebrochen"
          : state === "expired"
            ? "Abgelaufen"
            : evaluation.result
              ? "Berechnet"
              : "Entwurf";
  const fields: JarvisWinterCalculationDraftView["fields"] = [
    {
      label: "Rechenlogik",
      value: "Zentraler WorkPilot-Winterdienstrechner",
    },
    {
      label: "Projekt",
      value: selectedProject?.label || "Noch nicht zugeordnet",
    },
    ...(evaluation.result
      ? [
          {
            label: "Bereitschaft pro Saison",
            value: formatWinterCurrency(
              evaluation.result.readiness.seasonFee
            ),
          },
          {
            label: "Pauschalpreis je Einsatz",
            value: formatWinterCurrency(
              evaluation.result.variants.mixed.pricePerDeployment
            ),
          },
        ]
      : []),
  ];
  return {
    version: 2,
    previewId: draft.id,
    actionId: "winter-calculation.prepare",
    title: "Winterdienst kalkulieren",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields,
    editor: {
      input: payload.input as WinterServiceCalculationInput,
      projectId: payload.projectId ?? "",
      note: payload.note ?? "",
      projectOptions: projectOptions.map(
        ({ id, label, customerLabel }) => ({
          id,
          label,
          customerLabel,
        })
      ),
    },
    ...(evaluation.result
      ? { calculation: winterResultView(evaluation.result) }
      : {}),
    confirmation: { enabled: isReady, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "winterServiceCalculation" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "winterServiceCalculation" as const,
            entityId: draft.resultEntityId,
            label: "Gespeicherte Kalkulation öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisWinterCalculationDraft(input: {
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  context: { recordType?: string; recordId?: string };
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für eine JARVIS-Kalkulation ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  if (
    input.profile.sessionActor.role === Role.GAST ||
    input.profile.effectiveActor.role === Role.GAST
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine interne Kalkulation vorbereiten.",
      403
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  let context: WinterCalculationContext = {};
  let projectId = "";
  if (
    maySaveWinterCalculation({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.profile,
    }) &&
    input.context.recordType === "project" &&
    input.context.recordId
  ) {
    const project = await prisma.workPilotProject.findFirst({
      where: {
        id: input.context.recordId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        contactId: true,
        updatedAt: true,
      },
    });
    if (project?.contactId) {
      projectId = project.id;
      context = {
        projectId: project.id,
        projectUpdatedAt: project.updatedAt.toISOString(),
        customerId: project.contactId,
      };
    }
  }
  const payload = winterCalculationPayloadSchema.parse({
    input: EMPTY_WINTER_CALCULATION_INPUT,
    ...(projectId ? { projectId } : {}),
  });
  const payloadHash = hashJson(payload);
  const contextHash = hashJson(context);
  const draftData: DraftIntegrityData = {
    id: randomUUID(),
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "winter-calculation.prepare",
    state: "awaiting_input",
    revision: 1,
    payloadHash,
    contextHash,
    expiresAt: new Date(
      now.getTime() + JARVIS_WINTER_CALCULATION_DRAFT_TTL_MS
    ),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisWinterCalculationDraftView(draft, {
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    profile: input.profile,
  });
}

export async function getJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  return toJarvisWinterCalculationDraftView(draft, binding);
}

export async function completeJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeWinterCalculationDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Winterdienst-Eingaben sind unvollständig oder ungültig.",
      400
    );
  }
  const loaded = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Kalkulation wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Kalkulation kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (completed.data.note) {
    const noteAuthorization = authorizeJarvisQuestion(
      completed.data.note,
      binding.profile
    );
    if (
      noteAuthorization.reason === "prompt_injection" ||
      noteAuthorization.reason === "secret"
    ) {
      throw new JarvisActionDraftError(
        "invalid_input",
        "Die Notiz enthält eine gesperrte technische Anweisung oder ein Geheimnis und wurde nicht gespeichert.",
        400
      );
    }
  }
  const calculation = evaluateWinterCalculation(
    completed.data.input as WinterServiceCalculationInput
  );
  const savePermitted = maySaveWinterCalculation(binding);
  let context: WinterCalculationContext = {};
  if (savePermitted && completed.data.projectId) {
    const project = await prisma.workPilotProject.findFirst({
      where: {
        id: completed.data.projectId,
        organizationId: binding.organizationId,
        contactId: { not: null },
      },
      select: { id: true, contactId: true, updatedAt: true },
    });
    if (!project?.contactId) {
      throw new JarvisActionDraftError(
        "stale_context",
        "Das ausgewählte Projekt ist nicht mehr eindeutig mit einem Kunden verknüpft.",
        409
      );
    }
    context = {
      projectId: project.id,
      projectUpdatedAt: project.updatedAt.toISOString(),
      customerId: project.contactId,
    };
  }
  const nextPayload = winterCalculationPayloadSchema.parse({
    input: completed.data.input,
    ...(savePermitted && completed.data.projectId
      ? { projectId: completed.data.projectId }
      : {}),
    ...(completed.data.note ? { note: completed.data.note } : {}),
  });
  const payloadHash = hashJson(nextPayload);
  const contextHash = hashJson(context);
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: calculation.result
      ? "awaiting_confirmation"
      : "awaiting_input",
    revision,
    payloadHash,
    contextHash,
    lastErrorCode: calculation.result ? null : "invalid_input",
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: nextData.state,
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash,
        contextHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Kalkulation wurde zwischenzeitlich verändert. Bitte lade sie neu.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: calculation.result
        ? "draft_calculated"
        : "draft_validation_failed",
      ...(!calculation.result ? { reasonCode: "invalid_input" } : {}),
    });
    return current;
  });
  return toJarvisWinterCalculationDraftView(updated, binding);
}

export async function cancelJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    if (draft.state === "cancelled") {
      return toJarvisWinterCalculationDraftView(draft, binding);
    }
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Kalkulation kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== draft.revision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Kalkulation wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Kalkulation wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisWinterCalculationDraftView(cancelled, binding);
}

export async function confirmJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.state === "executed") {
    return toJarvisWinterCalculationDraftView(loaded.draft, binding);
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== loaded.draft.revision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Kalkulation wurde zwischenzeitlich verändert.",
      409
    );
  }
  if (loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Nur eine vollständig berechnete Kalkulation darf gespeichert werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (!maySaveWinterCalculation(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Deine aktuelle Rollenkombination darf Kalkulationen berechnen, aber nicht dauerhaft einem Projekt zuordnen.",
      403
    );
  }
  if (
    !loaded.payload.projectId ||
    !loaded.context.projectId ||
    !loaded.context.customerId ||
    !loaded.context.projectUpdatedAt
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Zum Speichern muss ein aktuelles Kundenprojekt ausgewählt sein.",
      400
    );
  }
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: loaded.draft.id },
      });
      if (!current) {
        throw new JarvisActionDraftError(
          "not_found",
          "Die Kalkulation wurde nicht gefunden.",
          404
        );
      }
      const parsed = validateWinterCalculationBinding(current, binding);
      const contextCustomerId = parsed.context.customerId;
      const contextProjectId = parsed.context.projectId;
      const contextProjectUpdatedAt =
        parsed.context.projectUpdatedAt;
      if (
        !contextCustomerId ||
        !contextProjectId ||
        !contextProjectUpdatedAt
      ) {
        throw new JarvisActionDraftError(
          "invalid_input",
          "Der bestätigte Projektkontext ist unvollständig.",
          400
        );
      }
      const calculated = calculateWinterService(
        parsed.payload.input as WinterServiceCalculationInput
      );
      if (current.state === "executed") return current;
      if (
        current.state !== "awaiting_confirmation" ||
        current.expiresAt.getTime() <= now.getTime()
      ) {
        throw new JarvisActionDraftError(
          current.expiresAt.getTime() <= now.getTime()
            ? "expired"
            : "conflict",
          "Die Kalkulation ist nicht mehr ausführbar.",
          current.expiresAt.getTime() <= now.getTime() ? 410 : 409
        );
      }
      const project = await tx.workPilotProject.findFirst({
        where: {
          id: contextProjectId,
          organizationId: binding.organizationId,
          contactId: contextCustomerId,
        },
        select: {
          id: true,
          projectNumber: true,
          title: true,
          customer: true,
          contactId: true,
          updatedAt: true,
        },
      });
      if (
        !project ||
        project.updatedAt.toISOString() !==
          contextProjectUpdatedAt
      ) {
        throw new JarvisActionDraftError(
          "stale_context",
          "Das Projekt wurde seit der Berechnung geändert. Bitte rechne mit dem aktuellen Stand erneut.",
          409
        );
      }
      const [customer, actor] = await Promise.all([
        tx.contact.findFirst({
          where: {
            id: contextCustomerId,
            organizationId: binding.organizationId,
          },
          select: {
            companyName: true,
            firstName: true,
            lastName: true,
            customerNumber: true,
          },
        }),
        tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true,
            salesRoleEnabled: true,
          },
        }),
      ]);
      if (!customer || !actor || !canManageProjects(actor)) {
        throw new JarvisActionDraftError(
          "role_changed",
          "Kunde, Projekt oder Berechtigung sind nicht mehr aktuell. Es wurde nichts gespeichert.",
          409
        );
      }
      const confirmedData: DraftIntegrityData = {
        ...current,
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
      };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(confirmedData),
        },
      });
      if (claimed.count !== 1) {
        throw new JarvisActionDraftError(
          "conflict",
          "Die Kalkulation wird bereits gespeichert.",
          409
        );
      }
      const customerName =
        customer.companyName?.trim() ||
        [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
        customer.customerNumber;
      const actorName =
        [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
        actor.email;
      const calculationId = randomUUID();
      await tx.winterServiceCalculation.create({
        data: {
          id: calculationId,
          organizationId: binding.organizationId,
          seriesId: current.id,
          version: 1,
          customerId: contextCustomerId,
          projectId: project.id,
          customerName,
          projectNumber: project.projectNumber,
          projectTitle: project.title,
          createdById: actor.id,
          createdByName: actorName,
          inputSnapshot: {
            schemaVersion: 2,
            ...(parsed.payload
              .input as WinterServiceCalculationInput),
          },
          resultSnapshot: {
            schemaVersion: 2,
            ...calculated,
          },
          generatedPackageIds: [],
          note: parsed.payload.note ?? "",
        },
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = {
        ...confirmedData,
        state: "executed",
        executedAt,
        resultEntityType: "winterServiceCalculation",
        resultEntityId: calculationId,
      };
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "winterServiceCalculation",
          resultEntityId: calculationId,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      await appendAuditEvent(tx, {
        draft: finalDraft,
        eventType: "draft_confirmed_and_executed",
        result: {
          id: calculationId,
          entityType: "winterServiceCalculation",
        },
      });
      return finalDraft;
    });
    return toJarvisWinterCalculationDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundWinterCalculationDraft(
        previewId,
        binding,
        now
      );
      if (latest.draft.state === "executed") {
        return toJarvisWinterCalculationDraftView(
          latest.draft,
          binding
        );
      }
    }
    if (error instanceof JarvisActionDraftError) throw error;
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Winterdienst-Kalkulation wurde nicht gespeichert. Der Entwurf bleibt zur Prüfung erhalten.",
      500
    );
  }
}
