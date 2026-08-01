import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { canManageProjects } from "@/lib/permissions";
import {
  evaluateProjectStatusChange,
  executeProjectStatusChange,
  getProjectStatusConfirmationText,
  matchesProjectStatusConfirmation,
  ProjectStatusServiceError,
} from "@/lib/projects/project-status-service";

export const dynamic = "force-dynamic";

function projectStatusError(error: unknown) {
  if (error instanceof ProjectStatusServiceError) {
    const status = error.code === "not_found" ? 404 : error.code === "invalid_input" ? 400 : 409;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  return NextResponse.json(
    { error: "Der Projektstatus konnte nicht sicher verarbeitet werden. Es wurde nichts verändert.", code: "execution_failed" },
    { status: 500 }
  );
}

async function binding(req: Request, actorId: unknown) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, actorId);
  if (!actorResult.ok) return { response: sessionBoundActorResponse(actorResult) } as const;
  if (!canManageProjects(actorResult.actor)) {
    return { response: NextResponse.json({ error: "Du darfst Projektstatus nicht ändern.", code: "forbidden" }, { status: 403 }) } as const;
  }
  return { organization, actor: actorResult.actor } as const;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resolved = await binding(req, body.actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const evaluation = await evaluateProjectStatusChange({
      organizationId: resolved.organization.id,
      projectId: typeof body.projectId === "string" ? body.projectId : "",
      targetStatus: typeof body.targetStatus === "string" ? body.targetStatus : "",
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    return NextResponse.json({
      evaluation,
      requiredText: getProjectStatusConfirmationText(evaluation.project.projectNumber, evaluation.targetStatus),
    });
  } catch (error) {
    return projectStatusError(error);
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const resolved = await binding(req, body.actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const evaluation = await evaluateProjectStatusChange({
      organizationId: resolved.organization.id,
      projectId: typeof body.projectId === "string" ? body.projectId : "",
      targetStatus: typeof body.targetStatus === "string" ? body.targetStatus : "",
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    if (evaluation.blockingIssues.length) {
      throw new ProjectStatusServiceError("blocked", evaluation.blockingIssues.join(" · "));
    }
    if (!matchesProjectStatusConfirmation(
      evaluation.project.projectNumber,
      evaluation.targetStatus,
      typeof body.confirmationText === "string" ? body.confirmationText : ""
    )) {
      throw new ProjectStatusServiceError(
        "invalid_input",
        `Gib zur kritischen Bestätigung exakt „${getProjectStatusConfirmationText(evaluation.project.projectNumber, evaluation.targetStatus)}“ ein.`
      );
    }
    if (typeof body.fingerprint !== "string" || body.fingerprint !== evaluation.fingerprint) {
      throw new ProjectStatusServiceError("stale_context", "Projekt oder Fachnachweise haben sich geändert. Bitte prüfe den Statuswechsel erneut.");
    }
    const actorName = [resolved.actor.firstName, resolved.actor.lastName].filter(Boolean).join(" ") || resolved.actor.email;
    const result = await prisma.$transaction(
      (tx) => executeProjectStatusChange({
        tx,
        organizationId: resolved.organization.id,
        projectId: evaluation.project.id,
        targetStatus: evaluation.targetStatus,
        reason: evaluation.reason,
        actorId: resolved.actor.id,
        actorName,
        requestId: typeof body.requestId === "string" ? body.requestId : "",
        expectedFingerprint: evaluation.fingerprint,
        source: "ui",
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json({ project: result.project, replayed: result.replayed });
  } catch (error) {
    return projectStatusError(error);
  }
}
