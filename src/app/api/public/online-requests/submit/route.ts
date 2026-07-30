import { randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ensureOnlineRequestStorage } from "@/lib/online-requests/ensure";
import { processPublicRequestPhotos, PublicPhotoError } from "@/lib/online-requests/photos";
import {
  consumePublicRequestRateLimit,
  isPublicRequestMutationSameOrigin,
  readStringList,
  verifyPublicRequestTurnstile,
} from "@/lib/online-requests/portal-security";
import {
  PublicRequestSecurityError,
  getPublicRequestIpHash,
  getPublicRequestUserAgentHash,
  hasValidProofOfWork,
  hashCanonicalOnlineRequestPayload,
  hashPublicRequestSessionNonce,
  verifyPublicRequestSessionToken,
} from "@/lib/online-requests/security";
import {
  parsePublicOnlineRequestInput,
  type PublicOnlineRequestInput,
} from "@/lib/online-requests/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MULTIPART_BODY_BYTES = 52 * 1024 * 1024;
const NOTIFICATION_ROLES = [
  "ADMIN",
  "GESCHAEFTSFUEHRER",
  "FUEHRUNGSKRAFT",
  "VERTRIEB",
] as const;
const MAX_TRANSACTION_ATTEMPTS = 3;

function secureHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function errorResponse(message: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        ...secureHeaders(),
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    }
  );
}

function createReferenceNumber(now: Date) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `OKI-${date}-${suffix}`;
}

function requestTypeLabel(requestType: PublicOnlineRequestInput["requestType"]) {
  return (
    {
      offer: "Angebotsanfrage",
      callback: "Rückruf & Beratung",
      execution: "Durchführungsanfrage",
      issue: "Mangel oder Problem",
      general: "Allgemeine Anfrage",
    } as const
  )[requestType];
}

function contactDisplayName(input: PublicOnlineRequestInput) {
  return (
    input.company ||
    [input.firstName, input.lastName].filter(Boolean).join(" ") ||
    "unbekannt"
  );
}

