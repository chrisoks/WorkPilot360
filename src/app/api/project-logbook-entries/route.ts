import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

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
  colleague: string | null;
  visibleFor: unknown;
  attachments: unknown;
  createdAt: Date;
};

async function ensureProjectLogbookEntryTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectLogbookEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "title" TEXT,
      "body" TEXT NOT NULL,
      "author" TEXT,
      "colleague" TEXT,
      "visibleFor" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    colleague: entry.colleague || "",
    visibleFor: cleanStringList(entry.visibleFor),
    attachments: cleanAttachments(entry.attachments),
  };
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureProjectLogbookEntryTable();

  const entries = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    SELECT *
    FROM "ProjectLogbookEntry"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "createdAt" DESC
  `;

  return NextResponse.json(entries.map(formatEntry));
}

export async function POST(req: Request) {
  const body = await req.json();
  const projectId = cleanString(body.projectId);
  const text = cleanString(body.text);

  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Bitte einen Logbucheintrag erfassen." }, { status: 400 });
  }

  const { organization } = await getDemoContext();
  await ensureProjectLogbookEntryTable();

  const id = cleanString(body.id) || randomUUID();
  const title = cleanString(body.title) || "Eintrag";
  const author = cleanString(body.author);
  const colleague = cleanString(body.colleague);
  const visibleFor = cleanStringList(body.visibleFor);
  const attachments = cleanAttachments(body.attachments);

  const rows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    INSERT INTO "ProjectLogbookEntry" (
      "id",
      "organizationId",
      "projectId",
      "title",
      "body",
      "author",
      "colleague",
      "visibleFor",
      "attachments"
    )
    VALUES (
      ${id},
      ${organization.id},
      ${projectId},
      ${title},
      ${text},
      ${author || null},
      ${colleague || null},
      ${JSON.stringify(visibleFor)}::jsonb,
      ${JSON.stringify(attachments)}::jsonb
    )
    RETURNING *
  `;

  return NextResponse.json(formatEntry(rows[0]), { status: 201 });
}
