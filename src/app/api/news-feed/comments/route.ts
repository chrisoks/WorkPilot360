import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canSeeNewsPost } from "@/lib/news-feed/visibility";
import { ensureNewsFeedTables } from "@/lib/sales-hub/ensure";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

export async function POST(req: Request) {
  await ensureNewsFeedTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const postId = cleanString(body.postId);
  const text = cleanString(body.body);

  if (!postId || !text) {
    return NextResponse.json({ error: "Bitte Beitrag und Kommentar angeben." }, { status: 400 });
  }

  const posts = await prisma.$queryRaw<
    Array<{ id: string; visibility: string; departmentIds: unknown; teamIds: unknown; userIds: unknown }>
  >`
    SELECT id, visibility, "departmentIds", "teamIds", "userIds"
    FROM "NewsPost"
    WHERE "organizationId" = ${organization.id}
      AND id = ${postId}
    LIMIT 1
  `;
  const post = posts[0];
  if (!post) {
    return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
  }
  if (!canSeeNewsPost(post, actor)) {
    return NextResponse.json({ error: "Du darfst diesen Beitrag nicht kommentieren." }, { status: 403 });
  }

  await prisma.$executeRaw`
    INSERT INTO "NewsComment" ("id", "organizationId", "postId", "body", "authorUserId", "authorName")
    VALUES (${randomUUID()}, ${organization.id}, ${postId}, ${text}, ${actor.id}, ${getUserName(actor)})
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
