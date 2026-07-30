import { prisma } from "@/lib/db/client";
import { getPublicAppOrigin } from "@/lib/http/public-app-origin";
import { PublicRequestSecurityError } from "./security";

type PublicRequestRateLimitKind = "session" | "submission" | "rejected";

const RATE_LIMITS: Record<
  PublicRequestRateLimitKind,
  { windowMs: number; maximum: number }
> = {
  session: { windowMs: 10 * 60 * 1000, maximum: 12 },
  submission: { windowMs: 60 * 60 * 1000, maximum: 5 },
  rejected: { windowMs: 10 * 60 * 1000, maximum: 8 },
};

let lastSecurityCleanupAt = 0;

export async function pruneExpiredPublicRequestSecurityArtifacts(
  now = new Date()
) {
  if (now.getTime() - lastSecurityCleanupAt < 60 * 60 * 1_000) return;
  lastSecurityCleanupAt = now.getTime();
  const expiredSessionCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const expiredBucketCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1_000);
  await Promise.all([
    prisma.onlineRequestPublicSession.deleteMany({
      where: { expiresAt: { lt: expiredSessionCutoff } },
    }),
    prisma.onlineRequestRateLimitBucket.deleteMany({
      where: { windowStart: { lt: expiredBucketCutoff } },
    }),
  ]);
}

export function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

export async function consumePublicRequestRateLimit(input: {
  organizationId: string;
  portalId: string;
  ipHash: string;
  kind: PublicRequestRateLimitKind;
  now?: Date;
}) {
  const limit = RATE_LIMITS[input.kind];
  const now = input.now ?? new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / limit.windowMs) * limit.windowMs
  );
  const bucket = await prisma.onlineRequestRateLimitBucket.upsert({
    where: {
      portalId_ipHash_kind_windowStart: {
        portalId: input.portalId,
        ipHash: input.ipHash,
        kind: input.kind,
        windowStart,
      },
    },
    create: {
      organizationId: input.organizationId,
      portalId: input.portalId,
      ipHash: input.ipHash,
      kind: input.kind,
      windowStart,
      requestCount: 1,
    },
    update: {
      requestCount: { increment: 1 },
    },
    select: { requestCount: true },
  });
  if (bucket.requestCount > limit.maximum) {
    throw new PublicRequestSecurityError(
      "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.",
      429
    );
  }
  return {
    remaining: Math.max(0, limit.maximum - bucket.requestCount),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStart.getTime() + limit.windowMs - now.getTime()) / 1_000)
    ),
  };
}

function normalizedOrigin(value: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

export function isPublicRequestMutationSameOrigin(
  request: Request,
  trustedHostnames: readonly string[]
) {
  const origin = normalizedOrigin(request.headers.get("origin"));
  if (!origin) return false;
  const allowedOrigins = new Set([
    normalizedOrigin(new URL(request.url).origin),
    normalizedOrigin(getPublicAppOrigin(request)),
  ]);
  if (allowedOrigins.has(origin)) return true;

  const originUrl = new URL(origin);
  const trusted = trustedHostnames.some(
    (hostname) => hostname.toLowerCase() === originUrl.hostname.toLowerCase()
  );
  if (!trusted) return false;
  if (originUrl.protocol === "https:") return true;
  return (
    process.env.NODE_ENV !== "production" &&
    originUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(originUrl.hostname)
  );
}

export type TurnstileVerificationResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export function isAcceptedTurnstileResponse(
  response: TurnstileVerificationResponse,
  trustedHostnames: readonly string[]
) {
  return Boolean(
    response.success &&
      response.action === "online_request" &&
      response.hostname &&
      trustedHostnames.some(
        (hostname) => hostname.toLowerCase() === response.hostname?.toLowerCase()
      )
  );
}

export async function verifyPublicRequestTurnstile(input: {
  token?: string;
  siteKey?: string | null;
  trustedHostnames: readonly string[];
}) {
  if (!input.siteKey) return;
  const secret = process.env.ONLINE_REQUEST_TURNSTILE_SECRET?.trim();
  if (!secret) {
    throw new PublicRequestSecurityError(
      "Der zusätzliche Formularschutz ist noch nicht konfiguriert.",
      503
    );
  }
  if (!input.token) {
    throw new PublicRequestSecurityError(
      "Bitte bestätigen Sie den Formularschutz.",
      403
    );
  }

  let response: Response;
  try {
    response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret,
          response: input.token,
        }),
        signal: AbortSignal.timeout(8_000),
      }
    );
  } catch {
    throw new PublicRequestSecurityError(
      "Der Formularschutz konnte nicht geprüft werden. Bitte versuchen Sie es erneut.",
      503
    );
  }
  if (!response.ok) {
    throw new PublicRequestSecurityError(
      "Der Formularschutz konnte nicht geprüft werden. Bitte versuchen Sie es erneut.",
      503
    );
  }
  const result = (await response.json()) as TurnstileVerificationResponse;
  if (!isAcceptedTurnstileResponse(result, input.trustedHostnames)) {
    throw new PublicRequestSecurityError(
      "Der Formularschutz konnte nicht bestätigt werden.",
      403
    );
  }
}
