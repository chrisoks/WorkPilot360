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
  type JarvisTaskActionDraftView,
} from "@/lib/jarvis/action-center";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";
import { canAssignTasksToOthers } from "@/lib/permissions";
import {
  createJarvisConfirmedTask,
  type JarvisCreatedTaskResult,
} from "@/lib/services/task-service";

const JARVIS_TASK_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_TASK_DRAFT_MAX_FUTURE_MS = 5 * 365 * 24 * 60 * 60 * 1000;
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
    result?: JarvisCreatedTaskResult;
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
      resultEntityType: input.result ? "task" : undefined,
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
  const nextPayload = taskPayloadSchema.parse({
    ...payload,
    description: completed.data.description || undefined,
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
