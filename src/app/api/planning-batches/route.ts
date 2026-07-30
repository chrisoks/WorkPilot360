import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  evaluatePlanningBatch,
  executePlanningBatch,
  isPlanningBatchError,
} from "@/lib/planning/planning-batch-service";
import { sharedPlanningRequestSchema } from "@/lib/planning/shared-planning";

const bodySchema = z
  .object({
    command: z.enum(["preflight", "execute"]),
    source: z.enum(["manual", "jarvis"]).default("manual"),
    actorUserId: z.string().trim().optional(),
    planning: sharedPlanningRequestSchema,
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const { organization, users } = await getDemoContext();
    const actorResult = await getSessionBoundActor(request, users, body.actorUserId);
    if (!actorResult.ok) return sessionBoundActorResponse(actorResult);

    const input = {
      organizationId: organization.id,
      timezone: organization.timezone || "Europe/Berlin",
      actor: actorResult.actor,
      users,
      request: body.planning,
    };
    if (body.command === "preflight") {
      return NextResponse.json({
        ok: true,
        evaluation: await evaluatePlanningBatch(input),
      });
    }
    return NextResponse.json(
      {
        ok: true,
        result: await executePlanningBatch({
          ...input,
          source: body.source,
        }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Die Planungsdaten sind unvollständig oder ungültig.",
          code: "invalid_planning_payload",
          issues: error.issues,
        },
        { status: 400 }
      );
    }
    if (isPlanningBatchError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("planning batch failed", error);
    return NextResponse.json(
      { error: "Die Planung konnte nicht sicher gespeichert werden." },
      { status: 500 }
    );
  }
}
