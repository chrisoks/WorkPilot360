import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

const bcrypt = require("bcryptjs") as {
  compareSync(password: string, hash: string): boolean;
};

function roleLabel(role: Role) {
  if (role === Role.GESCHAEFTSFUEHRER) return "Geschäftsführung";
  if (role === Role.FUEHRUNGSKRAFT) return "Führungskraft";
  if (role === Role.MITARBEITER) return "Mitarbeiter";
  if (role === Role.GAST) return "Gast";
  return "Admin";
}

async function ensureUserProfileColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "profileImageDataUrl" TEXT
  `;
}

async function getUserTeamIds(userId: string) {
  const memberships = await prisma.$queryRaw<Array<{ teamId: string }>>`
    SELECT "teamId" FROM "UserTeamMembership" WHERE "userId" = ${userId}
  `;

  return memberships.map((membership) => membership.teamId);
}

export async function POST(req: Request) {
  await ensureUserProfileColumns();
  const body = await req.json();
  const { organization } = await getDemoContext();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: Role;
      teamId: string | null;
      dailyWorkHours: number | null;
      profileImageDataUrl: string | null;
      passwordHash: string;
    }>
  >`
    SELECT
      id,
      "firstName",
      "lastName",
      email,
      role,
      "teamId",
      "dailyWorkHours",
      "profileImageDataUrl",
      "passwordHash"
    FROM "User"
    WHERE "organizationId" = ${organization.id}
      AND LOWER(email) = ${email}
      AND "isActive" = true
    LIMIT 1
  `;

  const user = rows[0];
  const storedPassword = user?.passwordHash || "demo";
  const passwordMatches =
    !!user &&
    (storedPassword === password ||
      (storedPassword.startsWith("$2") && bcrypt.compareSync(password, storedPassword)));

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort ist nicht korrekt." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    teamId: user.teamId,
    teamIds: await getUserTeamIds(user.id),
    dailyWorkHours: user.dailyWorkHours ?? 8,
    profileImageDataUrl: user.profileImageDataUrl ?? "",
  });
}

