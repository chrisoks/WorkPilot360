import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

export async function POST(
  req: Request,
  { params }: { params: { taskId: string } }
) {
  const body = await req.json();
  const text = String(body.text ?? "").trim();

  if (!text) {
    return NextResponse.json(
      { error: "Bitte einen Kommentar eingeben." },
      { status: 400 }
    );
  }

  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
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

  return NextResponse.json({
    id: comment.id,
    text: comment.body,
    erstelltAm: comment.createdAt.toISOString(),
    autor: `${comment.author.firstName} ${comment.author.lastName}`,
  }, { status: 201 });
}
