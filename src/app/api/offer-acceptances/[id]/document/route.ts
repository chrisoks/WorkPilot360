import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canSendOfferDocuments } from "@/lib/permissions";
import { cleanAcceptanceText, ensureOfferAcceptanceTable } from "@/lib/offer-acceptance/core";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureOfferAcceptanceTable();
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canSendOfferDocuments(actorResult.actor)) {
    return NextResponse.json({ error: "Keine Berechtigung für Angebotsfreigaben." }, { status: 403 });
  }
  const id = cleanAcceptanceText((await params).id);
  const requestedType = searchParams.get("type");
  const type = requestedType === "certificate" || requestedType === "withdrawal-notice" || requestedType === "withdrawal-receipt"
    ? requestedType
    : "offer";
  const rows = await prisma.$queryRaw<Array<{
    offerNumber: string;
    offerPdfData: string;
    acceptancePdfData: string | null;
    withdrawalNoticePdfData: string | null;
    withdrawalReceiptPdfData: string | null;
  }>>`
    SELECT "offerNumber", "offerPdfData", "acceptancePdfData", "withdrawalNoticePdfData", "withdrawalReceiptPdfData"
    FROM "OfferAcceptanceRequest"
    WHERE id = ${id} AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const row = rows[0];
  const data = type === "certificate"
    ? row?.acceptancePdfData
    : type === "withdrawal-notice"
      ? row?.withdrawalNoticePdfData
      : type === "withdrawal-receipt"
        ? row?.withdrawalReceiptPdfData
        : row?.offerPdfData;
  if (!row || !data) return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  const filename = type === "certificate"
    ? `Freigabe-${row.offerNumber}.pdf`
    : type === "withdrawal-notice"
      ? `Widerrufsbelehrung-${row.offerNumber}.pdf`
      : type === "withdrawal-receipt"
        ? `Widerruf-${row.offerNumber}.pdf`
        : `${row.offerNumber}.pdf`;
  return new NextResponse(Buffer.from(data, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename.replace(/[\r\n"]/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
