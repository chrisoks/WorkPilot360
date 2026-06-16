import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getMicrosoftOAuthConfig, getStoredMailAccount } from "@/lib/mail/microsoft";

function decodeState(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      userId?: string;
      returnTo?: string;
      nonce?: string;
    };
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const config = getMicrosoftOAuthConfig(req);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = req.headers.get("cookie")?.match(/(?:^|;\s*)wp360_ms_oauth_state=([^;]+)/)?.[1] || "";
  const decodedState = decodeState(state);
  const returnTo = decodedState.returnTo?.startsWith("/") ? decodedState.returnTo : "/";
  const redirectUrl = new URL(returnTo, config.appOrigin || url.origin);

  if (!code || !state || decodeURIComponent(expectedState) !== state || !decodedState.userId) {
    redirectUrl.searchParams.set("mailOAuth", "error");
    redirectUrl.searchParams.set("reason", "ungueltiger_status");
    return NextResponse.redirect(redirectUrl);
  }

  const tokenBody = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
  });

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });

  if (!tokenResponse.ok) {
    redirectUrl.searchParams.set("mailOAuth", "error");
    redirectUrl.searchParams.set("reason", "token");
    return NextResponse.redirect(redirectUrl);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = profileResponse.ok
    ? ((await profileResponse.json()) as {
        id?: string;
        displayName?: string;
        mail?: string;
        userPrincipalName?: string;
      })
    : {};

  const existingAccount = await getStoredMailAccount(decodedState.userId);
  const connectedAccount = {
    ...existingAccount,
    provider: "microsoft365",
    status: "connected",
    email: profile.mail || profile.userPrincipalName || existingAccount.email || "",
    displayName: profile.displayName || existingAccount.displayName || "",
    microsoftUserId: profile.id || existingAccount.microsoftUserId || "",
    accessToken: tokenData.access_token || "",
    refreshToken: tokenData.refresh_token || existingAccount.refreshToken || "",
    expiresAt: new Date(Date.now() + Number(tokenData.expires_in ?? 3600) * 1000).toISOString(),
    connectedAt: new Date().toISOString(),
  };

  await prisma.$executeRaw`
    UPDATE "User"
    SET "mailAccount" = ${connectedAccount}::jsonb
    WHERE id = ${decodedState.userId}
  `;

  redirectUrl.searchParams.set("mailOAuth", "connected");
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("wp360_ms_oauth_state");
  return response;
}