function isRetryableSubmissionTransaction(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

function canonicalPayload(input: {
  form: PublicOnlineRequestInput;
  tradeName: string;
  recommendations: Array<{ id: string; name: string }>;
  photos: Array<{ sha256: string; byteSize: number; width: number; height: number }>;
}) {
  const { form } = input;
  return {
    version: 1,
    clientSubmissionId: form.clientSubmissionId,
    requestType: form.requestType,
    tradeId: form.tradeId,
    tradeName: input.tradeName,
    recommendations: input.recommendations,
    desiredDate: form.desiredDate ?? null,
    desiredTimeWindow: form.desiredTimeWindow ?? null,
    callbackTimeWindow: form.callbackTimeWindow ?? null,
    urgency: form.urgency ?? null,
    street: form.street,
    postalCode: form.postalCode,
    city: form.city,
    objectHint: form.objectHint ?? null,
    description: form.description,
    customerKind: form.customerKind,
    company: form.company ?? null,
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email?.toLowerCase() ?? null,
    phone: form.phone ?? null,
    preferredContact: form.preferredContact,
    photos: input.photos,
  };
}

async function noteRejectedAttempt(input: {
  organizationId?: string;
  portalId?: string;
  ipHash?: string;
}) {
  if (!input.organizationId || !input.portalId || !input.ipHash) return;
  try {
    await consumePublicRequestRateLimit({
      organizationId: input.organizationId,
      portalId: input.portalId,
      ipHash: input.ipHash,
      kind: "rejected",
    });
  } catch {
    // Rejected-attempt accounting must not expose infrastructure details.
  }
}

export async function POST(request: Request) {
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = Number(contentLengthHeader || 0);
  if (
    contentLengthHeader &&
    (!Number.isFinite(contentLength) ||
      contentLength <= 0 ||
      contentLength > MAX_MULTIPART_BODY_BYTES)
  ) {
    return errorResponse("Die Anfrage ist leer oder insgesamt zu groß.", 413);
  }

  const slug = new URL(request.url).searchParams.get("portal")?.trim() ?? "";
  let organizationId = "";
  let portalId = "";
  let ipHash = "";
  try {
    await ensureOnlineRequestStorage();
    const portal = await prisma.onlineRequestPortal.findUnique({
      where: { slug },
      select: {
        id: true,
        organizationId: true,
        displayName: true,
        isActive: true,
        allowedTradeIds: true,
        notificationUserIds: true,
        trustedHostnames: true,
        turnstileSiteKey: true,
      },
    });
    if (!portal?.isActive) {
      return errorResponse("Dieses Anfrageportal ist derzeit nicht verfügbar.", 404);
    }
    organizationId = portal.organizationId;
    portalId = portal.id;
    ipHash = getPublicRequestIpHash(request);
    const trustedHostnames = readStringList(portal.trustedHostnames);
    if (!isPublicRequestMutationSameOrigin(request, trustedHostnames)) {
      throw new PublicRequestSecurityError("Anfragequelle ist nicht erlaubt.", 403);
    }

    const submissionLimit = await consumePublicRequestRateLimit({
      organizationId,
      portalId,
      ipHash,
      kind: "submission",
    });
    const formData = await request.formData();
    const metadataValue = formData.get("metadata");
    if (typeof metadataValue !== "string" || metadataValue.length > 32_000) {
      throw new PublicRequestSecurityError("Formulardaten sind ungültig.", 400);
    }
    let metadata: unknown;
    try {
      metadata = JSON.parse(metadataValue);
    } catch {
      throw new PublicRequestSecurityError("Formulardaten sind ungültig.", 400);
    }
    const parsed = parsePublicOnlineRequestInput(metadata);
    if (!parsed.success) {
      throw new PublicRequestSecurityError(
        parsed.error.issues[0]?.message || "Formulardaten sind unvollständig.",
        400
      );
    }
    const form = parsed.data;
    const sessionPayload = verifyPublicRequestSessionToken(form.sessionToken, {
      expectedPortalId: portal.id,
    });
    if (
      !hasValidProofOfWork({
        challenge: sessionPayload.challenge,
        proof: form.proof,
        difficulty: sessionPayload.difficulty,
      })
    ) {
      throw new PublicRequestSecurityError(
        "Die automatische Sicherheitsprüfung ist fehlgeschlagen.",
        403
      );
    }

    await verifyPublicRequestTurnstile({
      token: form.turnstileToken,
      siteKey: portal.turnstileSiteKey,
      trustedHostnames,
    });

    const idHash = hashPublicRequestSessionNonce(sessionPayload.sessionNonce);
    const publicSession = await prisma.onlineRequestPublicSession.findUnique({
      where: { idHash },
      select: {
        portalId: true,
        organizationId: true,
        ipHash: true,
        notBefore: true,
        expiresAt: true,
      },
    });
    const now = new Date();
    if (
      !publicSession ||
      publicSession.portalId !== portal.id ||
      publicSession.organizationId !== portal.organizationId ||
      publicSession.ipHash !== ipHash ||
      publicSession.notBefore > now ||
      publicSession.expiresAt <= now
    ) {
      throw new PublicRequestSecurityError(
        "Die Formularsitzung ist ungültig oder abgelaufen.",
        401
      );
    }

    const allowedTradeIds = new Set(readStringList(portal.allowedTradeIds));
    if (
      !allowedTradeIds.has(form.tradeId) ||
      form.recommendationTradeIds.some((tradeId) => !allowedTradeIds.has(tradeId))
    ) {
      throw new PublicRequestSecurityError(
        "Eine gewählte Leistung ist für dieses Formular nicht freigegeben.",
        400
      );
    }
    const requestedTradeIds = [
      form.tradeId,
      ...form.recommendationTradeIds,
    ];
    const trades = await prisma.category.findMany({
      where: {
        organizationId: portal.organizationId,
        id: { in: requestedTradeIds },
      },
      select: { id: true, name: true },
    });
    const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
    const mainTrade = tradesById.get(form.tradeId);
    const recommendations = form.recommendationTradeIds
      .map((tradeId) => tradesById.get(tradeId))
      .filter((trade): trade is { id: string; name: string } => Boolean(trade));
    if (!mainTrade || recommendations.length !== form.recommendationTradeIds.length) {
      throw new PublicRequestSecurityError(
        "Eine gewählte Leistung ist nicht mehr verfügbar.",
        400
      );
    }

    const photoEntries = formData
      .getAll("photos")
      .filter((entry): entry is File => typeof entry !== "string");
    const photos = await processPublicRequestPhotos(photoEntries);
    const payloadHash = hashCanonicalOnlineRequestPayload(
      canonicalPayload({
        form,
        tradeName: mainTrade.name,
        recommendations,
        photos,
      })
    );
    const configuredNotificationUserIds = readStringList(
      portal.notificationUserIds
    );
    const notificationUsers = await prisma.user.findMany({
      where: {
        organizationId: portal.organizationId,
        isActive: true,
        ...(configuredNotificationUserIds.length
          ? { id: { in: configuredNotificationUserIds } }
          : { role: { in: [...NOTIFICATION_ROLES] } }),
      },
      select: { id: true },
    });

    let result:
      | {
          id: string;
          referenceNumber: string;
          createdAt: Date;
          duplicate: boolean;
        }
      | undefined;
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
        const existing = await tx.onlineRequest.findUnique({
          where: {
            portalId_clientSubmissionId: {
              portalId: portal.id,
              clientSubmissionId: form.clientSubmissionId,
            },
          },
          select: {
            id: true,
            referenceNumber: true,
            payloadHash: true,
            createdAt: true,
          },
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            throw new PublicRequestSecurityError(
              "Diese Übertragungs-ID wurde bereits mit anderen Daten verwendet.",
              409
            );
          }
          // A newly issued session used for an idempotent retry must not stay
          // reusable for a different submission. An already consumed session
          // may still receive the same safe idempotent response.
          await tx.onlineRequestPublicSession.updateMany({
            where: {
              idHash,
              portalId: portal.id,
              organizationId: portal.organizationId,
              ipHash,
              consumedAt: null,
              notBefore: { lte: now },
              expiresAt: { gt: now },
            },
            data: { consumedAt: now },
          });
          return { ...existing, duplicate: true };
        }

        const consumed = await tx.onlineRequestPublicSession.updateMany({
          where: {
            idHash,
            portalId: portal.id,
            organizationId: portal.organizationId,
            ipHash,
            consumedAt: null,
            notBefore: { lte: now },
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) {
          throw new PublicRequestSecurityError(
            "Diese Formularsitzung wurde bereits verwendet.",
            409
          );
        }

        const requestId = randomUUID();
        const referenceNumber = createReferenceNumber(now);
        const created = await tx.onlineRequest.create({
          data: {
            id: requestId,
            organizationId: portal.organizationId,
            portalId: portal.id,
            referenceNumber,
            clientSubmissionId: form.clientSubmissionId,
            payloadHash,
            requestType: form.requestType,
            tradeId: mainTrade.id,
            tradeName: mainTrade.name,
            recommendationTradeIds: recommendations.map((trade) => trade.id),
            recommendationNames: recommendations.map((trade) => trade.name),
            desiredDate: form.desiredDate,
            desiredTimeWindow: form.desiredTimeWindow,
            callbackTimeWindow: form.callbackTimeWindow,
            urgency: form.urgency,
            street: form.street,
            postalCode: form.postalCode,
            city: form.city,
            objectHint: form.objectHint,
            description: form.description,
            customerKind: form.customerKind,
            company: form.company,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email?.toLowerCase(),
            phone: form.phone,
            preferredContact: form.preferredContact,
            consentAt: now,
            submissionIpHash: ipHash,
            userAgentHash: getPublicRequestUserAgentHash(request),
            securitySignals: [
              "signed_session",
              "one_time_nonce",
              "proof_of_work",
              ...(portal.turnstileSiteKey ? ["turnstile"] : []),
              ...(photos.length ? ["photos_reencoded"] : []),
            ],
            photos: {
              createMany: {
                data: photos.map((photo) => ({
                  organizationId: portal.organizationId,
                  fileName: photo.fileName,
                  mimeType: photo.mimeType,
                  byteSize: photo.byteSize,
                  sha256: photo.sha256,
                  width: photo.width,
                  height: photo.height,
                  sortOrder: photo.sortOrder,
                  data: Uint8Array.from(photo.data),
                })),
              },
            },
            auditEvents: {
              create: {
                organizationId: portal.organizationId,
                eventType: "submitted",
                actorName: "Online-Formular",
                payload: {
                  portalSlug: slug,
                  photoCount: photos.length,
                  requestType: form.requestType,
                  tradeId: mainTrade.id,
                },
              },
            },
          },
          select: {
            id: true,
            referenceNumber: true,
            createdAt: true,
          },
        });
        if (notificationUsers.length) {
          await tx.notification.createMany({
            data: notificationUsers.map((user) => ({
              organizationId: portal.organizationId,
              userId: user.id,
              channel: "app",
              subject: `Neue Online-Anfrage ${referenceNumber}`,
              body: `${requestTypeLabel(form.requestType)} · ${mainTrade.name} · ${contactDisplayName(form)}`,
              linkTarget: "online-requests",
              linkTargetId: requestId,
              linkLabel: "Online-Anfrage öffnen",
            })),
          });
        }
            return { ...created, duplicate: false };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 20_000,
          }
        );
        break;
      } catch (error) {
        if (
          isRetryableSubmissionTransaction(error) &&
          attempt < MAX_TRANSACTION_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
    }
    if (!result) {
      throw new Error("Online request transaction ended without a result.");
    }

    return NextResponse.json(
      {
        referenceNumber: result.referenceNumber,
        submittedAt: result.createdAt.toISOString(),
        duplicate: result.duplicate,
      },
      {
        status: result.duplicate ? 200 : 201,
        headers: {
          ...secureHeaders(),
          "X-RateLimit-Remaining": String(submissionLimit.remaining),
        },
      }
    );
  } catch (error) {
    await noteRejectedAttempt({ organizationId, portalId, ipHash });
    if (error instanceof PublicRequestSecurityError) {
      return errorResponse(
        error.message,
        error.status,
        error.status === 429 ? 600 : undefined
      );
    }
    if (error instanceof PublicPhotoError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Online request submission failed", {
      portalSlug: slug,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : "unknown",
    });
    return errorResponse(
      "Die Anfrage konnte nicht übertragen werden. Bitte versuchen Sie es erneut.",
      500
    );
  }
}
