import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import {
  canArchiveProjects,
  canCreateProjectLogbookEntries,
  canManageProjectLogbookAttachments,
} from "@/lib/permissions";

type LogbookAttachment = {
  name: string;
  type: "Bild" | "Dokument";
  mimeType?: string;
  size?: number;
  dataUrl?: string;
};

type ProjectLogbookEntryRow = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string | null;
  body: string;
  author: string | null;
  authorUserId: string | null;
  colleague: string | null;
  visibleFor: unknown;
  attachments: unknown;
  projectMonth: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectReferenceRow = {
  id: string;
  status: string;
};

const MAX_LOGBOOK_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_LOGBOOK_ENTRY_ATTACHMENT_BYTES = 48 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"]);

const ACTIVITY_REPORT_TITLES = new Set([
  "Dokumente: Tätigkeitsberichte",
  "Dokumente: T\u00c3\u00a4tigkeitsberichte",
]);
const ACTIVITY_REPORT_DELETE_TITLE = "Tätigkeitsbericht: gelöscht";
const PROJECT_ATTACHMENT_DELETE_TITLE = "Projektanhang: gelöscht";

async function ensureProjectLogbookEntryTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectLogbookEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "title" TEXT,
      "body" TEXT NOT NULL,
      "author" TEXT,
      "authorUserId" TEXT,
      "colleague" TEXT,
      "visibleFor" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "projectMonth" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectLogbookEntry"
    ADD COLUMN IF NOT EXISTS "projectMonth" TEXT,
    ADD COLUMN IF NOT EXISTS "authorUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanString(actorId);
  if (!requestedActorId) return null;

  return users.find((candidate) => candidate.id === requestedActorId && candidate.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

function forbiddenLogbookResponse() {
  return NextResponse.json(
    { error: "Du darfst keine Projektlogbuch-Eintraege erstellen." },
    { status: 403 }
  );
}

function forbiddenAttachmentResponse() {
  return NextResponse.json(
    { error: "Du darfst diesen Projektanhang nicht veraendern." },
    { status: 403 }
  );
}

function isArchivedProjectStatus(status: string) {
  return status.trim().toLowerCase().includes("archiviert");
}

async function getProjectReference(organizationId: string, projectId: string) {
  const rows = await prisma.$queryRaw<ProjectReferenceRow[]>`
    SELECT "id", "status"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function assertWritableProject(organizationId: string, projectId: string, actor: User) {
  const project = await getProjectReference(organizationId, projectId);
  if (!project) {
    return NextResponse.json({ error: "Projekt wurde nicht gefunden." }, { status: 404 });
  }
  if (isArchivedProjectStatus(project.status) && !canArchiveProjects(actor)) {
    return NextResponse.json(
      { error: "Archivierte Projekte duerfen nicht mehr im Logbuch veraendert werden." },
      { status: 403 }
    );
  }
  return null;
}

function cleanStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean)
    : [];
}

function cleanAttachments(value: unknown): LogbookAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<LogbookAttachment[]>((attachments, attachment) => {
      if (!attachment || typeof attachment !== "object") return attachments;
      const candidate = attachment as Partial<LogbookAttachment>;
      const name = cleanString(candidate.name);
      if (!name) return attachments;

      attachments.push({
        name,
        type: candidate.type === "Bild" ? "Bild" : "Dokument",
        mimeType: cleanString(candidate.mimeType),
        size: Number.isFinite(Number(candidate.size)) ? Number(candidate.size) : 0,
        dataUrl: cleanString(candidate.dataUrl),
      });

      return attachments;
    }, []);
}

function formatFileSize(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function getAttachmentExtension(name: string) {
  return name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
}

function getDataUrlMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
  return match?.[1]?.toLowerCase() || "";
}

function estimateDataUrlBytes(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",");
  const payload = separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : dataUrl;
  if (!payload) return 0;
  if (dataUrl.slice(0, separatorIndex).toLowerCase().includes(";base64")) {
    return Math.ceil((payload.length * 3) / 4);
  }
  return payload.length;
}

function getAttachmentBytes(attachment: LogbookAttachment) {
  return Math.max(
    Number.isFinite(attachment.size) ? Number(attachment.size) : 0,
    attachment.dataUrl ? estimateDataUrlBytes(attachment.dataUrl) : 0
  );
}

function isAllowedAttachmentType(attachment: LogbookAttachment) {
  const mimeType = (attachment.mimeType || getDataUrlMimeType(attachment.dataUrl || "")).toLowerCase();
  const extension = getAttachmentExtension(attachment.name);
  const isImage =
    (mimeType && ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) ||
    (!mimeType && ALLOWED_IMAGE_EXTENSIONS.has(extension)) ||
    ALLOWED_IMAGE_EXTENSIONS.has(extension);

  if (attachment.type === "Bild") {
    return isImage;
  }

  return (
    isImage ||
    (mimeType && ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) ||
    (!mimeType && ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) ||
    ALLOWED_DOCUMENT_EXTENSIONS.has(extension)
  );
}

function validateAttachments(attachments: LogbookAttachment[]) {
  let totalBytes = 0;

  for (const attachment of attachments) {
    if (attachment.dataUrl && !attachment.dataUrl.startsWith("data:")) {
      return {
        status: 400,
        error: `Anhang "${attachment.name}" hat ein ungueltiges Datenformat.`,
      };
    }

    if (!isAllowedAttachmentType(attachment)) {
      return {
        status: 400,
        error: `Dateityp von "${attachment.name}" ist nicht erlaubt.`,
      };
    }

    const attachmentBytes = getAttachmentBytes(attachment);
    if (attachmentBytes > MAX_LOGBOOK_ATTACHMENT_BYTES) {
      return {
        status: 413,
        error: `Anhang "${attachment.name}" ist zu gross. Erlaubt sind maximal ${formatFileSize(
          MAX_LOGBOOK_ATTACHMENT_BYTES
        )} pro Datei.`,
      };
    }

    totalBytes += attachmentBytes;
  }

  if (totalBytes > MAX_LOGBOOK_ENTRY_ATTACHMENT_BYTES) {
    return {
      status: 413,
      error: `Die Anhaenge sind zusammen zu gross. Erlaubt sind maximal ${formatFileSize(
        MAX_LOGBOOK_ENTRY_ATTACHMENT_BYTES
      )} pro Eintrag.`,
    };
  }

  return null;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatEntry(entry: ProjectLogbookEntryRow) {
  return {
    id: entry.id,
    projectId: entry.projectId,
    date: formatDateTime(entry.createdAt),
    title: entry.title || "Eintrag",
    text: entry.body,
    author: entry.author || "",
    authorUserId: entry.authorUserId || "",
    colleague: entry.colleague || "",
    visibleFor: cleanStringList(entry.visibleFor),
    attachments: cleanAttachments(entry.attachments),
    projectMonth: entry.projectMonth || "",
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function formatEntrySummary(entry: ProjectLogbookEntryRow) {
  const attachments = cleanAttachments(entry.attachments);

  return {
    id: entry.id,
    projectId: entry.projectId,
    date: formatDateTime(entry.createdAt),
    title: entry.title || "Eintrag",
    text: entry.body,
    author: entry.author || "",
    authorUserId: entry.authorUserId || "",
    colleague: entry.colleague || "",
    visibleFor: cleanStringList(entry.visibleFor),
    projectMonth: entry.projectMonth || "",
    updatedAt: entry.updatedAt.toISOString(),
    attachments: attachments.map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      mimeType: attachment.mimeType || "",
      size: attachment.size || 0,
    })),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, url.searchParams.get("actorId"));
  if (!actor) {
    return unauthorizedActorResponse();
  }

  await ensureProjectLogbookEntryTable();
  const projectId = cleanString(url.searchParams.get("projectId"));
  const updatedAfterValue = cleanString(url.searchParams.get("updatedAfter"));
  const summaryOnly = cleanString(url.searchParams.get("summary")) === "1";
  const updatedAfter = updatedAfterValue ? new Date(updatedAfterValue) : null;
  const hasUpdatedAfter = Boolean(updatedAfter && !Number.isNaN(updatedAfter.getTime()));

  if (projectId) {
    const entries = hasUpdatedAfter
      ? await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
          SELECT *
          FROM "ProjectLogbookEntry"
          WHERE "organizationId" = ${organization.id}
            AND "projectId" = ${projectId}
            AND "updatedAt" > ${updatedAfter}
          ORDER BY "createdAt" DESC
        `
      : await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
          SELECT *
          FROM "ProjectLogbookEntry"
          WHERE "organizationId" = ${organization.id}
            AND "projectId" = ${projectId}
          ORDER BY "createdAt" DESC
        `;

    return NextResponse.json(summaryOnly ? entries.map(formatEntrySummary) : entries.map(formatEntry));
  }

  const entries = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    SELECT *
    FROM "ProjectLogbookEntry"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;

  return NextResponse.json(summaryOnly ? entries.map(formatEntrySummary) : entries.map(formatEntry));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const projectId = cleanString(body.projectId);
  const text = cleanString(body.text);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canCreateProjectLogbookEntries(actor)) {
    return forbiddenLogbookResponse();
  }

  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Bitte einen Logbucheintrag erfassen." }, { status: 400 });
  }

  await ensureProjectLogbookEntryTable();
  const projectError = await assertWritableProject(organization.id, projectId, actor);
  if (projectError) {
    return projectError;
  }

  const id = cleanString(body.id) || randomUUID();
  const title = cleanString(body.title) || "Eintrag";
  const author = getActorName(actor);
  const authorUserId = actor.id;
  const colleague = cleanString(body.colleague);
  const visibleFor = cleanStringList(body.visibleFor);
  const attachments = cleanAttachments(body.attachments);
  const attachmentError = validateAttachments(attachments);
  if (attachmentError) {
    return NextResponse.json({ error: attachmentError.error }, { status: attachmentError.status });
  }
  const projectMonth = cleanString(body.projectMonth);
  const requestedCreatedAt = cleanString(body.createdAt);
  const createdAt = requestedCreatedAt ? new Date(requestedCreatedAt) : new Date();
  const createdAtValue = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

  const rows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    INSERT INTO "ProjectLogbookEntry" (
      "id",
      "organizationId",
      "projectId",
      "title",
      "body",
      "author",
      "authorUserId",
      "colleague",
      "visibleFor",
      "attachments",
      "projectMonth",
      "createdAt"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${projectId},
      ${title},
      ${text},
      ${author || null},
      ${authorUserId || null},
      ${colleague || null},
      ${JSON.stringify(visibleFor)}::jsonb,
      ${JSON.stringify(attachments)}::jsonb,
      ${projectMonth || null},
      ${createdAtValue}
    )
    RETURNING *
  `;

  return NextResponse.json(formatEntry(rows[0]), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const entryId = cleanString(body.entryId);
  const attachmentName = cleanString(body.attachmentName);
  const attachmentIndex = Number(body.attachmentIndex);
  const action = cleanString(body.action) || "delete";
  const targetTitle = cleanString(body.targetTitle);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  const actorName = getActorName(actor);
  const actorUserId = actor.id;

  if (!entryId) {
    return NextResponse.json({ error: "Logbucheintrag fehlt." }, { status: 400 });
  }

  await ensureProjectLogbookEntryTable();

  const rows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    SELECT *
    FROM "ProjectLogbookEntry"
    WHERE "id" = ${entryId}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;

  const entry = rows[0];
  if (!entry) {
    return NextResponse.json({ error: "Logbucheintrag wurde nicht gefunden." }, { status: 404 });
  }
  const projectError = await assertWritableProject(organization.id, entry.projectId, actor);
  if (projectError) {
    return projectError;
  }
  if (!canManageProjectLogbookAttachments(actor) && entry.authorUserId !== actor.id) {
    return forbiddenAttachmentResponse();
  }

  const attachments = cleanAttachments(entry.attachments);
  const targetIndex =
    Number.isInteger(attachmentIndex) &&
    attachmentIndex >= 0 &&
    attachmentIndex < attachments.length &&
    (!attachmentName || attachments[attachmentIndex]?.name === attachmentName)
      ? attachmentIndex
      : attachments.findIndex((attachment) => attachment.name === attachmentName);

  if (targetIndex < 0) {
    return NextResponse.json({ error: "Anhang wurde nicht gefunden." }, { status: 404 });
  }

  const removedAttachment = attachments[targetIndex];
  if (action === "move") {
    if (removedAttachment.type !== "Bild") {
      return NextResponse.json({ error: "Nur Bilder können verschoben werden." }, { status: 400 });
    }
    if (!targetTitle || !targetTitle.startsWith("Bilder: ")) {
      return NextResponse.json({ error: "Bild-Zielordner fehlt." }, { status: 400 });
    }
  }

  const nextAttachments = attachments.filter((_, index) => index !== targetIndex);
  const updatedRows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    UPDATE "ProjectLogbookEntry"
    SET "attachments" = ${JSON.stringify(nextAttachments)}::jsonb,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${entry.id}
      AND "organizationId" = ${organization.id}
    RETURNING *
  `;

  const normalizedEntryTitle = (entry.title || "")
    .replaceAll("Taetigkeitsbericht", "Tätigkeitsbericht")
    .replaceAll("T\u00c3\u00a4tigkeitsbericht", "Tätigkeitsbericht");
  const isActivityReport =
    ACTIVITY_REPORT_TITLES.has(entry.title || "") ||
    normalizedEntryTitle === "Dokumente: Tätigkeitsberichte" ||
    normalizedEntryTitle.includes("Tätigkeitsbericht");
  const historyTitle = isActivityReport ? ACTIVITY_REPORT_DELETE_TITLE : PROJECT_ATTACHMENT_DELETE_TITLE;
  const sourceTitle = entry.title || "Projektakte";
  if (action === "move") {
    const targetRows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
      SELECT *
      FROM "ProjectLogbookEntry"
      WHERE "organizationId" = ${organization.id}
        AND "projectId" = ${entry.projectId}
        AND "title" = ${targetTitle}
      ORDER BY "createdAt" DESC
    `;
    const targetEntry = targetRows.find((row) => (row.projectMonth || "") === (entry.projectMonth || ""));
    const movedRows = targetEntry
      ? await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
          UPDATE "ProjectLogbookEntry"
          SET "attachments" = ${JSON.stringify([...cleanAttachments(targetEntry.attachments), removedAttachment])}::jsonb,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${targetEntry.id}
            AND "organizationId" = ${organization.id}
          RETURNING *
        `
      : await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
          INSERT INTO "ProjectLogbookEntry" (
            "id",
            "organizationId",
            "projectId",
            "title",
            "body",
            "author",
            "authorUserId",
            "colleague",
            "visibleFor",
            "attachments",
            "projectMonth"
          )
          VALUES (
            ${randomUUID()},
            ${organization.id},
            ${entry.projectId},
            ${targetTitle},
            ${`Bild "${removedAttachment.name}" verschoben.`},
            ${actorName},
            ${actorUserId || null},
            ${entry.colleague || null},
            ${JSON.stringify(cleanStringList(entry.visibleFor))}::jsonb,
            ${JSON.stringify([removedAttachment])}::jsonb,
            ${entry.projectMonth || null}
          )
          RETURNING *
        `;

    const historyRows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
      INSERT INTO "ProjectLogbookEntry" (
        "id",
        "organizationId",
        "projectId",
        "title",
        "body",
        "author",
        "authorUserId",
        "colleague",
        "visibleFor",
        "attachments",
        "projectMonth"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${entry.projectId},
        ${"Projektbild: verschoben"},
        ${`Bild "${removedAttachment.name}" wurde aus "${sourceTitle}" nach "${targetTitle}" verschoben.`},
        ${actorName},
        ${actorUserId || null},
        ${entry.colleague || null},
        ${JSON.stringify(cleanStringList(entry.visibleFor))}::jsonb,
        ${JSON.stringify([])}::jsonb,
        ${entry.projectMonth || null}
      )
      RETURNING *
    `;

    return NextResponse.json({
      entry: formatEntry(updatedRows[0]),
      targetEntry: formatEntry(movedRows[0]),
      history: formatEntry(historyRows[0]),
    });
  }
  const historyBody = isActivityReport
    ? `Tätigkeitsbericht "${removedAttachment.name}" wurde gelöscht.`
    : `${removedAttachment.type === "Bild" ? "Bild" : "Dokument"} "${removedAttachment.name}" wurde aus "${sourceTitle}" gelöscht.`;

  const historyRows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    INSERT INTO "ProjectLogbookEntry" (
      "id",
      "organizationId",
      "projectId",
      "title",
      "body",
      "author",
      "authorUserId",
      "colleague",
      "visibleFor",
      "attachments",
      "projectMonth"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${entry.projectId},
      ${historyTitle},
      ${historyBody},
      ${actorName},
      ${actorUserId || null},
      ${entry.colleague || null},
      ${JSON.stringify(cleanStringList(entry.visibleFor))}::jsonb,
      ${JSON.stringify([])}::jsonb,
      ${entry.projectMonth || null}
    )
    RETURNING *
  `;

  return NextResponse.json({
    entry: formatEntry(updatedRows[0]),
    history: formatEntry(historyRows[0]),
  });
}
