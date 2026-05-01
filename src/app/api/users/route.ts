import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

function canManageUsers(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

function roleLabel(role: Role) {
  if (role === Role.GESCHAEFTSFUEHRER) return "Gesch\u00e4ftsf\u00fchrung";
  if (role === Role.FUEHRUNGSKRAFT) return "F\u00fchrungskraft";
  if (role === Role.MITARBEITER) return "Mitarbeiter";
  if (role === Role.GAST) return "Gast";
  return "Admin";
}

function formatUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  teamId: string | null;
  dailyWorkHours?: number | null;
  profileImageDataUrl?: string | null;
}, teamIds: string[] = []) {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    teamId: user.teamId,
    teamIds,
    dailyWorkHours: user.dailyWorkHours ?? 8,
    profileImageDataUrl: user.profileImageDataUrl ?? "",
  };
}

function parseDailyWorkHours(value: unknown) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return 8;
  return hours;
}

async function getUserTeamIds(userId: string) {
  const memberships = await prisma.$queryRaw<Array<{ teamId: string }>>`
    SELECT "teamId" FROM "UserTeamMembership" WHERE "userId" = ${userId}
  `;

  return memberships.map((membership) => membership.teamId);
}

async function getUserDailyWorkHours(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, number>();

  const rows = await prisma.$queryRaw<Array<{ id: string; dailyWorkHours: number }>>`
    SELECT id, "dailyWorkHours" FROM "User" WHERE id IN (${Prisma.join(userIds)})
  `;

  return new Map(rows.map((row) => [row.id, row.dailyWorkHours]));
}

