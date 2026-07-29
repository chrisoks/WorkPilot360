import { z } from "zod";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  authorizeJarvisQuestion,
  classifyJarvisQuestion,
  JarvisAccessProfile,
} from "@/lib/jarvis/security";

export const JARVIS_PREVIEW_ACTION_IDS = [
  "task.prepare",
  "planning.prepare",
  "time.prepare",
] as const;

export type JarvisPreviewActionId = (typeof JARVIS_PREVIEW_ACTION_IDS)[number];
export type JarvisActionPreviewState =
  | "awaiting_confirmation"
  | "confirmed"
  | "cancelled";
export type JarvisActionPreviewAuditEventType =
  | "preview_created"
  | "preview_confirmed"
  | "preview_cancelled";
export const JARVIS_PREVIEW_CANCELLATION_REASONS = [
  "user_cancelled",
  "data_incomplete",
  "wrong_context",
  "needs_review",
] as const;
export type JarvisActionPreviewCancellationReason =
  (typeof JARVIS_PREVIEW_CANCELLATION_REASONS)[number];

const boundedId = z.string().trim().min(1).max(120);
const boundedText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => value || undefined)
    .optional();
const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)), "Ungültiger Zeitstempel");

const taskPreviewPayloadSchema = z
  .object({
    title: boundedText(180),
    description: optionalText(4000),
    assigneeId: boundedId.optional(),
    dueAt: isoDateTime.optional(),
    projectId: boundedId.optional(),
    customerId: boundedId.optional(),
  })
  .strict();

const planningPreviewPayloadSchema = z
  .object({
    title: boundedText(180),
    startAt: isoDateTime,
    endAt: isoDateTime,
    projectId: boundedId,
    assigneeIds: z.array(boundedId).min(1).max(50),
    location: optionalText(500),
    note: optionalText(4000),
  })
  .strict()
  .refine(
    (payload) => Date.parse(payload.endAt) > Date.parse(payload.startAt),
    {
      message: "Das Terminende muss nach dem Terminbeginn liegen.",
      path: ["endAt"],
    }
  );

const timePreviewPayloadSchema = z
  .object({
    projectId: boundedId,
    employeeId: boundedId,
    startAt: isoDateTime,
    endAt: isoDateTime,
    pauseMinutes: z.number().int().min(0).max(1440),
    description: boundedText(2000),
  })
  .strict()
  .refine(
    (payload) => Date.parse(payload.endAt) > Date.parse(payload.startAt),
    {
      message: "Das Ende des Zeiteintrags muss nach dem Beginn liegen.",
      path: ["endAt"],
    }
  );

const PREVIEW_PAYLOAD_SCHEMAS = {
  "task.prepare": taskPreviewPayloadSchema,
  "planning.prepare": planningPreviewPayloadSchema,
  "time.prepare": timePreviewPayloadSchema,
} satisfies Record<JarvisPreviewActionId, z.ZodType>;

export type JarvisActionPreviewPayloadMap = {
  "task.prepare": z.infer<typeof taskPreviewPayloadSchema>;
  "planning.prepare": z.infer<typeof planningPreviewPayloadSchema>;
  "time.prepare": z.infer<typeof timePreviewPayloadSchema>;
};

export type JarvisActionPreviewAuditEvent = {
  sequence: number;
  type: JarvisActionPreviewAuditEventType;
  at: string;
  organizationId: string;
  sessionActorId: string;
  effectiveActorId: string;
  impersonating: boolean;
  reason?: JarvisActionPreviewCancellationReason;
};

export type JarvisActionPreview<
  TActionId extends JarvisPreviewActionId = JarvisPreviewActionId,
> = {
  version: 1;
  previewId: string;
  actionId: TActionId;
  actionTitle: string;
  state: JarvisActionPreviewState;
  organizationId: string;
  sessionActorId: string;
  effectiveActorId: string;
  impersonating: boolean;
  payload: JarvisActionPreviewPayloadMap[TActionId];
  execution: {
    enabled: false;
    reason: "preview_only";
  };
  audit: JarvisActionPreviewAuditEvent[];
};

export type JarvisActionPreviewView = {
  version: 1;
  previewId: string;
  actionId: JarvisPreviewActionId;
  title: string;
  badge: "Nur Vorschau";
  state: "awaiting_confirmation";
  fields: Array<{
    label: string;
    value: string;
  }>;
  missingFields: string[];
  confirmation: {
    enabled: false;
    reason: "not_released";
  };
  execution: {
    enabled: false;
    reason: "preview_only";
  };
};

