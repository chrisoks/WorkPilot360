import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { ensureOnlineRequestStorage } from "@/lib/online-requests/ensure";
import {
  consumePublicRequestRateLimit,
  pruneExpiredPublicRequestSecurityArtifacts,
  readStringList,
} from "@/lib/online-requests/portal-security";
import {
  PublicRequestSecurityError,
  createPublicRequestSessionToken,
  getPublicRequestIpHash,
} from "@/lib/online-requests/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("portal")?.trim() ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return NextResponse.json(
      { error: "Anfrageportal wurde nicht gefunden." },
      { status: 404, headers: responseHeaders() }
    );
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json(
      { error: "Formularsitzung konnte nicht erstellt werden." },
      { status: 403, headers: responseHeaders() }
    );
  }

  try {
    await ensureOnlineRequestStorage();
    await pruneExpiredPublicRequestSecurityArtifacts().catch((error) => {
      console.warn("Online request security cleanup failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    });
    const portal = await prisma.onlineRequestPortal.findUnique({
      where: { slug },
      select: {
        id: true,
        organizationId: true,
        displayName: true,
        isActive: true,
        allowedTradeIds: true,
        trustedHostnames: true,
        turnstileSiteKey: true,
      },
    });
    if (!portal?.isActive) {
      return NextResponse.json(
        { error: "Dieses Anfrageportal ist derzeit nicht verfügbar." },
        { status: 404, headers: responseHeaders() }
      );
    }

    const allowedTradeIds = readStringList(portal.allowedTradeIds);
    if (!allowedTradeIds.length) {
      throw new PublicRequestSecurityError(
        "Für dieses Anfrageportal sind noch keine Leistungen freigegeben.",
        503
      );
    }
    const trades = await prisma.category.findMany({
      where: {
        organizationId: portal.organizationId,
        id: { in: allowedTradeIds },
      },
      select: { id: true, name: true },
    });
    const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
    const orderedTrades = allowedTradeIds
      .map((tradeId) => tradesById.get(tradeId))
      .filter((trade): trade is { id: string; name: string } => Boolean(trade));
    if (!orderedTrades.length) {
      throw new PublicRequestSecurityError(
        "Für dieses Anfrageportal sind noch keine gültigen Leistungen freigegeben.",
        503
      );
    }

    const ipHash = getPublicRequestIpHash(request);
    const rateLimit = await consumePublicRequestRateLimit({
      organizationId: portal.organizationId,
      portalId: portal.id,
      ipHash,
      kind: "session",
    });
    const session = createPublicRequestSessionToken({ portalId: portal.id });
    await prisma.onlineRequestPublicSession.create({
      data: {
        idHash: session.idHash,
        organizationId: portal.organizationId,
        portalId: portal.id,
        ipHash,
        issuedAt: new Date(session.payload.issuedAt),
        notBefore: new Date(session.payload.notBefore),
        expiresAt: new Date(session.payload.expiresAt),
      },
    });

    return NextResponse.json(
      {
        portal: {
          slug,
          displayName: portal.displayName,
          trades: orderedTrades,
        },
        security: {
          sessionToken: session.token,
          challenge: session.payload.challenge,
          difficulty: session.payload.difficulty,
          expiresAt: new Date(session.payload.expiresAt).toISOString(),
          turnstileSiteKey: portal.turnstileSiteKey,
        },
      },
      {
        headers: {
          ...responseHeaders(),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    if (error instanceof PublicRequestSecurityError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            ...responseHeaders(),
            ...(error.status === 429 ? { "Retry-After": "600" } : {}),
          },
        }
      );
    }
    console.error("Online request session creation failed", {
      portalSlug: slug,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Formularsitzung konnte nicht erstellt werden." },
      { status: 500, headers: responseHeaders() }
    );
  }
}
