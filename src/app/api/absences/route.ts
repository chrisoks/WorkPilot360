import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type AbsenceType = "urlaub" | "krank";

type AbsenceRow = {
  id: string;
  userId: string;
  userName: string;
  representativeUserId: string | null;
  representativeName: string | null;
  type: AbsenceType;
  date: Date | string;
  note: string | null;
};

function canManageAbsences(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER || role === Role.FUEHRUNGSKRAFT;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAbsence(row: AbsenceRow) {
  const dateKey = row.date instanceof Date ? formatDateKey(row.date) : row.date.slice(0, 10);

  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    representativeUserId: row.representativeUserId,
    representativeName: row.representativeName,
    type: row.type,
    date: dateKey,
    note: row.note ?? "",
  };
}

async function ensureAbsenceTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Absence" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "date" DATE NOT NULL,
      "representativeUserId" TEXT,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Absence_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Absence_userId_date_key" UNIQUE ("userId", "date")
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Absence"
    ADD COLUMN IF NOT EXISTS "representativeUserId" TEXT
  `;
}

export async function GET(req: Request) {
  await ensureAbsenceTable();
  const { organization } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "1900-01-01";
  const to = searchParams.get("to") ?? "2999-12-31";

  const rows = await prisma.$queryRaw<AbsenceRow[]>`
    SELECT
      absences.id,
      absences."userId",
      CONCAT(users."firstName", ' ', users."lastName") as "userName",
      absences."representativeUserId",
      CASE
        WHEN representatives.id IS NULL THEN NULL
        ELSE CONCAT(representatives."firstName", ' ', representatives."lastName")
      END as "representativeName",
      absences.type,
      absences.date,
      absences.note
    FROM "Absence" absences
    INNER JOIN "User" users ON users.id = absences."userId"
    LEFT JOIN "User" representatives ON representatives.id = absences."representativeUserId"
    WHERE absences."organizationId" = ${organization.id}
      AND absences.date >= ${from}::date
      AND absences.date <= ${to}::date
    ORDER BY absences.date ASC, users."firstName" ASC
  `;

  return NextResponse.json(rows.map(formatAbsence));
}

export async function POST(req: Request) {
  await ensureAbsenceTable();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const targetUserId = String(body.userId ?? "");
  const dateFrom = String(body.dateFrom ?? body.date ?? "");
  const dateTo = String(body.dateTo ?? body.date ?? dateFrom);
  const representativeUserId = String(body.representativeUserId ?? "");
  const type = String(body.type ?? "") as AbsenceType;
  const handoverChecklist = Array.isArray(body.handoverChecklist)
    ? body.handoverChecklist.map((item: unknown) => String(item)).filter(Boolean)
    : [];
  const handoverConfirmed = Boolean(body.handoverConfirmed);

  if (!targetUserId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "Bitte Benutzer sowie Datum von und bis ausw\u00e4hlen." },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return NextResponse.json(
      { error: "Bitte ein g\u00fcltiges Datum ausw\u00e4hlen." },
      { status: 400 }
    );
  }

  const startDate = new Date(`${dateFrom}T00:00:00`);
  const endDate = new Date(`${dateTo}T00:00:00`);

  if (startDate.getTime() > endDate.getTime()) {
    return NextResponse.json(
      { error: "Das Bis-Datum darf nicht vor dem Von-Datum liegen." },
      { status: 400 }
    );
  }

  if (type !== "urlaub" && type !== "krank") {
    return NextResponse.json(
      { error: "Bitte Urlaub oder Krank ausw\u00e4hlen." },
      { status: 400 }
    );
  }

  if (type === "urlaub" && (!handoverConfirmed || handoverChecklist.length === 0)) {
    return NextResponse.json(
      { error: "Bitte die Urlaubs\u00fcbergabe vollst\u00e4ndig ausf\u00fcllen und best\u00e4tigen." },
      { status: 400 }
    );
  }

  if (targetUserId !== actor.id && !canManageAbsences(actor.role)) {
    return NextResponse.json(
      { error: "Du darfst nur eigene Abwesenheiten eintragen." },
      { status: 403 }
    );
  }

  const targetUser = users.find((demoUser) => demoUser.id === targetUserId);
  if (!targetUser) {
    return NextResponse.json(
      { error: "Benutzer wurde nicht gefunden." },
      { status: 404 }
    );
  }

  const representative = users.find((demoUser) => demoUser.id === representativeUserId) ?? null;

  if (!representative || representative.id === targetUser.id) {
    return NextResponse.json(
      { error: "Bitte einen Vertreter ausw\u00e4hlen." },
      { status: 400 }
    );
  }

  const baseNote = String(body.note ?? "").trim();
  const handoverNote =
    type === "urlaub"
      ? `Urlaubs\u00fcbergabe best\u00e4tigt: ${handoverChecklist.join("; ")}`
      : "";
  const savedNote = [baseNote, handoverNote].filter(Boolean).join("\n\n") || null;

  for (const currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const date = formatDateKey(currentDate);

    await prisma.$executeRaw`
      INSERT INTO "Absence" ("id", "organizationId", "userId", "type", "date", "representativeUserId", "note")
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${targetUserId},
        ${type},
        ${date}::date,
        ${representative?.id ?? null},
        ${savedNote}
      )
      ON CONFLICT ("userId", "date")
      DO UPDATE SET
        "type" = EXCLUDED."type",
        "representativeUserId" = EXCLUDED."representativeUserId",
        "note" = EXCLUDED."note"
    `;
  }

  const absenceTypeLabel = type === "urlaub" ? "Urlaub" : "Krank";
  const targetUserName = `${targetUser.firstName} ${targetUser.lastName}`;
  const notificationBody = `${targetUserName}: ${absenceTypeLabel} vom ${dateFrom} bis ${dateTo}. Vertreter: ${representative.firstName} ${representative.lastName}.`;
  const adminRecipients = users.filter(
    (demoUser) => demoUser.role === Role.ADMIN || demoUser.role === Role.GESCHAEFTSFUEHRER
  );

  const notificationRecipients: Array<{ userId: string; subject: string; body: string }> = [
    {
      userId: representative.id,
      subject: "Vertretung eingetragen",
      body: `Du wurdest als Vertreter f\u00fcr ${targetUserName} eingetragen: ${absenceTypeLabel} vom ${dateFrom} bis ${dateTo}.`,
    },
    ...adminRecipients.map((recipient) => ({
      userId: recipient.id,
      subject: "Neue Abwesenheit eingetragen",
      body: notificationBody,
    })),
  ];

  for (const notification of notificationRecipients) {
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id",
        "organizationId",
        "userId",
        "taskId",
        "channel",
        "subject",
        "body",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${notification.userId},
        NULL,
        'app',
        ${notification.subject},
        ${notification.body},
        CURRENT_TIMESTAMP
      )
    `;
  }

  const rows = await prisma.$queryRaw<AbsenceRow[]>`
    SELECT
      absences.id,
      absences."userId",
      CONCAT(users."firstName", ' ', users."lastName") as "userName",
      absences."representativeUserId",
      CASE
        WHEN representatives.id IS NULL THEN NULL
        ELSE CONCAT(representatives."firstName", ' ', representatives."lastName")
      END as "representativeName",
      absences.type,
      absences.date,
      absences.note
    FROM "Absence" absences
    INNER JOIN "User" users ON users.id = absences."userId"
    LEFT JOIN "User" representatives ON representatives.id = absences."representativeUserId"
    WHERE absences."organizationId" = ${organization.id}
      AND absences."userId" = ${targetUserId}
      AND absences.date >= ${dateFrom}::date
      AND absences.date <= ${dateTo}::date
    ORDER BY absences.date ASC
  `;

  return NextResponse.json(rows.map(formatAbsence), { status: 201 });
}

export async function DELETE(req: Request) {
  await ensureAbsenceTable();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const absenceId = String(body.absenceId ?? "");

  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT "userId" FROM "Absence"
    WHERE id = ${absenceId} AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const absence = rows[0];

  if (!absence) {
    return NextResponse.json({ error: "Abwesenheit wurde nicht gefunden." }, { status: 404 });
  }

  if (absence.userId !== actor.id && !canManageAbsences(actor.role)) {
    return NextResponse.json(
      { error: "Du darfst diese Abwesenheit nicht l\u00f6schen." },
      { status: 403 }
    );
  }

  await prisma.$executeRaw`
    DELETE FROM "Absence"
    WHERE id = ${absenceId} AND "organizationId" = ${organization.id}
  `;

  return NextResponse.json({ success: true });
}
