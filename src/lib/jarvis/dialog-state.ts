import type { JarvisDialogChoice } from "@/lib/jarvis/dialog";
import {
  resolveJarvisIntentDecision,
  type JarvisIntentDecision,
  type JarvisIntentDomain,
  type JarvisIntentEntity,
  type JarvisIntentGoal,
  type JarvisIntentRecordFilter,
  type JarvisIntentTimeScope,
} from "@/lib/jarvis/intent-decision";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";

export type JarvisDialogRecord = {
  kind: "project" | "customer";
  id: string;
};

export type JarvisProjectSequenceScope =
  | "full"
  | "planning"
  | "stamps"
  | "tasks"
  | "commercial"
  | "automation";

export type JarvisDialogState = {
  version: 1;
  domain: JarvisIntentDomain;
  topicId?: string;
  activeRecord?: JarvisDialogRecord;
  lastQuestion: string;
  lastIntent: {
    goals: JarvisIntentGoal[];
    entities: JarvisIntentEntity[];
    timeScopes: JarvisIntentTimeScope[];
    recordFilter: JarvisIntentRecordFilter;
  };
  clarification?: {
    topicId: string;
    depth: number;
  };
  projectSequence?: {
    remainingReferences: string[];
    scope: JarvisProjectSequenceScope;
  };
};

type JarvisDialogResponse = {
  type?: unknown;
  topicId?: unknown;
  choices?: unknown;
  records?: unknown;
  dialogSequence?: unknown;
};

const DOMAINS = new Set<JarvisIntentDomain>([
  "system",
  "sales",
  "management",
]);
const GOALS = new Set<JarvisIntentGoal>([
  "how_to",
  "read",
  "explain",
  "diagnose",
  "analyze",
  "change",
]);
const ENTITIES = new Set<JarvisIntentEntity>([
  "project",
  "customer",
  "task",
  "offer",
  "invoice",
  "employee",
  "catalog",
]);
const TIME_SCOPES = new Set<JarvisIntentTimeScope>([
  "today",
  "current_month",
  "previous_month",
  "current_year",
  "previous_year",
]);
const RECORD_FILTERS = new Set<JarvisIntentRecordFilter>([
  "all",
  "open",
  "today",
  "overdue",
]);
const PROJECT_SEQUENCE_SCOPES = new Set<JarvisProjectSequenceScope>([
  "full",
  "planning",
  "stamps",
  "tasks",
  "commercial",
  "automation",
]);

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function normalize(value: string) {
  return normalizeJarvisIntentText(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeList<T extends string>(
  value: unknown,
  allowed: Set<T>,
  limit: number
) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is T => typeof entry === "string" && allowed.has(entry as T))
    .slice(0, limit);
}

function sanitizeActiveRecord(value: unknown): JarvisDialogRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind;
  const id = cleanText(candidate.id, 120);
  if ((kind !== "project" && kind !== "customer") || !id) return undefined;
  return { kind, id };
}

function sanitizeProjectReference(value: unknown) {
  const reference = cleanText(value, 40).toUpperCase();
  return /^[\p{L}]{2,}[- ]?\d{1,8}$/u.test(reference)
    ? reference.replace(/\s+/g, "-")
    : "";
}

export function extractJarvisProjectReferences(question: string) {
  const matches =
    question.toUpperCase().match(/\b[\p{L}]{2,}[- ]?\d{1,8}\b/gu) ?? [];
  return [...new Set(matches.map(sanitizeProjectReference).filter(Boolean))].slice(
    0,
    5
  );
}

