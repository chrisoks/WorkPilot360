import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { canManageMasterData } from "@/lib/permissions";
import { getChecklistTemplates, updateChecklistTemplate } from "@/lib/checklists/templates";

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  return NextResponse.json({ templates: await getChecklistTemplates(organization.id) });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageMasterData(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Checklisten-Vorlagen bearbeiten." },
      { status: 403 }
    );
  }
  try {
    const template = await updateChecklistTemplate(
      organization.id,
      typeof body.id === "string" ? body.id : "",
      body.template,
      actorResult.actor.id
    );
    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vorlage konnte nicht gespeichert werden." },
      { status: 400 }
    );
  }
}
