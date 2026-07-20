import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  auditOksPhoneRequest,
  authenticateOksPhoneRequest,
  OKS_PHONE_SCOPES,
} from "@/lib/integrations/oks-phone/auth";
import { oksPhoneErrorResponse } from "@/lib/integrations/oks-phone/responses";
import { decodeDeltaCursor, encodeDeltaCursor } from "@/lib/integrations/oks-phone/delta";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await authenticateOksPhoneRequest(request, OKS_PHONE_SCOPES.contactsDeltaRead);
    const { searchParams } = new URL(request.url);
    const limitValue = Number(searchParams.get("limit") || "100");
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 200) {
      return NextResponse.json({ error: "limit muss zwischen 1 und 200 liegen." }, { status: 400 });
    }

    const cursorValue = searchParams.get("cursor")?.trim() || "";
    const afterValue = searchParams.get("after")?.trim() || "";
    const cursor = cursorValue ? decodeDeltaCursor(cursorValue) : null;
    if (cursorValue && !cursor) {
      return NextResponse.json({ error: "cursor ist ungueltig." }, { status: 400 });
    }
    if (!cursor && (!afterValue || Number.isNaN(Date.parse(afterValue)))) {
      return NextResponse.json(
        { error: "Beim ersten Abruf ist after als gueltiger ISO-Zeitstempel erforderlich." },
        { status: 400 }
      );
    }

    const lowerBound = new Date(cursor?.occurredAt ?? afterValue);
    const rows = await prisma.contactIntegrationEvent.findMany({
      where: {
        organizationId: actor.organizationId,
        OR: cursor
          ? [
              { occurredAt: { gt: lowerBound } },
              { occurredAt: lowerBound, id: { gt: cursor.id } },
            ]
          : [{ occurredAt: { gt: lowerBound } }],
      },
      select: {
        id: true,
        contactId: true,
        eventType: true,
        changedFields: true,
        occurredAt: true,
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: limitValue + 1,
    });

    const hasMore = rows.length > limitValue;
    const events = rows.slice(0, limitValue);
    const last = events.at(-1);
    await auditOksPhoneRequest({
      actor,
      action: "oks_phone_contacts_delta_read",
      entityType: "contact-delta",
      outcome: "success",
    });

    return NextResponse.json({
      events,
      hasMore,
      nextCursor: last
        ? encodeDeltaCursor({ occurredAt: last.occurredAt.toISOString(), id: last.id })
        : cursorValue || null,
      generatedAt: new Date().toISOString(),
      detailEndpoint: "/api/integrations/oks-phone/customer-context?contactId={contactId}",
    });
  } catch (error) {
    return oksPhoneErrorResponse(error);
  }
}
