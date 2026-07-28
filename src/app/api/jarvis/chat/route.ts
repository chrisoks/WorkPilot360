import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  resolveJarvisSystemHelp,
  resolveJarvisSystemHelpTopic,
  sanitizeJarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";
import {
  classifyJarvisIntentWithAi,
  type JarvisAiIntentClassification,
} from "@/lib/jarvis/ai-intent-fallback";
import {
  resolveJarvisPersonDiagnosticRequest,
  resolveJarvisPersonSummaryRequest,
} from "@/lib/jarvis/person-summary";
import { resolveJarvisReadRequest } from "@/lib/jarvis/read-model";
import {
  resolveJarvisSalesAnalysisIntent,
  resolveJarvisSalesAnalysisRequest,
} from "@/lib/jarvis/sales-analysis";
import { resolveJarvisOrganizationMaterialRequest } from "@/lib/jarvis/organization-material-analysis";
import { resolveJarvisOrganizationServiceRateRequest } from "@/lib/jarvis/organization-service-rate-analysis";
import { resolveJarvisProjectReviewInventoryRequest } from "@/lib/jarvis/organization-project-review-analysis";
import { resolveJarvisProjectHealthRequest } from "@/lib/jarvis/project-health";
import {
  authorizeJarvisQuestion,
  createJarvisAccessProfile,
  getJarvisAuthorizationRefusalMessage,
} from "@/lib/jarvis/security";
import { applyJarvisAnswerPolicy } from "@/lib/jarvis/answer-policy";
import {
  resolveJarvisIntentDecision,
  type JarvisIntentDecision,
} from "@/lib/jarvis/intent-decision";
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

function buildAiIntentClarification(
  classification: JarvisAiIntentClassification,
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>
) {
  if (
    classification.intent !== "prepare_action" &&
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
  if (!authorization.allowed) {
    return respond({
      type: "refusal",
      topicId: "security.refusal",
      message: getJarvisAuthorizationRefusalMessage(authorization),
    });
  }
  const projectReviewInventoryResponse =
    await resolveJarvisProjectReviewInventoryRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
  if (projectReviewInventoryResponse) {
    return respond(projectReviewInventoryResponse, "management");
  }
  const projectMatrixClarification =
    buildJarvisProjectMatrixClarification(
      message,
      intentDecision,
      accessProfile
    );
  if (projectMatrixClarification) {
    return respond(projectMatrixClarification);
  }
  const projectScopeSequenceClarification =
    buildJarvisProjectScopeSequenceClarification(
      message,
      intentDecision,
      accessProfile
    );
  if (projectScopeSequenceClarification) {
    return respond(projectScopeSequenceClarification);
  }
  const aiIntentClassification = await classifyJarvisIntentWithAi({
    question: message,
    decision: intentDecision,
    context,
  });
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
  if (aiIntentClassification) {
    const aiClarification = buildAiIntentClarification(
      aiIntentClassification,
      context
    );
    if (aiClarification) {
      return respond(aiClarification, aiIntentClassification.domain);
    }
  }
  const intentClarification = buildJarvisIntentClarification(
    intentDecision,
    accessProfile
  );
  if (intentClarification) {
    return respond(intentClarification);
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
  const projectHealthResponse = shouldUseProjectHealthPath(
    message,
    intentDecision
  )
    ? await resolveJarvisProjectHealthRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
        context,
        ...(conversationContext ? { conversationContext } : {}),
      })
    : undefined;
  if (projectHealthResponse) {
    return respond(projectHealthResponse);
  }
  const personDiagnosticResponse = await resolveJarvisPersonDiagnosticRequest({
    question: message,
    organizationId: organization.id,
    accessProfile,
    context,
  });
  if (personDiagnosticResponse) {
    return respond(personDiagnosticResponse);
  }
  const personSummaryResponse = await resolveJarvisPersonSummaryRequest({
    question: message,
    organizationId: organization.id,
    accessProfile,
  });
  if (personSummaryResponse) {
    return respond(personSummaryResponse);
  }
  const organizationServiceRateResponse =
    await resolveJarvisOrganizationServiceRateRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
  if (organizationServiceRateResponse) {
    return respond(organizationServiceRateResponse, "management");
  }
  const organizationMaterialResponse =
    await resolveJarvisOrganizationMaterialRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
  if (organizationMaterialResponse) {
    return respond(organizationMaterialResponse, "management");
  }
  if (resolveJarvisSalesAnalysisIntent(message)) {
    const salesAnalysisResponse = await resolveJarvisSalesAnalysisRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
    if (salesAnalysisResponse) {
      return respond(salesAnalysisResponse, "sales");
    }
  }
  const readResponse = await resolveJarvisReadRequest({
    question: message,
    context,
    organizationId: organization.id,
    accessProfile,
  });
  if (readResponse) {
    return respond(readResponse);
  }
  const resolved = resolveJarvisSystemHelp(message, context, accessProfile);
  return respond(resolved);
}
