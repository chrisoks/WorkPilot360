import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { searchJarvisGuidedOptions, type JarvisGuidedSearchKind } from "@/lib/jarvis/guided-search";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { canManageOffers } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const KINDS = new Set<JarvisGuidedSearchKind>(["customer", "project", "catalog"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, url.searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  const sessionActor = users.find((user) => user.id === actorResult.sessionUserId && user.isActive !== false);
  if (!sessionActor) {
    return NextResponse.json({ error: "Angemeldeter Benutzer konnte nicht bestimmt werden." }, { status: 401 });
  }
  const profile = createJarvisAccessProfile(sessionActor, actorResult.actor);
  if (!canManageOffers(profile.sessionActor) || !canManageOffers(profile.effectiveActor)) {
    return NextResponse.json({ error: "Diese Rollenkombination darf keine Angebotsdaten durchsuchen." }, { status: 403 });
  }
  const rawKind = url.searchParams.get("kind") ?? "";
  if (!KINDS.has(rawKind as JarvisGuidedSearchKind)) {
    return NextResponse.json({ error: "Unbekannte Suchart." }, { status: 400 });
  }
  const results = await searchJarvisGuidedOptions({
    organizationId: organization.id,
    kind: rawKind as JarvisGuidedSearchKind,
    query: url.searchParams.get("query") ?? "",
    customer: url.searchParams.get("customer") ?? "",
  });
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
