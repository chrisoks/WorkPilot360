import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import {
  executeOfferLifecycle,
  OfferLifecycleServiceError,
  type OfferLifecycleAction,
} from "@/lib/offers/offer-lifecycle-service";
import { canDeleteOffers } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof OfferLifecycleServiceError) {
    const status = error.code === "not_found" ? 404 : error.code === "blocked" || error.code === "invalid_input" ? 400 : 409;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  return NextResponse.json({ error: "Die Angebotsänderung konnte nicht sicher ausgeführt werden." }, { status: 500 });
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const url = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, url.searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canDeleteOffers(actorResult.actor)) return NextResponse.json({ error: "Keine Berechtigung für gelöschte Angebote." }, { status: 403 });
  const projectId = (url.searchParams.get("projectId") || "").trim();
  const offers = await prisma.offer.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ["Gelöscht", "Gel\u00c3\u00b6scht"] },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, projectId: true, projectNumber: true, projectTitle: true, company: true,
      offerType: true, addendumMode: true, plannedExecutionEndMonth: true, parentOfferId: true,
      offerNumber: true, status: true, customerName: true, customerStreet: true, customerCity: true,
      contactName: true, internalContactName: true, internalPhone: true, internalEmail: true,
      plannedExecutionMonth: true, introText: true, closingText: true, netTotal: true, vatRate: true,
      grossTotal: true, discountPercent: true, lostReason: true, lostNote: true, lostAt: true,
      wonAt: true, wonByName: true, wonReason: true, pdfData: true, createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json(offers.map(({ pdfData, ...offer }) => ({
    ...offer,
    pdfAvailable: Boolean(pdfData),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
    lostAt: offer.lostAt?.toISOString() || "",
    wonAt: offer.wonAt?.toISOString() || "",
    lines: [],
  })));
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const body = await req.json().catch(() => ({}));
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canDeleteOffers(actorResult.actor)) return NextResponse.json({ error: "Keine Berechtigung für diese Angebotsänderung." }, { status: 403 });
  const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const action: OfferLifecycleAction | undefined = body.action === "delete" || body.action === "restore" ? body.action : undefined;
  if (!offerId || !action) return NextResponse.json({ error: "Angebot oder Aktion fehlt." }, { status: 400 });
  const actor = actorResult.actor;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  try {
    const offer = await prisma.$transaction(
      (tx) => executeOfferLifecycle({
        tx, organizationId: organization.id, offerId, action, reason,
        actorId: actor.id, actorName, source: "ui",
      }),
      { isolationLevel: "Serializable" }
    );
    return NextResponse.json({ id: offer.id, offerNumber: offer.offerNumber, status: offer.status });
  } catch (error) {
    return errorResponse(error);
  }
}
