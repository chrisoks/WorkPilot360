import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSessionUser } from "@/lib/auth/session";

function roleLabel(role: string) {
  if (role === "GESCHAEFTSFUEHRER") return "Gesch\u00e4ftsf\u00fchrung";
  if (role === "FUEHRUNGSKRAFT") return "F\u00fchrungskraft";
  if (role === "VERTRIEB") return "Vertrieb";
  if (role === "BUCHHALTUNG") return "Buchhaltung";
  if (role === "MITARBEITER") return "Mitarbeiter";
  if (role === "GAST") return "Gast";
  return "Admin";
}

async function getUserTeamIds(userId: string) {
  const memberships = await prisma.$queryRaw<Array<{ teamId: string }>>`
    SELECT "teamId" FROM "UserTeamMembership" WHERE "userId" = ${userId}
  `;

  return memberships.map((membership) => membership.teamId);
}

export async function GET(req: Request) {
  const user = await getAuthenticatedSessionUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      email: user.email,
      role: user.role,
      roleLabel: roleLabel(user.role),
      teamId: user.teamId,
      teamIds: await getUserTeamIds(user.id),
      dailyWorkHours: user.dailyWorkHours ?? 8,
      profileImageDataUrl: user.profileImageDataUrl ?? "",
      personalNumber: user.personalNumber ?? "",
    },
  });
}
