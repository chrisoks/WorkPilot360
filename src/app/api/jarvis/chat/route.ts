import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  resolveJarvisSystemHelp,
  sanitizeJarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";
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
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
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

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function shouldUseProjectHealthPath(
  question: string,
  decision: JarvisIntentDecision
) {
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
