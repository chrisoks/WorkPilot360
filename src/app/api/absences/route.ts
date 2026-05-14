import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, Role, TaskPriority, TaskStatus } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type AbsenceType = "urlaub" | "krank";
type AbsenceDayPart = "full" | "first-half" | "second-half";

type AbsenceRow = {
  id: string;
  requestGroupId: string | null;
  userId: string;
  userName: string;
  representativeUserId: string | null;
  representativeName: string | null;
  type: AbsenceType;
  dayPart: AbsenceDayPart | null;
  status: string | null;
  date: Date | string;
  note: string | null;
  handoverTaskIds: unknown;
  rejectionReason: string | null;
  history: unknown;
  createdAt: Date | string;
};

type AbsenceHistoryItem = {
  id: string;
  event: string;
  actorName: string;
  note: string;
  createdAt: string;
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
  const history = Array.isArray(row.history)
    ? row.history.map((item) => {
        const current = item as Partial<AbsenceHistoryItem>;
        return {
          id: String(current.id ?? randomUUID()),
          event: String(current.event ?? ""),
          actorName: String(current.actorName ?? ""),
          note: String(current.note ?? ""),
          createdAt: String(current.createdAt ?? ""),
        };
      })
    : [];
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? "");
  const normalizedHistory =
    history.length > 0
      ? history
      : [
          {
            id: row.id,
            event: "Antrag vorhanden",
            actorName: row.userName,
            note: "Dieser Antrag wurde vor der detaillierten Historie angelegt.",
            createdAt,
          },
        ];

  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    representativeUserId: row.representativeUserId,
    representativeName: row.representativeName,
    type: row.type,
    dayPart: row.dayPart ?? "full",
    status: row.status ?? "genehmigt",
    date: dateKey,
    note: row.note ?? "",
    requestGroupId: row.requestGroupId ?? row.id,
    handoverTaskIds: Array.isArray(row.handoverTaskIds) ? row.handoverTaskIds.map(String) : [],
    rejectionReason: row.rejectionReason ?? "",
    history: normalizedHistory,
  };
}

function createHistoryItem(event: string, actorName: string, note = ""): AbsenceHistoryItem {
  return {
    id: randomUUID(),
    event,
    actorName,
    note,
    createdAt: new Date().toISOString(),
  };
}

