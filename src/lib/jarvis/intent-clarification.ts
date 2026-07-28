import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  createJarvisDialogChoice,
  type JarvisDialogChoice,
} from "@/lib/jarvis/dialog";
import type {
  JarvisIntentDecision,
  JarvisIntentDomain,
  JarvisIntentEntity,
  JarvisIntentTimeScope,
} from "@/lib/jarvis/intent-decision";
import {
  canAccessJarvisDataClass,
  type JarvisAccessProfile,
} from "@/lib/jarvis/security";
import {
  extractJarvisProjectReferences,
  type JarvisDialogState,
  type JarvisProjectSequenceScope,
} from "@/lib/jarvis/dialog-state";

export type JarvisIntentClarificationResponse = {
  type: "clarification";
  topicId: "intent.clarification";
  message: string;
  choices: JarvisDialogChoice[];
  deterministic: true;
};

export type JarvisProjectSequenceClarificationResponse = {
  type: "clarification";
  topicId: "project.sequence.clarification";
  message: string;
  choices: JarvisDialogChoice[];
  dialogSequence: {
    remainingReferences: string[];
    scope: JarvisProjectSequenceScope;
  };
  deterministic: true;
};

const DOMAIN_LABELS: Record<JarvisIntentDomain, string> = {
  system: "System & Datensätze",
  sales: "Vertrieb & Kundenchancen",
  management: "BWL & Unternehmenssteuerung",
};

const ENTITY_CONFIG: Record<
  JarvisIntentEntity,
  { label: string; singular: string; actionId?: Parameters<typeof getJarvisActionDecision>[0] }
> = {
  project: { label: "Projekte", singular: "Projekt", actionId: "project.read" },
  customer: { label: "Kunden & Kontakte", singular: "Kunden", actionId: "contact.read" },
  task: { label: "Aufgaben", singular: "Aufgaben", actionId: "task.read" },
  offer: { label: "Angebote", singular: "Angebote", actionId: "offer.read" },
  invoice: { label: "Rechnungen", singular: "Rechnungen", actionId: "invoice.read" },
  employee: { label: "Mitarbeitende", singular: "Mitarbeitende" },
  catalog: { label: "Artikel & Leistungen", singular: "Artikel und Leistungen" },
};

const TIME_SCOPE_LABELS: Record<JarvisIntentTimeScope, string> = {
  today: "Heute",
  current_month: "Aktueller Monat",
  previous_month: "Vormonat",
  current_year: "Aktuelles Jahr",
  previous_year: "Vorjahr",
};

function canUseDomain(domain: JarvisIntentDomain, profile: JarvisAccessProfile) {
  if (domain === "system") return true;
  if (domain === "sales") {
    return getJarvisActionDecision("sales.analysis.read", profile).executable;
  }
  return canAccessJarvisDataClass(profile, "financial");
}

function normalizePrompt(value: string) {
  const cleaned = value.trim().replace(/[.?!]+$/g, "");
  return cleaned ? `${cleaned}.` : "";
}

function resolveProjectSequenceScope(
  question: string
): JarvisProjectSequenceScope {
  const value = question.toLocaleLowerCase("de-DE");
  if (/(stempel|arbeitszeit|zeiteintrag|stunden)/.test(value)) return "stamps";
  if (/(planung|termin|verplan)/.test(value)) return "planning";
  if (/(aufgabe|offene punkte|todo)/.test(value)) return "tasks";
  if (/(angebot|rechnung|abrechnung|faktura)/.test(value)) return "commercial";
  if (/(automatik|zusammenhang|workflow|prozess)/.test(value)) return "automation";
  return "full";
}

function getProjectSequencePrompt(
  reference: string,
  scope: JarvisProjectSequenceScope
) {
  if (scope === "planning") {
    return `Prüfe Planung und Termine von Projekt ${reference}.`;
  }
  if (scope === "stamps") {
    return `Prüfe Stempelungen und Arbeitszeiten von Projekt ${reference}.`;
  }
  if (scope === "tasks") {
    return `Prüfe Aufgaben und offene Punkte von Projekt ${reference}.`;
  }
  if (scope === "commercial") {
    return `Prüfe Angebote, Rechnungen und Abrechnung von Projekt ${reference}.`;
  }
  if (scope === "automation") {
    return `Prüfe Automatiken und Zusammenhänge von Projekt ${reference}.`;
  }
  return `Prüfe Projekt ${reference} vollständig.`;
}

function getProjectSequenceChoices(
  references: string[],
  scope: JarvisProjectSequenceScope
) {
  return references.map((reference, index) =>
    createJarvisDialogChoice(
      `project-sequence-${index + 1}-${reference.toLocaleLowerCase("de-DE")}`,
      reference,
      getProjectSequencePrompt(reference, scope)
    )
  );
}

