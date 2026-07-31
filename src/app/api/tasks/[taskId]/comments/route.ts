import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import {
  getSessionBoundActor,
  sessionBoundActorResponse,
} from "@/lib/auth/actor";
import {
  createTaskComment,
  deliverTaskCommentNotificationMails,
  TaskCommentServiceError,
} from "@/lib/services/task-comment-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  const recipientUserId =
    typeof body.recipientUserId === "string"
      ? body.recipientUserId.trim()
      : "";

  if (!text) {
    return NextResponse.json(
      { error: "Bitte einen Kommentar eingeben." },
      { status: 400 }
    );
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  await prisma.$executeRaw`
    ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  await prisma.$executeRaw`
    ALTER TABLE "TaskComment"
    ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT
  `;

  try {
    const result = await prisma.$transaction((tx) =>
      createTaskComment(tx, {
        organizationId: organization.id,
        taskId,
        authority: [{ id: actor.id, role: actor.role }],
        authorUserId: actor.id,
        text,
        recipientUserId,
        source: "manual",
      })
    );
    await deliverTaskCommentNotificationMails(result.mailNotifications);

    return NextResponse.json(
      {
        id: result.comment.id,
        text: result.comment.body,
        erstelltAm: result.comment.createdAt.toISOString(),
        autor: result.authorName,
        recipientUserId,
        recipientName: result.recipientName,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TaskCommentServiceError) {
      const status =
        error.code === "task_not_found"
          ? 404
          : error.code === "invalid_input" ||
              error.code === "recipient_invalid"
            ? 400
            : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