function getAbsenceTypeLabel(type: AbsenceType) {
  return type === "urlaub" ? "Urlaub" : "Krank";
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

async function notifyAbsenceChange(
  organizationId: string,
  users: Awaited<ReturnType<typeof getDemoContext>>["users"],
  subject: string,
  body: string
) {
  const recipients = users.filter(
    (demoUser) => demoUser.role === Role.GESCHAEFTSFUEHRER || demoUser.role === Role.FUEHRUNGSKRAFT
  );

  for (const recipient of recipients) {
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
        ${organizationId},
        ${recipient.id},
        NULL,
        'app',
        ${subject},
        ${body},
        CURRENT_TIMESTAMP
      )
    `;
  }
}

async function ensureAbsenceTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Absence" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "requestGroupId" TEXT,
      "type" TEXT NOT NULL,
      "dayPart" TEXT NOT NULL DEFAULT 'full',
      "status" TEXT NOT NULL DEFAULT 'genehmigt',
      "date" DATE NOT NULL,
      "representativeUserId" TEXT,
      "note" TEXT,
      "handoverTaskIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "rejectionReason" TEXT,
      "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Absence_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Absence_userId_date_key" UNIQUE ("userId", "date")
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Absence"
    ADD COLUMN IF NOT EXISTS "requestGroupId" TEXT,
    ADD COLUMN IF NOT EXISTS "representativeUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "dayPart" TEXT NOT NULL DEFAULT 'full',
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'genehmigt',
    ADD COLUMN IF NOT EXISTS "handoverTaskIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

function cleanDayPart(value: unknown): AbsenceDayPart {
  return value === "first-half" || value === "second-half" ? value : "full";
}

function cleanStatus(value: unknown) {
  const status = String(value ?? "");
  return [
    "wartet_vertreter",
    "wartet_geschaeftsfuehrung",
    "genehmigt",
    "abgelehnt",
  ].includes(status)
    ? status
    : "wartet_vertreter";
}

function parseHandoverTasks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const current = item as { title?: unknown; description?: unknown };
      const title = String(current.title ?? "").trim();
      const description = String(current.description ?? "").trim();
      return title ? { title, description } : null;
    })
    .filter((item): item is { title: string; description: string } => Boolean(item));
}

async function createHandoverTasks(input: {
  organizationId: string;
  applicantId: string;
  applicantName: string;
  representativeId: string;
  representativeTeamId?: string | null;
  requestGroupId: string;
  dateFrom: string;
  items: Array<{ title: string; description: string }>;
}) {
  const ids: string[] = [];
  for (const item of input.items) {
    const task = await prisma.task.create({
      data: {
        organizationId: input.organizationId,
        ownerId: input.representativeId,
        teamId: input.representativeTeamId ?? null,
        title: item.title,
        description: [
          item.description,
          `Übergabe-Aufgabe aus Abwesenheitsantrag von ${input.applicantName}.`,
        ].filter(Boolean).join("\n\n"),
        status: TaskStatus.OFFEN,
        priority: TaskPriority.NORMAL,
        deadline: new Date(`${input.dateFrom}T12:00:00`),
        estimateMinutes: null,
      },
    });
    await prisma.$executeRaw`
      UPDATE "Task"
      SET "createdById" = ${input.applicantId},
          "acceptanceStatus" = 'pending'
      WHERE id = ${task.id}
    `;
    ids.push(task.id);
  }
  return ids;
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
      absences."requestGroupId",
      absences."userId",
      CONCAT(users."firstName", ' ', users."lastName") as "userName",
      absences."representativeUserId",
      CASE
        WHEN representatives.id IS NULL THEN NULL
        ELSE CONCAT(representatives."firstName", ' ', representatives."lastName")
      END as "representativeName",
      absences.type,
      absences."dayPart",
      absences.status,
      absences.date,
      absences.note,
      absences."handoverTaskIds",
      absences."rejectionReason",
      absences.history,
      absences."createdAt"
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
  const dayPart = cleanDayPart(body.dayPart);
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

  if (type === "urlaub" && !handoverConfirmed) {
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
  const requestGroupId = randomUUID();
  const providedHandoverTaskIds = Array.isArray(body.handoverTaskIds)
    ? body.handoverTaskIds.map((item: unknown) => String(item)).filter(Boolean)
    : [];
  const handoverTaskItems = parseHandoverTasks(body.handoverTasks);
  const handoverTaskIds =
    providedHandoverTaskIds.length > 0
      ? providedHandoverTaskIds
      : await createHandoverTasks({
          organizationId: organization.id,
          applicantId: targetUser.id,
          applicantName: `${targetUser.firstName} ${targetUser.lastName}`,
          representativeId: representative.id,
          representativeTeamId: representative.teamId,
          requestGroupId,
          dateFrom,
          items: handoverTaskItems,
        });
  const handoverNote =
    type === "urlaub" && handoverChecklist.length > 0
      ? `Urlaubs\u00fcbergabe best\u00e4tigt: ${handoverChecklist.join("; ")}`
      : "";
  const savedNote = [baseNote, handoverNote].filter(Boolean).join("\n\n") || null;
  const initialHistory = [
    createHistoryItem(
      "Antrag erstellt",
      `${actor.firstName} ${actor.lastName}`,
      `${getAbsenceTypeLabel(type)} vom ${dateFrom} bis ${dateTo}. Vertreter: ${representative.firstName} ${representative.lastName}.`
    ),
  ];

  for (const currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const date = formatDateKey(currentDate);

    await prisma.$executeRaw`
      INSERT INTO "Absence" (
        "id", "organizationId", "requestGroupId", "userId", "type", "dayPart",
        "status", "date", "representativeUserId", "note", "handoverTaskIds",
        "rejectionReason", "history"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${requestGroupId},
        ${targetUserId},
        ${type},
        ${dayPart},
        'wartet_vertreter',
        ${date}::date,
        ${representative?.id ?? null},
        ${savedNote},
        ${JSON.stringify(handoverTaskIds)}::jsonb,
        NULL,
        ${JSON.stringify(initialHistory)}::jsonb
      )
      ON CONFLICT ("userId", "date")
      DO UPDATE SET
        "type" = EXCLUDED."type",
        "dayPart" = EXCLUDED."dayPart",
        "status" = EXCLUDED."status",
        "representativeUserId" = EXCLUDED."representativeUserId",
        "note" = EXCLUDED."note",
        "handoverTaskIds" = EXCLUDED."handoverTaskIds",
        "rejectionReason" = EXCLUDED."rejectionReason",
        "history" = EXCLUDED."history"
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
      absences."requestGroupId",
      absences."userId",
      CONCAT(users."firstName", ' ', users."lastName") as "userName",
      absences."representativeUserId",
      CASE
        WHEN representatives.id IS NULL THEN NULL
        ELSE CONCAT(representatives."firstName", ' ', representatives."lastName")
      END as "representativeName",
      absences.type,
      absences."dayPart",
      absences.status,
      absences.date,
      absences.note,
      absences."handoverTaskIds",
      absences."rejectionReason",
      absences.history,
      absences."createdAt"
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

export async function PATCH(req: Request) {
  await ensureAbsenceTable();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const action = String(body.action ?? "");
  const absenceId = String(body.absenceId ?? "");
  const targetUserId = String(body.userId ?? "");
  const dateFrom = String(body.dateFrom ?? "");
  const dateTo = String(body.dateTo ?? dateFrom);
  const representativeUserId = String(body.representativeUserId ?? "");
  const type = String(body.type ?? "") as AbsenceType;
  const dayPart = cleanDayPart(body.dayPart);
  const baseNote = String(body.note ?? "").trim();
  const rejectionReason = String(body.reason ?? "").trim();
  const handoverChecklist = Array.isArray(body.handoverChecklist)
    ? body.handoverChecklist.map((item: unknown) => String(item)).filter(Boolean)
    : [];
  const handoverConfirmed = Boolean(body.handoverConfirmed);

  const existingRows = await prisma.$queryRaw<AbsenceRow[]>`
    SELECT
      absences.id,
      absences."requestGroupId",
      absences."userId",
      CONCAT(users."firstName", ' ', users."lastName") as "userName",
      absences."representativeUserId",
      CASE
        WHEN representatives.id IS NULL THEN NULL
        ELSE CONCAT(representatives."firstName", ' ', representatives."lastName")
      END as "representativeName",
      absences.type,
      absences."dayPart",
      absences.status,
      absences.date,
      absences.note,
      absences."handoverTaskIds",
      absences."rejectionReason",
      absences.history,
      absences."createdAt"
    FROM "Absence" absences
    INNER JOIN "User" users ON users.id = absences."userId"
    LEFT JOIN "User" representatives ON representatives.id = absences."representativeUserId"
    WHERE absences.id = ${absenceId}
      AND absences."organizationId" = ${organization.id}
    LIMIT 1
  `;
  const existingAbsence = existingRows[0];

  if (!existingAbsence) {
    return NextResponse.json({ error: "Abwesenheit wurde nicht gefunden." }, { status: 404 });
  }

  if (action) {
    const requestGroupId = existingAbsence.requestGroupId ?? existingAbsence.id;
    const nextStatus =
      action === "accept-representation"
        ? "wartet_geschaeftsfuehrung"
        : action === "final-approve"
          ? "genehmigt"
          : action === "reject"
            ? "abgelehnt"
            : "";

    if (!nextStatus) {
      return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
    }

    if (action === "reject" && !rejectionReason) {
      return NextResponse.json({ error: "Bitte eine Begründung für die Ablehnung angeben." }, { status: 400 });
    }

    if (action === "accept-representation" && existingAbsence.representativeUserId !== actor.id) {
      return NextResponse.json({ error: "Nur der Vertreter darf die Vertretung akzeptieren." }, { status: 403 });
    }

    if (action === "final-approve" && !canManageAbsences(actor.role)) {
      return NextResponse.json({ error: "Nur Führungskräfte dürfen den Antrag final bearbeiten." }, { status: 403 });
    }

    if (
      action === "reject" &&
      !canManageAbsences(actor.role) &&
      existingAbsence.representativeUserId !== actor.id
    ) {
      return NextResponse.json({ error: "Nur der Vertreter oder eine Führungskraft darf den Antrag ablehnen." }, { status: 403 });
    }

    const handoverTaskIds = Array.isArray(existingAbsence.handoverTaskIds)
      ? existingAbsence.handoverTaskIds.map(String)
      : [];

    if (action === "accept-representation" && handoverTaskIds.length > 0) {
      const pendingTasks = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "Task"
        WHERE id IN (${Prisma.join(handoverTaskIds)})
          AND "acceptanceStatus" <> 'accepted'
      `;
      if (pendingTasks.length > 0) {
        return NextResponse.json(
          { error: "Bitte zuerst alle Übergabe-Aufgaben im Aufgabenmodul akzeptieren." },
          { status: 400 }
        );
      }
    }

    const historyItem = createHistoryItem(
      action === "accept-representation"
        ? "Vertretung akzeptiert"
        : action === "final-approve"
          ? "Final genehmigt"
          : "Antrag abgelehnt",
      `${actor.firstName} ${actor.lastName}`,
      action === "reject" ? rejectionReason : ""
    );

    await prisma.$executeRaw`
      UPDATE "Absence"
      SET status = ${nextStatus},
          "rejectionReason" = ${action === "reject" ? rejectionReason : null},
          history = COALESCE(history, '[]'::jsonb) || ${JSON.stringify([historyItem])}::jsonb
      WHERE "organizationId" = ${organization.id}
        AND COALESCE("requestGroupId", id) = ${requestGroupId}
    `;

    await notifyAbsenceChange(
      organization.id,
      users,
      action === "accept-representation"
        ? "Vertretung akzeptiert"
        : action === "final-approve"
          ? "Abwesenheit genehmigt"
          : "Abwesenheit abgelehnt",
      `${actor.firstName} ${actor.lastName} hat den Abwesenheitsantrag von ${existingAbsence.userName} bearbeitet.`
    );

    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id", "organizationId", "userId", "taskId", "channel", "subject", "body",
        "createdAt", "linkTarget", "linkTargetId", "linkLabel"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${existingAbsence.userId},
        NULL,
        'app',
        ${action === "accept-representation"
          ? "Vertretung akzeptiert"
          : action === "final-approve"
            ? "Abwesenheit genehmigt"
            : "Abwesenheit abgelehnt"},
        ${action === "reject"
          ? `${actor.firstName} ${actor.lastName} hat deinen Abwesenheitsantrag abgelehnt. Begründung: ${rejectionReason}`
          : `${actor.firstName} ${actor.lastName} hat deinen Abwesenheitsantrag bearbeitet.`},
        CURRENT_TIMESTAMP,
        'absence-request',
        ${requestGroupId},
        'Antrag öffnen'
      )
    `;

    return NextResponse.json({ success: true });
  }

  if (existingAbsence.userId !== actor.id && !canManageAbsences(actor.role)) {
    return NextResponse.json(
      { error: "Du darfst diese Abwesenheit nicht bearbeiten." },
      { status: 403 }
    );
  }

  if (!targetUserId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "Bitte Benutzer sowie Datum von und bis ausw\u00e4hlen." },
      { status: 400 }
    );
  }

  if (type !== "urlaub" && type !== "krank") {
    return NextResponse.json(
      { error: "Bitte Urlaub oder Krank ausw\u00e4hlen." },
      { status: 400 }
    );
  }

  if (type === "urlaub" && !handoverConfirmed) {
    return NextResponse.json(
      { error: "Bitte die Urlaubs\u00fcbergabe vollst\u00e4ndig ausf\u00fcllen und best\u00e4tigen." },
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

  const targetUser = users.find((demoUser) => demoUser.id === targetUserId);
  const representative = users.find((demoUser) => demoUser.id === representativeUserId) ?? null;

  if (!targetUser || !representative || representative.id === targetUser.id) {
    return NextResponse.json({ error: "Bitte einen Vertreter ausw\u00e4hlen." }, { status: 400 });
  }

  const existingDate = existingAbsence.date instanceof Date
    ? formatDateKey(existingAbsence.date)
    : existingAbsence.date.slice(0, 10);
  const siblingRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Absence"
    WHERE "organizationId" = ${organization.id}
      AND "userId" = ${existingAbsence.userId}
      AND type = ${existingAbsence.type}
      AND COALESCE("representativeUserId", '') = ${existingAbsence.representativeUserId ?? ""}
      AND COALESCE(note, '') = ${existingAbsence.note ?? ""}
      AND date >= ${formatDateKey(addDays(new Date(`${existingDate}T00:00:00`), -31))}::date
      AND date <= ${formatDateKey(addDays(new Date(`${existingDate}T00:00:00`), 31))}::date
  `;

  await prisma.$executeRaw`
    DELETE FROM "Absence"
    WHERE id IN (${Prisma.join(siblingRows.map((row) => row.id))})
      AND "organizationId" = ${organization.id}
  `;

  const handoverNote =
    type === "urlaub" && handoverChecklist.length > 0
      ? `Urlaubs\u00fcbergabe best\u00e4tigt: ${handoverChecklist.join("; ")}`
      : "";
  const savedNote = [baseNote, handoverNote].filter(Boolean).join("\n\n") || null;
  const editHistoryItem = createHistoryItem(
    "Antrag bearbeitet",
    `${actor.firstName} ${actor.lastName}`,
    `${getAbsenceTypeLabel(type)} vom ${dateFrom} bis ${dateTo}. Vertreter: ${representative.firstName} ${representative.lastName}.`
  );

  for (const currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const date = formatDateKey(currentDate);

    await prisma.$executeRaw`
      INSERT INTO "Absence" (
        "id", "organizationId", "requestGroupId", "userId", "type", "dayPart",
        "status", "date", "representativeUserId", "note", "handoverTaskIds",
        "rejectionReason", "history"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${existingAbsence.requestGroupId ?? randomUUID()},
        ${targetUserId},
        ${type},
        ${dayPart},
        ${cleanStatus(existingAbsence.status)},
        ${date}::date,
        ${representative.id},
        ${savedNote},
        ${JSON.stringify(
          Array.isArray(existingAbsence.handoverTaskIds) ? existingAbsence.handoverTaskIds.map(String) : []
        )}::jsonb,
        ${existingAbsence.rejectionReason},
        ${JSON.stringify([
          ...(Array.isArray(existingAbsence.history) ? existingAbsence.history : []),
          editHistoryItem,
        ])}::jsonb
      )
      ON CONFLICT ("userId", "date")
      DO UPDATE SET
        "type" = EXCLUDED."type",
        "dayPart" = EXCLUDED."dayPart",
        "status" = EXCLUDED."status",
        "representativeUserId" = EXCLUDED."representativeUserId",
        "note" = EXCLUDED."note",
        "handoverTaskIds" = EXCLUDED."handoverTaskIds",
        "rejectionReason" = EXCLUDED."rejectionReason",
        "history" = EXCLUDED."history"
    `;
  }

  await notifyAbsenceChange(
    organization.id,
    users,
    "Abwesenheit bearbeitet",
    `${actor.firstName} ${actor.lastName} hat eine Abwesenheit bearbeitet: ${targetUser.firstName} ${targetUser.lastName}, ${getAbsenceTypeLabel(type)} vom ${dateFrom} bis ${dateTo}.`
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  await ensureAbsenceTable();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;
  const absenceId = String(body.absenceId ?? "");
  const dateFrom = String(body.dateFrom ?? "");
  const dateTo = String(body.dateTo ?? dateFrom);

  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      representativeUserId: string | null;
      type: AbsenceType;
      date: Date;
      note: string | null;
    }>
  >`
    SELECT "userId", "representativeUserId", type, date, note FROM "Absence"
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

  const deleteStart = dateFrom || formatDateKey(absence.date);
  const deleteEnd = dateTo || deleteStart;

  await prisma.$executeRaw`
    DELETE FROM "Absence"
    WHERE "organizationId" = ${organization.id}
      AND "userId" = ${absence.userId}
      AND type = ${absence.type}
      AND COALESCE("representativeUserId", '') = ${absence.representativeUserId ?? ""}
      AND COALESCE(note, '') = ${absence.note ?? ""}
      AND date >= ${deleteStart}::date
      AND date <= ${deleteEnd}::date
  `;

  const targetUser = users.find((demoUser) => demoUser.id === absence.userId);
  await notifyAbsenceChange(
    organization.id,
    users,
    "Abwesenheit gelöscht",
    `${actor.firstName} ${actor.lastName} hat eine Abwesenheit gelöscht: ${targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : "Benutzer"}, ${getAbsenceTypeLabel(absence.type)} vom ${deleteStart} bis ${deleteEnd}.`
  );

  return NextResponse.json({ success: true });
}
