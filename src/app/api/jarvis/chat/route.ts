import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  resolveJarvisSystemHelp,
  sanitizeJarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";
import { resolveJarvisReadRequest } from "@/lib/jarvis/read-model";
import { resolveJarvisSalesAnalysisIntent } from "@/lib/jarvis/sales-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
  const accessProfile = createJarvisAccessProfile(sessionActor, actorResult.actor);
  if (resolveJarvisSalesAnalysisIntent(message)) {
    return NextResponse.json({
      type: "answer",
      topicId: "sales.analysis.mode-hint",
      message:
        "Diese Frage gehört zur Vertriebsanalyse. Nutze dafür den JARVIS-Reiter „Vertrieb“, sofern er für deine Rolle freigegeben ist. Die Systemhilfe bleibt auf die Bedienung von WorkPilot360 begrenzt.",
      deterministic: true,
    });
  }
  const readResponse = await resolveJarvisReadRequest({
    question: message,
    context,
    organizationId: organization.id,
    accessProfile,
  });
  if (readResponse) {
    return NextResponse.json(readResponse);
  }
  const resolved = resolveJarvisSystemHelp(message, context, accessProfile);
  return NextResponse.json(resolved);
}
