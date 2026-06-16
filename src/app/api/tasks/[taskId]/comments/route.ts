import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

export async function POST(
  req: Request,
  { params }: { params: { taskId: string } }
) {
  const body = await req.json();
  const text = String(body.text ?? "").trim();
  const recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId.trim() : "";

  if (!text) {
    return NextResponse.json(
      { error: "Bitte einen Kommentar eingeben." },
      { status: 400 }
    );
  }

  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
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
      id: params.taskId,
      organizationId: organization.id,
    },
  });

  if (!task) {
    return NextResponse.json(
      { error: "Aufgabe wurde nicht gefunden." },
      { status: 404 }
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

    recipientName = `${participantRows[0].firstName} ${participantRows[0].lastName}`;
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
    ...taskParticipantRows.map((participant) => participant.userId),
  ]);
  notificationRecipientIds.delete(actor.id);

  for (const userId of notificationRecipientIds) {
    await prisma.notification.create({
      data: {
        organizationId: organization.id,
        taskId: task.id,
        userId,
        channel: "app",
        subject: "Neuer Kommentar zur Aufgabe",
        body: recipientName
          ? `${actor.firstName} ${actor.lastName} hat in der Aufgabe "${task.title}" einen Kommentar an ${recipientName} geschrieben: ${text}`
          : `${actor.firstName} ${actor.lastName} hat die Aufgabe "${task.title}" kommentiert: ${text}`,
        sentAt: null,
        linkTarget: "task",
        linkTargetId: task.id,
        linkLabel: "Aufgabe öffnen",
      },
    });
  }


  await prisma.$executeRaw`
    UPDATE "Task"
    SET "history" = COALESCE("history", '[]'::jsonb) || ${JSON.stringify([
      {
        id: randomUUID(),
        event: "Kommentar hinzugefügt",
        actorName: `${actor.firstName} ${actor.lastName}`,
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
    autor: `${comment.author.firstName} ${comment.author.lastName}`,
    recipientUserId,
    recipientName,
  }, { status: 201 });
}
