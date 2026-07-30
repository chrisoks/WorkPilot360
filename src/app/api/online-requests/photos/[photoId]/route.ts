import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import {
  getSessionBoundActor,
  sessionBoundActorResponse,
} from "@/lib/auth/actor";
import { ensureOnlineRequestStorage } from "@/lib/online-requests/ensure";
import { canReadOnlineRequests } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ photoId: string }> }
) {
  await ensureOnlineRequestStorage();
  const url = new URL(request.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(
    request,
    users,
    url.searchParams.get("actorId")
  );
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canReadOnlineRequests(actorResult.actor)) {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
  }

  const { photoId } = await context.params;
  const photo = await prisma.onlineRequestPhoto.findFirst({
    where: {
      id: photoId,
      organizationId: organization.id,
      onlineRequest: { organizationId: organization.id },
    },
    select: {
      data: true,
      mimeType: true,
      byteSize: true,
      sha256: true,
    },
  });
  if (!photo) {
    return NextResponse.json({ error: "Anfragebild nicht gefunden." }, { status: 404 });
  }
  return new Response(Uint8Array.from(photo.data), {
    headers: {
      "Cache-Control": "private, max-age=300, must-revalidate",
      "Content-Disposition": 'inline; filename="anfragebild.jpg"',
      "Content-Length": String(photo.byteSize),
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Type": photo.mimeType,
      ETag: `"${photo.sha256}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
