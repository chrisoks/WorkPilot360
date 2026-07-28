import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  createJarvisDialogChoice,
  type JarvisDialogChoice,
} from "@/lib/jarvis/dialog";
import {
  resolveJarvisIntentDecision,
  type JarvisIntentDecision,
  type JarvisIntentDomain,
  type JarvisIntentEntity,
  type JarvisIntentTimeScope,
} from "@/lib/jarvis/intent-decision";
import {
  canAccessJarvisDataClass,
  type JarvisAccessProfile,
} from "@/lib/jarvis/security";
import {
  extractJarvisProjectReferences,
  resolveJarvisDialogChoiceInput,
  resolveJarvisProjectIntentScopes,
  type JarvisDialogState,
  type JarvisGuidedSequenceTask,
  type JarvisIntentSequenceTask,
  type JarvisProjectSequenceScope,
} from "@/lib/jarvis/dialog-state";

export type JarvisIntentClarificationResponse = {
  type: "clarification";
  topicId: "intent.clarification";
  message: string;
  choices: JarvisDialogChoice[];
  dialogIntentSequence?: {
    remainingTasks: JarvisIntentSequenceTask[];
  };
  dialogGuidedSequence?: {
    remainingTasks: JarvisGuidedSequenceTask[];
  };
  deterministic: true;
};

