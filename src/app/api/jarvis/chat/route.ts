import { NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
    /\b(?:unser(?:e|en|er|em)?|wir|unternehmen|insgesamt|alle kunden|welche kunden|welche mitarbeiter|durchschnittlich)\b/iu.test(
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
  const startsWithQuestion =
    /^\s*(?:warum|weshalb|wieso|wann|wo|wer|welch\w*|was|ist|sind|wurde|wurden|hat|haben|gibt|kann|können)\b/iu.test(
      question
    );
  return (
    !/^\s*wie\b/iu.test(question) &&
    ((!startsWithQuestion && decision.goals.includes("change")) ||
      /^\s*(?:leg|lege|mach|mache|schick|sende|stornier|lösch|losch|ändere|ander|setz|markier|erstell|trag|plane)\w*\b/iu.test(
        question
      ))
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
      /\bwie\b.*\b(?:buch|leg|erfass|trag|plan|verplan)\w*\b/.test(value)
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
      message: getJarvisAuthorizationRefusalMessage(authorization),
    });
  }
  if (accessPolicyResponse) {
    return respond(accessPolicyResponse);
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
    (deterministicQuestionSemantics.projectReferences.length === 1 ||
      context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    (deterministicQuestionSemantics.projectScopes.includes("full") ||
      (
        /\bfehler\w*\b/.test(deterministicQuestionSemantics.normalized) &&
        deterministicQuestionSemantics.projectScopes.length > 0
      ));
  const deterministicProjectDiagnosticFollowUp =
    (context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    isJarvisReferentialFollowUp(message) &&
    /^\s*(?:prüf|pruef|pruf|check|analysier|untersuch|kontrollier)\w*\s+(?:das|dies|dort|hier)\b/iu.test(
      message
    );
  if (
    (deterministicProjectDialogIntent ||
      deterministicProjectDiagnosticIntent ||
      deterministicProjectDiagnosticFollowUp) &&
    !deterministicPersonIntent &&
    !deterministicCapabilityGap &&
    !deterministicSalesIntent
  ) {
    const projectDialogResponse = await resolveJarvisProjectHealthRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
      context,
      ...(conversationContext ? { conversationContext } : {}),
    });
    if (projectDialogResponse) {
      return respond(projectDialogResponse);
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
  const directActionRequest = looksLikeDirectActionRequest(
    message,
    intentDecision
  );
  const exactHelpTopicId = findJarvisExactHelpTopicId(message, context);
  const deterministicHelpRequest =
    Boolean(exactHelpTopicId) &&
    looksLikeDeterministicHelpRequest(message) &&
    !directActionRequest;
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
    const projectMatrixClarification =
      buildJarvisProjectMatrixClarification(
        message,
        intentDecision,
        accessProfile
      );
    if (projectMatrixClarification) {
      return respond(projectMatrixClarification, routePlan.domain);
    }
    const projectScopeSequenceClarification =
      buildJarvisProjectScopeSequenceClarification(
        message,
        intentDecision,
        accessProfile
      );
    if (projectScopeSequenceClarification) {
      return respond(projectScopeSequenceClarification, routePlan.domain);
    }
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
  const organizationServiceRateResponse =
    await resolveJarvisOrganizationServiceRateRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
  if (
    organizationServiceRateResponse &&
    doesJarvisResponseFitRoute(routePlan, organizationServiceRateResponse)
  ) {
    return respond(organizationServiceRateResponse, "management");
  }
  const organizationMaterialResponse =
    await resolveJarvisOrganizationMaterialRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
  if (
    organizationMaterialResponse &&
    doesJarvisResponseFitRoute(routePlan, organizationMaterialResponse)
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
  const projectSequenceClarification =
    buildJarvisProjectSequenceClarification(
      message,
      intentDecision,
      accessProfile
    );
  if (projectSequenceClarification) {
    return respond(projectSequenceClarification);
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
