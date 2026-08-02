import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { canArchiveProjects } from "@/lib/permissions";
import { evaluateProjectLifecycle, executeProjectLifecycle, getProjectLifecycleConfirmationText, matchesProjectLifecycleConfirmation, ProjectLifecycleServiceError } from "@/lib/projects/project-lifecycle-service";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof ProjectLifecycleServiceError) {
    const status = error.code === "not_found" ? 404 : error.code === "invalid_input" ? 400 : 409;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  return NextResponse.json({ error: "Die Projektarchivierung konnte nicht sicher verarbeitet werden. Es wurde nichts verändert.", code: "execution_failed" }, { status: 500 });
}

async function binding(req: Request, actorId: unknown) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, actorId);
  if (!actorResult.ok) return { response: sessionBoundActorResponse(actorResult) } as const;
  if (!canArchiveProjects(actorResult.actor)) return { response: NextResponse.json({ error: "Du darfst Projekte nicht archivieren oder wiederherstellen.", code: "forbidden" }, { status: 403 }) } as const;
  return { organization, actor: actorResult.actor } as const;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resolved = await binding(req, body.actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const evaluation = await evaluateProjectLifecycle({ organizationId: resolved.organization.id, projectId: typeof body.projectId === "string" ? body.projectId : "", lifecycleAction: typeof body.lifecycleAction === "string" ? body.lifecycleAction : "", reason: typeof body.reason === "string" ? body.reason : "" });
    return NextResponse.json({ evaluation, requiredText: getProjectLifecycleConfirmationText(evaluation.project.projectNumber, evaluation.lifecycleAction) });
  } catch (error) { return failure(error); }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resolved = await binding(req, body.actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const evaluation = await evaluateProjectLifecycle({ organizationId: resolved.organization.id, projectId: typeof body.projectId === "string" ? body.projectId : "", lifecycleAction: typeof body.lifecycleAction === "string" ? body.lifecycleAction : "", reason: typeof body.reason === "string" ? body.reason : "" });
    if (evaluation.blockingIssues.length) throw new ProjectLifecycleServiceError("blocked", evaluation.blockingIssues.join(" · "));
    if (!matchesProjectLifecycleConfirmation(evaluation.project.projectNumber, evaluation.lifecycleAction, typeof body.confirmationText === "string" ? body.confirmationText : "")) {
      throw new ProjectLifecycleServiceError("invalid_input", `Gib zur kritischen Bestätigung exakt „${getProjectLifecycleConfirmationText(evaluation.project.projectNumber, evaluation.lifecycleAction)}“ ein.`);
    }
    if (typeof body.fingerprint !== "string" || body.fingerprint !== evaluation.fingerprint) throw new ProjectLifecycleServiceError("stale_context", "Projekt oder Verknüpfungen haben sich geändert. Bitte prüfe die Aktion erneut.");
    const actorName = [resolved.actor.firstName, resolved.actor.lastName].filter(Boolean).join(" ") || resolved.actor.email;
    const result = await prisma.$transaction((tx) => executeProjectLifecycle({ tx, organizationId: resolved.organization.id, projectId: evaluation.project.id, lifecycleAction: evaluation.lifecycleAction, reason: evaluation.reason, actorId: resolved.actor.id, actorName, requestId: typeof body.requestId === "string" ? body.requestId : "", expectedFingerprint: evaluation.fingerprint, source: "ui" }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ project: result.project, replayed: result.replayed });
  } catch (error) { return failure(error); }
}
