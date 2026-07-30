import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

export const PUBLIC_REQUEST_SESSION_TTL_MS = 30 * 60 * 1000;
export const PUBLIC_REQUEST_MIN_FILL_TIME_MS = 2_500;
export const PUBLIC_REQUEST_PROOF_DIFFICULTY = 15;

export type PublicRequestSessionPayload = {
  version: 1;
  sessionNonce: string;
  portalId: string;
  issuedAt: number;
  notBefore: number;
  expiresAt: number;
  challenge: string;
  difficulty: number;
};

export class PublicRequestSecurityError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 409 | 429 | 503
  ) {
    super(message);
  }
}

function getSecuritySecret() {
  const secret =
    process.env.ONLINE_REQUEST_SIGNING_SECRET?.trim() ||
    process.env.WORKPILOT_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";
  if (secret.length < 32) {
    throw new PublicRequestSecurityError(
      "Das Online-Anfragenportal ist noch nicht sicher konfiguriert.",
      503
    );
  }
  return secret;
}

function hmac(value: string) {
  return createHmac("sha256", getSecuritySecret())
    .update(value, "utf8")
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isValidPayload(value: unknown): value is PublicRequestSessionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PublicRequestSessionPayload>;
  return (
    payload.version === 1 &&
    typeof payload.sessionNonce === "string" &&
    payload.sessionNonce.length >= 24 &&
    typeof payload.portalId === "string" &&
    payload.portalId.length > 0 &&
    Number.isSafeInteger(payload.issuedAt) &&
    Number.isSafeInteger(payload.notBefore) &&
    Number.isSafeInteger(payload.expiresAt) &&
    typeof payload.challenge === "string" &&
    payload.challenge.length >= 24 &&
    Number.isSafeInteger(payload.difficulty) &&
    Number(payload.difficulty) >= 10 &&
    Number(payload.difficulty) <= 22
  );
}

export function createPublicRequestSessionToken(input: {
  portalId: string;
  now?: Date;
  ttlMs?: number;
  minimumFillTimeMs?: number;
  difficulty?: number;
}) {
  const now = input.now ?? new Date();
  const issuedAt = now.getTime();
  const payload: PublicRequestSessionPayload = {
    version: 1,
    sessionNonce: randomBytes(24).toString("base64url"),
    portalId: input.portalId,
    issuedAt,
    notBefore: issuedAt + (input.minimumFillTimeMs ?? PUBLIC_REQUEST_MIN_FILL_TIME_MS),
    expiresAt: issuedAt + (input.ttlMs ?? PUBLIC_REQUEST_SESSION_TTL_MS),
    challenge: randomBytes(24).toString("base64url"),
    difficulty: input.difficulty ?? PUBLIC_REQUEST_PROOF_DIFFICULTY,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return {
    payload,
    token: `${encodedPayload}.${hmac(encodedPayload)}`,
    idHash: hashPublicRequestSessionNonce(payload.sessionNonce),
  };
}

export function verifyPublicRequestSessionToken(
  token: string,
  options: { now?: Date; expectedPortalId?: string } = {}
) {
  if (!token || token.length > 2_048) {
    throw new PublicRequestSecurityError("Formularsitzung ist ungültig.", 401);
  }
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length || !safeEqual(signature, hmac(encodedPayload))) {
    throw new PublicRequestSecurityError("Formularsitzung ist ungültig.", 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new PublicRequestSecurityError("Formularsitzung ist ungültig.", 401);
  }
  if (!isValidPayload(parsed)) {
    throw new PublicRequestSecurityError("Formularsitzung ist ungültig.", 401);
  }
  const now = (options.now ?? new Date()).getTime();
  if (parsed.expiresAt <= now) {
    throw new PublicRequestSecurityError(
      "Die Formularsitzung ist abgelaufen. Bitte laden Sie die Seite neu.",
      401
    );
  }
  if (parsed.notBefore > now) {
    throw new PublicRequestSecurityError(
      "Das Formular wurde ungewöhnlich schnell abgesendet. Bitte prüfen Sie Ihre Angaben.",
      429
    );
  }
  if (options.expectedPortalId && parsed.portalId !== options.expectedPortalId) {
    throw new PublicRequestSecurityError("Formularsitzung gehört nicht zu diesem Portal.", 403);
  }
  return parsed;
}

export function hashPublicRequestSessionNonce(nonce: string) {
  return createHash("sha256").update(`session:${nonce}`, "utf8").digest("hex");
}

export function hashPublicRequestNetworkValue(value: string) {
  return createHmac("sha256", getSecuritySecret())
    .update(`network:${value}`, "utf8")
    .digest("hex");
}

export function getPublicRequestClientIp(request: Request) {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  const candidate = candidates.find((value) => value?.trim())?.trim() || "unknown";
  return candidate.slice(0, 128);
}

export function getPublicRequestIpHash(request: Request) {
  return hashPublicRequestNetworkValue(getPublicRequestClientIp(request));
}

export function getPublicRequestUserAgentHash(request: Request) {
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent ? hashPublicRequestNetworkValue(userAgent.slice(0, 1_024)) : null;
}

export function hasValidProofOfWork(input: {
  challenge: string;
  proof: string;
  difficulty: number;
}) {
  if (!/^[0-9]{1,12}$/.test(input.proof)) return false;
  const digest = createHash("sha256")
    .update(`${input.challenge}:${input.proof}`, "utf8")
    .digest();
  let remainingBits = input.difficulty;
  for (const byte of digest) {
    if (remainingBits <= 0) return true;
    if (remainingBits >= 8) {
      if (byte !== 0) return false;
      remainingBits -= 8;
      continue;
    }
    return (byte >> (8 - remainingBits)) === 0;
  }
  return remainingBits <= 0;
}

export function hashCanonicalOnlineRequestPayload(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}
