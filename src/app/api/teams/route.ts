import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { canManageTeams } from "@/lib/permissions";

async function formatTeam(team: { id: string; name: string; departmentId: string | null }) {
  const [memberships, tasks] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM "UserTeamMembership" memberships
      INNER JOIN "User" users ON users.id = memberships."userId"
      WHERE memberships."teamId" = ${team.id}
      AND users."isActive" = true
    `,
    prisma.task.count({
      where: {
        teamId: team.id,
      },
    }),
  ]);

  return {
    id: team.id,
    name: team.name,
    departmentId: team.departmentId,
    userCount: Number(memberships[0]?.count ?? 0),
    taskCount: tasks,
  };
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);

  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  const teams = await prisma.team.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json(await Promise.all(teams.map(formatTeam)));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, department, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);

  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageTeams(actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Teams anlegen." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Bitte einen Teamnamen angeben." },
      { status: 400 }
    );
  }

  const team = await prisma.team.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      name: body.name.trim(),
    },
  });

  return NextResponse.json(await formatTeam(team), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);

  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageTeams(actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Teams bearbeiten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Bitte einen Teamnamen angeben." },
      { status: 400 }
    );
  }

  const existingTeam = await prisma.team.findFirst({
    where: {
      id: body.teamId,
      organizationId: organization.id,
    },
  });

  if (!existingTeam) {
    return NextResponse.json(
      { error: "Team wurde nicht gefunden." },
      { status: 404 }
    );
  }

  const team = await prisma.team.update({
    where: {
      id: existingTeam.id,
    },
    data: {
      name: body.name.trim(),
    },
  });

  return NextResponse.json(await formatTeam(team));
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);

  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageTeams(actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Teams löschen." },
      { status: 403 }
    );
  }

  const team = await prisma.team.findFirst({
    where: {
      id: body.teamId,
      organizationId: organization.id,
    },
  });

  if (!team) {
    return NextResponse.json(
      { error: "Team wurde nicht gefunden." },
      { status: 404 }
    );
  }

  await prisma.$executeRaw`
    DELETE FROM "UserTeamMembership" WHERE "teamId" = ${team.id}
  `;

  await prisma.user.updateMany({
    where: {
      teamId: team.id,
    },
    data: {
      teamId: null,
    },
  });

  await prisma.task.updateMany({
    where: {
      teamId: team.id,
    },
    data: {
      teamId: null,
    },
  });

  await prisma.team.delete({
    where: {
      id: team.id,
    },
  });

  return NextResponse.json({ success: true });
}
