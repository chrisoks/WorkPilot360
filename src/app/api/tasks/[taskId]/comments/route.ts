import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { sendTaskNotificationMailSafely } from "@/lib/mail/task-notifications";
import type { User } from "@prisma/client";

function getUserName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const body = await req.json();
  const text = String(body.text ?? "").trim();
  const recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId.trim() : "";

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
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      organizationId: organization.id,
    },
  });

  if (!task) {
    return NextResponse.json(
      { error: "Aufgabe wurde nicht gefunden." },
      { status: 404 }
    );
  }

  const actorParticipantRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "TaskParticipant"
    WHERE "taskId" = ${task.id}
      AND "userId" = ${actor.id}
    LIMIT 1
  `;
  const canComment =
    task.ownerId === actor.id ||
    task.createdById === actor.id ||
    actorParticipantRows.length > 0;

  if (!canComment) {
    return NextResponse.json(
      { error: "Du darfst diese Aufgabe nicht kommentieren." },
      { status: 403 }
    );
  }

  let recipientName = "";
  if (recipientUserId) {
    const participantRows = await prisma.$queryRaw<Array<{ firstName: string; lastName: string }>>`
      SELECT u."firstName", u."lastName"
      FROM "TaskParticipant" p
      JOIN "User" u ON u.id = p."userId"
      WHERE p."taskId" = ${task.id}
        AND p."userId" = ${recipientUserId}
      LIMIT 1
    `;

    if (participantRows.length === 0) {
      return NextResponse.json(
        { error: "Kommentare können nur an Aufgabenbeteiligte gerichtet werden." },
        { status: 400 }
      );
    }

    recipientName = `${participantRows[0].firstName} ${participantRows[0].lastName}`.trim();
  }

  const taskParticipantRows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT "userId"
    FROM "TaskParticipant"
    WHERE "taskId" = ${task.id}
  `;

  const comment = await prisma.taskComment.create({
    data: {
      organizationId: organization.id,
      taskId: task.id,
      authorId: actor.id,
      body: text,
    },
    include: {
      author: true,
    },
  });

  if (recipientUserId) {
    await prisma.$executeRaw`
      UPDATE "TaskComment"
      SET "recipientUserId" = ${recipientUserId}
      WHERE id = ${comment.id}
    `;
  }

  const notificationRecipientIds = new Set<string>([
    task.ownerId,
    ...(task.createdById ? [task.createdById] : []),
    ...taskParticipantRows.map((participant) => participant.userId),
  ]);
  notificationRecipientIds.delete(actor.id);

  for (const userId of notificationRecipientIds) {
    const notificationBody = recipientName
      ? `${getUserName(actor)} hat in der Aufgabe "${task.title}" einen Kommentar an ${recipientName} geschrieben: ${text}`
      : `${getUserName(actor)} hat die Aufgabe "${task.title}" kommentiert: ${text}`;
    const notification = await prisma.notification.create({
      data: {
        organizationId: organization.id,
        taskId: task.id,
        userId,
        channel: "app",
        subject: "Neuer Kommentar zur Aufgabe",
        body: notificationBody,
        sentAt: null,
        linkTarget: "task",
        linkTargetId: task.id,
        linkLabel: "Aufgabe öffnen",
      },
    });

    await sendTaskNotificationMailSafely({
      notificationId: notification.id,
      userId,
      subject: "Neuer Kommentar zur Aufgabe",
      body: notificationBody,
    });
  }


  await prisma.$executeRaw`
    UPDATE "Task"
    SET "history" = COALESCE("history", '[]'::jsonb) || ${JSON.stringify([
      {
        id: randomUUID(),
        event: "Kommentar hinzugefügt",
        actorName: getUserName(actor),
        note: recipientName ? `An ${recipientName}: ${text}` : text,
        createdAt: new Date().toISOString(),
      },
    ])}::jsonb
    WHERE id = ${task.id}
  `;

  return NextResponse.json({
    id: comment.id,
    text: comment.body,
    erstelltAm: comment.createdAt.toISOString(),
    autor: getUserName(comment.author),
    recipientUserId,
    recipientName,
  }, { status: 201 });
}
