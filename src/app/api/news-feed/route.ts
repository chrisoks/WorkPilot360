import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canSeeNewsPost } from "@/lib/news-feed/visibility";
import { sendPushToUserSafely } from "@/lib/push/web-push";
import { ensureNewsFeedTables } from "@/lib/sales-hub/ensure";

type NewsPostRow = {
  id: string;
  title: string;
  body: string;
  authorUserId: string | null;
  authorName: string;
  visibility: string;
  departmentIds: unknown;
  teamIds: unknown;
  userIds: unknown;
  attachments: unknown;
  pollQuestion: string | null;
  pollOptions: unknown;
  pollAllowMultiple: boolean | null;
  createdAt: Date;
  readAt: Date | null;
};

type NewsCommentRow = {
  id: string;
  postId: string;
  body: string;
  authorUserId: string | null;
  authorName: string;
  createdAt: Date;
};

type NewsReactionRow = {
  postId: string;
  userId: string;
  reaction: string;
};

type NewsPollVoteRow = {
  postId: string;
  optionId: string;
  userId: string;
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

function cleanAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const attachment = item as Record<string, unknown>;
      const id = cleanString(attachment.id) || randomUUID();
      const name = cleanString(attachment.name);
      const dataUrl = cleanString(attachment.dataUrl);
      const contentType = cleanString(attachment.contentType);
      if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
      return { id, name, dataUrl, contentType };
    })
    .filter(Boolean);
}

function cleanPollOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { id: randomUUID(), label: item.trim() };
      if (!item || typeof item !== "object") return null;
      const option = item as Record<string, unknown>;
      const label = cleanString(option.label);
      if (!label) return null;
      return { id: cleanString(option.id) || randomUUID(), label };
    })
    .filter(Boolean);
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function canEditNewsPost(
  actor: { id: string; role?: string | null },
  post: { authorUserId: string | null }
) {
  return post.authorUserId === actor.id || actor.role === "ADMIN" || actor.role === "GESCHAEFTSFUEHRER";
}

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

async function notifyUsersAboutNewsPost(input: {
  organizationId: string;
  postId: string;
  title: string;
  authorName: string;
  actorUserId: string;
  users: Array<{ id: string; isActive: boolean; role?: string | null }>;
  postVisibility: {
    visibility: string;
    departmentIds: unknown;
    teamIds: unknown;
    userIds: unknown;
  };
}) {
  await ensureNotificationLinkColumns();

  const subject = "Neuer Beitrag im Firmenfeed";
  const body = `${input.authorName} hat einen neuen Beitrag im Firmenfeed veröffentlicht: ${input.title}`;
  const recipients = input.users.filter(
    (user) => user.isActive && user.id !== input.actorUserId && canSeeNewsPost(input.postVisibility, user)
  );

  for (const recipient of recipients) {
    const notification = await prisma.notification.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        userId: recipient.id,
        taskId: null,
        channel: "app",
        subject,
        body,
        linkTarget: "news-feed",
        linkTargetId: input.postId,
        linkLabel: "Beitrag öffnen",
        sentAt: null,
      },
    });

    await sendPushToUserSafely({
      organizationId: input.organizationId,
      userId: recipient.id,
      payload: {
        title: subject,
        body,
        notificationId: notification.id,
        linkTarget: "news-feed",
        linkTargetId: input.postId,
        url: `/?target=news-feed&targetId=${encodeURIComponent(input.postId)}`,
      },
    });
  }
}

