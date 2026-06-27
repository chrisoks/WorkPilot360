import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

function canManageTeams(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

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

export async function GET() {
  const { organization } = await getDemoContext();

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
  const { organization, department, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTeams(actor.role)) {
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
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTeams(actor.role)) {
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

  const team = await prisma.team.update({
    where: {
      id: body.teamId,
    },
    data: {
      name: body.name.trim(),
    },
  });

  if (team.organizationId !== organization.id) {
    return NextResponse.json(
      { error: "Team gehört nicht zur Demo-Organisation." },
      { status: 403 }
    );
  }

  return NextResponse.json(await formatTeam(team));
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTeams(actor.role)) {
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
