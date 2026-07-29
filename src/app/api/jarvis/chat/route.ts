import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  findJarvisExactHelpTopicId,
  resolveJarvisSystemHelp,
  resolveJarvisSystemHelpTopic,
  sanitizeJarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";
import {
  classifyJarvisIntentWithAi,
  type JarvisAiIntentClassification,
} from "@/lib/jarvis/ai-intent-fallback";
import {
  resolveJarvisPersonDiagnosticIntent,
  resolveJarvisPersonDiagnosticRequest,
  resolveJarvisPersonIntent,
  resolveJarvisPersonSummaryRequest,
} from "@/lib/jarvis/person-summary";
import { resolveJarvisReadRequest } from "@/lib/jarvis/read-model";
import {
  resolveJarvisSalesAnalysisIntent,
  resolveJarvisSalesAnalysisRequest,
} from "@/lib/jarvis/sales-analysis";
import { resolveJarvisOrganizationMaterialRequest } from "@/lib/jarvis/organization-material-analysis";
import { resolveJarvisOrganizationServiceRateRequest } from "@/lib/jarvis/organization-service-rate-analysis";
import {
  resolveJarvisOrganizationReceivablesIntent,
  resolveJarvisOrganizationReceivablesRequest,
} from "@/lib/jarvis/organization-receivables-analysis";
import {
  resolveJarvisOrganizationOfferAgingIntent,
  resolveJarvisOrganizationOfferAgingRequest,
} from "@/lib/jarvis/organization-offer-aging-analysis";
import {
  resolveJarvisProjectReviewInventoryIntent,
  resolveJarvisProjectReviewInventoryRequest,
} from "@/lib/jarvis/organization-project-review-analysis";
import { resolveJarvisProjectHealthRequest } from "@/lib/jarvis/project-health";
import {
  authorizeJarvisQuestion,
  createJarvisAccessProfile,
  getJarvisAuthorizationRefusalMessage,
} from "@/lib/jarvis/security";
import { applyJarvisAnswerPolicy } from "@/lib/jarvis/answer-policy";
import { resolveJarvisAccessPolicyQuestion } from "@/lib/jarvis/access-policy";
import { resolveJarvisCapabilityGap } from "@/lib/jarvis/capability-gap";
import {
  resolveJarvisIntentDecision,
  type JarvisIntentDecision,
} from "@/lib/jarvis/intent-decision";
import {
  doesJarvisResponseFitRoute,
  getJarvisReadHint,
  resolveJarvisRoutePlan,
} from "@/lib/jarvis/intent-orchestrator";
import {
  buildJarvisIntentClarification,
  buildJarvisProjectMatrixClarification,
  buildJarvisProjectScopeSequenceClarification,
  buildJarvisProjectSequenceClarification,
  buildJarvisProjectSequenceContinuation,
  resolveJarvisGuidedSequenceContinuation,
  resolveJarvisIntentSequenceContinuation,
} from "@/lib/jarvis/intent-clarification";
import {
  buildJarvisDialogState,
  extractJarvisProjectReferences,
  getJarvisDialogConversationContext,
  isJarvisReferentialFollowUp,
  sanitizeJarvisDialogState,
  shouldCarryJarvisActiveRecord,
} from "@/lib/jarvis/dialog-state";
import { createJarvisDialogChoice } from "@/lib/jarvis/dialog";
import { resolveJarvisProjectDialogIntent } from "@/lib/jarvis/project-dialog-intent";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import { analyzeJarvisQuestion } from "@/lib/jarvis/question-semantics";
import {
  createJarvisActionPreview,
  extractJarvisTaskPreviewTitle,
} from "@/lib/jarvis/action-center";
import {
  createPersistedJarvisTaskDraft,
  JarvisActionDraftError,
} from "@/lib/jarvis/action-draft-store";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function buildJarvisTaskPreview(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  const title = extractJarvisTaskPreviewTitle(input.question);
  if (!title) return undefined;
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: "task.prepare",
    payload: {
      title,
      ...(input.context.recordType === "project" && input.context.recordId
        ? { projectId: input.context.recordId }
        : {}),
    },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) return undefined;

  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für bestätigbare JARVIS-Aktionen ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert oder ausgeführt.",
    };
  }

  try {
    const actionDraft = await createPersistedJarvisTaskDraft({
      preview: preview.value,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
      context: input.context,
    });
    return {
      type: "answer" as const,
      topicId: "action.draft.task",
      message:
        "Ich habe einen sicheren Aufgabenentwurf vorbereitet. Ergänze Verantwortlichkeit und Fälligkeit und prüfe anschließend alle Angaben. Erst deine ausdrückliche Bestätigung darf genau eine Aufgabe anlegen.",
      actionDraft,
    };
  } catch (error) {
    const message =
      error instanceof JarvisActionDraftError
        ? error.message
        : "Der Aufgabenentwurf konnte nicht sicher gespeichert werden.";
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${message} Es wurde nichts ausgeführt.`,
    };
  }
}

function shouldUseProjectHealthPath(
  question: string,
  decision: JarvisIntentDecision
) {
  // Eindeutige Bedienfragen bleiben Bedienfragen. Der Projektkontext darf
  // Begriffe wie "Termin" nicht automatisch in eine Diagnose umdeuten.
  if (decision.goals.includes("how_to")) return false;
  const asksForProjectCollection =
    /\bprojekte\b/iu.test(question) &&
    extractJarvisProjectReferences(question).length === 0 &&
    !isJarvisReferentialFollowUp(question);
  if (asksForProjectCollection) return false;
  const asksForOrganizationScope =
    /\b(?:bei uns|unser(?:e|en|er|em)?|wir|unternehmen|insgesamt|alle kunden|welche kunden|welche mitarbeiter|durchschnittlich)\b/iu.test(
      question
    ) &&
    extractJarvisProjectReferences(question).length === 0 &&
    !/\b(?:dieses|diesem|diesen)\s+projekt\b|\bhier\b/iu.test(question);
  if (asksForOrganizationScope) return false;
  const asksForGenericRecords =
    decision.goals.includes("read") &&
    decision.entities.some((entity) =>
      ["customer", "task", "offer", "invoice"].includes(entity)
    );
  if (!asksForGenericRecords) return true;
  return (
    decision.entities.includes("project") ||
    extractJarvisProjectReferences(question).length > 0 ||
    isJarvisReferentialFollowUp(question)
  );
}

function looksLikeDirectActionRequest(
  question: string,
  decision: JarvisIntentDecision
) {
  if (
    /\b(?:wichtigste[rn]?|nächste[rn]?)\s+(?:sinnvolle[nr]?\s+)?schritt\b/iu.test(
      question
    )
  ) {
    return false;
  }
  const startsWithQuestion =
    /^\s*(?:warum|weshalb|wieso|wann|wo|wer|welch\w*|was|ist|sind|wurde|wurden|hat|haben|gibt|kann|können)\b/iu.test(
      question
    );
  return (
    !/^\s*wie\b/iu.test(question) &&
    ((!startsWithQuestion && decision.goals.includes("change")) ||
      /^\s*(?:leg|lege|mach|mache|schick|sende|stornier|stemp(?:el|le)|lösch|losch|ändere|ander|setz|markier|erstell|trag|plane)\w*\b/iu.test(
        question
      ))
  );
}

function resolveExplicitSafetyPolicyQuestion(question: string) {
  const value = normalizeJarvisIntentText(question);
  if (
    /\b(?:darfst|kannst|wirst)\b.*\brechnung\w*\b.*\bversend\w*\b/.test(
      value
    )
  ) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.invoice-send",
      message:
        "Nein. JARVIS versendet Rechnungen nicht eigenständig. Ein Versand ist eine finanzielle Außenwirkung und benötigt den freigegebenen Rechnungsablauf, eine sichtbare Vorschau, Rollen- und Organisationsprüfung sowie eine bewusste menschliche Bestätigung.",
      deterministic: true,
    };
  }
  if (
    /\b(?:darfst|kannst|sollst)\b.*\brolle\w*\b.*\b(?:ander|aender|wechsel|vergeb)\w*\b/.test(
      value
    )
  ) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.role-change",
      message:
        "Nein. JARVIS ändert oder vergibt Rollen nicht eigenständig. Rollen steuern Zugriffe und müssen über den dafür berechtigten Verwaltungsweg mit sichtbarer Zielperson, neuer Rolle und bewusster menschlicher Bestätigung geändert werden.",
      deterministic: true,
    };
  }
  if (
    /\b(?:darfst|kannst|sollst)\b.*\bstempel\w*\b.*\b(?:ander|aender|losch|loesch|korrigier)\w*\b/.test(
      value
    )
  ) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.stamp-change",
      message:
        "Nein. JARVIS ändert oder löscht Stempelungen nicht eigenständig. Zeitbuchungen bleiben eine nachvollziehbare Benutzer- beziehungsweise berechtigte Korrekturaktion; Ziel, Zeitraum, Begründung und Wirkung müssen vor der Bestätigung sichtbar sein.",
      deterministic: true,
    };
  }
  if (/\b(?:heimlich\w*\s+)?personlichkeitsprofil\w*\b/.test(value)) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.people-profile",
      message:
        "Nein. JARVIS erstellt keine heimlichen Persönlichkeitsprofile. Zulässig sind nur transparente, zweckgebundene und rollenberechtigte Beobachtungen aus freigegebenen Arbeitsdaten; menschliche Einordnung, Feedback und Personalentscheidungen bleiben bei den Verantwortlichen.",
      deterministic: true,
    };
  }
  if (
    /^\s*(?:losch|loesch)\w*\b/.test(value) &&
    /\bprojekt\w*\b/.test(value)
  ) {
    return {
      type: "refusal" as const,
      topicId: "jarvis.safety.project-delete",
      message:
        "Das Projekt wurde nicht gelöscht. Eine Projektlöschung ist irreversibel und für JARVIS nicht freigegeben; sie darf nur über den berechtigten Verwaltungsweg mit eindeutigem Ziel, sichtbaren Folgen und bewusster menschlicher Bestätigung erfolgen.",
      deterministic: true,
    };
  }
  if (
    /^\s*(?:send|sende|schick)\w*\b/.test(value) &&
    /\brechnung\w*\b/.test(value)
  ) {
    return {
      type: "refusal" as const,
      topicId: "jarvis.safety.invoice-send",
      message:
        "Die Rechnung wurde nicht versendet. Rechnungsversand ist eine finanzielle Außenwirkung und für JARVIS noch nicht freigegeben; prüfe Empfänger, Dokument, Betrag und Versandweg im vorgesehenen Rechnungsablauf und bestätige dort bewusst.",
      deterministic: true,
    };
  }
  return undefined;
}

function looksLikeTaskCreationPreviewRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  const startsWithCreate =
    /^\s*(?:leg|lege|erstell|erstelle)\w*\b/.test(value);
  const startsWithLay =
    /^\s*(?:leg|lege)\w*\b/.test(value);
  const hasExplicitCreationMarker =
    !startsWithLay ||
    /\ban\s*[.!?]*$/iu.test(question) ||
    /\bneue\s+aufgabe\b/iu.test(question);
  return (
    startsWithCreate &&
    hasExplicitCreationMarker &&
    /\baufgabe\b/.test(value) &&
    !/\b(?:losch|loesch|ander|aender|archivier)\w*\b/.test(value)
  );
}

function looksLikeDeterministicHelpRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /^(?:wo|wie)\b/.test(value) &&
    (
      /\b(?:sehe|erkenne|finde|offne|oeffne)\s+ich\b/.test(value) ||
      /\bwo\b.*\b(?:sehe|erkenne|finde)\b/.test(value) ||
      /\bwie\b.*\b(?:versende|verschicke|sende)\b/.test(value) ||
      /\bwie\b.*\b(?:buch|leg|erfass|trag|plan|verplan)\w*\b/.test(value) ||
      /\bwie\b.*\b(?:komme|gelange)\b/.test(value)
    )
  );
}

function buildAiIntentClarification(
  classification: JarvisAiIntentClassification,
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>
) {
  if (
    classification.intent !== "prepare_action" &&
    classification.intent !== "unclear" &&
    !classification.needsClarification
  ) {
    return undefined;
  }
  const actionChoices: Partial<
    Record<
      JarvisAiIntentClassification["actionKind"],
      ReturnType<typeof createJarvisDialogChoice>
    >
  > = {
    "appointment.create": createJarvisDialogChoice(
      "ai-intent-appointment-help",
      "Termin anlegen erklären",
      "Wie buche ich hier einen Termin?"
    ),
    "task.create": createJarvisDialogChoice(
      "ai-intent-task-help",
      "Aufgabe anlegen erklären",
      "Wie lege ich hier eine Aufgabe an?"
    ),
    "email.send": createJarvisDialogChoice(
      "ai-intent-email-help",
      "E-Mail-Vorgehen erklären",
      "Wie versende ich in WorkPilot360 eine E-Mail?"
    ),
    "project.create": createJarvisDialogChoice(
      "ai-intent-project-create-help",
      "Projektanlage erklären",
      "Wie lege ich in WorkPilot360 ein Projekt an?"
    ),
    "customer.create": createJarvisDialogChoice(
      "ai-intent-customer-create-help",
      "Kundenanlage erklären",
      "Wie lege ich in WorkPilot360 einen Kunden oder Kontakt an?"
    ),
    "offer.create": createJarvisDialogChoice(
      "ai-intent-offer-create-help",
      "Angebotserstellung erklären",
      "Wie lege ich in WorkPilot360 ein Angebot an?"
    ),
    "invoice.create": createJarvisDialogChoice(
      "ai-intent-invoice-create-help",
      "Rechnungsentwurf erklären",
      "Wie lege ich in WorkPilot360 einen Rechnungsentwurf an?"
    ),
    "invoice.cancel": createJarvisDialogChoice(
      "ai-intent-invoice-cancel-help",
      "Stornierung erklären",
      "Wie storniere ich in WorkPilot360 eine Rechnung?"
    ),
    "stamp.delete": createJarvisDialogChoice(
      "ai-intent-stamp-delete-help",
      "Löschen erklären",
      "Wie lösche ich in WorkPilot360 eine Stempelung?"
    ),
    "time_entry.create": createJarvisDialogChoice(
      "ai-intent-time-entry-create-help",
      "Zeiteintrag erklären",
      "Wie erfasse ich in WorkPilot360 einen manuellen Zeiteintrag?"
    ),
    "record.delete": createJarvisDialogChoice(
      "ai-intent-record-delete-help",
      "Sicheres Löschen erklären",
      "Wie lösche ich diesen Datensatz in WorkPilot360?"
    ),
    "catalog.change": createJarvisDialogChoice(
      "ai-intent-catalog-change-help",
      "Artikel oder Leistung ändern",
      "Wie bearbeite ich einen Artikel oder eine Leistung in WorkPilot360?"
    ),
    "record.change": createJarvisDialogChoice(
      "ai-intent-record-change-help",
      "Änderung erklären",
      "Wie ändere ich diesen Datensatz in WorkPilot360?"
    ),
  };
  const actionChoice = actionChoices[classification.actionKind];
  const choices = [
    ...(actionChoice ? [actionChoice] : []),
    ...(classification.actionKind === "appointment.create" &&
    context.recordType === "project"
      ? [
          createJarvisDialogChoice(
            "ai-intent-appointment-diagnose",
            "Planung & Termine prüfen",
            "Prüfe Planung und Termine für dieses Projekt."
          ),
        ]
      : []),
  ];
  return {
    type: "clarification" as const,
    topicId: "intent.ai.action-clarification",
    message:
      classification.intent === "prepare_action"
        ? "Ich habe verstanden, dass JARVIS hier direkt etwas ausführen soll. Diese Aktion ist in der aktuellen Entwicklungsphase noch nicht freigegeben und wurde nicht ausgeführt. Soll ich dir das sichere Vorgehen erklären?"
        : "Ich bin noch nicht sicher, ob du etwas nur erklärt, geprüft oder später direkt durch JARVIS erledigt haben möchtest. Bitte wähle das gewünschte Vorgehen.",
    choices,
  };
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const body = await req.json().catch(() => ({}));
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  const sessionActor = users.find(
    (candidate) => candidate.id === actorResult.sessionUserId && candidate.isActive !== false
  );
  if (!sessionActor) {
    return NextResponse.json(
      { error: "Angemeldeter Benutzer konnte nicht eindeutig bestimmt werden." },
      { status: 401 }
    );
  }

  const message = cleanText(body.message, 1800);
  if (!message) {
    return NextResponse.json({ error: "Bitte eine Frage zur Bedienung von WorkPilot360 eingeben." }, { status: 400 });
  }

  const context = sanitizeJarvisSurfaceContext(body.context);
  const previousDialogState = sanitizeJarvisDialogState(body.dialogState);
  const suppliedConversationContext = body.conversationContext
    ? sanitizeJarvisSurfaceContext(body.conversationContext)
    : undefined;
  const accessProfile = createJarvisAccessProfile(sessionActor, actorResult.actor);
  const intentDecision = resolveJarvisIntentDecision(message);
  const conversationContext =
    getJarvisDialogConversationContext(previousDialogState, message) ??
    (shouldCarryJarvisActiveRecord(message)
      ? suppliedConversationContext
      : undefined);
  const respond = (
    payload: Record<string, unknown>,
    domain = intentDecision.state === "resolved"
      ? intentDecision.domain
      : previousDialogState?.domain ?? intentDecision.domain
  ) => {
    payload = applyJarvisAnswerPolicy(message, payload);
    const intentSequenceContinuation =
      payload.type === "answer" || payload.type === "refusal"
        ? resolveJarvisIntentSequenceContinuation(
            previousDialogState,
            message,
            accessProfile
          )
        : undefined;
    const guidedSequenceContinuation =
      payload.type === "answer" || payload.type === "refusal"
        ? resolveJarvisGuidedSequenceContinuation(
            previousDialogState,
            message,
            accessProfile
          )
        : undefined;
    const sequenceChoices =
      payload.type === "answer" || payload.type === "refusal"
        ? [
            ...buildJarvisProjectSequenceContinuation(
              previousDialogState,
              message,
              accessProfile
            ),
            ...(intentSequenceContinuation?.choices ?? []),
            ...(guidedSequenceContinuation?.choices ?? []),
          ]
        : [];
    const payloadWithIntentSequence: Record<string, unknown> = {
      ...payload,
      ...(intentSequenceContinuation
        ? {
            dialogIntentSequence: {
              remainingTasks: intentSequenceContinuation.remainingTasks,
            },
          }
        : {}),
      ...(guidedSequenceContinuation
        ? {
            dialogGuidedSequence: {
              remainingTasks: guidedSequenceContinuation.remainingTasks,
            },
          }
        : {}),
    };
    const sequencePayload =
      sequenceChoices.length > 0
        ? {
            ...payloadWithIntentSequence,
            choices: [
              ...(Array.isArray(payloadWithIntentSequence.choices)
                ? payloadWithIntentSequence.choices
                : []),
              ...sequenceChoices,
            ],
          }
        : payloadWithIntentSequence;
    const responsePayload =
      sequencePayload.type === "clarification" &&
      previousDialogState?.clarification?.topicId ===
        sequencePayload.topicId &&
      sequencePayload.topicId !== "intent.ai.action-clarification" &&
      (previousDialogState?.clarification?.depth ?? 0) >= 2
        ? {
            ...sequencePayload,
            message:
              "Ich möchte hier nicht raten. Bitte wähle eine der angebotenen Möglichkeiten oder formuliere Ziel und Datensatz einmal vollständig neu.",
          }
        : sequencePayload;
    const dialogState = buildJarvisDialogState({
        question: message,
        decision: intentDecision,
        domain,
        response: responsePayload,
        previousState: previousDialogState,
        conversationContext,
      });
    const {
      dialogSequence: _dialogSequence,
      dialogIntentSequence: _dialogIntentSequence,
      dialogGuidedSequence: _dialogGuidedSequence,
      ...publicPayload
    } = responsePayload;
    return NextResponse.json({
      ...publicPayload,
      dialogState,
    });
  };
  const authorization = authorizeJarvisQuestion(message, accessProfile);
  const accessPolicyResponse = resolveJarvisAccessPolicyQuestion(message);
  if (!authorization.allowed) {
    if (authorization.reason === "role" && accessPolicyResponse) {
      return respond(accessPolicyResponse);
    }
    return respond({
      type: "refusal",
      topicId: "security.refusal",
      message: getJarvisAuthorizationRefusalMessage(authorization, message),
    });
  }
  if (accessPolicyResponse) {
    return respond(accessPolicyResponse);
  }
  const explicitSafetyPolicyResponse =
    resolveExplicitSafetyPolicyQuestion(message);
  if (explicitSafetyPolicyResponse) {
    return respond(explicitSafetyPolicyResponse);
  }
  const projectReviewInventoryIntent =
    resolveJarvisProjectReviewInventoryIntent(message);
  if (projectReviewInventoryIntent) {
    const projectReviewInventoryResponse =
      await resolveJarvisProjectReviewInventoryRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
      });
    if (projectReviewInventoryResponse) {
      return respond(projectReviewInventoryResponse, "management");
    }
  }
  const organizationReceivablesIntent =
    resolveJarvisOrganizationReceivablesIntent(message);
  if (organizationReceivablesIntent) {
    const organizationReceivablesResponse =
      await resolveJarvisOrganizationReceivablesRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
      });
    if (organizationReceivablesResponse) {
      return respond(organizationReceivablesResponse, "management");
    }
  }
  const organizationOfferAgingIntent =
    resolveJarvisOrganizationOfferAgingIntent(message);
  if (organizationOfferAgingIntent) {
    const organizationOfferAgingResponse =
      await resolveJarvisOrganizationOfferAgingRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
      });
    if (organizationOfferAgingResponse) {
      return respond(organizationOfferAgingResponse, "management");
    }
  }
  const deterministicPersonIntent =
    resolveJarvisPersonIntent(message) ??
    resolveJarvisPersonDiagnosticIntent(message);
  const deterministicCapabilityGap = resolveJarvisCapabilityGap(message);
  const deterministicSalesIntent = resolveJarvisSalesAnalysisIntent(message);
  const exactHelpTopicId = findJarvisExactHelpTopicId(message, context);
  if (exactHelpTopicId?.startsWith("jarvis.")) {
    return respond(
      resolveJarvisSystemHelpTopic(
        exactHelpTopicId,
        message,
        context,
        accessProfile
      )
    );
  }
  const plainLanguageProjectFollowUp =
    previousDialogState?.activeRecord?.kind === "project" &&
    previousDialogState.topicId === "project.health" &&
    /\b(?:ohne fachbegriffe|einfach(?:er)? erkl[aä]r|leicht verst[aä]ndlich)\b/iu.test(
      message
    );
  if (plainLanguageProjectFollowUp) {
    const previousProjectResponse = await resolveJarvisProjectHealthRequest({
      question: previousDialogState.lastQuestion,
      organizationId: organization.id,
      accessProfile,
      context,
      ...(conversationContext ? { conversationContext } : {}),
    });
    if (previousProjectResponse) {
      return respond({
        type: "answer",
        topicId: "project.health.plain-language",
        message: `Einfach gesagt: ${previousProjectResponse.message}`,
        deterministic: true,
      });
    }
  }
  const deterministicProjectDialogIntent =
    resolveJarvisProjectDialogIntent({
      question: message,
      hasProjectContext:
        extractJarvisProjectReferences(message).length === 1 ||
        context.recordType === "project" ||
        conversationContext?.recordType === "project",
    });
  const deterministicQuestionSemantics = analyzeJarvisQuestion(message);
  const deterministicProjectDiagnosticIntent =
    !intentDecision.goals.includes("how_to") &&
    !looksLikeDeterministicHelpRequest(message) &&
    !looksLikeDirectActionRequest(message, intentDecision) &&
    (deterministicQuestionSemantics.projectReferences.length === 1 ||
      context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    shouldUseProjectHealthPath(message, intentDecision) &&
    deterministicQuestionSemantics.projectScopes.length === 1;
  const deterministicProjectDiagnosticFollowUp =
    (context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    isJarvisReferentialFollowUp(message) &&
    /^\s*(?:prüf|pruef|pruf|check|analysier|untersuch|kontrollier)\w*\s+(?:mal\s+)?(?:(?:das|dies)\s+)?(?:projekt\s+)?(?:dort|hier|das|dies)\b/iu.test(
      message
    );
  const deterministicProjectWhyFollowUp =
    conversationContext?.recordType === "project" &&
    previousDialogState?.topicId?.startsWith("project.health") &&
    /^\s*(?:warum|wieso|weshalb)\s*[?!.]*\s*$/iu.test(message);
  if (
    (deterministicProjectDialogIntent ||
      deterministicProjectDiagnosticIntent ||
      deterministicProjectDiagnosticFollowUp ||
      deterministicProjectWhyFollowUp) &&
    !deterministicPersonIntent &&
    !deterministicCapabilityGap &&
    !deterministicSalesIntent
  ) {
    const projectDialogResponse = await resolveJarvisProjectHealthRequest({
      question: deterministicProjectWhyFollowUp
        ? previousDialogState?.topicId === "project.health.plain-language"
          ? "Was ist der wichtigste nächste Schritt für dieses Projekt und warum?"
          : "Was läuft beim zuletzt geprüften Projekt schief?"
        : message,
      organizationId: organization.id,
      accessProfile,
      context,
      ...(conversationContext ? { conversationContext } : {}),
    });
    if (projectDialogResponse) {
      if (deterministicProjectWhyFollowUp) {
        return respond({
          type: "answer",
          topicId: "project.health.why",
          message: `Der Grund für diese Priorität: ${projectDialogResponse.message}`,
          deterministic: true,
        });
      }
      return respond(projectDialogResponse);
    }
  }
  const directActionRequest = looksLikeDirectActionRequest(
    message,
    intentDecision
  );
  if (directActionRequest && /^\s*stemp(?:el|le|l)\w*\b/iu.test(message)) {
    return respond({
      type: "refusal",
      topicId: "action.time-write-not-released",
      message:
        "Diese Stempelaktion ist für JARVIS nicht freigegeben und wurde nicht ausgeführt. Stempelungen bleiben eine bewusste Benutzeraktion in der Zeiterfassung; rückwirkende Änderungen müssen zusätzlich über den dafür berechtigten WorkPilot360-Weg geprüft werden.",
      deterministic: true,
    });
  }
  const deterministicHelpRequest =
    Boolean(exactHelpTopicId) &&
    (
      looksLikeDeterministicHelpRequest(message) ||
      exactHelpTopicId?.startsWith("jarvis.")
    ) &&
    !directActionRequest;
  if (exactHelpTopicId && deterministicHelpRequest) {
    return respond(
      resolveJarvisSystemHelpTopic(
        exactHelpTopicId,
        message,
        context,
        accessProfile
      )
    );
  }
  if (
    !directActionRequest &&
    !exactHelpTopicId &&
    looksLikeDeterministicHelpRequest(message)
  ) {
    const deterministicHelp = resolveJarvisSystemHelp(
      message,
      context,
      accessProfile
    );
    if (deterministicHelp.type !== "unknown") {
      return respond(deterministicHelp);
    }
  }
  if (!directActionRequest) {
    const deterministicProjectClarification =
      buildJarvisProjectMatrixClarification(
        message,
        intentDecision,
        accessProfile
      ) ??
      buildJarvisProjectScopeSequenceClarification(
        message,
        intentDecision,
        accessProfile
      ) ??
      buildJarvisProjectSequenceClarification(
        message,
        intentDecision,
        accessProfile
      );
    if (deterministicProjectClarification) {
      return respond(deterministicProjectClarification);
    }
  }
  if (
    directActionRequest &&
    looksLikeTaskCreationPreviewRequest(message)
  ) {
    const taskPreview = await buildJarvisTaskPreview({
      question: message,
      organizationId: organization.id,
      sessionId: actorResult.sessionId,
      accessProfile,
      context,
    });
    if (taskPreview) {
      return respond(taskPreview);
    }
  }
  const routingContext = conversationContext ?? context;
  const aiIntentClassification = await classifyJarvisIntentWithAi({
    question: message,
    decision: intentDecision,
    context: routingContext,
  });
  const routePlan = resolveJarvisRoutePlan({
    question: message,
    decision: intentDecision,
    context: routingContext,
    ai: aiIntentClassification,
    hasDeterministicPersonIntent: Boolean(deterministicPersonIntent),
  });
  if (
    directActionRequest &&
    aiIntentClassification?.intent === "prepare_action" &&
    aiIntentClassification.actionKind === "task.create"
  ) {
    const taskPreview = await buildJarvisTaskPreview({
      question: message,
      organizationId: organization.id,
      sessionId: actorResult.sessionId,
      accessProfile,
      context,
    });
    if (taskPreview) {
      return respond(taskPreview);
    }
  }
  if (
    directActionRequest &&
    aiIntentClassification?.intent !== "prepare_action"
  ) {
    return respond({
      type: "clarification",
      topicId: "intent.action-not-executed",
      message:
        "Du möchtest, dass JARVIS direkt etwas ändert oder anlegt. Diese Aktion wurde nicht ausgeführt. Die ausführende Funktion ist noch nicht freigegeben; ich kann dir stattdessen den sicheren Ablauf in WorkPilot360 erklären.",
    });
  }
  if (
    aiIntentClassification &&
    (routePlan.prepareAction || routePlan.needsClarification) &&
    !deterministicHelpRequest &&
    !deterministicPersonIntent &&
    !deterministicCapabilityGap &&
    !deterministicSalesIntent
  ) {
    const aiClarification = buildAiIntentClarification(
      aiIntentClassification,
      routingContext
    );
    if (aiClarification) {
      return respond(aiClarification, routePlan.domain);
    }
  }
  if (
    exactHelpTopicId &&
    (routePlan.allowExactHelp || deterministicHelpRequest) &&
    !directActionRequest
  ) {
    return respond(
      resolveJarvisSystemHelpTopic(
        exactHelpTopicId,
        message,
        context,
        accessProfile
      )
    );
  }
  if (routePlan.needsClarification) {
    const intentClarification = buildJarvisIntentClarification(
      intentDecision,
      accessProfile
    );
    if (intentClarification) {
      return respond(intentClarification, routePlan.domain);
    }
  }
  const projectReviewInventoryResponse =
    await resolveJarvisProjectReviewInventoryRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
  if (
    projectReviewInventoryResponse &&
    doesJarvisResponseFitRoute(routePlan, projectReviewInventoryResponse)
  ) {
    return respond(projectReviewInventoryResponse, "management");
  }
  const explicitlyOrganizationScoped =
    /\b(?:bei uns|unser(?:e|en|er|em)?|wir|unternehmen|insgesamt|organisationsweit)\b/iu.test(
      message
    ) &&
    extractJarvisProjectReferences(message).length === 0 &&
    !/\b(?:dieses|diesem|diesen)\s+projekt\b|\bhier\b/iu.test(message);
  const projectFocusedRelation =
    !explicitlyOrganizationScoped &&
    (context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    deterministicQuestionSemantics.relation;
  const organizationServiceRateResponse =
    projectFocusedRelation === "project_service_rates"
      ? undefined
      : await resolveJarvisOrganizationServiceRateRequest({
          question: message,
          organizationId: organization.id,
          accessProfile,
        });
  if (
    organizationServiceRateResponse &&
    (
      explicitlyOrganizationScoped ||
      doesJarvisResponseFitRoute(routePlan, organizationServiceRateResponse)
    )
  ) {
    return respond(organizationServiceRateResponse, "management");
  }
  const organizationMaterialResponse =
    projectFocusedRelation === "project_materials"
      ? undefined
      : await resolveJarvisOrganizationMaterialRequest({
          question: message,
          organizationId: organization.id,
          accessProfile,
        });
  if (
    organizationMaterialResponse &&
    (
      explicitlyOrganizationScoped ||
      doesJarvisResponseFitRoute(routePlan, organizationMaterialResponse)
    )
  ) {
    return respond(organizationMaterialResponse, "management");
  }
  if (deterministicSalesIntent) {
    const salesAnalysisResponse = await resolveJarvisSalesAnalysisRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
    if (
      salesAnalysisResponse &&
      doesJarvisResponseFitRoute(routePlan, salesAnalysisResponse)
    ) {
      return respond(salesAnalysisResponse, "sales");
    }
  }
  if (deterministicCapabilityGap) {
    return respond(deterministicCapabilityGap, routePlan.domain);
  }
  if (routePlan.preferPerson) {
    const personDiagnosticResponse =
      await resolveJarvisPersonDiagnosticRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
        context,
      });
    if (
      personDiagnosticResponse &&
      doesJarvisResponseFitRoute(routePlan, personDiagnosticResponse)
    ) {
      return respond(personDiagnosticResponse, routePlan.domain);
    }
    const personSummaryResponse = await resolveJarvisPersonSummaryRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
    if (
      personSummaryResponse &&
      doesJarvisResponseFitRoute(routePlan, personSummaryResponse)
    ) {
      return respond(personSummaryResponse, routePlan.domain);
    }
  }
  if (routePlan.preferRead) {
    const readResponse = await resolveJarvisReadRequest({
      question: message,
      context,
      organizationId: organization.id,
      accessProfile,
      intentHint: getJarvisReadHint(routePlan),
    });
    if (
      readResponse &&
      doesJarvisResponseFitRoute(routePlan, readResponse)
    ) {
      return respond(readResponse, routePlan.domain);
    }
  }
  const explicitProjectReferences = extractJarvisProjectReferences(message);
  if (
    explicitProjectReferences.length === 1 &&
    !directActionRequest &&
    routePlan.preferProjectHealth &&
    shouldUseProjectHealthPath(message, intentDecision)
  ) {
    const explicitProjectResponse = await resolveJarvisProjectHealthRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
      context,
      ...(conversationContext ? { conversationContext } : {}),
    });
    if (
      explicitProjectResponse &&
      doesJarvisResponseFitRoute(routePlan, explicitProjectResponse)
    ) {
      return respond(explicitProjectResponse);
    }
  }
  if (
    aiIntentClassification?.intent === "how_to" &&
    aiIntentClassification.helpTopicId !== "none" &&
    aiIntentClassification.confidence === "high" &&
    !aiIntentClassification.needsClarification
  ) {
    return respond(
      resolveJarvisSystemHelpTopic(
        aiIntentClassification.helpTopicId,
        message,
        context,
        accessProfile
      ),
      aiIntentClassification.domain
    );
  }
  if (!routePlan.needsClarification) {
    const intentClarification = buildJarvisIntentClarification(
      intentDecision,
      accessProfile
    );
    if (intentClarification) {
      return respond(intentClarification, routePlan.domain);
    }
  }
  const projectHealthResponse =
    routePlan.preferProjectHealth &&
    shouldUseProjectHealthPath(message, intentDecision)
    ? await resolveJarvisProjectHealthRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
        context,
        ...(conversationContext ? { conversationContext } : {}),
      })
    : undefined;
  if (
    projectHealthResponse &&
    doesJarvisResponseFitRoute(routePlan, projectHealthResponse)
  ) {
    return respond(projectHealthResponse);
  }
  const personDiagnosticResponse = await resolveJarvisPersonDiagnosticRequest({
    question: message,
    organizationId: organization.id,
    accessProfile,
    context,
  });
  if (
    personDiagnosticResponse &&
    doesJarvisResponseFitRoute(routePlan, personDiagnosticResponse)
  ) {
    return respond(personDiagnosticResponse);
  }
  const personSummaryResponse = await resolveJarvisPersonSummaryRequest({
    question: message,
    organizationId: organization.id,
    accessProfile,
  });
  if (
    personSummaryResponse &&
    doesJarvisResponseFitRoute(routePlan, personSummaryResponse)
  ) {
    return respond(personSummaryResponse);
  }
  const readResponse = await resolveJarvisReadRequest({
    question: message,
    context,
    organizationId: organization.id,
    accessProfile,
    ...(getJarvisReadHint(routePlan)
      ? { intentHint: getJarvisReadHint(routePlan) }
      : {}),
  });
  if (readResponse && doesJarvisResponseFitRoute(routePlan, readResponse)) {
    return respond(readResponse);
  }
  const resolved = resolveJarvisSystemHelp(message, context, accessProfile);
  return respond(resolved);
}
