import { prisma } from "@/lib/db/client";
import { Role } from "@prisma/client";

export async function getDemoContext() {
  const organization = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {
      locale: "de",
      timezone: "Europe/Berlin",
    },
    create: {
      name: "Demo Organisation",
      slug: "demo",
      locale: "de",
      timezone: "Europe/Berlin",
    },
  });

  const department = await prisma.department.upsert({
    where: {
      id: "demo-department-operations",
    },
    update: {},
    create: {
      id: "demo-department-operations",
      organizationId: organization.id,
      name: "Operations",
    },
  });

  const [existingTeam, existingUserCount] = await Promise.all([
    prisma.team.findFirst({
      where: {
        organizationId: organization.id,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.user.count({
      where: {
        organizationId: organization.id,
      },
    }),
  ]);

  const team =
    existingTeam ??
    (existingUserCount === 0
      ? await prisma.team.create({
          data: {
            id: "demo-team-alpha",
            organizationId: organization.id,
            departmentId: department.id,
            name: "Team Alpha",
          },
        })
      : null);

  if (team) {
    await prisma.team.update({
      where: {
        id: team.id,
      },
      data: {
        departmentId: department.id,
      },
    });
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "UserTeamMembership" (
      "userId" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserTeamMembership_pkey" PRIMARY KEY ("userId", "teamId")
    )
  `;

  const users = [
    {
      email: "admin@demo.local",
      firstName: "Ada",
      lastName: "Admin",
      role: Role.ADMIN,
    },
    {
      email: "ceo@demo.local",
      firstName: "Gina",
      lastName: "Geschäftsführung",
      role: Role.GESCHAEFTSFUEHRER,
    },
    {
      email: "lead@demo.local",
      firstName: "Lars",
      lastName: "Führungskraft",
      role: Role.FUEHRUNGSKRAFT,
    },
    {
      email: "mia@demo.local",
      firstName: "Mia",
      lastName: "Mitarbeiterin",
      role: Role.MITARBEITER,
    },
    {
      email: "max@demo.local",
      firstName: "Max",
      lastName: "Mitarbeiter",
      role: Role.MITARBEITER,
    },
  ];

  const createdUsers = await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: {
          organizationId_email: {
            organizationId: organization.id,
            email: user.email,
          },
        },
        update: {
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          departmentId: department.id,
        },
        create: {
          ...user,
          organizationId: organization.id,
          passwordHash: "demo",
          departmentId: department.id,
          teamId: team?.id ?? null,
        },
      })
    )
  );

  const organizationUsers = await prisma.user.findMany({
    where: {
      organizationId: organization.id,
      isActive: true,
    },
    orderBy: [
      {
        role: "asc",
      },
      {
        firstName: "asc",
      },
    ],
  });

  for (const organizationUser of organizationUsers) {
    if (!organizationUser.teamId) continue;

    const existingMemberships = await prisma.$queryRaw<Array<{ teamId: string }>>`
      SELECT "teamId" FROM "UserTeamMembership" WHERE "userId" = ${organizationUser.id}
    `;

    if (existingMemberships.length === 0) {
      await prisma.$executeRaw`
        INSERT INTO "UserTeamMembership" ("userId", "teamId")
        VALUES (${organizationUser.id}, ${organizationUser.teamId})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  const currentUser =
    createdUsers.find((user) => user.role === Role.ADMIN) ??
    organizationUsers.find((user) => user.role === Role.ADMIN) ??
    organizationUsers[0];

  return {
    organization,
    department,
    team,
    users: organizationUsers,
    user: currentUser,
  };
}

