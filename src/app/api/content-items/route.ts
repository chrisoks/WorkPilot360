import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type ContentItemRow = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  channel: string;
  format: string;
  ownerUserId: string | null;
  ownerName: string;
  plannedDate: string;
  productionDueDate: string;
  productionDueTime: string;
  approvalDueDate: string;
  approvalDueTime: string;
  plannedTime: string;
  approvalLevel: string;
  status: string;
  directionApprovedById: string | null;
  directionApprovedByName: string | null;
  directionApprovedAt: Date | null;
  finalApprovedById: string | null;
  finalApprovedByName: string | null;
  finalApprovedAt: Date | null;
  correctionNote: string;
  assetLink: string;
  imageDataUrl: string;
  sourceIdeaId: string | null;
  sourceIdeaTitle: string;
  createdByUserId: string | null;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
};

type ContentHistoryRow = {
  id: string;
  contentItemId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  actorName: string;
  note: string;
  createdAt: Date;
};

type ContentNotificationRecipient = {
  id: string;
  email: string;
};

const approvalLevels = new Set(["gruen", "gelb", "rot"]);
const statuses = new Set([
  "Idee",
  "Richtungsfreigabe offen",
  "In Produktion",
  "Fertig produziert",
  "Finale Freigabe offen",
  "Korrektur nötig",
  "Korrektur nÃ¶tig",
  "Freigegeben",
  "Veröffentlicht",
  "VerÃ¶ffentlicht",
]);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value: unknown) {
  const text = cleanString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanTime(value: unknown, fallback = "09:00") {
  const text = cleanString(value);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function getDefaultThursday(dateKey: string) {
  const date = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
  const day = date.getDay();
  const offset = day <= 4 ? 4 - day : 11 - day;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function getDefaultFriday(dateKey: string) {
  const thursday = new Date(`${getDefaultThursday(dateKey)}T00:00:00`);
  thursday.setDate(thursday.getDate() + 1);
  return thursday.toISOString().slice(0, 10);
}

function cleanApprovalLevel(value: unknown) {
  const level = cleanString(value);
  return approvalLevels.has(level) ? level : "gruen";
}

function cleanStatus(value: unknown, approvalLevel: string) {
  const status = cleanString(value);
  if (statuses.has(status)) return status;
  return approvalLevel === "gruen" ? "In Produktion" : "Richtungsfreigabe offen";
}

function isLockedContentStatus(status: string) {
  return status === "Freigegeben" || status === "Veröffentlicht" || status === "VerÃ¶ffentlicht";
}

function formatHistory(row: ContentHistoryRow) {
  return {
    id: row.id,
    contentItemId: row.contentItemId,
    eventType: row.eventType,
    fromStatus: row.fromStatus ?? "",
    toStatus: row.toStatus ?? "",
    actorUserId: row.actorUserId ?? "",
    actorName: row.actorName,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatItem(row: ContentItemRow, history: ContentHistoryRow[] = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    channel: row.channel,
    format: row.format,
    ownerUserId: row.ownerUserId ?? "",
    ownerName: row.ownerName,
    plannedDate: row.plannedDate,
    productionDueDate: row.productionDueDate,
    productionDueTime: cleanTime(row.productionDueTime, "17:00"),
    approvalDueDate: row.approvalDueDate,
    approvalDueTime: cleanTime(row.approvalDueTime, "17:00"),
    plannedTime: cleanTime(row.plannedTime, "09:00"),
    approvalLevel: cleanApprovalLevel(row.approvalLevel),
    status: cleanStatus(row.status, row.approvalLevel),
    directionApprovedById: row.directionApprovedById ?? "",
    directionApprovedByName: row.directionApprovedByName ?? "",
    directionApprovedAt: row.directionApprovedAt?.toISOString() ?? "",
    finalApprovedById: row.finalApprovedById ?? "",
    finalApprovedByName: row.finalApprovedByName ?? "",
    finalApprovedAt: row.finalApprovedAt?.toISOString() ?? "",
    correctionNote: row.correctionNote,
    assetLink: row.assetLink,
    imageDataUrl: row.imageDataUrl,
    sourceIdeaId: row.sourceIdeaId ?? "",
    sourceIdeaTitle: row.sourceIdeaTitle,
    createdByUserId: row.createdByUserId ?? "",
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    history: history.map(formatHistory),
  };
}

async function ensureContentTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ContentItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "channel" TEXT NOT NULL DEFAULT 'Instagram',
      "format" TEXT NOT NULL DEFAULT 'Post',
      "ownerUserId" TEXT,
      "ownerName" TEXT NOT NULL DEFAULT '',
      "plannedDate" TEXT NOT NULL,
      "productionDueDate" TEXT NOT NULL DEFAULT '',
      "productionDueTime" TEXT NOT NULL DEFAULT '17:00',
      "approvalDueDate" TEXT NOT NULL DEFAULT '',
      "approvalDueTime" TEXT NOT NULL DEFAULT '17:00',
      "plannedTime" TEXT NOT NULL DEFAULT '09:00',
      "approvalLevel" TEXT NOT NULL DEFAULT 'gruen',
      "status" TEXT NOT NULL DEFAULT 'Idee',
      "directionApprovedById" TEXT,
      "directionApprovedByName" TEXT,
      "directionApprovedAt" TIMESTAMP(3),
      "finalApprovedById" TEXT,
      "finalApprovedByName" TEXT,
      "finalApprovedAt" TIMESTAMP(3),
      "correctionNote" TEXT NOT NULL DEFAULT '',
      "assetLink" TEXT NOT NULL DEFAULT '',
      "imageDataUrl" TEXT NOT NULL DEFAULT '',
      "sourceIdeaId" TEXT,
      "sourceIdeaTitle" TEXT NOT NULL DEFAULT '',
      "createdByUserId" TEXT,
      "createdByName" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ContentItem"
    ADD COLUMN IF NOT EXISTS "productionDueTime" TEXT NOT NULL DEFAULT '17:00',
    ADD COLUMN IF NOT EXISTS "approvalDueTime" TEXT NOT NULL DEFAULT '17:00',
    ADD COLUMN IF NOT EXISTS "plannedTime" TEXT NOT NULL DEFAULT '09:00',
    ADD COLUMN IF NOT EXISTS "imageDataUrl" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "sourceIdeaId" TEXT,
    ADD COLUMN IF NOT EXISTS "sourceIdeaTitle" TEXT NOT NULL DEFAULT ''
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "IdeaPost" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL DEFAULT '',
      "authorUserId" TEXT,
      "authorName" TEXT NOT NULL DEFAULT '',
      "pinned" BOOLEAN NOT NULL DEFAULT false,
      "plannedContentItemId" TEXT,
      "plannedContentTitle" TEXT NOT NULL DEFAULT '',
      "plannedContentStatus" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "IdeaPost"
    ADD COLUMN IF NOT EXISTS "plannedContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "plannedContentTitle" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "plannedContentStatus" TEXT NOT NULL DEFAULT ''
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ContentApprovalHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "contentItemId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "fromStatus" TEXT,
      "toStatus" TEXT,
      "actorUserId" TEXT,
      "actorName" TEXT NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

async function createHistory(input: {
  organizationId: string;
  contentItemId: string;
  eventType: string;
  fromStatus?: string;
  toStatus?: string;
  actorUserId?: string;
  actorName?: string;
  note?: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "ContentApprovalHistory" (
      "id",
      "organizationId",
      "contentItemId",
      "eventType",
      "fromStatus",
      "toStatus",
      "actorUserId",
      "actorName",
      "note",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.organizationId},
      ${input.contentItemId},
      ${input.eventType},
      ${input.fromStatus || null},
      ${input.toStatus || null},
      ${input.actorUserId || null},
      ${input.actorName || ""},
      ${input.note || ""},
      CURRENT_TIMESTAMP
    )
  `;
}

async function createContentNotification(input: {
  organizationId: string;
  userId: string;
  subject: string;
  body: string;
  contentItemId: string;
  linkLabel: string;
}) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Notification"
    WHERE "organizationId" = ${input.organizationId}
      AND "userId" = ${input.userId}
      AND "subject" = ${input.subject}
      AND "linkTarget" = 'content-item'
      AND "linkTargetId" = ${input.contentItemId}
      AND "readAt" IS NULL
    LIMIT 1
  `;

  if (existing.length > 0) return;

  await prisma.$executeRaw`
    INSERT INTO "Notification" (
      "id",
      "organizationId",
      "userId",
      "taskId",
      "channel",
      "subject",
      "body",
      "linkTarget",
      "linkTargetId",
      "linkLabel",
      "sentAt",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.organizationId},
      ${input.userId},
      NULL,
      'app_email',
      ${input.subject},
      ${input.body},
      'content-item',
      ${input.contentItemId},
      ${input.linkLabel},
      NULL,
      CURRENT_TIMESTAMP
    )
  `;
}

async function getContentApprovers(organizationId: string) {
  return prisma.$queryRaw<ContentNotificationRecipient[]>`
    SELECT id, email
    FROM "User"
    WHERE "organizationId" = ${organizationId}
      AND "isActive" = true
      AND (
        "role"::text IN ('ADMIN', 'GESCHAEFTSFUEHRER', 'FUEHRUNGSKRAFT')
        OR LOWER(CONCAT("firstName", ' ', "lastName")) LIKE '%pauline%'
      )
  `;
}

async function notifyContentAction(input: {
  organizationId: string;
  item: ContentItemRow;
  action: string;
  actorUserId: string;
  actorName: string;
  note?: string;
}) {
  await ensureNotificationLinkColumns();

  if (input.action === "request-correction" && input.item.ownerUserId && input.item.ownerUserId !== input.actorUserId) {
    await createContentNotification({
      organizationId: input.organizationId,
      userId: input.item.ownerUserId,
      subject: "Korrektur nötig",
      body: `${input.actorName} hat Korrekturen für "${input.item.title}" angefordert: ${input.note || "Bitte prüfen."}`,
      contentItemId: input.item.id,
      linkLabel: "Korrektur öffnen",
    });
    return;
  }

  if (input.action === "direction-approve" && input.item.ownerUserId && input.item.ownerUserId !== input.actorUserId) {
    await createContentNotification({
      organizationId: input.organizationId,
      userId: input.item.ownerUserId,
      subject: "Richtung freigegeben",
      body: `${input.actorName} hat die Richtung für "${input.item.title}" freigegeben. Der Inhalt kann produziert werden.`,
      contentItemId: input.item.id,
      linkLabel: "Inhalt öffnen",
    });
    return;
  }

  if (input.action === "final-approve" && input.item.ownerUserId && input.item.ownerUserId !== input.actorUserId) {
    await createContentNotification({
      organizationId: input.organizationId,
      userId: input.item.ownerUserId,
      subject: "Content freigegeben",
      body: `${input.actorName} hat "${input.item.title}" final freigegeben.`,
      contentItemId: input.item.id,
      linkLabel: "Inhalt öffnen",
    });
    return;
  }

  if (input.action === "resubmit" || input.action === "mark-produced") {
    const approvers = await getContentApprovers(input.organizationId);
    for (const approver of approvers.filter((recipient) => recipient.id !== input.actorUserId)) {
      await createContentNotification({
        organizationId: input.organizationId,
        userId: approver.id,
        subject: "Content final freigeben",
        body: `"${input.item.title}" wurde ${input.action === "resubmit" ? "nach Korrektur erneut eingereicht" : "fertig produziert"} und wartet auf finale Freigabe.`,
        contentItemId: input.item.id,
        linkLabel: "Freigabe öffnen",
      });
    }
  }
}

async function getActor(actorId: unknown) {
  const { user, users } = await getDemoContext();
  return users.find((candidate) => candidate.id === actorId) ?? user;
}

async function listContentItems() {
  const { organization } = await getDemoContext();
  await ensureContentTables();

  const rows = await prisma.$queryRaw<ContentItemRow[]>`
    SELECT *
    FROM "ContentItem"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "plannedDate" ASC, "createdAt" ASC
  `;

  const historyRows = rows.length
    ? await prisma.$queryRaw<ContentHistoryRow[]>`
        SELECT *
        FROM "ContentApprovalHistory"
        WHERE "organizationId" = ${organization.id}
          AND "contentItemId" IN (${Prisma.join(rows.map((row) => row.id))})
        ORDER BY "createdAt" DESC
      `
    : [];
  const historyByItemId = new Map<string, ContentHistoryRow[]>();

  for (const history of historyRows) {
    historyByItemId.set(history.contentItemId, [
      ...(historyByItemId.get(history.contentItemId) ?? []),
      history,
    ]);
  }

  return rows.map((row) => formatItem(row, historyByItemId.get(row.id) ?? []));
}

export async function GET() {
  return NextResponse.json(await listContentItems());
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
  const actor = await getActor(body.actorId);
  await ensureContentTables();

  const title = cleanString(body.title);
  const plannedDate = cleanDate(body.plannedDate) || new Date().toISOString().slice(0, 10);
  const approvalLevel = cleanApprovalLevel(body.approvalLevel);
  const status = cleanStatus(body.status, approvalLevel);
  const ownerName = cleanString(body.ownerName);

  if (!title) {
    return NextResponse.json({ error: "Bitte einen Titel angeben." }, { status: 400 });
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "ContentItem" (
      "id",
      "organizationId",
      "title",
      "description",
      "channel",
      "format",
      "ownerUserId",
      "ownerName",
      "plannedDate",
      "productionDueDate",
      "productionDueTime",
      "approvalDueDate",
      "approvalDueTime",
      "plannedTime",
      "approvalLevel",
      "status",
      "assetLink",
      "imageDataUrl",
      "sourceIdeaId",
      "sourceIdeaTitle",
      "createdByUserId",
      "createdByName",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${title},
      ${cleanString(body.description)},
      ${cleanString(body.channel) || "Instagram"},
      ${cleanString(body.format) || "Post"},
      ${cleanString(body.ownerUserId) || null},
      ${ownerName},
      ${plannedDate},
      ${cleanDate(body.productionDueDate) || getDefaultThursday(plannedDate)},
      ${cleanTime(body.productionDueTime, "17:00")},
      ${cleanDate(body.approvalDueDate) || getDefaultFriday(plannedDate)},
      ${cleanTime(body.approvalDueTime, "17:00")},
      ${cleanTime(body.plannedTime, "09:00")},
      ${approvalLevel},
      ${status},
      ${cleanString(body.assetLink)},
      ${cleanString(body.imageDataUrl)},
      ${cleanString(body.sourceIdeaId) || null},
      ${cleanString(body.sourceIdeaTitle)},
      ${actor.id},
      ${`${actor.firstName} ${actor.lastName}`.trim()},
      CURRENT_TIMESTAMP
    )
  `;

  await createHistory({
    organizationId: organization.id,
    contentItemId: id,
    eventType: "Inhalt angelegt",
    toStatus: status,
    actorUserId: actor.id,
    actorName: `${actor.firstName} ${actor.lastName}`.trim(),
    note: approvalLevel === "gruen" ? "Grün: Creator entscheidet selbst." : "",
  });

  const sourceIdeaId = cleanString(body.sourceIdeaId);
  if (sourceIdeaId) {
    await prisma.$executeRaw`
      UPDATE "IdeaPost"
      SET "plannedContentItemId" = ${id},
          "plannedContentTitle" = ${title},
          "plannedContentStatus" = ${status},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${sourceIdeaId}
        AND "organizationId" = ${organization.id}
    `;

    await createHistory({
      organizationId: organization.id,
      contentItemId: id,
      eventType: "Aus Idee geplant",
      toStatus: status,
      actorUserId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`.trim(),
      note: cleanString(body.sourceIdeaTitle),
    });
  }

  if (status === "Richtungsfreigabe offen") {
    await ensureNotificationLinkColumns();
    const approvers = await getContentApprovers(organization.id);
    for (const approver of approvers.filter((recipient) => recipient.id !== actor.id)) {
      await createContentNotification({
        organizationId: organization.id,
        userId: approver.id,
        subject: "Richtungsfreigabe offen",
        body: `"${title}" wartet auf Richtungsfreigabe.`,
        contentItemId: id,
        linkLabel: "Freigabe öffnen",
      });
    }
  }

  return NextResponse.json(await listContentItems());
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
  const actor = await getActor(body.actorId);
  await ensureContentTables();

  const id = cleanString(body.id);
  if (!id) {
    return NextResponse.json({ error: "Content-ID fehlt." }, { status: 400 });
  }

  const [existing] = await prisma.$queryRaw<ContentItemRow[]>`
    SELECT *
    FROM "ContentItem"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  if (!existing) {
    return NextResponse.json({ error: "Inhalt wurde nicht gefunden." }, { status: 404 });
  }

  const actorName = `${actor.firstName} ${actor.lastName}`.trim();

  if (body.action) {
    const action = cleanString(body.action);
    const note = cleanString(body.note);
    const nextStatus =
      action === "direction-approve"
        ? "In Produktion"
        : action === "mark-produced"
          ? "Finale Freigabe offen"
          : action === "final-approve"
            ? "Freigegeben"
            : action === "publish"
              ? "Veröffentlicht"
              : action === "request-correction"
                ? "Korrektur nötig"
                : action === "resubmit"
                  ? "Finale Freigabe offen"
                  : action === "unlock-post-approval-edit"
                    ? existing.status
                    : "";
    const eventType =
      action === "direction-approve"
        ? "Richtung freigegeben"
        : action === "mark-produced"
          ? "Fertig produziert"
          : action === "final-approve"
            ? "Final freigegeben"
            : action === "publish"
              ? "Veröffentlicht"
              : action === "request-correction"
                ? "Korrektur angefordert"
                : action === "resubmit"
                  ? "Erneut eingereicht"
                  : action === "unlock-post-approval-edit"
                    ? "Nachträgliche Bearbeitung geöffnet"
                    : "";

    if (!nextStatus || !eventType) {
      return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
    }

    if (action === "request-correction" && !note) {
      return NextResponse.json({ error: "Bitte einen Korrekturhinweis angeben." }, { status: 400 });
    }

    if (action === "unlock-post-approval-edit" && !isLockedContentStatus(existing.status)) {
      return NextResponse.json({ error: "Nur freigegebene Inhalte können nachträglich geöffnet werden." }, { status: 400 });
    }

    if (action === "publish" && existing.status !== "Freigegeben") {
      return NextResponse.json({ error: "Nur freigegebene Inhalte können veröffentlicht werden." }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE "ContentItem"
      SET
        "status" = ${nextStatus},
        "correctionNote" = ${action === "request-correction" ? note : existing.correctionNote},
        "directionApprovedById" = ${action === "direction-approve" ? actor.id : existing.directionApprovedById},
        "directionApprovedByName" = ${action === "direction-approve" ? actorName : existing.directionApprovedByName},
        "directionApprovedAt" = ${action === "direction-approve" ? new Date() : existing.directionApprovedAt},
        "finalApprovedById" = ${action === "final-approve" ? actor.id : existing.finalApprovedById},
        "finalApprovedByName" = ${action === "final-approve" ? actorName : existing.finalApprovedByName},
        "finalApprovedAt" = ${action === "final-approve" ? new Date() : existing.finalApprovedAt},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
    `;

    await createHistory({
      organizationId: organization.id,
      contentItemId: id,
      eventType,
      fromStatus: existing.status,
      toStatus: nextStatus,
      actorUserId: actor.id,
      actorName,
      note,
    });

    if (existing.sourceIdeaId) {
      await prisma.$executeRaw`
        UPDATE "IdeaPost"
        SET "plannedContentTitle" = ${existing.title},
            "plannedContentStatus" = ${nextStatus},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${existing.sourceIdeaId}
          AND "organizationId" = ${organization.id}
      `;
    }

    await notifyContentAction({
      organizationId: organization.id,
      item: existing,
      action,
      actorUserId: actor.id,
      actorName,
      note,
    });

    return NextResponse.json(await listContentItems());
  }

  const title = cleanString(body.title);
  const plannedDate = cleanDate(body.plannedDate) || existing.plannedDate;
  const approvalLevel = cleanApprovalLevel(body.approvalLevel);
  const requestedStatus = cleanStatus(body.status, approvalLevel);
  const postApprovalEdit = body.postApprovalEdit === true;
  const description = cleanString(body.description);
  const channel = cleanString(body.channel) || "Instagram";
  const format = cleanString(body.format) || "Post";
  const ownerUserId = cleanString(body.ownerUserId) || null;
  const ownerName = cleanString(body.ownerName);
  const productionDueDate = cleanDate(body.productionDueDate) || getDefaultThursday(plannedDate);
  const productionDueTime = cleanTime(body.productionDueTime, existing.productionDueTime || "17:00");
  const approvalDueDate = cleanDate(body.approvalDueDate) || getDefaultFriday(plannedDate);
  const approvalDueTime = cleanTime(body.approvalDueTime, existing.approvalDueTime || "17:00");
  const plannedTime = cleanTime(body.plannedTime, existing.plannedTime || "09:00");
  const assetLink = cleanString(body.assetLink);
  const imageDataUrl = cleanString(body.imageDataUrl);
  const sourceIdeaId = cleanString(body.sourceIdeaId) || null;
  const sourceIdeaTitle = cleanString(body.sourceIdeaTitle);
  const isLockedAfterApproval = isLockedContentStatus(existing.status);
  const hasSensitivePostApprovalChange =
    title !== existing.title ||
    channel !== existing.channel ||
    format !== existing.format ||
    ownerUserId !== existing.ownerUserId ||
    plannedDate !== existing.plannedDate ||
    productionDueDate !== existing.productionDueDate ||
    productionDueTime !== existing.productionDueTime ||
    approvalDueDate !== existing.approvalDueDate ||
    approvalDueTime !== existing.approvalDueTime ||
    plannedTime !== existing.plannedTime ||
    approvalLevel !== existing.approvalLevel ||
    imageDataUrl !== existing.imageDataUrl;
  const status =
    isLockedAfterApproval && postApprovalEdit && hasSensitivePostApprovalChange
      ? "Finale Freigabe offen"
      : isLockedAfterApproval
        ? existing.status
        : requestedStatus;

  if (!title) {
    return NextResponse.json({ error: "Bitte einen Titel angeben." }, { status: 400 });
  }

  if (isLockedAfterApproval && !postApprovalEdit) {
    return NextResponse.json(
      { error: "Freigegebene Inhalte sind gesperrt. Bitte zuerst nachträgliche Bearbeitung öffnen." },
      { status: 400 }
    );
  }

  await prisma.$executeRaw`
    UPDATE "ContentItem"
    SET
      "title" = ${title},
      "description" = ${description},
      "channel" = ${channel},
      "format" = ${format},
      "ownerUserId" = ${ownerUserId},
      "ownerName" = ${ownerName},
      "plannedDate" = ${plannedDate},
      "productionDueDate" = ${productionDueDate},
      "productionDueTime" = ${productionDueTime},
      "approvalDueDate" = ${approvalDueDate},
      "approvalDueTime" = ${approvalDueTime},
      "plannedTime" = ${plannedTime},
      "approvalLevel" = ${approvalLevel},
      "status" = ${status},
      "assetLink" = ${assetLink},
      "imageDataUrl" = ${imageDataUrl},
      "sourceIdeaId" = ${sourceIdeaId},
      "sourceIdeaTitle" = ${sourceIdeaTitle},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  if (sourceIdeaId && sourceIdeaId !== existing.sourceIdeaId) {
    if (existing.sourceIdeaId) {
      await prisma.$executeRaw`
        UPDATE "IdeaPost"
        SET "plannedContentItemId" = NULL,
            "plannedContentTitle" = '',
            "plannedContentStatus" = '',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${existing.sourceIdeaId}
          AND "organizationId" = ${organization.id}
      `;
    }

    await prisma.$executeRaw`
      UPDATE "IdeaPost"
      SET "plannedContentItemId" = ${id},
          "plannedContentTitle" = ${title},
          "plannedContentStatus" = ${status},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${sourceIdeaId}
        AND "organizationId" = ${organization.id}
    `;
  }

  await createHistory({
    organizationId: organization.id,
    contentItemId: id,
    eventType: isLockedAfterApproval ? "Nach Freigabe bearbeitet" : "Inhalt bearbeitet",
    fromStatus: existing.status,
    toStatus: status,
    actorUserId: actor.id,
    actorName,
    note:
      isLockedAfterApproval && hasSensitivePostApprovalChange
        ? "Relevante Änderung nach Freigabe: erneute finale Freigabe erforderlich."
        : "",
  });

  if (existing.sourceIdeaId) {
    await prisma.$executeRaw`
      UPDATE "IdeaPost"
      SET "plannedContentTitle" = ${title},
          "plannedContentStatus" = ${status},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${existing.sourceIdeaId}
        AND "organizationId" = ${organization.id}
    `;
  }

  if (existing.sourceIdeaId) {
    await prisma.$executeRaw`
      UPDATE "IdeaPost"
      SET "plannedContentItemId" = NULL,
          "plannedContentTitle" = '',
          "plannedContentStatus" = '',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${existing.sourceIdeaId}
        AND "organizationId" = ${organization.id}
    `;
  }

  return NextResponse.json(await listContentItems());
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
  const actor = await getActor(body.actorId);
  await ensureContentTables();

  const id = cleanString(body.id);
  if (!id) {
    return NextResponse.json({ error: "Content-ID fehlt." }, { status: 400 });
  }

  const [existing] = await prisma.$queryRaw<ContentItemRow[]>`
    SELECT *
    FROM "ContentItem"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  if (!existing) {
    return NextResponse.json({ error: "Inhalt wurde nicht gefunden." }, { status: 404 });
  }

  await createHistory({
    organizationId: organization.id,
    contentItemId: id,
    eventType: "Inhalt gelöscht",
    fromStatus: existing.status,
    actorUserId: actor.id,
    actorName: `${actor.firstName} ${actor.lastName}`.trim(),
  });

  await prisma.$executeRaw`
    DELETE FROM "ContentItem"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  return NextResponse.json(await listContentItems());
}
