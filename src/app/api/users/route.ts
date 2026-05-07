import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

const bcrypt = require("bcryptjs") as {
  hashSync(password: string, saltRounds: number): string;
};

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
  salutation?: string | null;
  birthDate?: Date | string | null;
  language?: string | null;
  phone?: string | null;
  mobile?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  signature?: string | null;
  signatureHidden?: boolean | null;
}, teamIds: string[] = []) {
  const birthDate =
    user.birthDate instanceof Date
      ? user.birthDate.toISOString().slice(0, 10)
      : user.birthDate ?? "";

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
    salutation: user.salutation ?? "Herr",
    birthDate,
    language: user.language ?? "Deutsch (Deutschland)",
    phone: user.phone ?? "",
    mobile: user.mobile ?? "",
    street: user.street ?? "",
    postalCode: user.postalCode ?? "",
    city: user.city ?? "",
    signature: user.signature ?? "",
    signatureHidden: Boolean(user.signatureHidden),
  };
}

function parseDailyWorkHours(value: unknown) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return 8;
  return hours;
}

function parsePassword(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBirthDate(value: unknown) {
  const text = parseText(value);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
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
    ADD COLUMN IF NOT EXISTS "profileImageDataUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "salutation" TEXT,
    ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "language" TEXT,
    ADD COLUMN IF NOT EXISTS "phone" TEXT,
    ADD COLUMN IF NOT EXISTS "mobile" TEXT,
    ADD COLUMN IF NOT EXISTS "street" TEXT,
    ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
    ADD COLUMN IF NOT EXISTS "city" TEXT,
    ADD COLUMN IF NOT EXISTS "signature" TEXT,
    ADD COLUMN IF NOT EXISTS "signatureHidden" BOOLEAN DEFAULT false
  `;
}

type UserDetails = {
  profileImageDataUrl: string;
  salutation: string;
  birthDate: string;
  language: string;
  phone: string;
  mobile: string;
  street: string;
  postalCode: string;
  city: string;
  signature: string;
  signatureHidden: boolean;
};

async function getUserDetails(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, UserDetails>();

  await ensureUserProfileColumns();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      profileImageDataUrl: string | null;
      salutation: string | null;
      birthDate: Date | null;
      language: string | null;
      phone: string | null;
      mobile: string | null;
      street: string | null;
      postalCode: string | null;
      city: string | null;
      signature: string | null;
      signatureHidden: boolean | null;
    }>
  >`
    SELECT
      id,
      "profileImageDataUrl",
      "salutation",
      "birthDate",
      "language",
      "phone",
      "mobile",
      "street",
      "postalCode",
      "city",
      "signature",
      "signatureHidden"
    FROM "User"
    WHERE id IN (${Prisma.join(userIds)})
  `;

  return new Map(
    rows.map((row) => [
      row.id,
      {
        profileImageDataUrl: row.profileImageDataUrl ?? "",
        salutation: row.salutation ?? "Herr",
        birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : "",
        language: row.language ?? "Deutsch (Deutschland)",
        phone: row.phone ?? "",
        mobile: row.mobile ?? "",
        street: row.street ?? "",
        postalCode: row.postalCode ?? "",
        city: row.city ?? "",
        signature: row.signature ?? "",
        signatureHidden: Boolean(row.signatureHidden),
      },
    ])
  );
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
  const detailsByUserId = await getUserDetails(users.map((user) => user.id));

  return NextResponse.json(
    await Promise.all(
      users.map(async (user) =>
        formatUser(
          {
            ...user,
            dailyWorkHours: dailyWorkHoursByUserId.get(user.id) ?? 8,
            ...(detailsByUserId.get(user.id) ?? {}),
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
  const isManagedUpdate = canManageUsers(actor.role);

  if (!isManagedUpdate && !isSelfUpdate) {
    return NextResponse.json(
      { error: "Du darfst nur deine eigenen Einstellungen ändern." },
      { status: 403 }
    );
  }

  if (isManagedUpdate && !Object.values(Role).includes(body.role)) {
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
      role: isManagedUpdate ? body.role : existingUser.role,
      teamId: isManagedUpdate ? primaryTeamId : existingUser.teamId,
      departmentId: department.id,
    },
  });

  if (updated.organizationId !== organization.id) {
    return NextResponse.json(
      { error: "Benutzer gehört nicht zur Demo-Organisation." },
      { status: 403 }
    );
  }

  if (isManagedUpdate) {
    await setUserTeams(updated.id, teamIds);
  }

  const updatedTeamIds = isManagedUpdate ? teamIds : await getUserTeamIds(updated.id);
  const nextPassword = parsePassword(body.password);
  if (nextPassword && nextPassword.length < 4) {
    return NextResponse.json(
      { error: "Bitte ein Passwort mit mindestens 4 Zeichen vergeben." },
      { status: 400 }
    );
  }
  const nextPasswordHash = nextPassword ? bcrypt.hashSync(nextPassword, 10) : "";
  const hasProfileImageUpdate = Object.prototype.hasOwnProperty.call(body, "profileImageDataUrl");
  const nextProfileImageDataUrl =
    hasProfileImageUpdate && typeof body.profileImageDataUrl === "string"
      ? body.profileImageDataUrl
      : "";
  const hasSalutationUpdate = Object.prototype.hasOwnProperty.call(body, "salutation");
  const hasBirthDateUpdate = Object.prototype.hasOwnProperty.call(body, "birthDate");
  const hasLanguageUpdate = Object.prototype.hasOwnProperty.call(body, "language");
  const hasPhoneUpdate = Object.prototype.hasOwnProperty.call(body, "phone");
  const hasMobileUpdate = Object.prototype.hasOwnProperty.call(body, "mobile");
  const hasStreetUpdate = Object.prototype.hasOwnProperty.call(body, "street");
  const hasPostalCodeUpdate = Object.prototype.hasOwnProperty.call(body, "postalCode");
  const hasCityUpdate = Object.prototype.hasOwnProperty.call(body, "city");
  const hasSignatureUpdate = Object.prototype.hasOwnProperty.call(body, "signature");
  const hasSignatureHiddenUpdate = Object.prototype.hasOwnProperty.call(body, "signatureHidden");
  const nextBirthDate = parseBirthDate(body.birthDate);

  await prisma.$executeRaw`
    UPDATE "User"
    SET
      "dailyWorkHours" = ${parseDailyWorkHours(body.dailyWorkHours)},
      "salutation" = CASE
        WHEN ${hasSalutationUpdate} THEN ${parseText(body.salutation) || null}
        ELSE "salutation"
      END,
      "birthDate" = CASE
        WHEN ${hasBirthDateUpdate} THEN ${nextBirthDate}
        ELSE "birthDate"
      END,
      "language" = CASE
        WHEN ${hasLanguageUpdate} THEN ${parseText(body.language) || "Deutsch (Deutschland)"}
        ELSE "language"
      END,
      "phone" = CASE
        WHEN ${hasPhoneUpdate} THEN ${parseText(body.phone) || null}
        ELSE "phone"
      END,
      "mobile" = CASE
        WHEN ${hasMobileUpdate} THEN ${parseText(body.mobile) || null}
        ELSE "mobile"
      END,
      "street" = CASE
        WHEN ${hasStreetUpdate} THEN ${parseText(body.street) || null}
        ELSE "street"
      END,
      "postalCode" = CASE
        WHEN ${hasPostalCodeUpdate} THEN ${parseText(body.postalCode) || null}
        ELSE "postalCode"
      END,
      "city" = CASE
        WHEN ${hasCityUpdate} THEN ${parseText(body.city) || null}
        ELSE "city"
      END,
      "signature" = CASE
        WHEN ${hasSignatureUpdate} THEN ${typeof body.signature === "string" ? body.signature : ""}
        ELSE "signature"
      END,
      "signatureHidden" = CASE
        WHEN ${hasSignatureHiddenUpdate} THEN ${Boolean(body.signatureHidden)}
        ELSE "signatureHidden"
      END,
      "profileImageDataUrl" = CASE
        WHEN ${hasProfileImageUpdate} THEN ${nextProfileImageDataUrl || null}
        ELSE "profileImageDataUrl"
      END,
      "passwordHash" = CASE
        WHEN ${nextPasswordHash} = '' THEN "passwordHash"
        ELSE ${nextPasswordHash}
      END
    WHERE id = ${updated.id}
  `;

  const detailsByUserId = await getUserDetails([updated.id]);

  return NextResponse.json(
    formatUser(
      {
        ...updated,
        dailyWorkHours: parseDailyWorkHours(body.dailyWorkHours),
        ...(detailsByUserId.get(updated.id) ?? {}),
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

  const password = parsePassword(body.password);
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Bitte ein Passwort mit mindestens 4 Zeichen vergeben." },
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
  const profileImageDataUrl =
    typeof body.profileImageDataUrl === "string" ? body.profileImageDataUrl : "";
  const birthDate = parseBirthDate(body.birthDate);
  const created = await prisma.user.create({
    data: {
      organizationId: organization.id,
      firstName: name.firstName,
      lastName: name.lastName,
      email: body.email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: body.role,
      teamId: primaryTeamId,
      departmentId: department.id,
    },
  });

  await setUserTeams(created.id, teamIds);
  await prisma.$executeRaw`
    UPDATE "User"
    SET
      "dailyWorkHours" = ${parseDailyWorkHours(body.dailyWorkHours)},
      "profileImageDataUrl" = ${profileImageDataUrl || null},
      "salutation" = ${parseText(body.salutation) || null},
      "birthDate" = ${birthDate},
      "language" = ${parseText(body.language) || "Deutsch (Deutschland)"},
      "phone" = ${parseText(body.phone) || null},
      "mobile" = ${parseText(body.mobile) || null},
      "street" = ${parseText(body.street) || null},
      "postalCode" = ${parseText(body.postalCode) || null},
      "city" = ${parseText(body.city) || null},
      "signature" = ${typeof body.signature === "string" ? body.signature : ""},
      "signatureHidden" = ${Boolean(body.signatureHidden)}
    WHERE id = ${created.id}
  `;

  return NextResponse.json(
    formatUser(
      {
        ...created,
        dailyWorkHours: parseDailyWorkHours(body.dailyWorkHours),
        profileImageDataUrl,
        salutation: parseText(body.salutation) || "Herr",
        birthDate: body.birthDate ?? "",
        language: parseText(body.language) || "Deutsch (Deutschland)",
        phone: parseText(body.phone),
        mobile: parseText(body.mobile),
        street: parseText(body.street),
        postalCode: parseText(body.postalCode),
        city: parseText(body.city),
        signature: typeof body.signature === "string" ? body.signature : "",
        signatureHidden: Boolean(body.signatureHidden),
      },
      teamIds
    ),
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
