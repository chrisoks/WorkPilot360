import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  cancelJarvisPlanningDraft,
  cancelJarvisTaskDraft,
  completeJarvisPlanningDraft,
  completeJarvisTaskDraft,
  confirmJarvisPlanningDraft,
  confirmJarvisTaskDraft,
  getJarvisActionDraft,
  JarvisActionDraftError,
  type JarvisTaskDraftBinding,
} from "@/lib/jarvis/action-draft-store";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { getPublicAppOrigin } from "@/lib/http/public-app-origin";
import {
  executePlanningBatch,
} from "@/lib/planning/planning-batch-service";

export const dynamic = "force-dynamic";

function draftErrorResponse(error: unknown) {
  if (error instanceof JarvisActionDraftError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  return NextResponse.json(
    {
      error:
        "Der Aufgabenentwurf konnte nicht sicher verarbeitet werden. Es wurde nichts ausgeführt.",
      code: "execution_failed",
    },
    { status: 500 }
  );
}

function mutationIsSameOrigin(req: Request) {
  const marker = req.headers.get("x-jarvis-action");
  if (
    marker !== "task-draft-v1" &&
    marker !== "jarvis-action-draft-v2"
  ) {
    return false;
  }
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(req.url);
    if (originUrl.origin === requestUrl.origin) return true;
    // Next.js can see the internal upstream URL behind the reverse proxy.
    // Reuse the application's validated public-origin resolver instead of
    // trusting any payload value.
    return originUrl.origin === getPublicAppOrigin(req);
  } catch {
    return false;
  }
}

async function getBinding(req: Request, requestedActorId: unknown) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(
    req,
    users,
    requestedActorId
  );
  if (!actorResult.ok) {
    return { response: sessionBoundActorResponse(actorResult) } as const;
  }
  if (!actorResult.sessionId) {
    return {
      response: NextResponse.json(
        {
          error:
            "Für bestätigbare JARVIS-Aktionen ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an.",
          code: "session_required",
        },
        { status: 401 }
      ),
    } as const;
  }
  const sessionActor = users.find(
    (candidate) =>
      candidate.id === actorResult.sessionUserId &&
      candidate.isActive !== false
  );
  if (!sessionActor) {
    return {
      response: NextResponse.json(
        {
          error: "Angemeldeter Benutzer konnte nicht bestimmt werden.",
          code: "scope_mismatch",
        },
        { status: 401 }
      ),
    } as const;
  }
  const binding: JarvisTaskDraftBinding = {
    organizationId: organization.id,
    sessionId: actorResult.sessionId,
    profile: createJarvisAccessProfile(sessionActor, actorResult.actor),
  };
  return { binding } as const;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  const { previewId } = await context.params;
  const actorId = new URL(req.url).searchParams.get("actorId");
  const resolved = await getBinding(req, actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const actionDraft = await getJarvisActionDraft(
      previewId,
      resolved.binding
    );
    return NextResponse.json({ actionDraft });
  } catch (error) {
    return draftErrorResponse(error);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  if (!mutationIsSameOrigin(req)) {
    return NextResponse.json(
      {
        error: "Die Action-Center-Anfrage konnte nicht verifiziert werden.",
        code: "scope_mismatch",
      },
      { status: 403 }
    );
  }
  const { previewId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const resolved = await getBinding(req, body.actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const isPlanning = body.actionId === "planning.prepare";
    const actionDraft = isPlanning
      ? await completeJarvisPlanningDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            title: body.title,
            note: body.note,
            assigneeIds: body.assigneeIds,
            startAt: body.startAt,
            endAt: body.endAt,
            approvalStatus: body.approvalStatus,
            offerId: body.offerId,
            planningTrade: body.planningTrade,
            billingCatalogItemId: body.billingCatalogItemId,
            recurrence: body.recurrence,
            overbookingReason: body.overbookingReason,
            overbookingFingerprint: body.overbookingFingerprint,
          }
        )
      : await completeJarvisTaskDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            description: body.description,
            assigneeId: body.assigneeId,
            dueAt: body.dueAt,
          }
        );
    return NextResponse.json({
      message:
        isPlanning
          ? "Der Terminentwurf wurde erneut fachlich geprüft. Nur wenn keine Prüfung blockiert, kannst du die Anlage bewusst bestätigen."
          : "Der Entwurf ist vollständig. Prüfe die Angaben und bestätige die Anlage bewusst.",
      actionDraft,
    });
  } catch (error) {
    return draftErrorResponse(error);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  if (!mutationIsSameOrigin(req)) {
    return NextResponse.json(
      {
        error: "Die Action-Center-Anfrage konnte nicht verifiziert werden.",
        code: "scope_mismatch",
      },
      { status: 403 }
    );
  }
  const { previewId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const resolved = await getBinding(req, body.actorId);
  if ("response" in resolved) return resolved.response;

  try {
    const isPlanning = body.actionId === "planning.prepare";
    if (body.command === "cancel") {
      const actionDraft = isPlanning
        ? await cancelJarvisPlanningDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : await cancelJarvisTaskDraft(
            previewId,
            resolved.binding,
            body.revision
          );
      return NextResponse.json({
        message: isPlanning
          ? "Der Terminentwurf wurde abgebrochen. Es wurden keine Planungsdaten angelegt."
          : "Der Aufgabenentwurf wurde abgebrochen. Es wurden keine Aufgabendaten angelegt.",
        actionDraft,
      });
    }
    if (body.command !== "confirm") {
      return NextResponse.json(
        {
          error: "Unbekannter Action-Center-Befehl.",
          code: "invalid_input",
        },
        { status: 400 }
      );
    }
    const actionDraft = isPlanning
      ? await confirmJarvisPlanningDraft(
          previewId,
          resolved.binding,
          body.revision,
          async (planningInput) => {
            const { organization, users } = await getDemoContext();
            const actor = users.find(
              (user) => user.id === planningInput.actorUserId && user.isActive
            );
            if (!actor || organization.id !== resolved.binding.organizationId) {
              throw new Error("Der gebundene JARVIS-Akteur ist nicht mehr aktiv.");
            }
            const result = await executePlanningBatch({
              organizationId: organization.id,
              timezone: organization.timezone || "Europe/Berlin",
              actor,
              users,
              request: planningInput.planning,
              source: "jarvis",
            });
            return { id: result.batchId };
          }
        )
      : await confirmJarvisTaskDraft(
          previewId,
          resolved.binding,
          body.revision
        );
    return NextResponse.json({
      message:
        actionDraft.state === "executed"
          ? isPlanning
            ? "Der Termin wurde nach deiner Bestätigung über den Planning-Service genau einmal angelegt."
            : "Die Aufgabe wurde nach deiner Bestätigung genau einmal angelegt."
          : isPlanning
            ? "Der Terminentwurf wurde nicht ausgeführt."
            : "Der Aufgabenentwurf wurde nicht ausgeführt.",
      actionDraft,
    });
  } catch (error) {
    return draftErrorResponse(error);
  }
}
