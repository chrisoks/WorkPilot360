import { NextResponse } from "next/server";
import { Role, type Task, type TimeEntry, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canManageTaskTimeEntries } from "@/lib/permissions";

function getUserName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

async function isTaskParticipant(taskId: string, userId: string) {
  const participant = await prisma.taskParticipant.findFirst({
    where: {
      taskId,
      userId,
    },
    select: {
      id: true,
    },
  });

  return Boolean(participant);
}

async function canAddTimeEntry(task: Pick<Task, "id" | "ownerId" | "createdById">, actor: User) {
  return (
    canManageTaskTimeEntries(actor) ||
    task.ownerId === actor.id ||
    task.createdById === actor.id ||
    await isTaskParticipant(task.id, actor.id)
  );
}

function canChangeTimeEntry(entry: Pick<TimeEntry, "userId">, actor: User) {
  return canManageTaskTimeEntries(actor) || entry.userId === actor.id;
}

function parseDuration(durationMinutes: unknown) {
  const value = Number(durationMinutes);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function parseStartedAt(startedAt: unknown) {
  if (!startedAt) return new Date();

  const parsed = new Date(String(startedAt));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalStartedAt(startedAt: unknown) {
  if (!startedAt) return undefined;

  const parsed = new Date(String(startedAt));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export async function POST(
  req: Request,
  { params }: { params: { taskId: string } }
) {
  const body = await req.json();
  const durationMinutes = parseDuration(body.durationMinutes);
  const startedAt = parseStartedAt(body.startedAt);

  if (!durationMinutes) {
    return NextResponse.json(
      { error: "Bitte eine Dauer in Minuten angeben." },
      { status: 400 }
    );
  }

  if (!startedAt) {
    return NextResponse.json(
      { error: "Bitte einen g\u00fcltigen Startzeitpunkt angeben." },
      { status: 400 }
    );
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

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

  if (!(await canAddTimeEntry(task, actor))) {
    return NextResponse.json(
      { error: "Du darfst f\u00fcr diese Aufgabe keine Zeit erfassen." },
      { status: 403 }
    );
  }

  const entry = await prisma.timeEntry.create({
    data: {
      organizationId: organization.id,
      taskId: task.id,
      userId: actor.id,
      startedAt,
      stoppedAt: new Date(startedAt.getTime() + durationMinutes * 60_000),
      durationMinutes,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    },
    include: {
      user: true,
    },
  });

  return NextResponse.json({
    id: entry.id,
    gestartetAm: toLocalDateTimeInputValue(entry.startedAt),
    dauerMinuten: entry.durationMinutes,
    notiz: entry.note ?? "",
    nutzer: `${entry.user.firstName} ${entry.user.lastName}`,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { taskId: string } }
) {
  const body = await req.json();
  const durationMinutes = parseDuration(body.durationMinutes);
  const requestedStartedAt = parseOptionalStartedAt(body.startedAt);

  if (!body.entryId) {
    return NextResponse.json({ error: "Zeiteintrag wurde nicht gefunden." }, { status: 400 });
  }

  if (!durationMinutes) {
    return NextResponse.json(
      { error: "Bitte eine Dauer in Minuten angeben." },
      { status: 400 }
    );
  }

  if (requestedStartedAt === null) {
    return NextResponse.json(
      { error: "Bitte einen g\u00fcltigen Startzeitpunkt angeben." },
      { status: 400 }
    );
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const existingEntry = await prisma.timeEntry.findFirst({
    where: {
      id: body.entryId,
      taskId: params.taskId,
      organizationId: organization.id,
    },
  });

  if (!existingEntry) {
    return NextResponse.json(
      { error: "Zeiteintrag wurde nicht gefunden." },
      { status: 404 }
    );
  }

  const startedAt = requestedStartedAt ?? existingEntry.startedAt;

  if (!canChangeTimeEntry(existingEntry, actor)) {
    return NextResponse.json(
      { error: "Du darfst diesen Zeiteintrag nicht bearbeiten." },
      { status: 403 }
    );
  }

  const entry = await prisma.timeEntry.update({
    where: {
      id: existingEntry.id,
    },
    data: {
      startedAt,
      stoppedAt: new Date(startedAt.getTime() + durationMinutes * 60_000),
      durationMinutes,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    },
    include: {
      user: true,
    },
  });

  return NextResponse.json({
    id: entry.id,
    gestartetAm: toLocalDateTimeInputValue(entry.startedAt),
    dauerMinuten: entry.durationMinutes,
    notiz: entry.note ?? "",
    nutzer: `${entry.user.firstName} ${entry.user.lastName}`,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { taskId: string } }
) {
  const body = await req.json();
  const reason = String(body.reason ?? "").trim();

  if (!body.entryId) {
    return NextResponse.json({ error: "Zeiteintrag wurde nicht gefunden." }, { status: 400 });
  }

  if (!reason) {
    return NextResponse.json(
      { error: "Bitte eine Begr\u00fcndung f\u00fcr das L\u00f6schen angeben." },
      { status: 400 }
    );
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const existingEntry = await prisma.timeEntry.findFirst({
    where: {
      id: body.entryId,
      taskId: params.taskId,
      organizationId: organization.id,
    },
    include: {
      task: true,
      user: true,
    },
  });

  if (!existingEntry) {
    return NextResponse.json(
      { error: "Zeiteintrag wurde nicht gefunden." },
      { status: 404 }
    );
  }

  if (!canChangeTimeEntry(existingEntry, actor)) {
    return NextResponse.json(
      { error: "Du darfst diesen Zeiteintrag nicht l\u00f6schen." },
      { status: 403 }
    );
  }

  await prisma.timeEntry.delete({
    where: {
      id: existingEntry.id,
    },
  });

  const recipients = users.filter(
    (demoUser) =>
      demoUser.isActive &&
      (demoUser.role === Role.ADMIN || demoUser.role === Role.GESCHAEFTSFUEHRER)
  );

  await Promise.all(
    recipients.map((recipient) =>
      prisma.notification.create({
        data: {
          organizationId: organization.id,
          userId: recipient.id,
          taskId: existingEntry.taskId,
          channel: "app",
          subject: "Zeiteintrag gel\u00f6scht",
          body: `${getUserName(actor)} hat einen Zeiteintrag gel\u00f6scht: ${existingEntry.durationMinutes} Min. bei "${existingEntry.task.title}". Begr\u00fcndung: ${reason}`,
        },
      })
    )
  );

  return NextResponse.json({ success: true });
}
