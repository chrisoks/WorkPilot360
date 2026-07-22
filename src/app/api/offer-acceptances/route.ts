import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canSendOfferDocuments } from "@/lib/permissions";
import { cleanAcceptanceText, ensureOfferAcceptanceTable } from "@/lib/offer-acceptance/core";

export async function GET(req: Request) {
  await ensureOfferAcceptanceTable();
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canSendOfferDocuments(actorResult.actor)) return NextResponse.json({ error: "Keine Berechtigung für Angebotsfreigaben." }, { status: 403 });
  const projectId = cleanAcceptanceText(searchParams.get("projectId"));
  const customerId = cleanAcceptanceText(searchParams.get("customerId"));
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT r."id", r."offerId", r."projectId", r."customerId", r."offerNumber", r."recipientEmail", r."recipientName",
      r."senderName", r."status", r."sentAt", r."expiresAt", r."firstAccessedAt", r."firstViewedAt", r."lastViewedAt",
      r."viewCount", r."acceptanceStartedAt", r."acceptedAt", r."acceptedByName", r."acceptedByRole", r."acceptedByEmail",
      r."acceptancePdfHash", r."confirmationSentAt", r."confirmationError", r."createdAt", o."projectNumber", o."projectTitle", o."grossTotal"
    FROM "OfferAcceptanceRequest" r
    INNER JOIN "Offer" o ON o.id = r."offerId" AND o."organizationId" = r."organizationId"
    WHERE r."organizationId" = ${organization.id}
      AND (${projectId} = '' OR r."projectId" = ${projectId})
      AND (${customerId} = '' OR r."customerId" = ${customerId})
    ORDER BY r."createdAt" DESC
    LIMIT 500
  `;
  return NextResponse.json(rows);
}