export type JarvisTaskActionDraftState =
  | "awaiting_input"
  | "awaiting_confirmation"
  | "cancelled"
  | "expired"
  | "executed";

export type JarvisTaskActionDraftView = {
  version: 2;
  previewId: string;
  actionId: "task.prepare";
  title: "Aufgabe vorbereiten";
  badge: "Entwurf" | "Bereit" | "Abgebrochen" | "Abgelaufen" | "Angelegt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{
    label: string;
    value: string;
  }>;
  missingFields: string[];
  editor: {
    description: string;
    assigneeId: string;
    dueAt: string;
    assigneeOptions: Array<{
      id: string;
      label: string;
    }>;
  };
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "missing_fields"
      | "expired"
      | "cancelled"
      | "executed";
  };
  cancellation: {
    enabled: boolean;
  };
  execution: {
    enabled: false;
    reason: "requires_confirmation" | "finalized";
  };
  result?: {
    entityType: "task";
    entityId: string;
    label: string;
  };
};

export type JarvisActionPreviewFailureCode =
  | "invalid_request"
  | "invalid_payload"
  | "missing_actor"
  | "not_permitted"
  | "not_preview_action"
  | "sensitive_content"
  | "scope_mismatch"
  | "invalid_transition";

export type JarvisActionPreviewResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: JarvisActionPreviewFailureCode;
      message: string;
      issues?: string[];
    };

export function extractJarvisTaskPreviewTitle(question: string) {
  const cleaned = question.trim().replace(/\s+/g, " ").slice(0, 1800);
  const quotedTitle =
    cleaned.match(/\baufgabe\b[^„“"']*[„"']([^„“"']{3,180})[“"']/iu)?.[1] ??
    cleaned.match(/[„"']([^„“"']{3,180})[“"']/u)?.[1];
  if (quotedTitle) return quotedTitle.trim();

  const taskIndex = cleaned.search(/\baufgabe\b/iu);
  if (taskIndex < 0) return undefined;
  const afterTask = cleaned
    .slice(taskIndex)
    .replace(/^\baufgabe\b/iu, "")
    .replace(/^(?:\s*(?:mit dem titel|namens|zum thema)\s*)/iu, "")
    .replace(/\s+an[.!?]*$/iu, "")
    .replace(/^[\s:–—-]+|[\s.!?]+$/gu, "")
    .trim()
    .slice(0, 180);
  if (!afterTask || !/\p{L}/u.test(afterTask)) return undefined;
  const significantTerms = afterTask
    .toLocaleLowerCase("de-DE")
    .split(/\s+/)
    .filter(
      (term) =>
        term &&
        ![
          "bitte",
          "dazu",
          "dafür",
          "hier",
          "für",
          "morgen",
          "heute",
          "neu",
          "neue",
          "einen",
          "eine",
        ].includes(term)
    );
  return significantTerms.length >= 2 ? afterTask : undefined;
}

export function toJarvisActionPreviewView(
  preview: JarvisActionPreview
): JarvisActionPreviewView {
  const fields: JarvisActionPreviewView["fields"] = [];
  const missingFields: string[] = [];

  if (preview.actionId === "task.prepare") {
    const payload = preview.payload as JarvisActionPreviewPayloadMap["task.prepare"];
    fields.push({ label: "Titel", value: payload.title });
    if (payload.description) {
      fields.push({ label: "Beschreibung", value: payload.description });
    }
    if (payload.projectId) {
      fields.push({ label: "Projektbezug", value: "Aktuelles Projekt verknüpft" });
    }
    if (!payload.assigneeId) missingFields.push("Verantwortliche Person");
    if (!payload.dueAt) missingFields.push("Fälligkeit");
  } else if (preview.actionId === "planning.prepare") {
    const payload =
      preview.payload as JarvisActionPreviewPayloadMap["planning.prepare"];
    fields.push(
      { label: "Titel", value: payload.title },
      { label: "Beginn", value: payload.startAt },
      { label: "Ende", value: payload.endAt }
    );
  } else {
    const payload = preview.payload as JarvisActionPreviewPayloadMap["time.prepare"];
    fields.push(
      { label: "Beginn", value: payload.startAt },
      { label: "Ende", value: payload.endAt },
      { label: "Pause", value: `${payload.pauseMinutes} Minuten` },
      { label: "Beschreibung", value: payload.description }
    );
  }

  return {
    version: 1,
    previewId: preview.previewId,
    actionId: preview.actionId,
    title: preview.actionTitle,
    badge: "Nur Vorschau",
    state: "awaiting_confirmation",
    fields,
    missingFields,
    confirmation: {
      enabled: false,
      reason: "not_released",
    },
    execution: {
      enabled: false,
      reason: "preview_only",
    },
  };
}

function getActorIds(profile: JarvisAccessProfile) {
  const sessionActorId = profile.sessionActor.id?.trim();
  const effectiveActorId = profile.effectiveActor.id?.trim();
  if (!sessionActorId || !effectiveActorId) return undefined;
  return { sessionActorId, effectiveActorId };
}

function listTextValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(listTextValues);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(listTextValues);
}

