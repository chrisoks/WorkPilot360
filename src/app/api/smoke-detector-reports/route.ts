import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { getDemoContext } from "@/lib/demo/context";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { canArchiveProjects, canCreateProjectLogbookEntries } from "@/lib/permissions";

type LogbookAttachment = {
  name: string;
  type: "Bild" | "Dokument";
  mimeType?: string;
  size?: number;
  dataUrl?: string;
};

type ProjectRow = {
  id: string;
  organizationId: string;
  projectNumber: string;
  title: string;
  status: string;
  customer: string | null;
  contactId: string | null;
  contactPersonId: string | null;
  branch: string | null;
  address: string | null;
  responsibleName: string | null;
};

type ContactRow = {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
};

type ProjectLogbookEntryRow = {
  id: string;
  projectId: string;
  title: string | null;
  body: string;
  author: string | null;
  colleague: string | null;
  visibleFor: unknown;
  attachments: unknown;
  createdAt: Date;
};

type SmokeDetectorDevice = {
  id: string;
  building: string;
  floor: string;
  unit: string;
  room: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  manufactureDate: string;
  battery: string;
  radioLinked: boolean;
  detectorType: string;
  ceilingPosition: string;
  distanceNotes: string;
  specialNotes: string;
  locationCompliant: boolean;
  functionTestPassed: boolean;
  visualInspectionPassed: boolean;
  signalTestDone: boolean;
  mountedSecurely: boolean;
  images: LogbookAttachment[];
};

type SmokeDetectorPayload = {
  projectId: string;
  installationDate: string;
  installer: string;
  objectNotes: string;
  deviations: string;
  devices: SmokeDetectorDevice[];
  objectImages: LogbookAttachment[];
};

