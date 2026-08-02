import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  createFinalInspection,
  applyFinalInspectionBillingStatus,
  FinalInspectionServiceError,
  FINAL_INSPECTION_ITEMS,
} from "@/lib/projects/final-inspection-service";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
}

function cleanChecklist(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { label?: unknown; done?: unknown };
      const label = cleanString(candidate.label);
      return label ? { label, done: candidate.done === true } : null;
    })
    .filter(Boolean) as Array<{ label: string; done: boolean }>;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const projectId = cleanString(body.projectId);
  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);

  const checklist = cleanChecklist(body.checklist);
  const requestId = cleanString(body.requestId) || randomUUID();
  const mode = cleanString(body.status) === "colleague" ? "colleague" : "self";
  const allChecksDone =
    mode === "colleague" ||
    (checklist.length === FINAL_INSPECTION_ITEMS.length &&
      checklist.every(
        (item, index) =>
          item.done && item.label === FINAL_INSPECTION_ITEMS[index],
      ));
  try {
    const result = await createFinalInspection({
      organizationId: organization.id,
      actorUserId: actorResult.actor.id,
      actorName: getActorName(actorResult.actor),
      inspection: {
        projectId,
        projectLabel: cleanString(body.projectLabel),
        mode,
        allChecksDone,
        comment: cleanString(body.comment),
        upsellNotes: cleanString(body.upsellNotes),
      },
      requestId,
      source: "ui",
    });
    const projectStatusTransition = await applyFinalInspectionBillingStatus({
      organizationId: organization.id,
      projectId,
      projectMonth: result.projectMonth,
      actorUserId: actorResult.actor.id,
      actorName: getActorName(actorResult.actor),
      requestId: `${requestId}:billing-status`,
      source: "ui",
    });
    return NextResponse.json({ id: result.id, success: true, projectStatusTransition }, { status: 201 });
  } catch (error) {
    if (error instanceof FinalInspectionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