function containsBlockedContent(
  value: unknown,
  profile: JarvisAccessProfile
) {
  return listTextValues(value).some((text) => {
    if (classifyJarvisQuestion(text) === "secret") return true;
    const authorization = authorizeJarvisQuestion(text, profile);
    return authorization.reason === "prompt_injection";
  });
}

function createAuditEvent(input: {
  sequence: number;
  type: JarvisActionPreviewAuditEventType;
  at: string;
  organizationId: string;
  profile: JarvisAccessProfile;
  actorIds: { sessionActorId: string; effectiveActorId: string };
  reason?: JarvisActionPreviewCancellationReason;
}): JarvisActionPreviewAuditEvent {
  return {
    sequence: input.sequence,
    type: input.type,
    at: input.at,
    organizationId: input.organizationId,
    sessionActorId: input.actorIds.sessionActorId,
    effectiveActorId: input.actorIds.effectiveActorId,
    impersonating: input.profile.isImpersonating,
    ...(input.reason ? { reason: input.reason } : {}),
  };
}

export function createJarvisActionPreview<
  TActionId extends JarvisPreviewActionId,
>(input: {
  previewId: string;
  actionId: TActionId;
  payload: unknown;
  organizationId: string;
  profile: JarvisAccessProfile;
  createdAt: string;
}): JarvisActionPreviewResult<JarvisActionPreview<TActionId>> {
  const request = z
    .object({
      previewId: boundedId,
      organizationId: boundedId,
      createdAt: isoDateTime,
    })
    .safeParse({
      previewId: input.previewId,
      organizationId: input.organizationId,
      createdAt: input.createdAt,
    });
  if (!request.success) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Die Vorschau-Metadaten sind ungültig.",
      issues: request.error.issues.map((issue) => issue.message),
    };
  }

  const actorIds = getActorIds(input.profile);
  if (!actorIds) {
    return {
      ok: false,
      code: "missing_actor",
      message:
        "Eine Action-Center-Vorschau benötigt einen eindeutig angemeldeten und wirksamen Benutzer.",
    };
  }

  const decision = getJarvisActionDecision(input.actionId, input.profile);
  if (!decision.known || !decision.action) {
    return {
      ok: false,
      code: "not_preview_action",
      message: "Diese Aktion ist nicht als sichere Vorschau registriert.",
    };
  }
  if (!decision.permitted) {
    return {
      ok: false,
      code: "not_permitted",
      message: "Die aktuelle Rollenkombination darf diese Vorschau nicht vorbereiten.",
    };
  }
  if (
    decision.action.risk !== "prepare" ||
    decision.action.confirmation !== "preview" ||
    !JARVIS_PREVIEW_ACTION_IDS.includes(input.actionId)
  ) {
    return {
      ok: false,
      code: "not_preview_action",
      message:
        "Nur ausdrücklich freigegebene Vorbereitungsaktionen dürfen im Action Center als Vorschau erscheinen.",
    };
  }

  const schema = PREVIEW_PAYLOAD_SCHEMAS[input.actionId];
  const payloadResult = schema.safeParse(input.payload);
  if (!payloadResult.success) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "Die Aktionsvorschau ist unvollständig oder enthält unerlaubte Felder.",
      issues: payloadResult.error.issues.map((issue) => issue.message),
    };
  }
  if (containsBlockedContent(payloadResult.data, input.profile)) {
    return {
      ok: false,
      code: "sensitive_content",
      message:
        "Technische Geheimnisse oder Prompt-Manipulationen dürfen nicht in einer Aktionsvorschau gespeichert werden.",
    };
  }

  const createdAt = request.data.createdAt;
  const organizationId = request.data.organizationId;
  return {
    ok: true,
    value: {
      version: 1,
      previewId: request.data.previewId,
      actionId: input.actionId,
      actionTitle: decision.action.title,
      state: "awaiting_confirmation",
      organizationId,
      ...actorIds,
      impersonating: input.profile.isImpersonating,
      payload:
        payloadResult.data as JarvisActionPreviewPayloadMap[TActionId],
      execution: {
        enabled: false,
        reason: "preview_only",
      },
      audit: [
        createAuditEvent({
          sequence: 1,
          type: "preview_created",
          at: createdAt,
          organizationId,
          profile: input.profile,
          actorIds,
        }),
      ],
    },
  };
}