export function sanitizeJarvisDialogState(
  value: unknown
): JarvisDialogState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const domain = candidate.domain;
  const lastQuestion = cleanText(candidate.lastQuestion, 1800);
  const lastIntent =
    candidate.lastIntent && typeof candidate.lastIntent === "object"
      ? candidate.lastIntent as Record<string, unknown>
      : {};
  const recordFilter = lastIntent.recordFilter;
  if (
    candidate.version !== 1 ||
    typeof domain !== "string" ||
    !DOMAINS.has(domain as JarvisIntentDomain) ||
    !lastQuestion
  ) {
    return undefined;
  }

  const clarification =
    candidate.clarification && typeof candidate.clarification === "object"
      ? candidate.clarification as Record<string, unknown>
      : undefined;
  const clarificationTopicId = cleanText(clarification?.topicId, 120);
  const clarificationDepth =
    typeof clarification?.depth === "number" &&
    Number.isInteger(clarification.depth)
      ? Math.min(2, Math.max(1, clarification.depth))
      : undefined;
  const projectSequence =
    candidate.projectSequence && typeof candidate.projectSequence === "object"
      ? candidate.projectSequence as Record<string, unknown>
      : undefined;
  const projectSequenceScope = projectSequence?.scope;
  const remainingReferences = Array.isArray(
    projectSequence?.remainingReferences
  )
    ? projectSequence.remainingReferences
        .map(sanitizeProjectReference)
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    version: 1,
    domain: domain as JarvisIntentDomain,
    topicId: cleanText(candidate.topicId, 120) || undefined,
    activeRecord: sanitizeActiveRecord(candidate.activeRecord),
    lastQuestion,
    lastIntent: {
      goals: sanitizeList(lastIntent.goals, GOALS, 6),
      entities: sanitizeList(lastIntent.entities, ENTITIES, 7),
      timeScopes: sanitizeList(lastIntent.timeScopes, TIME_SCOPES, 5),
      recordFilter:
        typeof recordFilter === "string" &&
        RECORD_FILTERS.has(recordFilter as JarvisIntentRecordFilter)
          ? recordFilter as JarvisIntentRecordFilter
          : "all",
    },
    clarification:
      clarificationTopicId && clarificationDepth
        ? {
            topicId: clarificationTopicId,
            depth: clarificationDepth,
          }
        : undefined,
    projectSequence:
      remainingReferences.length > 0 &&
      typeof projectSequenceScope === "string" &&
      PROJECT_SEQUENCE_SCOPES.has(
        projectSequenceScope as JarvisProjectSequenceScope
      )
        ? {
            remainingReferences,
            scope: projectSequenceScope as JarvisProjectSequenceScope,
          }
        : undefined,
  };
}

export function isJarvisReferentialFollowUp(question: string) {
  const value = normalize(question);
  const words = value.split(/\s+/).filter(Boolean);
  if (!value || words.length > 16) return false;
  if (
    /\bwie\b.*\b(anleg|erstell|erfass|bearbeit|losch|stornier|bedien)\w*\b/.test(
      value
    )
  ) {
    return false;
  }
  return (
    /^(und|auch|nur|dann|jetzt|weiter|davon|dazu|dort|hier)\b/.test(value) ||
    /\b(dieses|diesem|diesen|dieser|das projekt|der kunde|die kundin|davon|dazu|dort|hier|nochmal|noch einmal)\b/.test(
      value
    ) ||
    /^(wie sieht|was fehlt|warum|welche davon|was ist damit|pruf das|prufe das|check das)\b/.test(
      value
    )
  );
}

function hasExplicitProjectReference(question: string) {
  return /\b[\p{L}]{2,}[- ]?\d{1,8}\b/iu.test(question);
}

export function shouldCarryJarvisActiveRecord(question: string) {
  return (
    isJarvisReferentialFollowUp(question) &&
    !hasExplicitProjectReference(question)
  );
}

function choiceMatchTokens(value: string) {
  const ignored = new Set([
    "nur",
    "bitte",
    "den",
    "die",
    "das",
    "der",
    "mit",
    "fur",
    "zuerst",
    "davon",
    "nehmen",
  ]);
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

export function resolveJarvisDialogChoiceInput(
  question: string,
  choices?: JarvisDialogChoice[]
) {
  const cleaned = cleanText(question, 1800);
  if (!cleaned || !choices?.length) return undefined;
  const normalizedQuestion = normalize(cleaned);
  const exact = choices.filter(
    (choice) =>
      normalize(choice.label) === normalizedQuestion ||
      normalize(choice.prompt) === normalizedQuestion
  );
  if (exact.length === 1) return exact[0];
  const ordinalMatch = normalizedQuestion.match(
    /\b(?:das|den)?\s*(erste|zweite|dritte|vierte|funfte)\b/
  );
  if (ordinalMatch) {
    const ordinalIndex = ["erste", "zweite", "dritte", "vierte", "funfte"].indexOf(
      ordinalMatch[1]
    );
    if (ordinalIndex >= 0 && ordinalIndex < choices.length) {
      return choices[ordinalIndex];
    }
  }

  const questionTokens = new Set(choiceMatchTokens(cleaned));
  if (questionTokens.size === 0) return undefined;
  const partial = choices.filter((choice) => {
    const labelTokens = choiceMatchTokens(choice.label);
    return (
      labelTokens.length > 0 &&
      labelTokens.every((token) => questionTokens.has(token))
    );
  });
  return partial.length === 1 ? partial[0] : undefined;
}

export function resolveJarvisConversationDomain(
  question: string,
  previousState?: JarvisDialogState
) {
  const decision = resolveJarvisIntentDecision(question);
  if (decision.state === "resolved") return decision.domain;
  if (
    decision.state === "unrecognized" &&
    previousState &&
    isJarvisReferentialFollowUp(question)
  ) {
    return previousState.domain;
  }
  return "system";
}

function extractActiveRecord(response: JarvisDialogResponse) {
  if (!Array.isArray(response.records)) return undefined;
  const records = response.records.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const target = (entry as { target?: unknown }).target;
    const parsed = sanitizeActiveRecord(target);
    return parsed ? [parsed] : [];
  });
  const customers = records.filter((record) => record.kind === "customer");
  if (customers.length === 1) return customers[0];
  const projects = records.filter((record) => record.kind === "project");
  return projects.length === 1 ? projects[0] : undefined;
}

