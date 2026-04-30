import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { Role, TaskPriority, TaskStatus } from "@prisma/client";

function mapStatus(status: string): TaskStatus {
  if (status === "in Bearbeitung") return TaskStatus.IN_BEARBEITUNG;
  if (status === "erledigt") return TaskStatus.ERLEDIGT;
  return TaskStatus.OFFEN;
}

function mapPriority(priority: string): TaskPriority {
  if (priority === "hoch") return TaskPriority.HOCH;
  if (priority === "niedrig") return TaskPriority.NIEDRIG;
  return TaskPriority.NORMAL;
}

function toUiStatus(status: TaskStatus) {
  if (status === TaskStatus.IN_BEARBEITUNG) return "in Bearbeitung";
  if (status === TaskStatus.ERLEDIGT) return "erledigt";
  return "offen";
}

function toUiPriority(priority: TaskPriority) {
  if (priority === TaskPriority.HOCH) return "hoch";
  if (priority === TaskPriority.NIEDRIG) return "niedrig";
  return "normal";
}

async function getDemoContext() {
  const organization = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Organisation",
      slug: "demo",
    },
  });

  const user = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: "demo@example.com",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      email: "demo@example.com",
      passwordHash: "demo",
      firstName: "Demo",
      lastName: "User",
      role: Role.ADMIN,
    },
  });

  return { organization, user };
}

function formatTask(task: any) {
  return {
    id: task.id,
    titel: task.title,
    status: toUiStatus(task.status),
    prioritaet: toUiPriority(task.priority),
    zustaendig: `${task.owner.firstName} ${task.owner.lastName}`,
    faelligkeit: task.deadline.toISOString().slice(0, 10),
  };
}

export async function GET() {
  const { organization } = await getDemoContext();

  const tasks = await prisma.task.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      owner: true,
    },
  });

  return NextResponse.json(tasks.map(formatTask));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, user } = await getDemoContext();

  const task = await prisma.task.create({
    data: {
      organizationId: organization.id,
      ownerId: user.id,
      title: body.title,
      description: "",
      status: mapStatus(body.status),
      priority: mapPriority(body.priority),
      deadline: body.deadline ? new Date(body.deadline) : new Date(),
    },
    include: {
      owner: true,
    },
  });

  return NextResponse.json(formatTask(task));
}

export async function PATCH(req: Request) {
  const body = await req.json();

  const task = await prisma.task.update({
    where: {
      id: body.id,
    },
    data: {
      title: body.title,
      status: mapStatus(body.status),
      priority: mapPriority(body.priority),
      deadline: body.deadline ? new Date(body.deadline) : new Date(),
    },
    include: {
      owner: true,
    },
  });

  return NextResponse.json(formatTask(task));
}

export async function DELETE(req: Request) {
  const body = await req.json();

  if (!body.id) {
    return NextResponse.json(
      { error: "Keine Aufgaben-ID übergeben" },
      { status: 400 }
    );
  }

  await prisma.task.delete({
    where: {
      id: body.id,
    },
  });

  return NextResponse.json({ success: true });
}