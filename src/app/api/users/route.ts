import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

const bcrypt = require("bcryptjs") as {
  hashSync(password: string, saltRounds: number): string;
};

const defaultWeeklyCapacity = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
};

const defaultPlanningTimeWindows = Object.fromEntries(
  Object.keys(defaultWeeklyCapacity).map((day) => [day, { start: "08:00", end: "17:00" }])
);
const defaultPlanningBreakWindows = Object.fromEntries(
  Object.keys(defaultWeeklyCapacity).map((day) => [
    day,
    day === "saturday" || day === "sunday"
      ? { start: "", end: "" }
      : { start: "12:00", end: "12:30" },
  ])
);

const defaultMailAccount = {
  provider: "microsoft365",
  status: "not_connected",
  email: "",
  displayName: "",
  bcc: "",
  sendCopyToSelf: true,
  connectedAt: "",
  lastTestAt: "",
};

const planningGroupsByBoard: Record<string, string[]> = {
  "OK solutions": ["Marketing", "Arb.Sich.", "HR"],
  "OK immocare": ["VZK", "TZK"],
};

type BranchAllocations = {
  okSolutions: number;
  okImmocare: number;
  okImmocareVzk?: number;
  okImmocareTzk?: number;
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

function roundAllocation(value: number) {
  return Math.round(value * 100) / 100;
}

function defaultBranchAllocations(planningBoard?: string | null): BranchAllocations {
  return planningBoard === "OK immocare"
    ? { okSolutions: 0, okImmocare: 100, okImmocareVzk: 100, okImmocareTzk: 0 }
    : { okSolutions: 100, okImmocare: 0, okImmocareVzk: 0, okImmocareTzk: 0 };
}

function parseBranchAllocations(value: unknown, planningBoard?: string | null): BranchAllocations {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultBranchAllocations(planningBoard);
  }

  const input = value as Record<string, unknown>;
  const okSolutions = Number(input.okSolutions ?? 0);
  const legacyImmocare = Number(input.okImmocare ?? 0);
  const okImmocareVzk = Number(input.okImmocareVzk ?? (planningBoard === "OK immocare" ? legacyImmocare : 0));
  const okImmocareTzk = Number(input.okImmocareTzk ?? 0);
  const safeOkSolutions = Number.isFinite(okSolutions) ? Math.min(Math.max(okSolutions, 0), 100) : 0;
  const safeOkImmocareVzk = Number.isFinite(okImmocareVzk) ? Math.min(Math.max(okImmocareVzk, 0), 100) : 0;
  const safeOkImmocareTzk = Number.isFinite(okImmocareTzk) ? Math.min(Math.max(okImmocareTzk, 0), 100) : 0;
  const safeOkImmocare = Math.min(safeOkImmocareVzk + safeOkImmocareTzk, 100);
  const total = safeOkSolutions + safeOkImmocare;

  if (total <= 0) {
    return defaultBranchAllocations(planningBoard);
  }

  if (Math.abs(total - 100) > 0.01) {
    const normalizedOkSolutions = roundAllocation((safeOkSolutions / total) * 100);
    const immocareTotal = 100 - normalizedOkSolutions;
    const immocareSourceTotal = safeOkImmocareVzk + safeOkImmocareTzk;
    const normalizedVzk =
      immocareSourceTotal > 0 ? roundAllocation((safeOkImmocareVzk / immocareSourceTotal) * immocareTotal) : immocareTotal;
    return {
      okSolutions: normalizedOkSolutions,
      okImmocare: roundAllocation(immocareTotal),
      okImmocareVzk: normalizedVzk,
      okImmocareTzk: roundAllocation(immocareTotal - normalizedVzk),
    };
  }

  return {
    okSolutions: roundAllocation(safeOkSolutions),
    okImmocare: roundAllocation(safeOkImmocare),
    okImmocareVzk: roundAllocation(safeOkImmocareVzk),
    okImmocareTzk: roundAllocation(safeOkImmocareTzk),
  };
}

function formatUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive?: boolean | null;
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
  planningBoard?: string | null;
  planningGroup?: string | null;
  weeklyCapacity?: Prisma.JsonValue | null;
  planningStartTime?: string | null;
  planningEndTime?: string | null;
  planningTimeWindows?: Prisma.JsonValue | null;
  planningBreakWindows?: Prisma.JsonValue | null;
  planningResponsibleFor?: Prisma.JsonValue | null;
  branchAllocations?: Prisma.JsonValue | null;
  includeInLaborCostRate?: boolean | null;
  notifyIdeaStore?: boolean | null;
  notifyUpsell?: boolean | null;
  mailAccount?: Prisma.JsonValue | null;
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
    isActive: user.isActive ?? true,
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
    planningBoard: user.planningBoard ?? "OK solutions",
    planningGroup: user.planningGroup ?? "Marketing",
    weeklyCapacity: parseWeeklyCapacity(user.weeklyCapacity),
    planningStartTime: user.planningStartTime ?? "08:00",
    planningEndTime: user.planningEndTime ?? "17:00",
    planningTimeWindows: parsePlanningTimeWindows(
      user.planningTimeWindows,
      user.planningStartTime ?? "08:00",
      user.planningEndTime ?? "17:00"
    ),
    planningBreakWindows: parsePlanningBreakWindows(user.planningBreakWindows),
    planningResponsibleFor: parsePlanningResponsibleFor(user.planningResponsibleFor),
    branchAllocations: parseBranchAllocations(user.branchAllocations, user.planningBoard),
    includeInLaborCostRate: user.includeInLaborCostRate ?? true,
    notifyIdeaStore: user.notifyIdeaStore ?? true,
    notifyUpsell: user.notifyUpsell ?? false,
    mailAccount: parseMailAccount(user.mailAccount, user.email),
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

function parsePlanningBoard(value: unknown) {
  const text = parseText(value);
  return Object.keys(planningGroupsByBoard).includes(text) ? text : "OK solutions";
}

function parsePlanningGroup(board: string, value: unknown) {
  const text = parseText(value);
  const groups = planningGroupsByBoard[board] ?? planningGroupsByBoard["OK solutions"];
  return groups.includes(text) ? text : groups[0];
}

function parseWeeklyCapacity(value: unknown) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return Object.fromEntries(
    Object.entries(defaultWeeklyCapacity).map(([day, fallback]) => {
      const hours = Number(source[day]);
      return [day, Number.isFinite(hours) && hours >= 0 ? hours : fallback];
    })
  );
}

function parsePlanningTime(value: unknown, fallback: string) {
  const text = parseText(value);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function parseOptionalPlanningTime(value: unknown) {
  const text = parseText(value);
  return !text || /^\d{2}:\d{2}$/.test(text) ? text : "";
}

function parsePlanningTimeWindows(value: unknown, fallbackStart = "08:00", fallbackEnd = "17:00") {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return Object.fromEntries(
    Object.keys(defaultWeeklyCapacity).map((day) => {
      const entry =
        source[day] && typeof source[day] === "object" && !Array.isArray(source[day])
          ? (source[day] as Record<string, unknown>)
          : {};

      return [
        day,
        {
          start: parsePlanningTime(entry.start, fallbackStart),
          end: parsePlanningTime(entry.end, fallbackEnd),
        },
      ];
    })
  );
}

function parsePlanningBreakWindows(value: unknown) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return Object.fromEntries(
    Object.keys(defaultWeeklyCapacity).map((day) => {
      const fallback = defaultPlanningBreakWindows[day] as { start: string; end: string };
      const entry =
        source[day] && typeof source[day] === "object" && !Array.isArray(source[day])
          ? (source[day] as Record<string, unknown>)
          : {};

      return [
        day,
        {
          start: parseOptionalPlanningTime(entry.start) || fallback.start,
          end: parseOptionalPlanningTime(entry.end) || fallback.end,
        },
      ];
    })
  );
}

