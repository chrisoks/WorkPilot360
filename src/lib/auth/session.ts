import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export const WORKPILOT_SESSION_COOKIE = "workpilot_session";
export const SESSION_IDLE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_ABSOLUTE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_ROTATION_INTERVAL_SECONDS = 60 * 60 * 12;
export const SESSION_ROTATION_GRACE_SECONDS = 30;
const SESSION_TOUCH_INTERVAL_SECONDS = 60 * 15;

type LegacySessionPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

type ServerSessionToken = {
  sessionId: string;
  version: number;
};

type AuthSessionRow = {
  id: string;
  userId: string;
  tokenVersion: number;
  previousTokenVersion: number | null;
  previousValidUntil: Date | null;
  createdAt: Date;
  lastSeenAt: Date;
  lastRotatedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
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

export type SessionAuthentication = {
  user: AuthenticatedSessionUser;
  session: AuthSessionRow | null;
  replacementToken: string;
  legacy: boolean;
};

function getSessionSecret() {
  const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) {
    if (process.env.NODE_ENV === "production" && secret.length < 32) {
      throw new Error("Das produktive WorkPilot-Session-Secret muss mindestens 32 Zeichen lang sein.");
    }
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET muss in Produktion gesetzt sein.");
  }
  return "workpilot-local-development-session-secret";
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function signaturesMatch(signature: string, expectedSignature: string) {
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

function parseCookieHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function createServerSessionToken(sessionId: string, version: number) {
  const value = `v2.${sessionId}.${version}`;
  return `${value}.${signValue(value)}`;
}

export function parseServerSessionToken(token: string): ServerSessionToken | null {
  const [prefix, sessionId, versionText, signature, ...rest] = token.split(".");
  if (prefix !== "v2" || !sessionId || !versionText || !signature || rest.length > 0) return null;
  const version = Number(versionText);
  if (!Number.isSafeInteger(version) || version < 1) return null;
  const value = `${prefix}.${sessionId}.${versionText}`;
  if (!signaturesMatch(signature, signValue(value))) return null;
  return { sessionId, version };
}

function parseLegacySessionToken(token: string) {
  const [encodedPayload, signature, ...rest] = token.split(".");
  if (!encodedPayload || !signature || rest.length > 0) return null;
  if (!signaturesMatch(signature, signValue(encodedPayload))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as LegacySessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.userId || !payload.expiresAt || payload.expiresAt < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionTokenFromRequest(req: Request) {
  return parseCookieHeader(req.headers.get("cookie"), WORKPILOT_SESSION_COOKIE);
}

export function getSessionCookieOptions(maxAge = SESSION_ABSOLUTE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(0, maxAge),
  };
}

export async function createServerSession(userId: string, now = new Date()) {
  const id = randomUUID();
  const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MAX_AGE_SECONDS * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MAX_AGE_SECONDS * 1000);

  await prisma.authSession.create({
    data: {
      id,
      userId,
      tokenVersion: 1,
      createdAt: now,
      lastSeenAt: now,
      lastRotatedAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
    },
  });

  return {
    token: createServerSessionToken(id, 1),
    absoluteExpiresAt,
  };
}

async function getActiveUser(userId: string) {
  const users = await prisma.$queryRaw<AuthenticatedSessionUser[]>`
    SELECT id, "firstName", "lastName", email, role, "teamId", "dailyWorkHours", "profileImageDataUrl", "personalNumber"
    FROM "User"
    WHERE id = ${userId}
      AND "isActive" = true
    LIMIT 1
  `;
  return users[0] ?? null;
}

function sessionIsActive(session: AuthSessionRow, now: Date) {
  return (
    !session.revokedAt &&
    session.absoluteExpiresAt.getTime() > now.getTime() &&
    session.idleExpiresAt.getTime() > now.getTime()
  );
}

function tokenVersionIsAccepted(session: AuthSessionRow, version: number, now: Date) {
  if (version === session.tokenVersion) return true;
  return (
    version === session.previousTokenVersion &&
    !!session.previousValidUntil &&
    session.previousValidUntil.getTime() > now.getTime()
  );
}

async function touchSession(session: AuthSessionRow, now: Date) {
  if (now.getTime() - session.lastSeenAt.getTime() < SESSION_TOUCH_INTERVAL_SECONDS * 1000) {
    return session;
  }
  const idleExpiresAt = new Date(
    Math.min(
      now.getTime() + SESSION_IDLE_MAX_AGE_SECONDS * 1000,
      session.absoluteExpiresAt.getTime()
    )
  );
  return prisma.authSession.update({
    where: { id: session.id },
    data: { lastSeenAt: now, idleExpiresAt },
  });
}

export async function authenticateSession(req: Request, options?: { rotate?: boolean }) {
  const token = getSessionTokenFromRequest(req);
  const parsed = parseServerSessionToken(token);
  const now = new Date();

  if (!parsed) {
    const legacy = parseLegacySessionToken(token);
    if (!legacy) return null;
    const user = await getActiveUser(legacy.userId);
    return user ? { user, session: null, replacementToken: "", legacy: true } : null;
  }

  let session = (await prisma.authSession.findUnique({
    where: { id: parsed.sessionId },
  })) as AuthSessionRow | null;
  if (!session || !sessionIsActive(session, now)) return null;
  if (!tokenVersionIsAccepted(session, parsed.version, now)) return null;

  session = await touchSession(session, now);
  let replacementToken =
    parsed.version === session.tokenVersion
      ? ""
      : createServerSessionToken(session.id, session.tokenVersion);

  const rotationDue =
    options?.rotate &&
    now.getTime() - session.lastRotatedAt.getTime() >= SESSION_ROTATION_INTERVAL_SECONDS * 1000;
  if (rotationDue && parsed.version === session.tokenVersion) {
    const nextVersion = session.tokenVersion + 1;
    const previousValidUntil = new Date(now.getTime() + SESSION_ROTATION_GRACE_SECONDS * 1000);
    const updated = await prisma.authSession.updateMany({
      where: {
        id: session.id,
        tokenVersion: session.tokenVersion,
        revokedAt: null,
      },
      data: {
        previousTokenVersion: session.tokenVersion,
        previousValidUntil,
        tokenVersion: nextVersion,
        lastRotatedAt: now,
      },
    });
    if (updated.count === 1) {
      session = {
        ...session,
        previousTokenVersion: session.tokenVersion,
        previousValidUntil,
        tokenVersion: nextVersion,
        lastRotatedAt: now,
      };
      replacementToken = createServerSessionToken(session.id, nextVersion);
    } else {
      session = (await prisma.authSession.findUnique({ where: { id: session.id } })) as AuthSessionRow;
      if (!session || !tokenVersionIsAccepted(session, parsed.version, now)) return null;
      replacementToken = createServerSessionToken(session.id, session.tokenVersion);
    }
  }

  const user = await getActiveUser(session.userId);
  return user ? { user, session, replacementToken, legacy: false } : null;
}

export async function getAuthenticatedSessionUser(req: Request) {
  return (await authenticateSession(req))?.user ?? null;
}

export async function revokeSessionFromRequest(req: Request) {
  const parsed = parseServerSessionToken(getSessionTokenFromRequest(req));
  if (!parsed) return false;
  await prisma.authSession.updateMany({
    where: { id: parsed.sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return true;
}

export function getRemainingCookieMaxAge(absoluteExpiresAt: Date, now = new Date()) {
  return Math.max(0, Math.floor((absoluteExpiresAt.getTime() - now.getTime()) / 1000));
}
