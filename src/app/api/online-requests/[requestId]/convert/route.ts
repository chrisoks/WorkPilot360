import { NextResponse } from "next/server";
import {
  getSessionBoundActor,
  sessionBoundActorResponse,
} from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { getPublicAppOrigin } from "@/lib/http/public-app-origin";
import {
  convertOnlineRequest,
  OnlineRequestConversionError,
} from "@/lib/online-requests/conversion-service";
import { ensureOnlineRequestStorage } from "@/lib/online-requests/ensure";
import { canConvertOnlineRequests } from "@/lib/permissions";
import { ensureStatusTrackingTables } from "@/lib/status-tracking";

export const dynamic = "force-dynamic";

const MUTATION_MARKER = "online-request-convert-v1";

function mutationIsSameOrigin(request: Request) {
  if (request.headers.get("x-online-request-action") !== MUTATION_MARKER) {
    return false;
  }
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return (
      originUrl.origin === requestUrl.origin ||
      originUrl.origin === getPublicAppOrigin(request)
    );
  } catch {
    return false;
  }
}

function conversionErrorResponse(error: unknown) {
  if (error instanceof OnlineRequestConversionError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  console.error("Online request conversion failed", {
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : "unknown",
  });
  return NextResponse.json(
    {
      error:
        "Die Online-Anfrage konnte nicht sicher übernommen werden. Es wurden keine unvollständigen Projektdaten bestätigt.",
      code: "conversion_failed",
    },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  await Promise.all([
    ensureOnlineRequestStorage(),
    ensureStatusTrackingTables(),
  ]);
  if (!mutationIsSameOrigin(request)) {
    return NextResponse.json(
      {
        error:
          "Die Projektübernahme wurde wegen einer ungültigen Anfragequelle abgebrochen.",
        code: "origin_invalid",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(request, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!actorResult.sessionId) {
    return NextResponse.json(
      {
        error:
          "Für die Projektübernahme ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an.",
        code: "session_required",
      },
      { status: 401 }
    );
  }
  if (!canConvertOnlineRequests(actorResult.actor)) {
    return NextResponse.json(
      {
        error: "Du darfst Online-Anfragen nicht in Projekte umwandeln.",
        code: "forbidden",
      },
      { status: 403 }
    );
  }

  const { requestId } = await context.params;
  try {
    const result = await convertOnlineRequest({
      organizationId: organization.id,
      requestId,
      actor: actorResult.actor,
      users,
    });
    return NextResponse.json(result, {
      status: result.duplicate ? 200 : 201,
    });
  } catch (error) {
    return conversionErrorResponse(error);
  }
}
