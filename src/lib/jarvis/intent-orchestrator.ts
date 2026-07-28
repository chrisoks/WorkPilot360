import type {
  JarvisAiIntentClassification,
  JarvisAiIntentEntity,
  JarvisAiIntentKind,
  JarvisAiIntentScope,
} from "@/lib/jarvis/ai-intent-fallback";
import {
  extractJarvisProjectReferences,
  isJarvisReferentialFollowUp,
} from "@/lib/jarvis/dialog-state";
import type {
  JarvisIntentDecision,
  JarvisIntentEntity,
} from "@/lib/jarvis/intent-decision";
import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";

export type JarvisRoutePlan = {
  intent: JarvisAiIntentKind;
  domain: "system" | "sales" | "management";
  entity: JarvisAiIntentEntity;
  scope: JarvisAiIntentScope;
  confidence: "low" | "medium" | "high";
  source: "ai" | "deterministic";
  needsClarification: boolean;
  allowExactHelp: boolean;
  preferRead: boolean;
  preferPerson: boolean;
  preferProjectHealth: boolean;
  prepareAction: boolean;
  usesCurrentContext: boolean;
};

const ORGANIZATION_SCOPE_SIGNAL =
  /\b(?:wir|unser(?:e|en|er|em)?|unternehmen|insgesamt|alle|sämtliche|durchschnittlich)\b/iu;
const CURRENT_RECORD_SIGNAL =
  /\b(?:hier|dies(?:es|em|en|er)|aktuell(?:e|en|er|es)?|dazu|darüber)\b/iu;

function deterministicIntent(
  decision: JarvisIntentDecision
): JarvisAiIntentKind {
  if (decision.goals.includes("change")) return "prepare_action";
  if (decision.goals.includes("how_to")) return "how_to";
  if (decision.goals.includes("diagnose")) return "diagnose";
  if (decision.goals.includes("analyze")) return "analyze";
  if (decision.goals.includes("read")) return "read";
  if (decision.goals.includes("explain")) return "explain";
  return decision.state === "unrecognized" ? "unclear" : "explain";
}

function mapEntity(
  entity: JarvisIntentEntity | undefined
): JarvisAiIntentEntity {
  if (!entity) return "none";
  return entity;
}

function deterministicEntity(
  question: string,
  decision: JarvisIntentDecision,
  context: JarvisSurfaceContext
): JarvisAiIntentEntity {
  if (extractJarvisProjectReferences(question).length > 0) return "project";
  const entity = decision.entities[0];
  if (entity) return mapEntity(entity);
  if (CURRENT_RECORD_SIGNAL.test(question)) {
    if (context.recordType === "project") return "project";
    if (context.recordType === "customer") return "customer";
  }
  if (isJarvisReferentialFollowUp(question)) {
    if (context.recordType === "project") return "project";
    if (context.recordType === "customer") return "customer";
  }
  return "none";
}

function deterministicScope(
  question: string,
  decision: JarvisIntentDecision,
  context: JarvisSurfaceContext
): JarvisAiIntentScope {
  if (extractJarvisProjectReferences(question).length > 0) {
    return "explicit_record";
  }
  if (ORGANIZATION_SCOPE_SIGNAL.test(question)) return "organization";
  if (
    decision.recordFilter !== "all" ||
    /\b(?:projekte|kunden|kontakte|aufgaben|angebote|rechnungen|mitarbeiter)\b/iu.test(
      question
    )
  ) {
    return "collection";
  }
  if (
    (CURRENT_RECORD_SIGNAL.test(question) ||
      isJarvisReferentialFollowUp(question)) &&
    (context.recordType === "project" || context.recordType === "customer")
  ) {
    return "current_record";
  }
  return "none";
}

