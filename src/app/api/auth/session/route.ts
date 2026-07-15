import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  authenticateSession,
  createServerSession,
  getRemainingCookieMaxAge,
  getSessionCookieOptions,
  WORKPILOT_SESSION_COOKIE,
} from "@/lib/auth/session";

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
  const authentication = await authenticateSession(req, { rotate: true });
  if (!authentication) {
    return NextResponse.json(
      { authenticated: false, code: "SESSION_EXPIRED", error: "Sitzung ist abgelaufen oder wurde beendet." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  const { user } = authentication;

  const response = NextResponse.json({
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
  response.headers.set("Cache-Control", "no-store");

  if (authentication.legacy) {
    const replacement = await createServerSession(user.id);
    response.cookies.set(
      WORKPILOT_SESSION_COOKIE,
      replacement.token,
      getSessionCookieOptions(getRemainingCookieMaxAge(replacement.absoluteExpiresAt))
    );
  } else if (authentication.replacementToken && authentication.session) {
    response.cookies.set(
      WORKPILOT_SESSION_COOKIE,
      authentication.replacementToken,
      getSessionCookieOptions(getRemainingCookieMaxAge(authentication.session.absoluteExpiresAt))
    );
  }

  return response;
}