function formatPost(
  post: NewsPostRow,
  comments: NewsCommentRow[],
  reactions: NewsReactionRow[],
  votes: NewsPollVoteRow[],
  activeUserId: string
) {
  const postReactions = reactions.filter((reaction) => reaction.postId === post.id);
  const activeUserReaction = postReactions.find((reaction) => reaction.userId === activeUserId)?.reaction ?? "";
  const reactionSummary = postReactions.reduce<Record<string, number>>((summary, reaction) => {
    const key = reaction.reaction || "up";
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
  const pollOptions = jsonArray(post.pollOptions).map((option) => {
    const raw = option as Record<string, unknown>;
    const id = cleanString(raw.id);
    return {
      id,
      label: cleanString(raw.label),
      voteCount: votes.filter((vote) => vote.postId === post.id && vote.optionId === id).length,
      votedByActiveUser: votes.some(
        (vote) => vote.postId === post.id && vote.optionId === id && vote.userId === activeUserId
      ),
    };
  });
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    authorUserId: post.authorUserId ?? "",
    authorName: post.authorName,
    visibility: post.visibility,
    departmentIds: jsonArray(post.departmentIds).map(String),
    teamIds: jsonArray(post.teamIds).map(String),
    userIds: jsonArray(post.userIds).map(String),
    attachments: jsonArray(post.attachments),
    pollQuestion: post.pollQuestion ?? "",
    pollOptions,
    pollAllowMultiple: Boolean(post.pollAllowMultiple),
    createdAt: post.createdAt.toISOString(),
    readAt: post.readAt?.toISOString() ?? "",
    reactionCount: postReactions.length,
    reactedByActiveUser: postReactions.some((reaction) => reaction.userId === activeUserId),
    activeUserReaction,
    reactionSummary,
    comments: comments
      .filter((comment) => comment.postId === post.id)
      .map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        body: comment.body,
        authorUserId: comment.authorUserId ?? "",
        authorName: comment.authorName,
        createdAt: comment.createdAt.toISOString(),
      })),
  };
}

