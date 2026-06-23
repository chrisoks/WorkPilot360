import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getMicrosoftOAuthConfig } from "@/lib/mail/microsoft";
import { canManageUsers } from "@/lib/permissions";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "";
  const actorId = url.searchParams.get("actorId") || "";
  const returnTo = url.searchParams.get("returnTo") || "/";
  const config = getMicrosoftOAuthConfig(req);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
  }
  if (!actorId) {
    return NextResponse.json({ error: "Aktiver Benutzer erforderlich." }, { status: 401 });
  }

  const { users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const targetUser = users.find((user) => user.id === userId);
  if (!targetUser?.isActive) {
    return NextResponse.json({ error: "Aktiver Benutzer erforderlich." }, { status: 401 });
  }
  if (targetUser.id !== actor.id && !canManageUsers(actor)) {
    return NextResponse.json({ error: "Du darfst dieses Mailkonto nicht verbinden." }, { status: 403 });
  }

  if (!config.clientId || !config.clientSecret) {
    return NextResponse.json(
      {
        error:
          "Microsoft 365 OAuth ist noch nicht konfiguriert. Bitte MS365_CLIENT_ID und MS365_CLIENT_SECRET in der Umgebung hinterlegen.",
      },
      { status: 503 }
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ userId, actorId, returnTo, nonce })).toString("base64url");
  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", config.scopes.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("wp360_ms_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
