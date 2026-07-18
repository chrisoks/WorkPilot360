import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { canManageMasterData } from "@/lib/permissions";
import {
  getDocumentMailTemplates,
  saveDocumentMailTemplates,
} from "@/lib/company-settings/mail-templates";

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  return NextResponse.json(await getDocumentMailTemplates(organization.id));
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageMasterData(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen E-Mail-Vorlagen bearbeiten." },
      { status: 403 }
    );
  }
  return NextResponse.json(await saveDocumentMailTemplates(organization.id, body.templates));
}
