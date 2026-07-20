import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/client";

export const OKS_PHONE_SCOPES = {
  customerContextRead: "customer-context:read",
  customerLogbookWrite: "customer-logbook:write",
  projectLogbookWrite: "project-logbook:write",
  contactsDeltaRead: "contacts-delta:read",
} as const;

type CredentialRecord = {
  id: string;
  organizationId: string;
  keyId: string;
  name: string;
  secretHash: string;
  scopes: unknown;
  isActive: boolean;
  rateLimitPerMinute: number;
};

export type OksPhoneIntegrationActor = {
  credentialId: string;
  credentialName: string;
  organizationId: string;
  keyId: string;
  scopes: string[];
};

export class OksPhoneAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 429
  ) {
    super(message);
  }
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function readScopes(value: unknown) {
  return Array.isArray(value) ? value.filter((scope): scope is string => typeof scope === "string") : [];
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() ?? "";
}

async function consumeRateLimit(credential: CredentialRecord) {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCSeconds(0, 0);

  const bucket = await prisma.oksPhoneRateLimitBucket.upsert({
    where: {
      credentialId_windowStart: {
        credentialId: credential.id,
        windowStart,
      },
    },
    create: {
      credentialId: credential.id,
      windowStart,
      requestCount: 1,
    },
    update: {
      requestCount: { increment: 1 },
    },
    select: { requestCount: true },
  });

  if (bucket.requestCount > credential.rateLimitPerMinute) {
    throw new OksPhoneAuthError("Rate-Limit fuer diese Integration erreicht.", 429);
  }
}

export async function authenticateOksPhoneRequest(request: Request, requiredScope: string) {
  const token = getBearerToken(request);
  const separatorIndex = token.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    throw new OksPhoneAuthError("Integration nicht authentisiert.", 401);
  }

  const keyId = token.slice(0, separatorIndex);
  const secret = token.slice(separatorIndex + 1);
  const credential = await prisma.oksPhoneIntegrationCredential.findUnique({
    where: { keyId },
  });

  const providedHash = hashSecret(secret);
  if (!credential || !credential.isActive || !safeEqual(providedHash, credential.secretHash)) {
    throw new OksPhoneAuthError("Integration nicht authentisiert.", 401);
  }

  const scopes = readScopes(credential.scopes);
  if (!scopes.includes(requiredScope)) {
    throw new OksPhoneAuthError("Integration besitzt nicht den erforderlichen Scope.", 403);
  }

  await consumeRateLimit(credential);
  await prisma.oksPhoneIntegrationCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    credentialId: credential.id,
    credentialName: credential.name,
    organizationId: credential.organizationId,
    keyId: credential.keyId,
    scopes,
  } satisfies OksPhoneIntegrationActor;
}

export async function auditOksPhoneRequest(args: {
  actor: OksPhoneIntegrationActor;
  action: string;
  entityType: string;
  entityId?: string;
  outcome: "success" | "rejected" | "duplicate";
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: args.actor.organizationId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId || randomUUID(),
      payload: {
        integration: "oks-phone",
        credentialId: args.actor.credentialId,
        outcome: args.outcome,
      },
    },
  });
}

export function hashOksPhoneCredentialSecret(secret: string) {
  return hashSecret(secret);
}