function verifyTransitionScope(input: {
  preview: JarvisActionPreview;
  organizationId: string;
  profile: JarvisAccessProfile;
  transitionAt: string;
}) {
  const actorIds = getActorIds(input.profile);
  const schema = PREVIEW_PAYLOAD_SCHEMAS[input.preview.actionId];
  const auditIsIntact =
    Array.isArray(input.preview.audit) &&
    input.preview.audit.length > 0 &&
    input.preview.audit[0]?.type === "preview_created" &&
    input.preview.audit.every(
      (event, index) =>
        event.sequence === index + 1 &&
        event.organizationId === input.preview.organizationId &&
        event.sessionActorId === input.preview.sessionActorId &&
        event.effectiveActorId === input.preview.effectiveActorId &&
        event.impersonating === input.preview.impersonating &&
        Number.isFinite(Date.parse(event.at))
    );
  const lastAuditAt = input.preview.audit.at(-1)?.at;
  if (
    !actorIds ||
    input.preview.version !== 1 ||
    !JARVIS_PREVIEW_ACTION_IDS.includes(input.preview.actionId) ||
    !schema ||
    !schema.safeParse(input.preview.payload).success ||
    containsBlockedContent(input.preview.payload, input.profile) ||
    input.preview.execution.enabled !== false ||
    input.preview.execution.reason !== "preview_only" ||
    !auditIsIntact ||
    !lastAuditAt ||
    Date.parse(input.transitionAt) < Date.parse(lastAuditAt) ||
    input.preview.organizationId !== input.organizationId ||
    input.preview.sessionActorId !== actorIds.sessionActorId ||
    input.preview.effectiveActorId !== actorIds.effectiveActorId ||
    input.preview.impersonating !== input.profile.isImpersonating
  ) {
    return undefined;
  }
  const decision = getJarvisActionDecision(
    input.preview.actionId,
    input.profile
  );
  if (!decision.permitted) return undefined;
  return actorIds;
}

export function transitionJarvisActionPreview(input: {
  preview: JarvisActionPreview;
  command:
    | { type: "confirm"; at: string }
    | {
        type: "cancel";
        at: string;
        reason: JarvisActionPreviewCancellationReason;
      };
  organizationId: string;
  profile: JarvisAccessProfile;
}): JarvisActionPreviewResult<JarvisActionPreview> {
  const timestamp = isoDateTime.safeParse(input.command.at);
  if (!timestamp.success) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Der Zeitstempel der Vorschauaktion ist ungültig.",
    };
  }

  const actorIds = verifyTransitionScope({
    preview: input.preview,
    organizationId: input.organizationId,
    profile: input.profile,
    transitionAt: timestamp.data,
  });
  if (!actorIds) {
    return {
      ok: false,
      code: "scope_mismatch",
      message:
        "Organisation, Sitzung oder wirksamer Benutzer passen nicht zur ursprünglichen Vorschau.",
    };
  }
  if (input.preview.state !== "awaiting_confirmation") {
    return {
      ok: false,
      code: "invalid_transition",
      message:
        "Nur eine noch offene Vorschau darf bestätigt oder abgebrochen werden.",
    };
  }

  const isConfirmation = input.command.type === "confirm";
  const reason =
    input.command.type === "cancel"
      ? input.command.reason
      : undefined;
  if (
    reason &&
    !JARVIS_PREVIEW_CANCELLATION_REASONS.includes(reason)
  ) {
    return {
      ok: false,
      code: "invalid_request",
      message:
        "Der Abbruchgrund ist nicht für das datensparsame Audit freigegeben.",
    };
  }
  const event = createAuditEvent({
    sequence: input.preview.audit.length + 1,
    type: isConfirmation ? "preview_confirmed" : "preview_cancelled",
    at: timestamp.data,
    organizationId: input.organizationId,
    profile: input.profile,
    actorIds,
    reason,
  });

  return {
    ok: true,
    value: {
      ...input.preview,
      state: isConfirmation ? "confirmed" : "cancelled",
      execution: {
        enabled: false,
        reason: "preview_only",
      },
      audit: [...input.preview.audit, event],
    },
  };
}
