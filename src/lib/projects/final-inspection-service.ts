import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "@/lib/db/client";
import { getBerlinMonthKey } from "@/lib/date-time";
import {
  cleanupStorageBackedPayload,
  persistStorageBackedPayload,
  prepareStorageBackedPayload,
} from "@/lib/storage/document-file";
import { executeProjectStatusChange } from "@/lib/projects/project-status-service";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";

export const FINAL_INSPECTION_ITEMS = [
  "Auftrag vollständig erledigt",
  "Ergebnis sauber und ordentlich",
  "Keine sichtbaren Mängel",
  "Arbeitsbereich sicher und sauber hinterlassen",
  "Material / Geräte mitgenommen",
  "Besonderheiten oder Schäden gemeldet",
] as const;

export class FinalInspectionServiceError extends Error {
  constructor(
    public readonly code: "invalid_input" | "not_found" | "conflict",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type FinalInspectionInput = {
  projectId: string;
  projectLabel?: string;
  mode: "self" | "colleague";
  allChecksDone?: boolean;
  comment?: string;
  upsellNotes?: string;
};

type ProjectReference = {
  id: string;
  branch: string | null;
  projectNumber: string;
  title: string;
};

const A4_WIDTH = 595.276;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.35, 0.4, 0.48);
const LINE = rgb(0.78, 0.82, 0.88);
const TEAL = rgb(0, 0.62, 0.62);
const GREEN = rgb(0.08, 0.62, 0.31);

function clean(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function formatGermanDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(value);
}

function sanitizeFileNamePart(value: string, fallback: string) {
  return clean(value, 500)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return year && month
    ? new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(Date.UTC(year, month - 1, 1, 12)))
    : monthKey;
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

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9, color = INK) {
  page.drawText(text, { x, y, font, size, color });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
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
    for (const character of Array.from(word)) {
      if (font.widthOfTextAtSize(`${chunk}${character}`, size) <= maxWidth) chunk += character;
      else {
        if (chunk) lines.push(chunk);
        chunk = character;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size = 9, lineHeight = 13, color = INK) {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => drawText(page, line, x, y - index * lineHeight, font, size, color));
  return y - lines.length * lineHeight;
}

function drawInfoRow(page: PDFPage, label: string, value: string, x: number, y: number, fonts: { regular: PDFFont; bold: PDFFont }) {
  drawText(page, label, x, y, fonts.bold, 8.5, MUTED);
  drawWrappedText(page, value || "-", x + 92, y, 270, fonts.regular, 8.5, 12, INK);
}

async function generatePdf(input: {
  company: string;
  projectLabel: string;
  employee: string;
  inspectionDate: Date;
  mode: "self" | "colleague";
  comment: string;
  upsellNotes: string;
}) {
  const templateName = input.company.toLowerCase().includes("immocare") ? "ok-immocare.pdf" : "ok-solutions.pdf";
  const templateBytes = await readFile(path.join(process.cwd(), "public", "offer-templates", templateName));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const [templatePage] = await pdfDoc.copyPages(templateDoc, [0]);
  pdfDoc.addPage(templatePage);
  const left = 58;
  const right = A4_WIDTH - 58;
  let y = 650;
  const statusLabel = input.mode === "colleague" ? "Kollege führt Endkontrolle durch" : "Arbeit fertig";

  drawText(templatePage, "Endkontrolle", left, y, fonts.bold, 22, INK);
  y -= 30;
  drawWrappedText(templatePage, input.projectLabel, left, y, right - left, fonts.bold, 12, 16, INK);
  y -= 34;
  drawInfoRow(templatePage, "Datum", formatGermanDate(input.inspectionDate), left, y, fonts);
  drawInfoRow(templatePage, "Mitarbeiter", input.employee || "-", left, y - 18, fonts);
  drawInfoRow(templatePage, "Status", statusLabel, left, y - 36, fonts);
  y -= 68;
  templatePage.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 28;
  drawText(templatePage, "Prüfpunkte", left, y, fonts.bold, 12, INK);
  y -= 22;
  const items = input.mode === "colleague"
    ? ["Endkontrolle wird vom Kollegen durchgeführt."]
    : [...FINAL_INSPECTION_ITEMS];
  for (const item of items) {
    templatePage.drawRectangle({ x: left, y: y - 1, width: 11, height: 11, borderColor: GREEN, borderWidth: 1.2, color: rgb(0.88, 0.98, 0.92) });
    drawText(templatePage, "x", left + 3.2, y + 1, fonts.bold, 8, GREEN);
    y = drawWrappedText(templatePage, item, left + 20, y, right - left - 20, fonts.regular, 9, 13, INK) - 7;
  }
  y -= 10;
  templatePage.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 24;
  drawText(templatePage, "Kommentar", left, y, fonts.bold, 11, INK);
  y = drawWrappedText(templatePage, input.comment || "-", left, y - 16, right - left, fonts.regular, 9, 13, INK) - 14;
  drawText(templatePage, "Zusatzverkauf", left, y, fonts.bold, 11, INK);
  drawWrappedText(templatePage, input.upsellNotes || "Nein", left, y - 16, right - left, fonts.regular, 9, 13, input.upsellNotes ? TEAL : MUTED);
  pdfDoc.setTitle(`Endkontrolle ${input.projectLabel}`);
  pdfDoc.setSubject(input.company);
  pdfDoc.setProducer("WorkPilot360");
  pdfDoc.setCreator("WorkPilot360");
  return Buffer.from(await pdfDoc.save());
}

export async function createFinalInspection(input: {
  organizationId: string;
  actorUserId: string;
  actorName: string;
  inspection: FinalInspectionInput;
  requestId: string;
  source: "ui" | "jarvis";
  now?: Date;
}) {
  const organizationId = clean(input.organizationId, 120);
  const actorUserId = clean(input.actorUserId, 120);
  const requestId = clean(input.requestId, 240);
  const projectId = clean(input.inspection.projectId, 120);
  const comment = clean(input.inspection.comment);
  const upsellNotes = clean(input.inspection.upsellNotes);
  if (!organizationId || !actorUserId || !requestId || !projectId) {
    throw new FinalInspectionServiceError("invalid_input", "Organisation, Benutzer, Projekt und Ausführungs-ID müssen eindeutig feststehen.", 400);
  }
  if (input.inspection.mode === "self" && !input.inspection.allChecksDone) {
    throw new FinalInspectionServiceError("invalid_input", "Für die eigene Endkontrolle müssen alle sechs Prüfpunkte ausdrücklich bestätigt sein.", 400);
  }
  const [actor, project, existing] = await Promise.all([
    prisma.user.findFirst({ where: { id: actorUserId, organizationId, isActive: true }, select: { id: true } }),
    prisma.workPilotProject.findFirst({ where: { id: projectId, organizationId }, select: { id: true, branch: true, projectNumber: true, title: true } }),
    prisma.projectLogbookEntry.findFirst({ where: { organizationId, projectId, source: "stamp-session-final-inspection", callReference: requestId } }),
  ]);
  if (!actor) throw new FinalInspectionServiceError("not_found", "Der ausführende Benutzer ist nicht mehr aktiv.", 404);
  if (!project) throw new FinalInspectionServiceError("not_found", "Das Projekt wurde in dieser Organisation nicht gefunden.", 404);
  if (existing) return { id: existing.id, replayed: true, projectMonth: existing.projectMonth ?? "" };

  const now = input.now ?? new Date();
  const projectMonth = getBerlinMonthKey(now);
  const projectLabel = clean(input.inspection.projectLabel, 1000) || [project.projectNumber, project.title].filter(Boolean).join(" | ") || project.id;
  const actorName = clean(input.actorName, 500) || "System";
  const pdf = await generatePdf({ company: clean(project.branch, 240), projectLabel, employee: actorName, inspectionDate: now, mode: input.inspection.mode, comment, upsellNotes });
  const attachmentName = `Endkontrolle_${sanitizeFileNamePart(projectLabel, "Projekt")}_${formatGermanDate(now)}.pdf`;
  const preparedPdf = await prepareStorageBackedPayload({
    organizationId,
    ownerType: "project",
    ownerId: projectId,
    sourceType: "final-inspection-pdf",
    category: "final-inspections",
    originalName: attachmentName,
    contentType: "application/pdf",
    bytes: pdf,
    createdByUserId: actorUserId,
  });
  const statusLabel = input.inspection.mode === "colleague" ? "Kollege führt Endkontrolle durch" : "Arbeit fertig";
  const checklistCount = input.inspection.mode === "colleague" ? 1 : FINAL_INSPECTION_ITEMS.length;
  const body = [
    "Endkontrolle gespeichert.",
    `Objekt: ${projectLabel}`,
    `Datum: ${formatGermanDate(now)}`,
    `Mitarbeiter: ${actorName}`,
    `Status: ${statusLabel}`,
    `Prüfpunkte: ${checklistCount}/${checklistCount} erledigt`,
    comment ? `Kommentar: ${comment}` : "",
    upsellNotes ? `Zusatzverkauf: ${upsellNotes}` : "Zusatzverkauf: Nein",
  ].filter(Boolean).join("\n");

  let replayedInsideTransaction = false;
  try {
    const saved = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`final-inspection:${organizationId}:${projectId}:${requestId}`}, 0))`;
      const replay = await tx.projectLogbookEntry.findFirst({ where: { organizationId, projectId, source: "stamp-session-final-inspection", callReference: requestId } });
      if (replay) {
        replayedInsideTransaction = true;
        return replay;
      }
      await persistStorageBackedPayload(tx, preparedPdf);
      const entry = await tx.projectLogbookEntry.create({
        data: {
          id: randomUUID(), organizationId, projectId, title: "Dokumente: Endkontrolle", body,
          author: actorName, authorUserId: actorUserId,
          colleague: input.inspection.mode === "colleague" ? "Endkontrolle durch Kollegen" : "",
          visibleFor: ["Geschaeftsfuehrer", "Vertriebler", "Niederlassungsleiter", "Monteur", "Buchhaltung"],
          attachments: preparedPdf.prepared.attachments,
          projectMonth, source: "stamp-session-final-inspection", callReference: requestId,
        },
      });
      if (upsellNotes) {
        const recipients = await tx.user.findMany({ where: { organizationId, isActive: true, notifyUpsell: true }, select: { id: true } });
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            id: stableId("final-inspection-upsell", requestId, recipient.id), organizationId, userId: recipient.id,
            channel: "app", subject: "Zusatzverkauf erkannt",
            body: `Im Projekt ${projectLabel} wurde ein Zusatzverkauf erkannt: ${upsellNotes}`,
            linkTarget: "project-logbook", linkTargetId: projectId, linkLabel: "Zusatzverkauf ansehen",
          })),
          skipDuplicates: true,
        });
      }
      return entry;
    });
    if (replayedInsideTransaction) await cleanupStorageBackedPayload(preparedPdf);
    return { id: saved.id, replayed: replayedInsideTransaction, projectMonth: saved.projectMonth ?? projectMonth };
  } catch (error) {
    await cleanupStorageBackedPayload(preparedPdf);
    throw error;
  }
}

export async function applyFinalInspectionBillingStatus(input: {
  organizationId: string;
  projectId: string;
  projectMonth: string;
  actorUserId: string;
  actorName: string;
  requestId: string;
  source: "ui" | "jarvis";
}) {
  const project = await prisma.workPilotProject.findFirst({
    where: { organizationId: input.organizationId, id: input.projectId },
    select: { id: true, projectNumber: true, title: true, status: true, projectKind: true, projectType: true, branch: true, responsibleName: true },
  });
  if (!project) throw new FinalInspectionServiceError("not_found", "Das Projekt wurde in dieser Organisation nicht gefunden.", 404);
  if (["Abgeschlossen", "Archiviert"].includes(project.status)) return null;
  const recurring = clean(project.projectKind, 240).toLocaleLowerCase("de-DE").includes("dauerl");
  const evidenceWhere = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    ...(recurring && input.projectMonth ? { projectMonth: input.projectMonth } : {}),
  };
  const [finalInspections, beforeImages, afterImages] = await Promise.all([
    prisma.projectLogbookEntry.count({ where: { ...evidenceWhere, title: "Dokumente: Endkontrolle" } }),
    prisma.projectLogbookEntry.count({ where: { ...evidenceWhere, title: "Bilder: Vorherbilder" } }),
    prisma.projectLogbookEntry.count({ where: { ...evidenceWhere, title: "Bilder: Nachherbilder" } }),
  ]);
  const isImmocare = `${project.branch || ""} ${project.projectType || ""} ${project.projectNumber}`.toLocaleLowerCase("de-DE").includes("immocare")
    || project.projectNumber.toLocaleLowerCase("de-DE").startsWith("oki");
  const ready = finalInspections > 0 && (!isImmocare || (beforeImages > 0 && afterImages > 0));
  const targetStatus = ready ? "Zur Abrechnung bereit" : "Abrechnungsprüfung";
  const missing = [finalInspections ? "" : "Endkontrolle", isImmocare && !beforeImages ? "Vorherbild" : "", isImmocare && !afterImages ? "Nachherbild" : ""].filter(Boolean);
  const changed = project.status !== targetStatus;
  if (changed) {
    await prisma.$transaction((tx) => executeProjectStatusChange({
      tx,
      organizationId: input.organizationId,
      projectId: input.projectId,
      targetStatus,
      reason: ready ? "Abrechnungsprüfung vollständig" : `Abrechnungsprüfung offen: ${missing.join(", ")}`,
      actorId: input.actorUserId,
      actorName: input.actorName,
      requestId: input.requestId,
      source: input.source,
    }), { isolationLevel: "Serializable" });
  }
  if (ready) {
    const users = await prisma.user.findMany({ where: { organizationId: input.organizationId, isActive: true } });
    const responsibleName = clean(project.responsibleName, 500).toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
    const responsible = users.find((user) => [user.firstName, user.lastName].filter(Boolean).join(" ").toLocaleLowerCase("de-DE").replace(/\s+/g, " ") === responsibleName);
    const recipients = responsible ? [responsible] : users.filter((user) => user.role === "GESCHAEFTSFUEHRER" || user.role === "ADMIN");
    const subject = recurring ? `Dauerläufer abrechnungsbereit: ${formatMonthLabel(input.projectMonth)}` : "Projekt abrechnungsbereit";
    const projectLabel = [project.projectNumber, project.title].filter(Boolean).join(" | ");
    const body = recurring
      ? `${projectLabel}: Für ${formatMonthLabel(input.projectMonth)} sind die Pflichtnachweise vorhanden. Bitte Monatsrechnung erstellen oder prüfen.`
      : `${projectLabel}: Alle Pflichtnachweise sind vorhanden. Bitte Rechnung erstellen oder prüfen.`;
    for (const recipient of recipients) {
      const id = stableId("billing-ready", input.requestId, recipient.id);
      const existing = await prisma.notification.findUnique({ where: { id }, select: { id: true } });
      if (existing) continue;
      await prisma.notification.create({ data: { id, organizationId: input.organizationId, userId: recipient.id, channel: "app", subject, body, linkTarget: "project", linkTargetId: project.id, linkLabel: "Projekt öffnen" } });
      await sendNotificationMailSafely({ notificationId: id, userId: recipient.id, subject, body });
    }
  }
  return { changed, previousStatus: project.status, nextStatus: targetStatus };
}