const A4_WIDTH = 595.276;
const A4_HEIGHT = 841.89;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.35, 0.4, 0.48);
const LINE = rgb(0.78, 0.82, 0.88);
const BLUE = rgb(0.04, 0.38, 0.82);
const GREEN = rgb(0.02, 0.55, 0.32);
const MAX_REPORT_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_REPORT_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_REPORT_SOURCE_IMAGE_TOTAL_BYTES = 48 * 1024 * 1024;
const ALLOWED_REPORT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_REPORT_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function forbiddenReportResponse() {
  return NextResponse.json(
    { error: "Du darfst fuer dieses Projekt keinen Rauchmelder-Nachweis erstellen." },
    { status: 403 }
  );
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function isArchivedProjectStatus(status: string) {
  return status.trim().toLowerCase().includes("archiviert");
}

function formatFileSize(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function getAttachmentExtension(name: string) {
  return name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
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

function isAllowedReportImage(attachment: LogbookAttachment) {
  const mimeType = (attachment.mimeType || "").toLowerCase();
  const extension = getAttachmentExtension(attachment.name);
  return (
    ALLOWED_REPORT_IMAGE_MIME_TYPES.has(mimeType) ||
    (!mimeType && ALLOWED_REPORT_IMAGE_EXTENSIONS.has(extension)) ||
    ALLOWED_REPORT_IMAGE_EXTENSIONS.has(extension)
  );
}

function cleanBoolean(value: unknown) {
  return value === true;
}

function cleanAttachments(value: unknown): LogbookAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<LogbookAttachment[]>((attachments, attachment) => {
    if (!attachment || typeof attachment !== "object") return attachments;
    const candidate = attachment as Partial<LogbookAttachment>;
    const name = cleanString(candidate.name);
    const dataUrl = cleanString(candidate.dataUrl);
    if (!name || !dataUrl) return attachments;

    attachments.push({
      name,
      type: candidate.type === "Dokument" ? "Dokument" : "Bild",
      mimeType: cleanString(candidate.mimeType),
      size: Number.isFinite(Number(candidate.size)) ? Number(candidate.size) : 0,
      dataUrl,
    });

    return attachments;
  }, []);
}

function cleanDevice(value: unknown): SmokeDetectorDevice | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const room = cleanString(candidate.room);
  const manufacturer = cleanString(candidate.manufacturer);
  const model = cleanString(candidate.model);
  const serialNumber = cleanString(candidate.serialNumber);

  if (!room && !manufacturer && !model && !serialNumber) return null;

  return {
    id: cleanString(candidate.id) || randomUUID(),
    building: cleanString(candidate.building),
    floor: cleanString(candidate.floor),
    unit: cleanString(candidate.unit),
    room,
    manufacturer,
    model,
    serialNumber,
    manufactureDate: cleanString(candidate.manufactureDate),
    battery: cleanString(candidate.battery),
    radioLinked: cleanBoolean(candidate.radioLinked),
    detectorType: cleanString(candidate.detectorType),
    ceilingPosition: cleanString(candidate.ceilingPosition),
    distanceNotes: cleanString(candidate.distanceNotes),
    specialNotes: cleanString(candidate.specialNotes),
    locationCompliant: cleanBoolean(candidate.locationCompliant),
    functionTestPassed: cleanBoolean(candidate.functionTestPassed),
    visualInspectionPassed: cleanBoolean(candidate.visualInspectionPassed),
    signalTestDone: cleanBoolean(candidate.signalTestDone),
    mountedSecurely: cleanBoolean(candidate.mountedSecurely),
    images: cleanAttachments(candidate.images),
  };
}

function cleanPayload(body: Record<string, unknown>): SmokeDetectorPayload {
  return {
    projectId: cleanString(body.projectId),
    installationDate: cleanString(body.installationDate),
    installer: cleanString(body.installer),
    objectNotes: cleanString(body.objectNotes),
    deviations: cleanString(body.deviations),
    devices: Array.isArray(body.devices) ? body.devices.map(cleanDevice).filter((device): device is SmokeDetectorDevice => Boolean(device)) : [],
    objectImages: cleanAttachments(body.objectImages),
  };
}

function getSmokeDetectorImages(payload: SmokeDetectorPayload) {
  return [
    ...payload.objectImages,
    ...payload.devices.flatMap((device) => device.images),
  ];
}

function validateSmokeDetectorImages(payload: SmokeDetectorPayload) {
  const images = getSmokeDetectorImages(payload);
  let totalBytes = 0;

  for (const image of images) {
    if (!image.dataUrl?.startsWith("data:")) {
      return {
        status: 400,
        error: `Bild "${image.name}" hat ein ungueltiges Datenformat.`,
      };
    }

    if (!isAllowedReportImage(image)) {
      return {
        status: 400,
        error: `Bildtyp von "${image.name}" ist nicht erlaubt.`,
      };
    }

    const imageBytes = getAttachmentBytes(image);
    if (imageBytes > MAX_REPORT_SOURCE_IMAGE_BYTES) {
      return {
        status: 413,
        error: `Bild "${image.name}" ist zu gross. Erlaubt sind maximal ${formatFileSize(
          MAX_REPORT_SOURCE_IMAGE_BYTES
        )} pro Bild.`,
      };
    }
    totalBytes += imageBytes;
  }

  if (totalBytes > MAX_REPORT_SOURCE_IMAGE_TOTAL_BYTES) {
    return {
      status: 413,
      error: `Die Bilder sind zusammen zu gross. Erlaubt sind maximal ${formatFileSize(
        MAX_REPORT_SOURCE_IMAGE_TOTAL_BYTES
      )} pro Nachweis.`,
    };
  }

  return null;
}

function cleanStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => cleanString(item)).filter(Boolean) : [];
}

function formatEntry(entry: ProjectLogbookEntryRow) {
  return {
    id: entry.id,
    projectId: entry.projectId,
    date: new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(entry.createdAt),
    title: entry.title || "Eintrag",
    text: entry.body,
    author: entry.author || "",
    colleague: entry.colleague || "",
    visibleFor: cleanStringList(entry.visibleFor),
    attachments: cleanAttachments(entry.attachments),
  };
}

