import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";

const A4_WIDTH = 595.276;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.35, 0.4, 0.48);
const LINE = rgb(0.78, 0.82, 0.88);
const TEAL = rgb(0, 0.62, 0.62);
const GREEN = rgb(0.08, 0.62, 0.31);
const ORANGE = rgb(0.9, 0.45, 0.05);

type ProjectReference = {
  branch: string | null;
  projectNumber: string | null;
  title: string | null;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
}

function cleanChecklist(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { label?: unknown; done?: unknown };
      const label = cleanString(candidate.label);
      if (!label) return null;
      return { label, done: Boolean(candidate.done) };
    })
    .filter(Boolean) as Array<{ label: string; done: boolean }>;
}

function formatGermanDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function sanitizeFileNamePart(value: string, fallback: string) {
  const sanitized = cleanString(value)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || fallback;
}

async function embedFonts(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Regular.ttf")),
      readFile(path.join(process.cwd(), "public", "fonts", "Outfit-Bold.ttf")),
    ]);
    return {
      regular: await pdfDoc.embedFont(regularBytes, { subset: true }),
      bold: await pdfDoc.embedFont(boldBytes, { subset: true }),
    };
  } catch {
    return {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    };
  }
}

function getTemplatePath(company: string) {
  const isImmocare = company.toLowerCase().includes("immocare");
  return path.join(process.cwd(), "public", "offer-templates", isImmocare ? "ok-immocare.pdf" : "ok-solutions.pdf");
}

async function addTemplatePage(pdfDoc: PDFDocument, templateDoc: PDFDocument) {
  const [templatePage] = await pdfDoc.copyPages(templateDoc, [0]);
  pdfDoc.addPage(templatePage);
  return templatePage;
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9, color = INK) {
  page.drawText(text, { x, y, font, size, color });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }

    let chunk = "";
    for (const char of Array.from(word)) {
      const candidateChunk = `${chunk}${char}`;
      if (font.widthOfTextAtSize(candidateChunk, size) <= maxWidth) {
        chunk = candidateChunk;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    line = chunk;
  }

  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size = 9,
  lineHeight = 13,
  color = INK
) {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => drawText(page, line, x, y - index * lineHeight, font, size, color));
  return y - lines.length * lineHeight;
}

function drawInfoRow(page: PDFPage, label: string, value: string, x: number, y: number, fonts: { regular: PDFFont; bold: PDFFont }) {
  drawText(page, label, x, y, fonts.bold, 8.5, MUTED);
  drawWrappedText(page, value || "-", x + 92, y, 270, fonts.regular, 8.5, 12, INK);
}

