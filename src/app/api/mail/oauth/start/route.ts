import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getMicrosoftOAuthConfig } from "@/lib/mail/microsoft";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "";
  const returnTo = url.searchParams.get("returnTo") || "/";
  const config = getMicrosoftOAuthConfig(req);

  if (!userId) {
    return NextResponse.json({ error: "Mitarbeiter fehlt." }, { status: 400 });
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
  const state = Buffer.from(JSON.stringify({ userId, returnTo, nonce })).toString("base64url");
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