export function resolveJarvisRoutePlan(input: {
  question: string;
  decision: JarvisIntentDecision;
  context?: JarvisSurfaceContext;
  ai?: JarvisAiIntentClassification;
  hasDeterministicPersonIntent?: boolean;
}): JarvisRoutePlan {
  const context = input.context ?? {};
  const deterministicFallbackIntent = deterministicIntent(input.decision);
  const aiIsUsable =
    Boolean(input.ai) &&
    input.ai?.confidence !== "low" &&
    !(
      input.ai?.intent === "unclear" &&
      deterministicFallbackIntent !== "unclear"
    );
  const intent = aiIsUsable
    ? input.ai!.intent
    : deterministicFallbackIntent;
  const explicitProjectReferences =
    extractJarvisProjectReferences(input.question);
  const explicitProject = explicitProjectReferences.length > 0;
  const entity = aiIsUsable
    ? input.ai!.entity
    : deterministicEntity(input.question, input.decision, context);
  // Eine ausdrücklich genannte Projektnummer ist belastbarer als eine
  // probabilistische Scope-Klassifizierung.
  const scope = explicitProject
    ? "explicit_record"
    : aiIsUsable
      ? input.ai!.scope
      : deterministicScope(input.question, input.decision, context);
  const organizationOrCollection =
    scope === "organization" || scope === "collection";
  const usesCurrentContext =
    scope === "current_record" ||
    (!explicitProject &&
      !organizationOrCollection &&
      Boolean(input.ai?.usesCurrentContext));
  const projectScopedEntity =
    explicitProject ||
    (usesCurrentContext && context.recordType === "project") ||
    (
      context.recordType === "project" &&
      !organizationOrCollection &&
      ["diagnose", "analyze"].includes(intent) &&
      /\b(?:projekt|stempel|arbeitszeit|planung|termin|angebot|rechnung|abrechnung|automatik)\w*\b/iu.test(
        input.question
      )
    );
  const targetIsNonProject =
    !projectScopedEntity &&
    entity !== "none" &&
    entity !== "project" &&
    entity !== "planning" &&
    entity !== "organization";
  const projectIntent =
    entity === "project" ||
    entity === "planning" ||
    projectScopedEntity ||
    (entity === "none" &&
      usesCurrentContext &&
      context.recordType === "project");
  const readEntity = ["project", "customer", "task", "offer", "invoice"].includes(
    entity
  );

  return {
    intent,
    domain: aiIsUsable ? input.ai!.domain : input.decision.domain,
    entity,
    scope,
    confidence: aiIsUsable ? input.ai!.confidence : input.decision.confidence,
    source: aiIsUsable ? "ai" : "deterministic",
    needsClarification:
      !input.hasDeterministicPersonIntent &&
      !(
        explicitProjectReferences.length === 1 &&
        projectIntent &&
        ["read", "explain", "diagnose", "analyze"].includes(intent)
      ) &&
      (Boolean(input.ai?.needsClarification) ||
        intent === "unclear" ||
        (!aiIsUsable && input.decision.state === "clarification")),
    allowExactHelp: intent === "how_to",
    preferRead:
      intent === "read" &&
      readEntity &&
      (!projectIntent || organizationOrCollection),
    preferPerson:
      (input.hasDeterministicPersonIntent ||
        entity === "customer" ||
        entity === "employee") &&
      ["read", "explain", "diagnose", "analyze"].includes(intent),
    preferProjectHealth:
      !targetIsNonProject &&
      projectIntent &&
      !organizationOrCollection &&
      ["read", "explain", "diagnose", "analyze"].includes(intent),
    prepareAction: intent === "prepare_action",
    usesCurrentContext,
  };
}

export function getJarvisReadHint(plan: JarvisRoutePlan) {
  if (
    !plan.preferRead ||
    !["project", "customer", "task", "offer", "invoice"].includes(plan.entity)
  ) {
    return undefined;
  }
  return {
    kind: plan.entity as "project" | "customer" | "task" | "offer" | "invoice",
  };
}

export function doesJarvisResponseFitRoute(
  plan: JarvisRoutePlan,
  payload: unknown
) {
  if (plan.source !== "ai") return true;
  if (!payload || typeof payload !== "object") return false;
  const topicId = (payload as Record<string, unknown>).topicId;
  if (typeof topicId !== "string") return true;
  if (
    topicId.startsWith("security.") ||
    topicId.startsWith("intent.") ||
    topicId.startsWith("capability.")
  ) {
    return true;
  }
  if (topicId.startsWith("project.")) {
    return plan.preferProjectHealth;
  }
  if (topicId.startsWith("person.")) {
    return plan.preferPerson;
  }
  if (topicId.startsWith("records.")) {
    const kind = topicId.split(".")[1];
    return plan.intent === "read" && kind === plan.entity;
  }
  if (topicId.startsWith("sales.")) {
    return plan.domain === "sales";
  }
  if (topicId.startsWith("management.")) {
    return plan.domain === "management";
  }
  return true;
}
