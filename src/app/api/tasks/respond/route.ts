import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

type AbsenceHandoverRow = {
  id: string;
  requestGroupId: string | null;
  handoverTaskIds: unknown;
};

type ParticipantAcceptanceRow = {
  id: string;
  acceptanceStatus: string;
};

function createHistoryItem(event: string, actorName: string, note = "") {
  return {
    id: randomUUID(),
    event,
    actorName,
    note,
    createdAt: new Date().toISOString(),
  };
}

function formatResponseTimestamp(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function POST(req: Request) {
  await prisma.$executeRaw`
    ALTER TABLE "Absence"
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  await prisma.$executeRaw`
    ALTER TABLE "TaskParticipant"
    ADD COLUMN IF NOT EXISTS "acceptanceStatus" TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "acceptanceRespondedAt" TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT
  `;
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

  let participantResponseId = "";

  if (task.ownerId !== actor.id) {
    const matchingAbsenceRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Absence"
      WHERE "organizationId" = ${task.organizationId}
        AND "representativeUserId" = ${actor.id}
        AND "handoverTaskIds" @> ${JSON.stringify([task.id])}::jsonb
      LIMIT 1
    `;

    if (matchingAbsenceRows.length > 0) {
      await prisma.$executeRaw`
        UPDATE "Task"
        SET "ownerId" = ${actor.id}
        WHERE id = ${task.id}
      `;
      task.ownerId = actor.id;
    }

    if (task.ownerId !== actor.id) {
      const participantRows = await prisma.$queryRaw<ParticipantAcceptanceRow[]>`
        SELECT id, "acceptanceStatus"
        FROM "TaskParticipant"
        WHERE "taskId" = ${task.id}
          AND "userId" = ${actor.id}
        LIMIT 1
      `;

      if (participantRows.length === 0) {
        return NextResponse.json(
          { error: "Nur zuständige Personen oder Beteiligte können die Aufgabe annehmen oder ablehnen." },
          { status: 403 }
        );
      }

      participantResponseId = participantRows[0].id;
    }
  }

  const creator = users.find((demoUser) => demoUser.id === task.createdById);
  const respondedAt = new Date();
  const actorName = `${actor.firstName} ${actor.lastName}`;

  const taskHistoryItem = createHistoryItem(
    participantResponseId
      ? response === "accepted"
        ? "Aufgabenbeteiligung angenommen"
        : "Aufgabenbeteiligung abgelehnt"
      : response === "accepted"
        ? "Aufgabe angenommen"
        : "Aufgabe abgelehnt",
    actorName,
    response === "rejected" ? reason : ""
  );

  if (participantResponseId) {
    await prisma.$executeRaw`
      UPDATE "TaskParticipant"
      SET
        "acceptanceStatus" = ${response},
        "acceptanceRespondedAt" = ${respondedAt},
        "rejectionReason" = ${response === "rejected" ? reason : null}
      WHERE id = ${participantResponseId}
    `;
  } else {
    await prisma.task.update({
      where: {
        id: task.id,
      },
      data: {
        acceptanceStatus: response,
        acceptanceRespondedAt: respondedAt,
        rejectionReason: response === "rejected" ? reason : null,
        status: response === "rejected" ? TaskStatus.ABGELEHNT : TaskStatus.OFFEN,
      },
    });
  }

  await prisma.$executeRaw`
    UPDATE "Task"
    SET "history" = COALESCE("history", '[]'::jsonb) || ${JSON.stringify([taskHistoryItem])}::jsonb
    WHERE id = ${task.id}
  `;

  const absenceRows = await prisma.$queryRaw<AbsenceHandoverRow[]>`
      SELECT "requestGroupId", id
      , "handoverTaskIds"
      FROM "Absence"
      WHERE "organizationId" = ${task.organizationId}
        AND "handoverTaskIds" @> ${JSON.stringify([task.id])}::jsonb
      LIMIT 1
    `;

  if (response === "accepted" && absenceRows.length > 0) {
    const handoverTaskIds = Array.isArray(absenceRows[0].handoverTaskIds)
      ? absenceRows[0].handoverTaskIds.map(String)
      : [];
    const openHandoverTasks =
      handoverTaskIds.length > 0
        ? await prisma.task.count({
            where: {
              id: {
                in: handoverTaskIds,
              },
              acceptanceStatus: {
                not: "accepted",
              },
            },
          })
        : 0;

    if (openHandoverTasks === 0) {
      const requestGroupId = absenceRows[0].requestGroupId ?? absenceRows[0].id;
      const historyItem = createHistoryItem("Alle Übergabe-Aufgaben angenommen", actorName);

      await prisma.$executeRaw`
        UPDATE "Absence"
        SET status = 'wartet_geschaeftsfuehrung',
            history = COALESCE(history, '[]'::jsonb) || ${JSON.stringify([historyItem])}::jsonb
        WHERE "organizationId" = ${task.organizationId}
          AND COALESCE("requestGroupId", id) = ${requestGroupId}
          AND status = 'wartet_vertreter'
      `;
    }
  }

  if (response === "rejected") {
    const absenceRequestId = absenceRows[0]?.requestGroupId ?? absenceRows[0]?.id ?? null;
    const historyItem = createHistoryItem("Übergabe-Aufgabe abgelehnt", actorName, reason);

    await prisma.$executeRaw`
      UPDATE "Absence"
      SET status = 'abgelehnt',
          "rejectionReason" = ${reason},
          history = COALESCE(history, '[]'::jsonb) || ${JSON.stringify([historyItem])}::jsonb
      WHERE "organizationId" = ${task.organizationId}
        AND "handoverTaskIds" @> ${JSON.stringify([task.id])}::jsonb
    `;

    if (absenceRequestId && creator) {
      await prisma.notification.create({
        data: {
          organizationId: task.organizationId,
          taskId: task.id,
          userId: creator.id,
          channel: "app",
          subject: "Abwesenheitsantrag abgelehnt",
          body: `${actorName} hat die Übergabe-Aufgabe "${task.title}" abgelehnt. Begründung: ${reason}`,
          sentAt: null,
          linkTarget: "absence-request",
          linkTargetId: absenceRequestId,
          linkLabel: "Antrag öffnen",
        },
      });
    }
  }

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
