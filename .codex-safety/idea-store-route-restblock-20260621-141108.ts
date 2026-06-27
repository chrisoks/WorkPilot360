import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type IdeaRow = {
  id: string;
  title: string;
  body: string;
  authorUserId: string | null;
  authorName: string;
  pinned: boolean | null;
  plannedContentItemId: string | null;
  plannedContentTitle: string | null;
  plannedContentStatus: string | null;
  createdAt: Date;
};

type IdeaCommentRow = {
  id: string;
  ideaId: string;
  body: string;
  authorUserId: string | null;
  authorName: string;
  createdAt: Date;
};

type IdeaLikeRow = {
  ideaId: string;
  userId: string;
  reaction: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureIdeaTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "IdeaPost" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL DEFAULT '',
      "authorUserId" TEXT,
      "authorName" TEXT NOT NULL DEFAULT '',
      "pinned" BOOLEAN NOT NULL DEFAULT false,
      "plannedContentItemId" TEXT,
      "plannedContentTitle" TEXT NOT NULL DEFAULT '',
      "plannedContentStatus" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "IdeaPost"
    ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "plannedContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "plannedContentTitle" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "plannedContentStatus" TEXT NOT NULL DEFAULT ''
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "IdeaComment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "ideaId" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "authorUserId" TEXT,
      "authorName" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "IdeaLike" (
      "organizationId" TEXT NOT NULL,
      "ideaId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "reaction" TEXT NOT NULL DEFAULT 'up',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "IdeaLike_pkey" PRIMARY KEY ("ideaId", "userId")
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "IdeaLike"
    ADD COLUMN IF NOT EXISTS "reaction" TEXT NOT NULL DEFAULT 'up'
  `;

  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "notifyIdeaStore" BOOLEAN DEFAULT true
  `;

  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

async function getActor(actorId: unknown) {
  const { user, users } = await getDemoContext();
  return users.find((candidate) => candidate.id === actorId) ?? user;
}

async function listIdeas(activeUserId = "") {
  const { organization } = await getDemoContext();
  await ensureIdeaTables();

  const ideas = await prisma.$queryRaw<IdeaRow[]>`
    SELECT
      id,
      title,
      body,
      "authorUserId",
      "authorName",
      "pinned",
      "plannedContentItemId",
      "plannedContentTitle",
      "plannedContentStatus",
      "createdAt"
    FROM "IdeaPost"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "pinned" DESC, "createdAt" DESC
  `;

  const ideaIds = ideas.map((idea) => idea.id);
  const comments = ideaIds.length
    ? await prisma.$queryRaw<IdeaCommentRow[]>`
        SELECT id, "ideaId", body, "authorUserId", "authorName", "createdAt"
        FROM "IdeaComment"
        WHERE "organizationId" = ${organization.id}
          AND "ideaId" IN (${Prisma.join(ideaIds)})
        ORDER BY "createdAt" ASC
      `
    : [];
  const likes = ideaIds.length
    ? await prisma.$queryRaw<IdeaLikeRow[]>`
        SELECT "ideaId", "userId", COALESCE("reaction", 'up') AS reaction
        FROM "IdeaLike"
        WHERE "organizationId" = ${organization.id}
          AND "ideaId" IN (${Prisma.join(ideaIds)})
      `
    : [];

  const commentsByIdea = new Map<string, IdeaCommentRow[]>();
  for (const comment of comments) {
    commentsByIdea.set(comment.ideaId, [...(commentsByIdea.get(comment.ideaId) ?? []), comment]);
  }

  return ideas.map((idea) => {
    const ideaLikes = likes.filter((like) => like.ideaId === idea.id);
    const positiveLikes = ideaLikes.filter((like) => like.reaction !== "down");
    const negativeLikes = ideaLikes.filter((like) => like.reaction === "down");
    return {
      id: idea.id,
      title: idea.title,
      body: idea.body,
      authorUserId: idea.authorUserId ?? "",
      authorName: idea.authorName,
      pinned: Boolean(idea.pinned),
      plannedContentItemId: idea.plannedContentItemId ?? "",
      plannedContentTitle: idea.plannedContentTitle ?? "",
      plannedContentStatus: idea.plannedContentStatus ?? "",
      createdAt: idea.createdAt.toISOString(),
      likeCount: positiveLikes.length,
      dislikeCount: negativeLikes.length,
      likedByActiveUser: Boolean(activeUserId && positiveLikes.some((like) => like.userId === activeUserId)),
      dislikedByActiveUser: Boolean(activeUserId && negativeLikes.some((like) => like.userId === activeUserId)),
      comments: (commentsByIdea.get(idea.id) ?? []).map((comment) => ({
        id: comment.id,
        ideaId: comment.ideaId,
        body: comment.body,
        authorUserId: comment.authorUserId ?? "",
        authorName: comment.authorName,
        createdAt: comment.createdAt.toISOString(),
      })),
    };
  });
}

async function notifyIdeaStore(input: {
  ideaId: string;
  subject: string;
  body: string;
  actorUserId: string;
}) {
  const { organization } = await getDemoContext();
  const recipients = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "User"
    WHERE "organizationId" = ${organization.id}
      AND "isActive" = true
      AND id <> ${input.actorUserId}
      AND COALESCE("notifyIdeaStore", true) = true
  `;

  for (const recipient of recipients) {
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id", "organizationId", "userId", "taskId", "channel", "subject", "body",
        "linkTarget", "linkTargetId", "linkLabel", "sentAt", "createdAt"
      )
      VALUES (
        ${randomUUID()}, ${organization.id}, ${recipient.id}, NULL, 'app',
        ${input.subject}, ${input.body}, 'idea-store', ${input.ideaId}, 'Idee öffnen', NULL, CURRENT_TIMESTAMP
      )
    `;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return NextResponse.json(await listIdeas(searchParams.get("userId") ?? ""));
}

export async function POST(req: Request) {
  await ensureIdeaTables();
  const body = await req.json();
  const { organization } = await getDemoContext();
  const actor = await getActor(body.actorId);
  const actorName = `${actor.firstName} ${actor.lastName}`.trim();
  const title = cleanString(body.title);
  const text = cleanString(body.body);

  if (!title) {
    return NextResponse.json({ error: "Bitte einen Ideentitel angeben." }, { status: 400 });
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "IdeaPost" ("id", "organizationId", "title", "body", "authorUserId", "authorName")
    VALUES (${id}, ${organization.id}, ${title}, ${text}, ${actor.id}, ${actorName})
  `;

  await notifyIdeaStore({
    ideaId: id,
    actorUserId: actor.id,
    subject: "Neue Idee im Ideen-Feed",
    body: `${actorName} hat eine neue Idee eingestellt: ${title}`,
  });

  return NextResponse.json(await listIdeas(actor.id));
}

export async function PATCH(req: Request) {
  await ensureIdeaTables();
  const body = await req.json();
  const { organization } = await getDemoContext();
  const actor = await getActor(body.actorId);
  const actorName = `${actor.firstName} ${actor.lastName}`.trim();
  const ideaId = cleanString(body.ideaId);
  const action = cleanString(body.action);

  const [idea] = await prisma.$queryRaw<IdeaRow[]>`
    SELECT
      id,
      title,
      body,
      "authorUserId",
      "authorName",
      "pinned",
      "plannedContentItemId",
      "plannedContentTitle",
      "plannedContentStatus",
      "createdAt"
    FROM "IdeaPost"
    WHERE id = ${ideaId}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  if (!idea) return NextResponse.json({ error: "Idee wurde nicht gefunden." }, { status: 404 });

  if (action === "comment") {
    const text = cleanString(body.body);
    if (!text) return NextResponse.json({ error: "Bitte einen Kommentar eingeben." }, { status: 400 });

    await prisma.$executeRaw`
      INSERT INTO "IdeaComment" ("id", "organizationId", "ideaId", "body", "authorUserId", "authorName")
      VALUES (${randomUUID()}, ${organization.id}, ${idea.id}, ${text}, ${actor.id}, ${actorName})
    `;
    await notifyIdeaStore({
      ideaId: idea.id,
      actorUserId: actor.id,
      subject: "Neuer Kommentar im Ideen-Feed",
      body: `${actorName} hat "${idea.title}" kommentiert.`,
    });
  }

  if (action === "like") {
    const alreadyLiked = await prisma.$queryRaw<Array<{ userId: string; reaction: string }>>`
      SELECT "userId", COALESCE("reaction", 'up') AS reaction FROM "IdeaLike"
      WHERE "organizationId" = ${organization.id}
        AND "ideaId" = ${idea.id}
        AND "userId" = ${actor.id}
      LIMIT 1
    `;

    if (alreadyLiked.length > 0 && alreadyLiked[0].reaction === "up") {
      await prisma.$executeRaw`
        DELETE FROM "IdeaLike"
        WHERE "organizationId" = ${organization.id}
          AND "ideaId" = ${idea.id}
          AND "userId" = ${actor.id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "IdeaLike" ("organizationId", "ideaId", "userId", "reaction")
        VALUES (${organization.id}, ${idea.id}, ${actor.id}, 'up')
        ON CONFLICT ("ideaId", "userId")
        DO UPDATE SET "reaction" = 'up'
      `;
      await notifyIdeaStore({
        ideaId: idea.id,
        actorUserId: actor.id,
        subject: "Neue Reaktion im Ideen-Feed",
        body: `${actorName} gefällt die Idee "${idea.title}".`,
      });
    }
  }

  if (action === "dislike") {
    const text = cleanString(body.body);
    if (!text) {
      return NextResponse.json(
        { error: "Daumen runter kann nur mit Kommentar gespeichert werden." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "IdeaComment" ("id", "organizationId", "ideaId", "body", "authorUserId", "authorName")
      VALUES (${randomUUID()}, ${organization.id}, ${idea.id}, ${text}, ${actor.id}, ${actorName})
    `;

    await prisma.$executeRaw`
      INSERT INTO "IdeaLike" ("organizationId", "ideaId", "userId", "reaction")
      VALUES (${organization.id}, ${idea.id}, ${actor.id}, 'down')
      ON CONFLICT ("ideaId", "userId")
      DO UPDATE SET "reaction" = 'down'
    `;

    await notifyIdeaStore({
      ideaId: idea.id,
      actorUserId: actor.id,
      subject: "Neue Reaktion im Ideen-Feed",
      body: `${actorName} hat zur Idee "${idea.title}" Feedback hinterlassen.`,
    });
  }

  if (action === "pin") {
    await prisma.$executeRaw`
      UPDATE "IdeaPost"
      SET "pinned" = ${!Boolean(idea.pinned)},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${idea.id}
        AND "organizationId" = ${organization.id}
    `;
  }

  return NextResponse.json(await listIdeas(actor.id));
}

