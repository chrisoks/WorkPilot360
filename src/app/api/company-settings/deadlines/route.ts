import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDeadlineSettings, saveDeadlineSettings } from "@/lib/company-settings/deadlines";
import { getDemoContext } from "@/lib/demo/context";
import { canManageStatusRules } from "@/lib/permissions";

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const settings = await getDeadlineSettings(organization.id);
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  if (!canManageStatusRules(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Gesch\u00e4ftsf\u00fchrung d\u00fcrfen Zeitfristen verwalten." },
      { status: 403 }
    );
  }

  const settings = await saveDeadlineSettings(organization.id, body);
  return NextResponse.json(settings);
}
