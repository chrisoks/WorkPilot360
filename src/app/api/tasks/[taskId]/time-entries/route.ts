import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

function parseDuration(durationMinutes: unknown) {
  const value = Number(durationMinutes);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
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

  if (!durationMinutes) {
    return NextResponse.json(
      { error: "Bitte eine Dauer in Minuten angeben." },
      { status: 400 }
    );
  }

  const { organization, user } = await getDemoContext();

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

  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();

  const entry = await prisma.timeEntry.create({
    data: {
      organizationId: organization.id,
      taskId: task.id,
      userId: user.id,
      startedAt,
      stoppedAt: new Date(startedAt.getTime() + durationMinutes * 60_000),
      durationMinutes,
      note: body.note || null,
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

  if (!body.entryId) {
    return NextResponse.json({ error: "Zeiteintrag wurde nicht gefunden." }, { status: 400 });
  }

  if (!durationMinutes) {
    return NextResponse.json(
      { error: "Bitte eine Dauer in Minuten angeben." },
      { status: 400 }
    );
  }

  const { organization } = await getDemoContext();
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

  const entry = await prisma.timeEntry.update({
    where: {
      id: existingEntry.id,
    },
    data: {
      stoppedAt: new Date(existingEntry.startedAt.getTime() + durationMinutes * 60_000),
      durationMinutes,
      note: body.note || null,
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

  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
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

  await prisma.timeEntry.delete({
    where: {
      id: existingEntry.id,
    },
  });

  const recipients = users.filter(
    (demoUser) => demoUser.role === Role.ADMIN || demoUser.role === Role.GESCHAEFTSFUEHRER
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
          body: `${actor.firstName} ${actor.lastName} hat einen Zeiteintrag gel\u00f6scht: ${existingEntry.durationMinutes} Min. bei "${existingEntry.task.title}". Begr\u00fcndung: ${reason}`,
        },
      })
    )
  );

  return NextResponse.json({ success: true });
}
