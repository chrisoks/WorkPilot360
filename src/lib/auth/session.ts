import { createHmac, timingSafeEqual } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export const WORKPILOT_SESSION_COOKIE = "workpilot_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

export type AuthenticatedSessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  teamId: string | null;
  dailyWorkHours: number | null;
  profileImageDataUrl: string | null;
  personalNumber: string | null;
};

function getSessionSecret() {
  return (
    process.env.WORKPILOT_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "workpilot-local-development-session-secret"
  );
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

function parseCookieHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function createSessionToken(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifySessionToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !payload.expiresAt || payload.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionTokenFromRequest(req: Request) {
  return parseCookieHeader(req.headers.get("cookie"), WORKPILOT_SESSION_COOKIE);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function getAuthenticatedSessionUser(req: Request) {
  const token = getSessionTokenFromRequest(req);
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const users = await prisma.$queryRaw<AuthenticatedSessionUser[]>`
    SELECT id, "firstName", "lastName", email, role, "teamId", "dailyWorkHours", "profileImageDataUrl", "personalNumber"
    FROM "User"
    WHERE id = ${payload.userId}
      AND "isActive" = true
    LIMIT 1
  `;

  return users[0] ?? null;
}