export type JarvisProjectMatrixClarificationResponse = {
  type: "clarification";
  topicId: "project.matrix.clarification";
  message: string;
  choices: JarvisDialogChoice[];
  dialogGuidedSequence?: {
    remainingTasks: JarvisGuidedSequenceTask[];
  };
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

export type JarvisProjectScopeSequenceClarificationResponse = {
  type: "clarification";
  topicId: "project.scope-sequence.clarification";
  message: string;
  choices: JarvisDialogChoice[];
  dialogIntentSequence: {
    remainingTasks: JarvisIntentSequenceTask[];
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
  if (scope === "improvements") {
    return `Prüfe Auffälligkeiten und Verbesserungen von Projekt ${reference}.`;
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

const PROJECT_SCOPE_LABELS: Record<JarvisProjectSequenceScope, string> = {
  full: "Vollständiger Projektcheck",
  planning: "Planung & Termine",
  stamps: "Stempelungen & Arbeitszeiten",
  tasks: "Aufgaben & offene Punkte",
  commercial: "Angebote & Rechnungen",
  automation: "Automatik & Zusammenhänge",
  improvements: "Auffälligkeiten & Verbesserungen",
};

function getProjectScopeTaskEntity(
  scope: JarvisProjectSequenceScope
): JarvisIntentSequenceTask["entity"] {
  if (scope === "tasks") return "task";
  return "project";
}

function canUseProjectScope(
  scope: JarvisProjectSequenceScope,
  profile: JarvisAccessProfile
) {
  if (!getJarvisActionDecision("project.read", profile).executable) return false;
  if (scope === "tasks") {
    return getJarvisActionDecision("task.read", profile).executable;
  }
  if (scope === "commercial") {
    return (
      getJarvisActionDecision("offer.read", profile).executable ||
      getJarvisActionDecision("invoice.read", profile).executable
    );
  }
  return true;
}

function getProjectScopeTaskChoice(task: JarvisIntentSequenceTask) {
  const scope = task.projectScope ?? "full";
  return createJarvisDialogChoice(
    `project-scope-sequence-${scope}`,
    PROJECT_SCOPE_LABELS[scope],
    getProjectSequencePrompt(task.projectReference ?? "", scope)
  );
}

function formatProjectReferences(references: string[]) {
  if (references.length <= 1) return references[0] ?? "";
  return `${references.slice(0, -1).join(", ")} und ${
    references[references.length - 1]
  }`;
}

function getProjectMatrixTaskChoice(task: JarvisGuidedSequenceTask) {
  const scope = task.projectScope ?? "full";
  const reference = task.projectReference ?? "";
  return createJarvisDialogChoice(
    `project-matrix-${reference.toLocaleLowerCase("de-DE")}-${scope}`,
    `${reference} · ${PROJECT_SCOPE_LABELS[scope]}`,
    getProjectSequencePrompt(reference, scope)
  );
}

export function buildJarvisProjectMatrixClarification(
  question: string,
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
): JarvisProjectMatrixClarificationResponse | undefined {
  if (
    decision.candidates.some((candidate) => candidate.score >= 100) ||
    decision.clarificationReasons.includes("multiple_domains") ||
    decision.clarificationReasons.includes("multiple_time_scopes") ||
    !decision.goals.some((goal) =>
      ["read", "diagnose", "analyze"].includes(goal)
    )
  ) {
    return undefined;
  }
  const references = extractJarvisProjectReferences(question);
  const scopes = resolveJarvisProjectIntentScopes(question).filter((scope) =>
    canUseProjectScope(scope, profile)
  );
  if (references.length < 2 || scopes.length < 2) return undefined;

  const taskCount = references.length * scopes.length;
  if (taskCount > 5) {
    const referenceText = formatProjectReferences(references);
    return {
      type: "clarification",
      topicId: "project.matrix.clarification",
      message:
        `Das sind ${taskCount} einzelne Prüfungen. Damit nichts übersehen wird, wähle bitte zuerst einen Prüfumfang für ${referenceText}. Danach können wir den nächsten Umfang gezielt starten.`,
      choices: scopes.map((scope) =>
        createJarvisDialogChoice(
          `project-matrix-scope-${scope}`,
          PROJECT_SCOPE_LABELS[scope],
          getProjectSequencePrompt(referenceText, scope)
        )
      ),
      deterministic: true,
    };
  }

  const remainingTasks = references.flatMap((projectReference) =>
    scopes.map<JarvisGuidedSequenceTask>((projectScope) => {
      const baseTask: JarvisGuidedSequenceTask = {
        kind: "project_matrix",
        domain: "system",
        choice: { id: "", label: "", prompt: "" },
        projectReference,
        projectScope,
      };
      return {
        ...baseTask,
        choice: getProjectMatrixTaskChoice(baseTask),
      };
    })
  );
  return {
    type: "clarification",
    topicId: "project.matrix.clarification",
    message:
      `Du hast ${taskCount} Prüfungen für mehrere Projekte genannt. Womit soll JARVIS beginnen? Alle weiteren Prüfungen bleiben vorgemerkt.`,
    choices: remainingTasks.map((task) => task.choice),
    dialogGuidedSequence: { remainingTasks },
    deterministic: true,
  };
}

export function buildJarvisProjectScopeSequenceClarification(
  question: string,
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
): JarvisProjectScopeSequenceClarificationResponse | undefined {
  if (
    decision.candidates.some((candidate) => candidate.score >= 100) ||
    decision.clarificationReasons.includes("multiple_domains") ||
    decision.clarificationReasons.includes("multiple_time_scopes") ||
    !decision.goals.some((goal) =>
      ["read", "diagnose", "analyze"].includes(goal)
    )
  ) {
    return undefined;
  }
  const references = extractJarvisProjectReferences(question);
  const scopes = resolveJarvisProjectIntentScopes(question).filter((scope) =>
    canUseProjectScope(scope, profile)
  );
  if (references.length !== 1 || scopes.length < 2) return undefined;
  const remainingTasks = scopes.slice(0, 5).map((projectScope) => ({
    entity: getProjectScopeTaskEntity(projectScope),
    recordFilter: decision.recordFilter,
    projectReference: references[0],
    projectScope,
  }));
  return {
    type: "clarification",
    topicId: "project.scope-sequence.clarification",
    message:
      `Du möchtest ${references[0]} in mehreren Bereichen prüfen. Womit soll JARVIS beginnen? Die übrigen Prüfungen bleiben vorgemerkt.`,
    choices: remainingTasks.map(getProjectScopeTaskChoice),
    dialogIntentSequence: { remainingTasks },
    deterministic: true,
  };
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

function getDomainGuidedTasks(
  decision: JarvisIntentDecision,
  choices: JarvisDialogChoice[]
) {
  return choices.flatMap<JarvisGuidedSequenceTask>((choice) => {
    const candidate = decision.candidates.find(
      (entry) =>
        choice.id.startsWith(`intent-domain-${entry.domain}-`) &&
        normalizePrompt(entry.segment) === choice.prompt
    );
    return candidate
      ? [
          {
            kind: "domain",
            domain: candidate.domain,
            choice,
          },
        ]
      : [];
  });
}

function getEntityPrompt(
  entity: JarvisIntentEntity,
  decision: JarvisIntentDecision,
  projectReference?: string
) {
  if (projectReference) {
    if (entity === "project") {
      return `Prüfe Projekt ${projectReference} vollständig.`;
    }
    if (entity === "task") {
      return `Prüfe Aufgaben und offene Punkte für ${projectReference}.`;
    }
    if (entity === "offer") {
      return `Prüfe Angebote für ${projectReference}.`;
    }
    if (entity === "invoice") {
      return `Prüfe Rechnungen und Abrechnung für ${projectReference}.`;
    }
  }
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
  const projectReferences = extractJarvisProjectReferences(decision.question);
  const projectReference =
    projectReferences.length === 1 ? projectReferences[0] : undefined;
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
        getEntityPrompt(entity, decision, projectReference)
      )
    );
}

function getIntentSequenceTasks(
  decision: JarvisIntentDecision,
  choices: JarvisDialogChoice[]
): JarvisIntentSequenceTask[] {
  const allowedChoiceIds = new Set(choices.map((choice) => choice.id));
  const projectReferences = extractJarvisProjectReferences(decision.question);
  const projectReference =
    projectReferences.length === 1 ? projectReferences[0] : undefined;
  return decision.entities
    .filter(
      (entity): entity is JarvisIntentSequenceTask["entity"] =>
        ["project", "customer", "task", "offer", "invoice"].includes(entity) &&
        allowedChoiceIds.has(`intent-entity-${entity}`)
    )
    .map((entity) => ({
      entity,
      recordFilter: decision.recordFilter,
      ...(projectReference &&
      ["project", "task", "offer", "invoice"].includes(entity)
        ? { projectReference }
        : {}),
    }));
}

function getIntentSequenceTaskPrompt(task: JarvisIntentSequenceTask) {
  if (task.projectReference && task.projectScope) {
    return getProjectSequencePrompt(task.projectReference, task.projectScope);
  }
  return getEntityPrompt(
    task.entity,
    {
      question: "",
      state: "resolved",
      domain: "system",
      confidence: "high",
      candidates: [],
      clarificationReasons: [],
      goals: ["read"],
      entities: [task.entity],
      timeScopes: [],
      recordFilter: task.recordFilter,
      segments: [],
    },
    task.projectReference
  );
}

function getIntentSequenceTaskChoice(task: JarvisIntentSequenceTask) {
  if (task.projectScope) return getProjectScopeTaskChoice(task);
  return createJarvisDialogChoice(
    `intent-sequence-${task.entity}`,
    ENTITY_CONFIG[task.entity].label,
    getIntentSequenceTaskPrompt(task)
  );
}

function canUseIntentSequenceTask(
  task: JarvisIntentSequenceTask,
  profile: JarvisAccessProfile
) {
  if (task.projectScope) {
    return canUseProjectScope(task.projectScope, profile);
  }
  const actionId = ENTITY_CONFIG[task.entity].actionId;
  return !actionId || getJarvisActionDecision(actionId, profile).executable;
}

export function resolveJarvisIntentSequenceContinuation(
  state: JarvisDialogState | undefined,
  question: string,
  profile: JarvisAccessProfile
) {
  if (!state?.intentSequence) return undefined;
  const decision = resolveJarvisIntentDecision(question);
  const selectedProjectScopes = resolveJarvisProjectIntentScopes(question);
  const selectedEntities = decision.entities.filter((entity) =>
    state.intentSequence?.remainingTasks.some(
      (task) => task.entity === entity
    )
  );
  const selectedTask = state.intentSequence.remainingTasks.find(
    (task) =>
      (task.projectScope
        ? selectedProjectScopes.length === 1 &&
          task.projectScope === selectedProjectScopes[0]
        : selectedEntities.length === 1 &&
          task.entity === selectedEntities[0]) &&
      (!task.projectReference ||
        extractJarvisProjectReferences(question).includes(task.projectReference))
  );
  if (!selectedTask) return undefined;
  const remainingTasks = state.intentSequence.remainingTasks
    .filter((task) => task !== selectedTask)
    .filter((task) => canUseIntentSequenceTask(task, profile));
  return {
    choices: remainingTasks.map(getIntentSequenceTaskChoice),
    remainingTasks,
  };
}

export function buildJarvisIntentSequenceContinuation(
  state: JarvisDialogState | undefined,
  question: string,
  profile: JarvisAccessProfile
) {
  return (
    resolveJarvisIntentSequenceContinuation(state, question, profile)
      ?.choices ?? []
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

function getTimeGuidedTasks(
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile,
  choices: JarvisDialogChoice[]
) {
  const candidate = decision.candidates.find((entry) =>
    canUseDomain(entry.domain, profile)
  );
  if (!candidate) return [];
  return choices.map<JarvisGuidedSequenceTask>((choice) => ({
    kind: "time",
    domain: candidate.domain,
    choice,
  }));
}

function canUseGuidedSequenceTask(
  task: JarvisGuidedSequenceTask,
  profile: JarvisAccessProfile
) {
  if (!canUseDomain(task.domain, profile)) return false;
  const decision = resolveJarvisIntentDecision(task.choice.prompt);
  if (decision.candidates.some((candidate) => candidate.score >= 100)) {
    return false;
  }
  if (task.kind === "project_matrix") {
    const references = extractJarvisProjectReferences(task.choice.prompt);
    const scopes = resolveJarvisProjectIntentScopes(task.choice.prompt);
    return (
      Boolean(task.projectReference) &&
      Boolean(task.projectScope) &&
      references.length === 1 &&
      references[0] === task.projectReference &&
      scopes.length === 1 &&
      scopes[0] === task.projectScope &&
      canUseProjectScope(task.projectScope, profile)
    );
  }
  if (decision.state === "resolved" && decision.domain !== task.domain) {
    return false;
  }
  return task.kind !== "time" || decision.timeScopes.length === 1;
}

export function resolveJarvisGuidedSequenceContinuation(
  state: JarvisDialogState | undefined,
  question: string,
  profile: JarvisAccessProfile
) {
  if (!state?.guidedSequence) return undefined;
  const selectedChoice = resolveJarvisDialogChoiceInput(
    question,
    state.guidedSequence.remainingTasks.map((task) => task.choice)
  );
  if (!selectedChoice) return undefined;
  const remainingTasks = state.guidedSequence.remainingTasks
    .filter((task) => task.choice.id !== selectedChoice.id)
    .filter((task) => canUseGuidedSequenceTask(task, profile));
  return {
    choices: remainingTasks.map((task) => task.choice),
    remainingTasks,
  };
}

export function buildJarvisIntentClarification(
  decision: JarvisIntentDecision,
  profile: JarvisAccessProfile
): JarvisIntentClarificationResponse | undefined {
  if (decision.state !== "clarification") return undefined;

  if (decision.clarificationReasons.includes("multiple_domains")) {
    const choices = getDomainChoices(decision, profile);
    if (choices.length === 0) return undefined;
    const remainingTasks = getDomainGuidedTasks(decision, choices);
    return {
      type: "clarification",
      topicId: "intent.clarification",
      message:
        "Deine Frage enthält mehrere Themen. Welchen Teil soll JARVIS zuerst bearbeiten? Die übrigen erlaubten Teile bleiben vorgemerkt.",
      choices,
      ...(remainingTasks.length > 1
        ? { dialogGuidedSequence: { remainingTasks } }
        : {}),
      deterministic: true,
    };
  }

  if (decision.clarificationReasons.includes("multiple_record_targets")) {
    const choices = getEntityChoices(decision, profile);
    if (choices.length === 0) return undefined;
    const remainingTasks = getIntentSequenceTasks(decision, choices);
    return {
      type: "clarification",
      topicId: "intent.clarification",
      message:
        "Du hast mehrere zusammengehörige Anliegen genannt. Welchen Teil soll JARVIS zuerst bearbeiten? Die übrigen bleiben vorgemerkt.",
      choices,
      ...(remainingTasks.length > 1
        ? { dialogIntentSequence: { remainingTasks } }
        : {}),
      deterministic: true,
    };
  }

  if (decision.clarificationReasons.includes("multiple_time_scopes")) {
    const choices = getTimeScopeChoices(decision, profile);
    if (choices.length === 0) return undefined;
    const remainingTasks = getTimeGuidedTasks(decision, profile, choices);
    return {
      type: "clarification",
      topicId: "intent.clarification",
      message:
        "Du hast mehrere Zeiträume genannt. Welchen Zeitraum soll JARVIS zuerst auswerten? Die übrigen Zeiträume bleiben vorgemerkt.",
      choices,
      ...(remainingTasks.length > 1
        ? { dialogGuidedSequence: { remainingTasks } }
        : {}),
      deterministic: true,
    };
  }

  return undefined;
}
