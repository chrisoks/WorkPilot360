import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getAuthenticatedSessionUser } from "@/lib/auth/session";

type ActorCandidate = {
  id: string;
  role: Role;
  isActive?: boolean;
};

type SessionBoundActorFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type SessionBoundActorResult<TActor extends ActorCandidate> =
  | {
      ok: true;
      actor: TActor;
      sessionUserId: string;
      isImpersonating: boolean;
    }
  | SessionBoundActorFailure;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function canUseSessionImpersonation(user: { role: Role }) {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export async function getSessionBoundActor<TActor extends ActorCandidate>(
  req: Request,
  users: TActor[],
  requestedActorId: unknown
): Promise<SessionBoundActorResult<TActor>> {
  const sessionUser = await getAuthenticatedSessionUser(req);
  if (!sessionUser) {
    return { ok: false, status: 401, error: "Aktive Sitzung erforderlich." };
  }

  const requestedId = cleanText(requestedActorId) || sessionUser.id;
  if (requestedId !== sessionUser.id && !canUseSessionImpersonation(sessionUser)) {
    return { ok: false, status: 403, error: "Du darfst nicht als dieser Benutzer handeln." };
  }

  const actor = users.find((candidate) => candidate.id === requestedId && candidate.isActive !== false);
  if (!actor) {
    return { ok: false, status: 401, error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." };
  }

  return {
    ok: true,
    actor,
    sessionUserId: sessionUser.id,
    isImpersonating: requestedId !== sessionUser.id,
  };
}

export async function getSessionUserActor<TActor extends { id: string; isActive?: boolean | null }>(
  req: Request,
  users: TActor[]
) {
  const sessionUser = await getAuthenticatedSessionUser(req);
  if (!sessionUser) return null;

  return users.find((candidate) => candidate.id === sessionUser.id && candidate.isActive !== false) ?? null;
}

export function sessionBoundActorResponse(result: SessionBoundActorFailure) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