async function ensureReadTables() {
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
    CREATE TABLE IF NOT EXISTS "WorkPilotProject" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "title" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT '',
      "customer" TEXT,
      "contactId" TEXT,
      "contactPersonId" TEXT,
      "branch" TEXT,
      "address" TEXT,
      "responsibleName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "WorkPilotProject"
    ADD COLUMN IF NOT EXISTS "projectNumber" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "customer" TEXT,
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "contactPersonId" TEXT,
    ADD COLUMN IF NOT EXISTS "branch" TEXT,
    ADD COLUMN IF NOT EXISTS "address" TEXT,
    ADD COLUMN IF NOT EXISTS "responsibleName" TEXT
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Contact" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "companyName" TEXT,
      "firstName" TEXT,
      "lastName" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "mobile" TEXT,
      "street" TEXT,
      "addressLine1" TEXT,
      "addressLine2" TEXT,
      "postalCode" TEXT,
      "city" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Contact"
    ADD COLUMN IF NOT EXISTS "companyName" TEXT,
    ADD COLUMN IF NOT EXISTS "firstName" TEXT,
    ADD COLUMN IF NOT EXISTS "lastName" TEXT,
    ADD COLUMN IF NOT EXISTS "email" TEXT,
    ADD COLUMN IF NOT EXISTS "phone" TEXT,
    ADD COLUMN IF NOT EXISTS "mobile" TEXT,
    ADD COLUMN IF NOT EXISTS "street" TEXT,
    ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
    ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
    ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
    ADD COLUMN IF NOT EXISTS "city" TEXT
  `;
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function parseInputDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function sanitizeFilePart(value: string) {
  return cleanString(value)
    .replace(/[^\p{L}\p{N}-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildReportName(project: ProjectRow, installationDate: Date) {
  const projectNumber = sanitizeFilePart(project.projectNumber || project.id || "Projekt");
  const datePart = formatDate(installationDate).replace(/\./g, "-");
  return `Rauchmelder_Nachweis_${projectNumber}_${datePart}`;
}

function formatProjectAddress(project: ProjectRow) {
  return cleanString(project.address).split(",").map((line) => line.trim()).filter(Boolean);
}

function contactName(contact?: ContactRow | null) {
  if (!contact) return "";
  return [contact.firstName, contact.lastName].map((part) => cleanString(part)).filter(Boolean).join(" ");
}

function contactCompanyOrName(contact?: ContactRow | null) {
  if (!contact) return "";
  return cleanString(contact.companyName) || contactName(contact);
}

function contactAddressLines(contact?: ContactRow | null) {
  if (!contact) return [];
  return [
    cleanString(contactCompanyOrName(contact)),
    cleanString(contactName(contact)) && cleanString(contact.companyName) ? cleanString(contactName(contact)) : "",
    cleanString(contact.addressLine1),
    cleanString(contact.addressLine2),
    cleanString(contact.street),
    [contact.postalCode, contact.city].map((part) => cleanString(part)).filter(Boolean).join(" "),
  ].filter(Boolean);
}

function getTemplatePath(company: string) {
  const isImmocare = company.toLowerCase().includes("immocare");
  return path.join(process.cwd(), "public", "offer-templates", isImmocare ? "ok-immocare.pdf" : "ok-solutions.pdf");
}

async function addTemplatePage(pdfDoc: PDFDocument, templateDoc: PDFDocument, pageIndex: 0 | 1) {
  const [templatePage] = await pdfDoc.copyPages(templateDoc, [pageIndex]);
  pdfDoc.addPage(templatePage);
  return templatePage;
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9, color = INK) {
  page.drawText(text, { x, y, font, size, color });
}

function drawRightAlignedText(page: PDFPage, text: string, rightX: number, y: number, font: PDFFont, size = 9, color = INK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - width, y, font, size, color });
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
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  lines.forEach((lineText, index) => drawText(page, lineText, x, y - index * lineHeight, font, size, color));
  return y - lines.length * lineHeight;
}

function drawInfoRow(page: PDFPage, label: string, value: string, x: number, y: number, fonts: { regular: PDFFont; bold: PDFFont }) {
  drawText(page, label, x, y, fonts.bold, 8.4, MUTED);
  drawRightAlignedText(page, value || "-", 552, y, fonts.regular, 8.4, INK);
}

function drawTableRow(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  fonts: { regular: PDFFont; bold: PDFFont },
  fill = false
) {
  if (fill) page.drawRectangle({ x, y: y - 7, width, height: 22, color: rgb(0.96, 0.98, 1) });
  page.drawLine({ start: { x, y: y - 8 }, end: { x: x + width, y: y - 8 }, thickness: 0.5, color: LINE });
  drawText(page, label, x + 8, y, fonts.bold, 8.2, MUTED);
  drawWrappedText(page, value || "-", x + 150, y, width - 160, fonts.regular, 8.2, 10.5, INK);
}

function yesNo(value: boolean) {
  return value ? "Ja" : "Nein";
}

async function embedReportImage(pdfDoc: PDFDocument, image: LogbookAttachment) {
  const base64 = image.dataUrl?.split(",")[1] ?? "";
  const bytes = Buffer.from(base64, "base64");
  const mimeType = image.mimeType?.toLowerCase() ?? "";

  if (mimeType.includes("png")) {
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  }

  try {
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return await pdfDoc.embedPng(bytes);
  }
}

function drawImageContained(page: PDFPage, embedded: PDFImage, box: { x: number; y: number; width: number; height: number }) {
  const scale = Math.min(box.width / embedded.width, box.height / embedded.height);
  const width = embedded.width * scale;
  const height = embedded.height * scale;
  page.drawImage(embedded, {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  });
}

async function generateSmokeDetectorReportPdf(input: {
  project: ProjectRow;
  customerContact?: ContactRow | null;
  contactPerson?: ContactRow | null;
  payload: SmokeDetectorPayload;
  reportName: string;
  installationDate: Date;
}) {
  const templateBytes = await readFile(getTemplatePath(input.project.branch || ""));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const firstPage = await addTemplatePage(pdfDoc, templateDoc, 0);
  const recipientLines = contactAddressLines(input.customerContact);
  const fallbackAddress = [input.project.customer || "Kunde", ...formatProjectAddress(input.project)];
  const addressLines = recipientLines.length > 0 ? recipientLines : fallbackAddress;

  let y = 672;
  addressLines.slice(0, 4).forEach((line, index) => {
    drawText(firstPage, line, 71, y, index === 0 ? fonts.bold : fonts.regular, index === 0 ? 8.7 : 8.4);
    y -= 12;
  });

  [
    ["Dokument", "Rauchmelder-Installationsnachweis"],
    ["Projektnummer", input.project.projectNumber],
    ["Installationsdatum", formatDate(input.installationDate)],
    ["Monteur/Fachkraft", input.payload.installer || input.project.responsibleName || contactName(input.contactPerson)],
    ["Telefon", input.contactPerson?.phone || input.contactPerson?.mobile || ""],
    ["E-Mail", input.contactPerson?.email || ""],
  ].forEach(([label, value], index) => drawInfoRow(firstPage, label, value, 313, 676 - index * 13, fonts));

  drawText(firstPage, `Projekt: ${input.project.title || "-"}`, 71, 544, fonts.bold, 10.7, INK);
  drawText(firstPage, "Rauchmelder-Installationsnachweis", 71, 520, fonts.bold, 14, INK);
  drawWrappedText(
    firstPage,
    "Dieser Nachweis dokumentiert die Installation der Rauchwarnmelder im genannten Objekt. Er umfasst Objekt- und Gerätedaten, Montageorte, die bei der Installation durchgeführten Prüfungen sowie zugeordnete Bildnachweise.",
    71,
    492,
    480,
    fonts.regular,
    8.8,
    12
  );
  drawWrappedText(
    firstPage,
    "Der Nachweis ist ein Installationsnachweis und ersetzt kein separates Wartungs- oder Instandhaltungsprotokoll.",
    71,
    444,
    480,
    fonts.bold,
    8.8,
    12
  );

  drawText(firstPage, "Objekt / Nutzungseinheit", 71, 392, fonts.bold, 10.5, INK);
  drawWrappedText(firstPage, input.payload.objectNotes || input.project.address || "-", 71, 374, 480, fonts.regular, 8.8, 12);

  drawText(firstPage, "Zusammenfassung", 71, 320, fonts.bold, 10.5, INK);
  drawText(firstPage, `${input.payload.devices.length} Rauchwarnmelder dokumentiert`, 71, 302, fonts.regular, 8.8, INK);
  drawText(firstPage, `${input.payload.devices.reduce((sum, device) => sum + device.images.length, 0)} Melderbilder, ${input.payload.objectImages.length} Objektbilder`, 71, 288, fonts.regular, 8.8, INK);
  if (input.payload.deviations) {
    drawText(firstPage, "Abweichungen / Hinweise", 71, 254, fonts.bold, 10.5, INK);
    drawWrappedText(firstPage, input.payload.deviations, 71, 236, 480, fonts.regular, 8.8, 12);
  }
  drawText(firstPage, "Unterschrift Monteur/Fachkraft", 71, 130, fonts.bold, 8.8, MUTED);
  firstPage.drawLine({ start: { x: 71, y: 106 }, end: { x: 250, y: 106 }, thickness: 0.7, color: LINE });
  drawText(firstPage, "Unterschrift Kunde / Objektverantwortlicher", 315, 130, fonts.bold, 8.8, MUTED);
  firstPage.drawLine({ start: { x: 315, y: 106 }, end: { x: 520, y: 106 }, thickness: 0.7, color: LINE });

  let devicePage = await addTemplatePage(pdfDoc, templateDoc, 1);
  let deviceY = 720;
  drawText(devicePage, "Dokumentierte Rauchwarnmelder", 56, deviceY, fonts.bold, 16, INK);
  deviceY -= 22;
  devicePage.drawLine({ start: { x: 56, y: deviceY }, end: { x: 539, y: deviceY }, thickness: 0.8, color: LINE });
  deviceY -= 26;

  for (const [index, device] of input.payload.devices.entries()) {
    if (deviceY < 210) {
      devicePage = await addTemplatePage(pdfDoc, templateDoc, 1);
      deviceY = 720;
      drawText(devicePage, "Dokumentierte Rauchwarnmelder (Fortsetzung)", 56, deviceY, fonts.bold, 16, INK);
      deviceY -= 48;
    }

    devicePage.drawRectangle({ x: 56, y: deviceY - 18, width: 483, height: 26, color: rgb(0.94, 0.97, 1) });
    drawText(devicePage, `${index + 1}. ${device.room || "Raum ohne Bezeichnung"}`, 68, deviceY - 3, fonts.bold, 10, INK);
    drawText(devicePage, [device.building, device.floor, device.unit].filter(Boolean).join(" | ") || "-", 330, deviceY - 3, fonts.regular, 8.4, MUTED);
    deviceY -= 34;

    const rows = [
      ["Hersteller / Modell", [device.manufacturer, device.model].filter(Boolean).join(" / ")],
      ["Seriennummer", device.serialNumber],
      ["Baujahr / Batterie / Typ", [device.manufactureDate, device.battery, device.detectorType].filter(Boolean).join(" / ")],
      ["Funkvernetzung", yesNo(device.radioLinked)],
      ["Montageort", [device.ceilingPosition, device.distanceNotes].filter(Boolean).join(" | ")],
      ["Montageort geeignet", yesNo(device.locationCompliant)],
      ["Prüfung", `Funktionstest: ${yesNo(device.functionTestPassed)} | Sichtprüfung: ${yesNo(device.visualInspectionPassed)} | Signaltest: ${yesNo(device.signalTestDone)} | Montage fest: ${yesNo(device.mountedSecurely)}`],
      ["Besonderheiten", device.specialNotes],
    ];

    rows.forEach(([label, value], rowIndex) => {
      drawTableRow(devicePage, label, value, 56, deviceY, 483, fonts, rowIndex % 2 === 0);
      deviceY -= 23;
    });
    deviceY -= 12;
  }

  const drawImagePage = async (title: string, label: string, image: LogbookAttachment, detail: string, color = BLUE) => {
    const page = await addTemplatePage(pdfDoc, templateDoc, 1);
    const imageBox = { x: 56, y: 132, width: 483, height: 548 };
    drawText(page, title, 56, 716, fonts.bold, 16, INK);
    page.drawLine({ start: { x: 56, y: 700 }, end: { x: 539, y: 700 }, thickness: 0.8, color: LINE });
    page.drawRectangle({ x: 56, y: 682, width: 92, height: 24, color });
    drawText(page, label, 69, 689, fonts.bold, 9, rgb(1, 1, 1));
    drawWrappedText(page, detail || image.name, 160, 691, 370, fonts.regular, 8.5, 11, MUTED);
    page.drawRectangle({ x: imageBox.x, y: imageBox.y, width: imageBox.width, height: imageBox.height, borderColor: LINE, borderWidth: 0.8 });
    const embedded = await embedReportImage(pdfDoc, image);
    drawImageContained(page, embedded, { x: imageBox.x + 8, y: imageBox.y + 8, width: imageBox.width - 16, height: imageBox.height - 16 });
  };

  for (const [imageIndex, image] of input.payload.objectImages.entries()) {
    await drawImagePage("Objektbilder", "OBJEKT", image, `${imageIndex + 1}. ${image.name}`, GREEN);
  }

  for (const device of input.payload.devices) {
    for (const [imageIndex, image] of device.images.entries()) {
      await drawImagePage(
        `Bilder: ${device.room || "Rauchwarnmelder"}`,
        "MELDER",
        image,
        `${imageIndex + 1}. ${image.name} | ${[device.room, device.serialNumber].filter(Boolean).join(" | ")}`,
        BLUE
      );
    }
  }

  pdfDoc.setTitle(input.reportName);
  return Buffer.from(await pdfDoc.save()).toString("base64");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = cleanPayload(body);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  if (!canCreateProjectLogbookEntries(actor)) {
    return forbiddenReportResponse();
  }

  if (!payload.projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }
  if (payload.devices.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens einen Rauchwarnmelder erfassen." }, { status: 400 });
  }
  const devicesWithoutSerial = payload.devices.filter((device) => !device.serialNumber);
  if (devicesWithoutSerial.length > 0 && !payload.deviations) {
    return NextResponse.json(
      { error: "Mindestens ein Rauchwarnmelder hat keine Seriennummer. Bitte als Abweichung/Hinweis dokumentieren." },
      { status: 400 }
    );
  }
  const imageError = validateSmokeDetectorImages(payload);
  if (imageError) {
    return NextResponse.json({ error: imageError.error }, { status: imageError.status });
  }

  await ensureReadTables();

  const projects = await prisma.$queryRaw<ProjectRow[]>`
    SELECT id, "organizationId", "projectNumber", title, status, customer, "contactId", "contactPersonId", branch, address, "responsibleName"
    FROM "WorkPilotProject"
    WHERE id = ${payload.projectId} AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const project = projects[0];
  if (!project) {
    return NextResponse.json({ error: "Projekt wurde nicht gefunden." }, { status: 404 });
  }
  if (isArchivedProjectStatus(project.status) && !canArchiveProjects(actor)) {
    return NextResponse.json(
      { error: "Archivierte Projekte duerfen nicht mehr im Logbuch veraendert werden." },
      { status: 403 }
    );
  }

  const contactIds = [project.contactId, project.contactPersonId].map((id) => cleanString(id)).filter(Boolean);
  const contacts = contactIds.length > 0
    ? await prisma.$queryRaw<ContactRow[]>`
        SELECT id, "companyName", "firstName", "lastName", email, phone, mobile,
               street, "addressLine1", "addressLine2", "postalCode", city
        FROM "Contact"
        WHERE "organizationId" = ${organization.id} AND id IN (${Prisma.join(contactIds)})
      `
    : [];
  const customerContact = contacts.find((contact) => contact.id === project.contactId);
  const contactPerson = contacts.find((contact) => contact.id === project.contactPersonId);
  const installationDate = parseInputDate(payload.installationDate);
  const reportName = buildReportName(project, installationDate);

  const existingRows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    SELECT *
    FROM "ProjectLogbookEntry"
    WHERE "organizationId" = ${organization.id}
      AND "projectId" = ${project.id}
      AND "title" IN (${"Dokumente: Checklisten"}, ${"Dokumente: Rauchmelder-Nachweise"})
    ORDER BY "createdAt" DESC
  `;
  const existingReport = existingRows.find((entry) =>
    cleanAttachments(entry.attachments).some(
      (attachment) =>
        attachment.type === "Dokument" &&
        attachment.name.toLowerCase() === `${reportName}.pdf`.toLowerCase() &&
        attachment.dataUrl?.startsWith("data:application/pdf")
    )
  );
  if (existingReport) {
    return NextResponse.json(formatEntry(existingReport));
  }

  let pdfData = "";
  try {
    pdfData = await generateSmokeDetectorReportPdf({
      project,
      customerContact,
      contactPerson,
      payload,
      reportName,
      installationDate,
    });
  } catch {
    return NextResponse.json(
      { error: "Rauchmelder-Nachweis konnte nicht erstellt werden. Bitte Bilder als JPG oder PNG hochladen." },
      { status: 400 }
    );
  }

  const attachment = {
    name: `${reportName}.pdf`,
    type: "Dokument" as const,
    mimeType: "application/pdf",
    size: Math.round((pdfData.length * 3) / 4),
    dataUrl: `data:application/pdf;base64,${pdfData}`,
  };
  if (attachment.size > MAX_REPORT_ATTACHMENT_BYTES) {
    return NextResponse.json(
      {
        error: `Rauchmelder-Nachweis ist zu gross. Erlaubt sind maximal ${formatFileSize(
          MAX_REPORT_ATTACHMENT_BYTES
        )} pro Datei.`,
      },
      { status: 413 }
    );
  }
  const rows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    INSERT INTO "ProjectLogbookEntry" (
      "id", "organizationId", "projectId", "title", "body", "author", "colleague", "visibleFor", "attachments", "createdAt"
    ) VALUES (
      ${randomUUID()}, ${organization.id}, ${project.id}, ${"Dokumente: Checklisten"},
      ${`${reportName} erstellt. ${payload.devices.length} Rauchwarnmelder dokumentiert.`}, ${getUserName(actor)}, ${""},
      ${JSON.stringify(["Geschaeftsfuehrer", "Vertriebler", "Niederlassungsleiter", "Monteur", "Buchhaltung"])}::jsonb,
      ${JSON.stringify([attachment])}::jsonb,
      ${installationDate}
    )
    RETURNING *
  `;

  return NextResponse.json(formatEntry(rows[0]), { status: 201 });
}