function parsePlanningResponsibleFor(value: unknown) {
  if (!Array.isArray(value)) return [];

  const validKeys = new Set(
    Object.entries(planningGroupsByBoard).flatMap(([board, groups]) =>
      groups.map((group) => `${board}:${group}`)
    )
  );

  return value
    .map((entry) => parseText(entry))
    .filter((entry, index, entries) => validKeys.has(entry) && entries.indexOf(entry) === index);
}

function parseMailAccount(value: unknown, fallbackEmail = "") {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const status =
    source.status === "connected" || source.status === "expired" || source.status === "not_connected"
      ? source.status
      : "not_connected";

  return {
    ...defaultMailAccount,
    provider: "microsoft365",
    status,
    email: parseText(source.email) || fallbackEmail,
    displayName: parseText(source.displayName),
    bcc: parseText(source.bcc),
    sendCopyToSelf: source.sendCopyToSelf !== false,
    connectedAt: parseText(source.connectedAt),
    lastTestAt: parseText(source.lastTestAt),
  };
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
    ADD COLUMN IF NOT EXISTS "signatureHidden" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "planningBoard" TEXT,
    ADD COLUMN IF NOT EXISTS "planningGroup" TEXT,
    ADD COLUMN IF NOT EXISTS "weeklyCapacity" JSONB DEFAULT '{"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":8,"saturday":0,"sunday":0}'::jsonb,
    ADD COLUMN IF NOT EXISTS "planningStartTime" TEXT DEFAULT '08:00',
    ADD COLUMN IF NOT EXISTS "planningEndTime" TEXT DEFAULT '17:00',
    ADD COLUMN IF NOT EXISTS "planningTimeWindows" JSONB DEFAULT '{"monday":{"start":"08:00","end":"17:00"},"tuesday":{"start":"08:00","end":"17:00"},"wednesday":{"start":"08:00","end":"17:00"},"thursday":{"start":"08:00","end":"17:00"},"friday":{"start":"08:00","end":"17:00"},"saturday":{"start":"08:00","end":"17:00"},"sunday":{"start":"08:00","end":"17:00"}}'::jsonb,
    ADD COLUMN IF NOT EXISTS "planningBreakWindows" JSONB DEFAULT '{"monday":{"start":"12:00","end":"12:30"},"tuesday":{"start":"12:00","end":"12:30"},"wednesday":{"start":"12:00","end":"12:30"},"thursday":{"start":"12:00","end":"12:30"},"friday":{"start":"12:00","end":"12:30"},"saturday":{"start":"","end":""},"sunday":{"start":"","end":""}}'::jsonb,
    ADD COLUMN IF NOT EXISTS "planningResponsibleFor" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "branchAllocations" JSONB,
    ADD COLUMN IF NOT EXISTS "includeInLaborCostRate" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "notifyIdeaStore" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "notifyUpsell" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "mailAccount" JSONB DEFAULT '{}'::jsonb
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
  planningBoard: string;
  planningGroup: string;
  weeklyCapacity: Record<string, number>;
  planningStartTime: string;
  planningEndTime: string;
  planningTimeWindows: Record<string, { start: string; end: string }>;
  planningBreakWindows: Record<string, { start: string; end: string }>;
  planningResponsibleFor: string[];
  branchAllocations: BranchAllocations;
  includeInLaborCostRate: boolean;
  notifyIdeaStore: boolean;
  notifyUpsell: boolean;
  mailAccount: ReturnType<typeof parseMailAccount>;
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
      planningBoard: string | null;
      planningGroup: string | null;
      weeklyCapacity: Prisma.JsonValue | null;
      planningStartTime: string | null;
      planningEndTime: string | null;
      planningTimeWindows: Prisma.JsonValue | null;
      planningBreakWindows: Prisma.JsonValue | null;
      planningResponsibleFor: Prisma.JsonValue | null;
      branchAllocations: Prisma.JsonValue | null;
      includeInLaborCostRate: boolean | null;
      notifyIdeaStore: boolean | null;
      notifyUpsell: boolean | null;
      mailAccount: Prisma.JsonValue | null;
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
      "signatureHidden",
      "planningBoard",
      "planningGroup",
      "weeklyCapacity",
      "planningStartTime",
      "planningEndTime",
      "planningTimeWindows",
      "planningBreakWindows",
      "planningResponsibleFor",
      "branchAllocations",
      "includeInLaborCostRate",
      "notifyIdeaStore",
      "notifyUpsell",
      "mailAccount"
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
        planningBoard: row.planningBoard ?? "OK solutions",
        planningGroup: row.planningGroup ?? "Marketing",
        weeklyCapacity: parseWeeklyCapacity(row.weeklyCapacity),
        planningStartTime: row.planningStartTime ?? "08:00",
        planningEndTime: row.planningEndTime ?? "17:00",
        planningTimeWindows: parsePlanningTimeWindows(
          row.planningTimeWindows,
          row.planningStartTime ?? "08:00",
          row.planningEndTime ?? "17:00"
        ),
        planningBreakWindows: parsePlanningBreakWindows(row.planningBreakWindows),
        planningResponsibleFor: parsePlanningResponsibleFor(row.planningResponsibleFor),
        branchAllocations: parseBranchAllocations(row.branchAllocations, row.planningBoard),
        includeInLaborCostRate: row.includeInLaborCostRate ?? true,
        notifyIdeaStore: row.notifyIdeaStore ?? true,
        notifyUpsell: row.notifyUpsell ?? false,
        mailAccount: parseMailAccount(row.mailAccount, ""),
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
  const { organization } = await getDemoContext();
  const users = await prisma.user.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        role: "asc",
      },
      {
        firstName: "asc",
      },
    ],
  });
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

  if (body.action === "set-active") {
    if (!isManagedUpdate) {
      return NextResponse.json(
        { error: "Nur Admins und Geschäftsführung dürfen Mitarbeiter aktivieren oder deaktivieren." },
        { status: 403 }
      );
    }

    if (body.userId === actor.id && body.isActive === false) {
      return NextResponse.json(
        { error: "Der aktive Nutzer kann sich nicht selbst deaktivieren." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: body.userId,
        organizationId: organization.id,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Benutzer wurde nicht gefunden." }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        isActive: Boolean(body.isActive),
      },
    });
    const updatedTeamIds = await getUserTeamIds(updated.id);

    return NextResponse.json(
      formatUser(
        {
          ...updated,
          ...(await getUserDetails([updated.id])).get(updated.id),
        },
        updatedTeamIds
      )
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
  const hasPlanningBoardUpdate = Object.prototype.hasOwnProperty.call(body, "planningBoard");
  const hasPlanningGroupUpdate = Object.prototype.hasOwnProperty.call(body, "planningGroup");
  const hasWeeklyCapacityUpdate = Object.prototype.hasOwnProperty.call(body, "weeklyCapacity");
  const hasPlanningStartTimeUpdate = Object.prototype.hasOwnProperty.call(body, "planningStartTime");
  const hasPlanningEndTimeUpdate = Object.prototype.hasOwnProperty.call(body, "planningEndTime");
  const hasPlanningTimeWindowsUpdate = Object.prototype.hasOwnProperty.call(body, "planningTimeWindows");
  const hasPlanningBreakWindowsUpdate = Object.prototype.hasOwnProperty.call(body, "planningBreakWindows");
  const hasPlanningResponsibleForUpdate = Object.prototype.hasOwnProperty.call(body, "planningResponsibleFor");
  const hasBranchAllocationsUpdate = Object.prototype.hasOwnProperty.call(body, "branchAllocations");
  const hasIncludeInLaborCostRateUpdate = Object.prototype.hasOwnProperty.call(body, "includeInLaborCostRate");
  const hasNotifyIdeaStoreUpdate = Object.prototype.hasOwnProperty.call(body, "notifyIdeaStore");
  const hasNotifyUpsellUpdate = Object.prototype.hasOwnProperty.call(body, "notifyUpsell");
  const hasMailAccountUpdate = Object.prototype.hasOwnProperty.call(body, "mailAccount");
  const nextBirthDate = parseBirthDate(body.birthDate);
  const nextPlanningBoard = parsePlanningBoard(body.planningBoard);
  const nextPlanningGroup = parsePlanningGroup(nextPlanningBoard, body.planningGroup);
  const nextWeeklyCapacity = parseWeeklyCapacity(body.weeklyCapacity);
  const nextPlanningStartTime = parsePlanningTime(body.planningStartTime, "08:00");
  const nextPlanningEndTime = parsePlanningTime(body.planningEndTime, "17:00");
  const nextPlanningTimeWindows = parsePlanningTimeWindows(
    body.planningTimeWindows,
    nextPlanningStartTime,
    nextPlanningEndTime
  );
  const nextPlanningBreakWindows = parsePlanningBreakWindows(body.planningBreakWindows);
  const nextPlanningResponsibleFor = parsePlanningResponsibleFor(body.planningResponsibleFor);
  const nextBranchAllocations = parseBranchAllocations(body.branchAllocations, nextPlanningBoard);
  const nextMailAccount = parseMailAccount(body.mailAccount, body.email);
  const existingMailRows = await prisma.$queryRaw<Array<{ mailAccount: Prisma.JsonValue | null }>>`
    SELECT "mailAccount" FROM "User" WHERE id = ${updated.id} LIMIT 1
  `;
  const existingMailAccount =
    existingMailRows[0]?.mailAccount &&
    typeof existingMailRows[0].mailAccount === "object" &&
    !Array.isArray(existingMailRows[0].mailAccount)
      ? (existingMailRows[0].mailAccount as Record<string, unknown>)
      : {};
  const mergedMailAccount =
    nextMailAccount.status === "connected"
      ? {
          ...existingMailAccount,
          ...nextMailAccount,
        }
      : {
          ...nextMailAccount,
          accessToken: undefined,
          refreshToken: undefined,
          expiresAt: undefined,
          microsoftUserId: undefined,
        };

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
      "planningBoard" = CASE
        WHEN ${hasPlanningBoardUpdate} THEN ${nextPlanningBoard}
        ELSE "planningBoard"
      END,
      "planningGroup" = CASE
        WHEN ${hasPlanningGroupUpdate} THEN ${nextPlanningGroup}
        ELSE "planningGroup"
      END,
      "weeklyCapacity" = CASE
        WHEN ${hasWeeklyCapacityUpdate} THEN ${JSON.stringify(nextWeeklyCapacity)}::jsonb
        ELSE "weeklyCapacity"
      END,
      "planningStartTime" = CASE
        WHEN ${hasPlanningStartTimeUpdate} THEN ${nextPlanningStartTime}
        ELSE "planningStartTime"
      END,
      "planningEndTime" = CASE
        WHEN ${hasPlanningEndTimeUpdate} THEN ${nextPlanningEndTime}
        ELSE "planningEndTime"
      END,
      "planningTimeWindows" = CASE
        WHEN ${hasPlanningTimeWindowsUpdate} THEN ${JSON.stringify(nextPlanningTimeWindows)}::jsonb
        ELSE "planningTimeWindows"
      END,
      "planningBreakWindows" = CASE
        WHEN ${hasPlanningBreakWindowsUpdate} THEN ${JSON.stringify(nextPlanningBreakWindows)}::jsonb
        ELSE "planningBreakWindows"
      END,
      "planningResponsibleFor" = CASE
        WHEN ${hasPlanningResponsibleForUpdate} THEN ${JSON.stringify(nextPlanningResponsibleFor)}::jsonb
        ELSE "planningResponsibleFor"
      END,
      "branchAllocations" = CASE
        WHEN ${hasBranchAllocationsUpdate} THEN ${JSON.stringify(nextBranchAllocations)}::jsonb
        ELSE "branchAllocations"
      END,
      "includeInLaborCostRate" = CASE
        WHEN ${hasIncludeInLaborCostRateUpdate} THEN ${Boolean(body.includeInLaborCostRate)}
        ELSE "includeInLaborCostRate"
      END,
      "notifyIdeaStore" = CASE
        WHEN ${hasNotifyIdeaStoreUpdate} THEN ${Boolean(body.notifyIdeaStore)}
        ELSE "notifyIdeaStore"
      END,
      "notifyUpsell" = CASE
        WHEN ${hasNotifyUpsellUpdate} THEN ${Boolean(body.notifyUpsell)}
        ELSE "notifyUpsell"
      END,
      "mailAccount" = CASE
        WHEN ${hasMailAccountUpdate} THEN ${JSON.stringify(mergedMailAccount)}::jsonb
        ELSE "mailAccount"
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
  const planningBoard = parsePlanningBoard(body.planningBoard);
  const planningGroup = parsePlanningGroup(planningBoard, body.planningGroup);
  const weeklyCapacity = parseWeeklyCapacity(body.weeklyCapacity);
  const planningStartTime = parsePlanningTime(body.planningStartTime, "08:00");
  const planningEndTime = parsePlanningTime(body.planningEndTime, "17:00");
  const planningTimeWindows = parsePlanningTimeWindows(
    body.planningTimeWindows,
    planningStartTime,
    planningEndTime
  );
  const planningBreakWindows = parsePlanningBreakWindows(body.planningBreakWindows);
  const planningResponsibleFor = parsePlanningResponsibleFor(body.planningResponsibleFor);
  const branchAllocations = parseBranchAllocations(body.branchAllocations, planningBoard);
  const includeInLaborCostRate = body.includeInLaborCostRate !== false;
  const notifyIdeaStore = body.notifyIdeaStore !== false;
  const notifyUpsell = body.notifyUpsell === true;
  const mailAccount = parseMailAccount(body.mailAccount, body.email);
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
      "signatureHidden" = ${Boolean(body.signatureHidden)},
      "planningBoard" = ${planningBoard},
      "planningGroup" = ${planningGroup},
      "weeklyCapacity" = ${JSON.stringify(weeklyCapacity)}::jsonb,
      "planningStartTime" = ${planningStartTime},
      "planningEndTime" = ${planningEndTime},
      "planningTimeWindows" = ${JSON.stringify(planningTimeWindows)}::jsonb,
      "planningBreakWindows" = ${JSON.stringify(planningBreakWindows)}::jsonb,
      "planningResponsibleFor" = ${JSON.stringify(planningResponsibleFor)}::jsonb,
      "branchAllocations" = ${JSON.stringify(branchAllocations)}::jsonb,
      "includeInLaborCostRate" = ${includeInLaborCostRate},
      "notifyIdeaStore" = ${notifyIdeaStore},
      "notifyUpsell" = ${notifyUpsell},
      "mailAccount" = ${JSON.stringify(mailAccount)}::jsonb
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
        planningBoard,
        planningGroup,
        weeklyCapacity,
        planningStartTime,
        planningEndTime,
        planningTimeWindows,
        planningBreakWindows,
        planningResponsibleFor,
        branchAllocations,
        includeInLaborCostRate,
        notifyIdeaStore,
        notifyUpsell,
        mailAccount,
      },
      teamIds
    ),
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
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

  const targetUser = await prisma.user.findFirst({
    where: {
      id: body.userId,
      organizationId: organization.id,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Benutzer wurde nicht gefunden." }, { status: 404 });
  }

  await prisma.user.update({
    where: {
      id: targetUser.id,
    },
    data: {
      isActive: false,
    },
  });

  return NextResponse.json({ success: true });
}
