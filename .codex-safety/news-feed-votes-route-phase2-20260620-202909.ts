import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureNewsFeedTables } from "@/lib/sales-hub/ensure";

type PostPollRow = {
  pollAllowMultiple: boolean | null;
  pollOptions: unknown;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getRequestActor(users: User[], actorId: unknown) {
  const cleanActorId = cleanString(actorId);
  if (!cleanActorId) return null;
  const actor = users.find((candidate) => candidate.id === cleanActorId);
  return actor?.isActive ? actor : null;
}

function unauthorizedActorResponse() {
  return NextResponse.json({ error: "Aktiver Benutzer erforderlich." }, { status: 401 });
}

export async function POST(req: Request) {
  await ensureNewsFeedTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const activeUser = getRequestActor(users, body.actorId ?? body.userId);
  if (!activeUser) {
    return unauthorizedActorResponse();
  }
  const postId = cleanString(body.postId);
  const selectedOptionIds = cleanStringArray(body.optionIds);

  if (!postId || selectedOptionIds.length === 0) {
    return NextResponse.json({ error: "Bitte eine Abstimmungsoption auswählen." }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<PostPollRow[]>`
    SELECT "pollAllowMultiple", "pollOptions"
    FROM "NewsPost"
    WHERE "organizationId" = ${organization.id}
      AND id = ${postId}
    LIMIT 1
  `;
  const post = rows[0];
  if (!post) {
    return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
  }

  const allowedOptionIds = jsonArray(post.pollOptions)
    .map((option) => cleanString((option as Record<string, unknown>).id))
    .filter(Boolean);
  const nextOptionIds = selectedOptionIds.filter((optionId) => allowedOptionIds.includes(optionId));
  if (nextOptionIds.length === 0) {
    return NextResponse.json({ error: "Ungültige Abstimmungsoption." }, { status: 400 });
  }

  await prisma.$executeRaw`
    DELETE FROM "NewsPollVote"
    WHERE "organizationId" = ${organization.id}
      AND "postId" = ${postId}
      AND "userId" = ${activeUser.id}
  `;

  const finalOptionIds = post.pollAllowMultiple ? nextOptionIds : nextOptionIds.slice(0, 1);
  for (const optionId of finalOptionIds) {
    await prisma.$executeRaw`
      INSERT INTO "NewsPollVote" ("organizationId", "postId", "optionId", "userId")
      VALUES (${organization.id}, ${postId}, ${optionId}, ${activeUser.id})
      ON CONFLICT ("postId", "optionId", "userId") DO NOTHING
    `;
  }

  return NextResponse.json({ success: true });
}