async function ensureUserProfileColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "profileImageDataUrl" TEXT
  `;
}

async function getUserProfileImages(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();

  await ensureUserProfileColumns();

  const rows = await prisma.$queryRaw<Array<{ id: string; profileImageDataUrl: string | null }>>`
    SELECT id, "profileImageDataUrl" FROM "User" WHERE id IN (${Prisma.join(userIds)})
  `;

  return new Map(rows.map((row) => [row.id, row.profileImageDataUrl ?? ""]));
}

async function setUserTeams(userId: string, teamIds: string[]) {
  await prisma.$executeRaw`
    DELETE FROM "UserTeamMembership" WHERE "userId" = ${userId}
  `;

  for (const teamId of teamIds) {
    await prisma.$executeRaw`
      INSERT INTO "UserTeamMembership" ("userId", "teamId")
      VALUES (${userId}, ${teamId})
      ON CONFLICT DO NOTHING
    `;
  }
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() || "Neuer";
  const lastName = parts.join(" ") || "Benutzer";

  return { firstName, lastName };
}

export async function GET() {
  const { users } = await getDemoContext();
  const dailyWorkHoursByUserId = await getUserDailyWorkHours(users.map((user) => user.id));
  const profileImageByUserId = await getUserProfileImages(users.map((user) => user.id));

  return NextResponse.json(
    await Promise.all(
      users.map(async (user) =>
        formatUser(
          {
            ...user,
            dailyWorkHours: dailyWorkHoursByUserId.get(user.id) ?? 8,
            profileImageDataUrl: profileImageByUserId.get(user.id) ?? "",
          },
          await getUserTeamIds(user.id)
        )
      )
    )
  );
}

export async function PATCH(req: Request) {
  await ensureUserProfileColumns();
  const body = await req.json();
  const { organization, department, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const isSelfUpdate = body.userId === actor.id;

  if (!canManageUsers(actor.role) && !isSelfUpdate) {
    return NextResponse.json(
      { error: "Du darfst nur deine eigenen Einstellungen ändern." },
      { status: 403 }
    );
  }

  if (!isSelfUpdate && !Object.values(Role).includes(body.role)) {
    return NextResponse.json(
      { error: "Die ausgew\u00e4hlte Rolle ist ung\u00fcltig." },
      { status: 400 }
    );
  }

  const name = splitName(body.name ?? "");
  const allTeams = await prisma.team.findMany({
    where: {
      organizationId: organization.id,
    },
    select: {
      id: true,
    },
  });
  const requestedTeamIds = Array.isArray(body.teamIds) ? body.teamIds : [];
  const teamIds = body.allTeams ? allTeams.map((team) => team.id) : requestedTeamIds;
  const primaryTeamId = teamIds[0] ?? null;
  const existingUser = users.find((demoUser) => demoUser.id === body.userId);

  if (!existingUser) {
    return NextResponse.json({ error: "Benutzer wurde nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: {
      id: body.userId,
    },
    data: {
      firstName: name.firstName,
      lastName: name.lastName,
      email: body.email,
      role: isSelfUpdate ? existingUser.role : body.role,
      teamId: isSelfUpdate ? existingUser.teamId : primaryTeamId,
      departmentId: department.id,
    },
  });

  if (updated.organizationId !== organization.id) {
    return NextResponse.json(
      { error: "Benutzer gehört nicht zur Demo-Organisation." },
      { status: 403 }
    );
  }

  if (!isSelfUpdate) {
    await setUserTeams(updated.id, teamIds);
  }

  const updatedTeamIds = isSelfUpdate ? await getUserTeamIds(updated.id) : teamIds;
  const nextPassword = typeof body.password === "string" ? body.password.trim() : "";
  const nextProfileImageDataUrl =
    typeof body.profileImageDataUrl === "string" ? body.profileImageDataUrl : "";

  await prisma.$executeRaw`
    UPDATE "User"
    SET
      "dailyWorkHours" = ${parseDailyWorkHours(body.dailyWorkHours)},
      "profileImageDataUrl" = ${nextProfileImageDataUrl || null},
      "passwordHash" = CASE
        WHEN ${nextPassword} = '' THEN "passwordHash"
        ELSE ${nextPassword}
      END
    WHERE id = ${updated.id}
  `;

  return NextResponse.json(
    formatUser(
      {
        ...updated,
        dailyWorkHours: parseDailyWorkHours(body.dailyWorkHours),
        profileImageDataUrl: nextProfileImageDataUrl,
      },
      updatedTeamIds
    )
  );
}

export async function POST(req: Request) {
  await ensureUserProfileColumns();
  const body = await req.json();
  const { organization, department, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageUsers(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Benutzer anlegen." },
      { status: 403 }
    );
  }

  if (!Object.values(Role).includes(body.role)) {
    return NextResponse.json(
      { error: "Die ausgewählte Rolle ist ungültig." },
      { status: 400 }
    );
  }

  if (!body.email || !body.name) {
    return NextResponse.json(
      { error: "Name und E-Mail sind Pflichtfelder." },
      { status: 400 }
    );
  }

  const name = splitName(body.name);
  const allTeams = await prisma.team.findMany({
    where: {
      organizationId: organization.id,
    },
    select: {
      id: true,
    },
  });
  const requestedTeamIds = Array.isArray(body.teamIds) ? body.teamIds : [];
  const teamIds = body.allTeams ? allTeams.map((team) => team.id) : requestedTeamIds;
  const primaryTeamId = teamIds[0] ?? null;
  const created = await prisma.user.create({
    data: {
      organizationId: organization.id,
      firstName: name.firstName,
      lastName: name.lastName,
      email: body.email,
      passwordHash: "demo",
      role: body.role,
      teamId: primaryTeamId,
      departmentId: department.id,
    },
  });

  await setUserTeams(created.id, teamIds);
  await prisma.$executeRaw`
    UPDATE "User"
    SET "dailyWorkHours" = ${parseDailyWorkHours(body.dailyWorkHours)}
    WHERE id = ${created.id}
  `;

  return NextResponse.json(
    formatUser({ ...created, dailyWorkHours: parseDailyWorkHours(body.dailyWorkHours) }, teamIds),
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageUsers(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Benutzer entfernen." },
      { status: 403 }
    );
  }

  if (body.userId === actor.id) {
    return NextResponse.json(
      { error: "Der aktive Nutzer kann sich nicht selbst entfernen." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: {
      id: body.userId,
    },
    data: {
      isActive: false,
    },
  });

  return NextResponse.json({ success: true });
}
