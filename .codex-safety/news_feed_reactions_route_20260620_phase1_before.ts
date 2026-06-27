import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureNewsFeedTables } from "@/lib/sales-hub/ensure";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  await ensureNewsFeedTables();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const activeUser = users.find((candidate) => candidate.id === cleanString(body.userId)) ?? user;
  const postId = cleanString(body.postId);
  const reaction = ["up", "heart", "celebrate", "idea", "wow"].includes(cleanString(body.reaction))
    ? cleanString(body.reaction)
    : "up";

  if (!postId) {
    return NextResponse.json({ error: "Keine News-ID uebergeben." }, { status: 400 });
  }

  const existing = await prisma.$queryRaw<Array<{ postId: string; reaction: string }>>`
    SELECT "postId", reaction FROM "NewsReaction"
    WHERE "organizationId" = ${organization.id}
      AND "postId" = ${postId}
      AND "userId" = ${activeUser.id}
    LIMIT 1
  `;

  const existingReaction = existing[0]?.reaction ?? "";

  if (existingReaction === reaction) {
    await prisma.$executeRaw`
      DELETE FROM "NewsReaction"
      WHERE "organizationId" = ${organization.id}
        AND "postId" = ${postId}
        AND "userId" = ${activeUser.id}
    `;
  } else if (existingReaction) {
    await prisma.$executeRaw`
      UPDATE "NewsReaction"
      SET "reaction" = ${reaction}
      WHERE "organizationId" = ${organization.id}
        AND "postId" = ${postId}
        AND "userId" = ${activeUser.id}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "NewsReaction" ("organizationId", "postId", "userId", "reaction")
      VALUES (${organization.id}, ${postId}, ${activeUser.id}, ${reaction})
      ON CONFLICT ("postId", "userId") DO NOTHING
    `;
  }

  return NextResponse.json({ success: true });
}
