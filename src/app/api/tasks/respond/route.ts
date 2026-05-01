import { NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type TaskAcceptanceRow = {
  id: string;
  title: string;
  ownerId: string;
  organizationId: string;
  createdById: string | null;
};

function formatResponseTimestamp(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const response = body.response === "rejected" ? "rejected" : "accepted";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!body.taskId) {
    return NextResponse.json({ error: "Keine Aufgaben-ID übergeben." }, { status: 400 });
  }

  if (response === "rejected" && !reason) {
    return NextResponse.json(
      { error: "Bitte eine Begründung für die Ablehnung angeben." },
      { status: 400 }
    );
  }

  const tasks = await prisma.$queryRaw<TaskAcceptanceRow[]>`
    SELECT id, title, "ownerId", "organizationId", "createdById"
    FROM "Task"
    WHERE id = ${body.taskId}
    LIMIT 1
  `;
  const task = tasks[0];

  if (!task) {
    return NextResponse.json({ error: "Aufgabe wurde nicht gefunden." }, { status: 404 });
  }

  if (task.ownerId !== actor.id) {
    return NextResponse.json(
      { error: "Nur der zuständige Benutzer kann die Aufgabe annehmen oder ablehnen." },
      { status: 403 }
    );
  }

  const creator = users.find((demoUser) => demoUser.id === task.createdById);
  const respondedAt = new Date();
  const actorName = `${actor.firstName} ${actor.lastName}`;

  await prisma.$executeRaw`
    UPDATE "Task"
    SET
      "acceptanceStatus" = ${response},
      "acceptanceRespondedAt" = ${respondedAt},
      "rejectionReason" = ${response === "rejected" ? reason : null},
      status = ${response === "rejected" ? TaskStatus.ABGELEHNT : TaskStatus.OFFEN}
    WHERE id = ${task.id}
  `;

  if (creator) {
    const subject = response === "accepted" ? "Aufgabe angenommen" : "Aufgabe abgelehnt";
    const bodyText =
      response === "accepted"
        ? `${actorName} hat die Aufgabe "${task.title}" angenommen am ${formatResponseTimestamp(
            respondedAt
          )}.`
        : `${actorName} hat die Aufgabe "${task.title}" abgelehnt. Begründung: ${reason}`;

    await prisma.notification.create({
      data: {
        organizationId: task.organizationId,
        taskId: task.id,
        userId: creator.id,
        channel: response === "rejected" ? "email" : "app",
        subject,
        body: bodyText,
        sentAt: null,
      },
    });
  }

  return NextResponse.json({ success: true });
}