async function getProjectReference(organizationId: string, projectId: string) {
  const rows = await prisma.$queryRaw<ProjectReference[]>`
    SELECT "branch", "projectNumber", "title"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function generateFinalInspectionPdf(input: {
  company: string;
  projectLabel: string;
  employee: string;
  inspectionDate: Date;
  statusLabel: string;
  checklist: Array<{ label: string; done: boolean }>;
  comment: string;
  upsellNotes: string;
}) {
  const templateBytes = await readFile(getTemplatePath(input.company));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const page = await addTemplatePage(pdfDoc, templateDoc);
  const contentLeft = 58;
  const contentRight = A4_WIDTH - 58;
  let y = 650;

  drawText(page, "Endkontrolle", contentLeft, y, fonts.bold, 22, INK);
  y -= 30;
  drawWrappedText(page, input.projectLabel, contentLeft, y, contentRight - contentLeft, fonts.bold, 12, 16, INK);
  y -= 34;

  drawInfoRow(page, "Datum", formatGermanDate(input.inspectionDate), contentLeft, y, fonts);
  drawInfoRow(page, "Mitarbeiter", input.employee || "-", contentLeft, y - 18, fonts);
  drawInfoRow(page, "Status", input.statusLabel, contentLeft, y - 36, fonts);
  y -= 68;

  page.drawLine({ start: { x: contentLeft, y }, end: { x: contentRight, y }, thickness: 1, color: LINE });
  y -= 28;

  drawText(page, "Prüfpunkte", contentLeft, y, fonts.bold, 12, INK);
  y -= 22;

  const items =
    input.statusLabel.includes("Kollege")
      ? [{ label: "Endkontrolle wird vom Kollegen durchgeführt.", done: true }]
      : input.checklist;

  for (const item of items) {
    const boxY = y - 1;
    page.drawRectangle({
      x: contentLeft,
      y: boxY,
      width: 11,
      height: 11,
      borderColor: item.done ? GREEN : ORANGE,
      borderWidth: 1.2,
      color: item.done ? rgb(0.88, 0.98, 0.92) : rgb(1, 0.93, 0.84),
    });
    drawText(page, item.done ? "x" : "!", contentLeft + 3.2, y + 1, fonts.bold, 8, item.done ? GREEN : ORANGE);
    y = drawWrappedText(page, item.label, contentLeft + 20, y, contentRight - contentLeft - 20, fonts.regular, 9, 13, INK) - 7;
  }

  y -= 10;
  page.drawLine({ start: { x: contentLeft, y }, end: { x: contentRight, y }, thickness: 1, color: LINE });
  y -= 24;

  drawText(page, "Kommentar", contentLeft, y, fonts.bold, 11, INK);
  y = drawWrappedText(page, input.comment || "-", contentLeft, y - 16, contentRight - contentLeft, fonts.regular, 9, 13, INK) - 14;

  drawText(page, "Zusatzverkauf", contentLeft, y, fonts.bold, 11, INK);
  y = drawWrappedText(page, input.upsellNotes || "Nein", contentLeft, y - 16, contentRight - contentLeft, fonts.regular, 9, 13, input.upsellNotes ? TEAL : MUTED);

  pdfDoc.setTitle(`Endkontrolle ${input.projectLabel}`);
  pdfDoc.setSubject(input.company);
  pdfDoc.setProducer("WorkPilot360");
  pdfDoc.setCreator("WorkPilot360");

  return Buffer.from(await pdfDoc.save()).toString("base64");
}

async function ensureTables() {
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
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectLogbookEntry"
    ADD COLUMN IF NOT EXISTS "authorUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "projectMonth" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "notifyUpsell" BOOLEAN DEFAULT false
  `;

  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const projectId = cleanString(body.projectId);
  const projectLabel = cleanString(body.projectLabel);
  const comment = cleanString(body.comment);
  const status = cleanString(body.status) === "colleague" ? "colleague" : "completed";
  const upsellNotes = cleanString(body.upsellNotes);
  const checklist = cleanChecklist(body.checklist);

  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const employee = getActorName(actor);

  await ensureTables();

  const now = new Date();
  const projectReference = await getProjectReference(organization.id, projectId);
  const company = cleanString(projectReference?.branch) || "";
  const resolvedProjectLabel =
    projectLabel ||
    [projectReference?.projectNumber, projectReference?.title].map((part) => cleanString(part)).filter(Boolean).join(" | ") ||
    projectId;
  const statusLabel = status === "colleague" ? "Kollege führt Endkontrolle durch" : "Arbeit fertig";
  const checklistDoneCount = status === "colleague" ? 1 : checklist.filter((item) => item.done).length;
  const checklistTotalCount = status === "colleague" ? 1 : checklist.length;
  const pdfData = await generateFinalInspectionPdf({
    company,
    projectLabel: resolvedProjectLabel,
    employee,
    inspectionDate: now,
    statusLabel,
    checklist,
    comment,
    upsellNotes,
  });

  const logbookText = [
    "Endkontrolle gespeichert.",
    `Objekt: ${resolvedProjectLabel}`,
    `Datum: ${formatGermanDate(now)}`,
    `Mitarbeiter: ${employee || "-"}`,
    `Status: ${statusLabel}`,
    `Prüfpunkte: ${checklistDoneCount}/${checklistTotalCount} erledigt`,
    comment ? `Kommentar: ${comment}` : "",
    upsellNotes ? `Zusatzverkauf: ${upsellNotes}` : "Zusatzverkauf: Nein",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const attachmentName = `Endkontrolle_${sanitizeFileNamePart(resolvedProjectLabel, "Projekt")}_${formatGermanDate(now)}.pdf`;
  const attachments = [
    {
      name: attachmentName,
      type: "Dokument",
      mimeType: "application/pdf",
      size: Math.round((pdfData.length * 3) / 4),
      dataUrl: `data:application/pdf;base64,${pdfData}`,
    },
  ];

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
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
      "attachments"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${projectId},
      ${"Dokumente: Endkontrolle"},
      ${logbookText},
      ${employee || "System"},
      ${actor.id},
      ${status === "colleague" ? "Endkontrolle durch Kollegen" : ""},
      ${JSON.stringify(["Geschaeftsfuehrer", "Vertriebler", "Niederlassungsleiter", "Monteur", "Buchhaltung"])}::jsonb,
      ${JSON.stringify(attachments)}::jsonb
    )
    RETURNING "id"
  `;

  if (upsellNotes) {
    const recipients = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "User"
      WHERE "organizationId" = ${organization.id}
        AND COALESCE("isActive", true) = true
        AND COALESCE("notifyUpsell", false) = true
    `;

    for (const recipient of recipients) {
      await prisma.$executeRaw`
        INSERT INTO "Notification" (
          "id",
          "organizationId",
          "userId",
          "channel",
          "subject",
          "body",
          "createdAt",
          "linkTarget",
          "linkTargetId",
          "linkLabel"
        )
        VALUES (
          ${randomUUID()},
          ${organization.id},
          ${recipient.id},
          'app',
          ${"Zusatzverkauf erkannt"},
          ${`Im Projekt ${projectLabel || projectId} wurde ein Zusatzverkauf erkannt: ${upsellNotes}`},
          CURRENT_TIMESTAMP,
          ${"project-logbook"},
          ${projectId},
          ${"Zusatzverkauf ansehen"}
        )
      `;
    }
  }

  return NextResponse.json({ id: rows[0]?.id ?? "", success: true }, { status: 201 });
}
