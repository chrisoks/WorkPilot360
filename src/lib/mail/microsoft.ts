import { prisma } from "@/lib/db/client";

export type MicrosoftMailAccount = {
  provider?: string;
  status?: string;
  email?: string;
  displayName?: string;
  bcc?: string;
  sendCopyToSelf?: boolean;
  connectedAt?: string;
  lastTestAt?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  microsoftUserId?: string;
};

export function getMicrosoftOAuthConfig(req?: Request) {
  const tenantId = process.env.MS365_TENANT_ID || "common";
  const clientId = process.env.MS365_CLIENT_ID || "";
  const clientSecret = process.env.MS365_CLIENT_SECRET || "";
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (req ? new URL(req.url).origin : "http://localhost:3001");
  const redirectUri =
    process.env.MS365_REDIRECT_URI || `${origin}/api/mail/oauth/callback`;

  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    scopes: ["offline_access", "User.Read", "Mail.Send"],
  };
}

export function parseStoredMailAccount(value: unknown): MicrosoftMailAccount {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MicrosoftMailAccount)
    : {};
}

export async function getStoredMailAccount(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ mailAccount: unknown }>>`
    SELECT "mailAccount"
    FROM "User"
    WHERE id = ${userId}
    LIMIT 1
  `;

  return parseStoredMailAccount(rows[0]?.mailAccount);
}

export function sanitizeMailAccount(account: MicrosoftMailAccount, fallbackEmail = "") {
  return {
    provider: "microsoft365",
    status: account.status === "connected" || account.status === "expired" ? account.status : "not_connected",
    email: account.email || fallbackEmail,
    displayName: account.displayName || "",
    bcc: account.bcc || "",
    sendCopyToSelf: account.sendCopyToSelf !== false,
    connectedAt: account.connectedAt || "",
    lastTestAt: account.lastTestAt || "",
  };
}

export async function refreshMicrosoftAccessToken(userId: string, account: MicrosoftMailAccount, req?: Request) {
  const config = getMicrosoftOAuthConfig(req);
  if (!config.clientId || !config.clientSecret || !account.refreshToken) return account;

  const expiresAt = account.expiresAt ? new Date(account.expiresAt).getTime() : 0;
  if (account.accessToken && expiresAt - Date.now() > 120000) return account;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: account.refreshToken,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
  });

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResponse.ok) {
    const expiredAccount = { ...account, status: "expired" };
    await prisma.$executeRaw`
      UPDATE "User" SET "mailAccount" = ${expiredAccount}::jsonb WHERE id = ${userId}
    `;
    return expiredAccount;
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const refreshedAccount = {
    ...account,
    status: "connected",
    accessToken: tokenData.access_token || account.accessToken,
    refreshToken: tokenData.refresh_token || account.refreshToken,
    expiresAt: new Date(Date.now() + Number(tokenData.expires_in ?? 3600) * 1000).toISOString(),
  };

  await prisma.$executeRaw`
    UPDATE "User" SET "mailAccount" = ${refreshedAccount}::jsonb WHERE id = ${userId}
  `;

  return refreshedAccount;
}