export function buildJarvisDialogState(input: {
  question: string;
  decision?: JarvisIntentDecision;
  domain?: JarvisIntentDomain;
  response?: JarvisDialogResponse;
  previousState?: JarvisDialogState;
  conversationContext?: JarvisSurfaceContext;
}): JarvisDialogState {
  const question = cleanText(input.question, 1800);
  const decision = input.decision ?? resolveJarvisIntentDecision(question);
  const response = input.response ?? {};
  const topicId = cleanText(response.topicId, 120) || undefined;
  const responseRecord = extractActiveRecord(response);
  const contextRecord =
    input.conversationContext?.recordType === "project" ||
    input.conversationContext?.recordType === "customer"
      ? sanitizeActiveRecord({
          kind: input.conversationContext.recordType,
          id: input.conversationContext.recordId,
        })
      : undefined;
  const carryPrevious = shouldCarryJarvisActiveRecord(question);
  const activeRecord =
    responseRecord ||
    (carryPrevious
      ? input.previousState?.activeRecord || contextRecord
      : undefined);
  const isClarification = response.type === "clarification";
  const previousClarification = input.previousState?.clarification;
  const clarificationDepth =
    isClarification && topicId
      ? previousClarification?.topicId === topicId
        ? Math.min(2, previousClarification.depth + 1)
        : 1
      : undefined;
  const responseSequence = sanitizeJarvisDialogState({
    version: 1,
    domain: input.domain ?? decision.domain,
    lastQuestion: question,
    lastIntent: {
      goals: decision.goals,
      entities: decision.entities,
      timeScopes: decision.timeScopes,
      recordFilter: decision.recordFilter,
    },
    projectSequence: response.dialogSequence,
  })?.projectSequence;
  const questionReferences = extractJarvisProjectReferences(question);
  const previousSequence = input.previousState?.projectSequence;
  const belongsToPreviousSequence =
    previousSequence &&
    questionReferences.length > 0 &&
    questionReferences.every((reference) =>
      previousSequence.remainingReferences.includes(reference)
    );
  const remainingPreviousReferences = belongsToPreviousSequence
    ? previousSequence.remainingReferences.filter(
        (reference) => !questionReferences.includes(reference)
      )
    : [];
  const projectSequence =
    responseSequence ??
    (previousSequence && remainingPreviousReferences.length > 0
      ? {
          remainingReferences: remainingPreviousReferences,
          scope: previousSequence.scope,
        }
      : undefined);

  return {
    version: 1,
    domain:
      input.domain ??
      (decision.state === "resolved"
        ? decision.domain
        : input.previousState?.domain ?? decision.domain),
    topicId,
    activeRecord,
    lastQuestion: question,
    lastIntent: {
      goals: decision.goals,
      entities: decision.entities,
      timeScopes: decision.timeScopes,
      recordFilter: decision.recordFilter,
    },
    clarification:
      topicId && clarificationDepth
        ? { topicId, depth: clarificationDepth }
        : undefined,
    projectSequence,
  };
}

export function getJarvisDialogConversationContext(
  state: JarvisDialogState | undefined,
  question: string
): JarvisSurfaceContext | undefined {
  if (!state?.activeRecord || !shouldCarryJarvisActiveRecord(question)) {
    return undefined;
  }
  return {
    recordType: state.activeRecord.kind,
    recordId: state.activeRecord.id,
  };
}