export function buildJarvisProjectSequenceClarification(
  question: string,
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
): JarvisProjectSequenceClarificationResponse | undefined {
  if (
    decision.candidates.some((candidate) => candidate.score >= 100) ||
    !decision.goals.some((goal) =>
      ["read", "diagnose", "analyze"].includes(goal)
    ) ||
    !getJarvisActionDecision("project.read", profile).executable
  ) {
    return undefined;
  }
  const references = extractJarvisProjectReferences(question);
  if (references.length < 2) return undefined;
  const scope = resolveProjectSequenceScope(question);
  return {
    type: "clarification",
    topicId: "project.sequence.clarification",
    message:
      "Du hast mehrere Projekte genannt. Welches Projekt soll JARVIS zuerst prüfen?",
    choices: getProjectSequenceChoices(references, scope),
    dialogSequence: {
      remainingReferences: references,
      scope,
    },
    deterministic: true,
  };
}

export function buildJarvisProjectSequenceContinuation(
  state: JarvisDialogState | undefined,
  question: string,
  profile: JarvisAccessProfile
) {
  if (
    !state?.projectSequence ||
    !getJarvisActionDecision("project.read", profile).executable
  ) {
    return [];
  }
  const currentReferences = extractJarvisProjectReferences(question);
  if (
    currentReferences.length !== 1 ||
    !state.projectSequence.remainingReferences.includes(currentReferences[0])
  ) {
    return [];
  }
  const remainingReferences =
    state.projectSequence.remainingReferences.filter(
      (reference) => reference !== currentReferences[0]
    );
  return getProjectSequenceChoices(
    remainingReferences,
    state.projectSequence.scope
  );
}

function getDomainChoices(
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
) {
  return decision.candidates
    .filter(
      (candidate) =>
        candidate.score >= 6 && canUseDomain(candidate.domain, profile)
    )
    .filter(
      (candidate, index, list) =>
        list.findIndex(
          (other) =>
            other.domain === candidate.domain && other.segment === candidate.segment
        ) === index
    )
    .map((candidate, index) =>
      createJarvisDialogChoice(
        `intent-domain-${candidate.domain}-${index + 1}`,
        DOMAIN_LABELS[candidate.domain],
        normalizePrompt(candidate.segment)
      )
    )
    .filter((choice) => choice.prompt);
}

function getEntityPrompt(
  entity: JarvisIntentEntity,
  decision: JarvisIntentDecision
) {
  const entityText = ENTITY_CONFIG[entity].singular;
  if (decision.recordFilter === "overdue") {
    return `Zeige mir die überfälligen ${entityText}.`;
  }
  if (decision.recordFilter === "today") {
    return `Zeige mir die heutigen ${entityText}.`;
  }
  if (decision.recordFilter === "open") {
    return `Zeige mir die offenen ${entityText}.`;
  }
  return `Zeige mir die ${entityText}.`;
}

function getEntityChoices(
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
) {
  return decision.entities
    .filter((entity) =>
      ["project", "customer", "task", "offer", "invoice"].includes(entity)
    )
    .filter((entity) => {
      const actionId = ENTITY_CONFIG[entity].actionId;
      return !actionId || getJarvisActionDecision(actionId, profile).executable;
    })
    .map((entity) =>
      createJarvisDialogChoice(
        `intent-entity-${entity}`,
        ENTITY_CONFIG[entity].label,
        getEntityPrompt(entity, decision)
      )
    );
}

function getTimeScopeChoices(
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
) {
  const candidate = decision.candidates.find((entry) =>
    canUseDomain(entry.domain, profile)
  );
  if (!candidate) return [];
  const subject =
    candidate.reasons.filter((reason) => reason !== "WorkPilot-Fachobjekt").join(" und ") ||
    DOMAIN_LABELS[candidate.domain];
  return decision.timeScopes.map((scope) =>
    createJarvisDialogChoice(
      `intent-time-${scope}`,
      TIME_SCOPE_LABELS[scope],
      `Analysiere ${subject} für den Zeitraum „${TIME_SCOPE_LABELS[scope]}“.`
    )
  );
}

export function buildJarvisIntentClarification(
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
): JarvisIntentClarificationResponse | undefined {
  if (decision.state !== "clarification") return undefined;

  if (decision.clarificationReasons.includes("multiple_domains")) {
    const choices = getDomainChoices(decision, profile);
    if (choices.length === 0) return undefined;
    return {
      type: "clarification",
      topicId: "intent.clarification",
      message:
        "Deine Frage enthält mehrere Themen. Welchen Teil soll JARVIS zuerst bearbeiten?",
      choices,
      deterministic: true,
    };
  }

  if (decision.clarificationReasons.includes("multiple_record_targets")) {
    const choices = getEntityChoices(decision, profile);
    if (choices.length === 0) return undefined;
    return {
      type: "clarification",
      topicId: "intent.clarification",
      message:
        "Du hast mehrere Datenbereiche genannt. Welche Datensätze soll JARVIS zuerst anzeigen?",
      choices,
      deterministic: true,
    };
  }

  if (decision.clarificationReasons.includes("multiple_time_scopes")) {
    const choices = getTimeScopeChoices(decision, profile);
    if (choices.length === 0) return undefined;
    return {
      type: "clarification",
      topicId: "intent.clarification",
      message:
        "Du hast mehrere Zeiträume genannt. Welchen Zeitraum soll JARVIS zuerst auswerten?",
      choices,
      deterministic: true,
    };
  }

  return undefined;
}