export async function GET(req: Request) {
  await ensureNewsFeedTables();
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const requestedActorId = searchParams.get("actorId") ?? searchParams.get("userId");
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const activeUser = actorResult.actor;

  const rows = await prisma.$queryRaw<NewsPostRow[]>`
    SELECT p.*, r."readAt"
    FROM "NewsPost" p
    LEFT JOIN "NewsReadState" r
      ON r."postId" = p.id AND r."userId" = ${activeUser.id}
    WHERE p."organizationId" = ${organization.id}
    ORDER BY p."createdAt" DESC
    LIMIT 80
  `;

  const visibleRows = rows.filter((post) => canSeeNewsPost(post, activeUser));
  const ids = visibleRows.map((post) => post.id);
  const comments = ids.length
    ? await prisma.$queryRaw<NewsCommentRow[]>`
        SELECT id, "postId", body, "authorUserId", "authorName", "createdAt"
        FROM "NewsComment"
        WHERE "organizationId" = ${organization.id}
          AND "postId" IN (${Prisma.join(ids)})
        ORDER BY "createdAt" ASC
      `
    : [];
  const reactions = ids.length
    ? await prisma.$queryRaw<NewsReactionRow[]>`
        SELECT "postId", "userId", reaction
        FROM "NewsReaction"
        WHERE "organizationId" = ${organization.id}
          AND "postId" IN (${Prisma.join(ids)})
      `
    : [];
  const votes = ids.length
    ? await prisma.$queryRaw<NewsPollVoteRow[]>`
        SELECT "postId", "optionId", "userId"
        FROM "NewsPollVote"
        WHERE "organizationId" = ${organization.id}
          AND "postId" IN (${Prisma.join(ids)})
      `
    : [];

  return NextResponse.json(visibleRows.map((post) => formatPost(post, comments, reactions, votes, activeUser.id)));
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
  const title = cleanString(body.title);
  const text = cleanString(body.body);
  const visibility = ["all", "departments", "teams", "users"].includes(cleanString(body.visibility))
    ? cleanString(body.visibility)
    : "all";
  const attachments = cleanAttachments(body.attachments);
  const pollQuestion = cleanString(body.pollQuestion);
  const pollOptions = cleanPollOptions(body.pollOptions);
  const pollAllowMultiple = Boolean(body.pollAllowMultiple);

  if (!title) {
    return NextResponse.json({ error: "Bitte einen Titel angeben." }, { status: 400 });
  }

  if (pollQuestion && pollOptions.length < 2) {
    return NextResponse.json({ error: "Eine Abstimmung benötigt mindestens zwei Antwortoptionen." }, { status: 400 });
  }

  const id = randomUUID();
  const authorName = getUserName(actor);
  await prisma.$executeRaw`
    INSERT INTO "NewsPost" (
      "id", "organizationId", "title", "body", "authorUserId", "authorName",
      "visibility", "departmentIds", "teamIds", "userIds",
      "attachments", "pollQuestion", "pollOptions", "pollAllowMultiple"
    ) VALUES (
      ${id}, ${organization.id}, ${title}, ${text}, ${actor.id}, ${authorName},
      ${visibility}, ${JSON.stringify(cleanStringArray(body.departmentIds))}::jsonb,
      ${JSON.stringify(cleanStringArray(body.teamIds))}::jsonb,
      ${JSON.stringify(cleanStringArray(body.userIds))}::jsonb,
      ${JSON.stringify(attachments)}::jsonb, ${pollQuestion},
      ${JSON.stringify(pollOptions)}::jsonb, ${pollAllowMultiple}
    )
  `;

  await notifyUsersAboutNewsPost({
    organizationId: organization.id,
    postId: id,
    title,
    authorName,
    actorUserId: actor.id,
    users,
    postVisibility: {
      visibility,
      departmentIds: cleanStringArray(body.departmentIds),
      teamIds: cleanStringArray(body.teamIds),
      userIds: cleanStringArray(body.userIds),
    },
  });

  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureNewsFeedTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId ?? body.userId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const activeUser = actorResult.actor;
  const postId = cleanString(body.postId);

  if (!postId) {
    return NextResponse.json({ error: "Keine News-ID uebergeben." }, { status: 400 });
  }

  if (body.action === "update") {
    const title = cleanString(body.title);
    const text = cleanString(body.body);
    const attachments = cleanAttachments(body.attachments);
    const pollQuestion = cleanString(body.pollQuestion);
    const pollOptions = cleanPollOptions(body.pollOptions);
    const pollAllowMultiple = Boolean(body.pollAllowMultiple);

    if (!title) {
      return NextResponse.json({ error: "Bitte einen Titel angeben." }, { status: 400 });
    }

    if (pollQuestion && pollOptions.length < 2) {
      return NextResponse.json({ error: "Eine Abstimmung benoetigt mindestens zwei Antwortoptionen." }, { status: 400 });
    }

    const editablePosts = await prisma.$queryRaw<Array<{ id: string; authorUserId: string | null }>>`
      SELECT id, "authorUserId"
      FROM "NewsPost"
      WHERE "organizationId" = ${organization.id}
        AND id = ${postId}
      LIMIT 1
    `;
    const editablePost = editablePosts[0];
    if (!editablePost) {
      return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });
    }
    if (!canEditNewsPost(activeUser, editablePost)) {
      return NextResponse.json({ error: "Du darfst diesen Beitrag nicht bearbeiten." }, { status: 403 });
    }

    await prisma.$executeRaw`
      UPDATE "NewsPost"
      SET
        "title" = ${title},
        "body" = ${text},
        "attachments" = ${JSON.stringify(attachments)}::jsonb,
        "pollQuestion" = ${pollQuestion},
        "pollOptions" = ${JSON.stringify(pollOptions)}::jsonb,
        "pollAllowMultiple" = ${pollAllowMultiple},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organization.id}
        AND id = ${postId}
    `;

    await prisma.$executeRaw`
      DELETE FROM "NewsPollVote"
      WHERE "organizationId" = ${organization.id}
        AND "postId" = ${postId}
    `;

    return NextResponse.json({ success: true });
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
  if (!canSeeNewsPost(post, activeUser)) {
    return NextResponse.json({ error: "Du darfst diesen Beitrag nicht sehen." }, { status: 403 });
  }

  await prisma.$executeRaw`
    INSERT INTO "NewsReadState" ("organizationId", "postId", "userId", "readAt")
    VALUES (${organization.id}, ${postId}, ${activeUser.id}, CURRENT_TIMESTAMP)
    ON CONFLICT ("postId", "userId") DO UPDATE SET "readAt" = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({ success: true });
}
