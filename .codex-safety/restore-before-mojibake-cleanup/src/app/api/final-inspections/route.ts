import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function createTextDataUrl(text: string) {
  return `data:text/plain;charset=utf-8;base64,${Buffer.from(text, "utf8").toString("base64")}`;
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
      "colleague" TEXT,
      "visibleFor" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
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
  const body = await req.json();
  const projectId = cleanString(body.projectId);
  const projectLabel = cleanString(body.projectLabel);
  const employee = cleanString(body.employee);
  const comment = cleanString(body.comment);
  const status = cleanString(body.status) === "colleague" ? "colleague" : "completed";
  const upsellNotes = cleanString(body.upsellNotes);
  const checklist = cleanChecklist(body.checklist);

  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  const { organization } = await getDemoContext();
  await ensureTables();

  const checkedLines =
    status === "colleague"
      ? ["Endkontrolle wird vom Kollegen durchgeführt."]
      : checklist.map((item) => `${item.done ? "[x]" : "[ ]"} ${item.label}`);
  const text = [
    `Objekt: ${projectLabel || projectId}`,
    `Datum: ${new Intl.DateTimeFormat("de-DE").format(new Date())}`,
    `Mitarbeiter: ${employee || "-"}`,
    "",
    "Endkontrolle",
    ...checkedLines,
    "",
    `Status: ${status === "colleague" ? "Kollege führt Endkontrolle durch" : "Arbeit fertig"}`,
    comment ? `Kommentar: ${comment}` : "",
    upsellNotes ? `Zusatzverkauf: ${upsellNotes}` : "Zusatzverkauf: Nein",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const attachmentName = `Endkontrolle ${new Intl.DateTimeFormat("de-DE").format(new Date())}.txt`;
  const attachments = [
    {
      name: attachmentName,
      type: "Dokument",
      mimeType: "text/plain",
      size: text.length,
      dataUrl: createTextDataUrl(text),
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
      "colleague",
      "visibleFor",
      "attachments"
    )
    VALUES (
      ${randomUUID()},
      ${organization.id},
      ${projectId},
      ${"Dokumente: Endkontrolle"},
      ${text},
      ${employee || "System"},
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
