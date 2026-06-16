import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

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
  customer: string | null;
  contactId: string | null;
  contactPersonId: string | null;
  projectKind: string | null;
  branch: string | null;
  address: string | null;
  responsibleName: string | null;
};

type ContactRow = {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  salutation: string | null;
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
  projectMonth: string | null;
  createdAt: Date;
};

type ReportImage = LogbookAttachment & {
  entryDate: Date;
};

const A4_WIDTH = 595.276;
const A4_HEIGHT = 841.89;
const INK = rgb(0.08, 0.1, 0.14);
const MUTED = rgb(0.35, 0.4, 0.48);
const LINE = rgb(0.78, 0.82, 0.88);
const BLUE = rgb(0.02, 0.38, 0.95);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    projectMonth: entry.projectMonth || "",
  };
}

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
      "projectMonth" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectLogbookEntry"
    ADD COLUMN IF NOT EXISTS "projectMonth" TEXT
  `;
}

async function ensureActivityReportReadTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "WorkPilotProject" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "title" TEXT NOT NULL DEFAULT '',
      "customer" TEXT,
      "contactId" TEXT,
      "contactPersonId" TEXT,
      "projectKind" TEXT,
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
    ADD COLUMN IF NOT EXISTS "customer" TEXT,
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "contactPersonId" TEXT,
    ADD COLUMN IF NOT EXISTS "projectKind" TEXT,
    ADD COLUMN IF NOT EXISTS "branch" TEXT,
    ADD COLUMN IF NOT EXISTS "address" TEXT,
    ADD COLUMN IF NOT EXISTS "responsibleName" TEXT
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Contact" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Kunde',
      "type" TEXT NOT NULL DEFAULT 'person',
      "legalForm" TEXT,
      "customerNumber" TEXT NOT NULL DEFAULT '',
      "parentCompanyId" TEXT,
      "parentCompanyName" TEXT,
      "mainContactName" TEXT,
      "isMainContact" BOOLEAN NOT NULL DEFAULT false,
      "isInvoiceRecipient" BOOLEAN NOT NULL DEFAULT false,
      "isActivityReportRecipient" BOOLEAN NOT NULL DEFAULT false,
      "companyName" TEXT,
      "firstName" TEXT,
      "lastName" TEXT,
      "salutation" TEXT,
      "additionalSalutation" TEXT,
      "position" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "mobile" TEXT,
      "fax" TEXT,
      "website" TEXT,
      "source" TEXT,
      "reachability" TEXT,
      "street" TEXT,
      "addressLine1" TEXT,
      "addressLine2" TEXT,
      "postalCode" TEXT,
      "city" TEXT,
      "country" TEXT,
      "paymentTermDays" INTEGER,
      "discountPercent" DOUBLE PRECISION,
      "discountTermDays" INTEGER,
      "priceGroup" TEXT,
      "iban" TEXT,
      "bic" TEXT,
      "bankName" TEXT,
      "taxId" TEXT,
      "debtorCreditorAccount" TEXT,
      "leitwegId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE "Contact"
    ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Kunde',
    ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'person',
    ADD COLUMN IF NOT EXISTS "legalForm" TEXT,
    ADD COLUMN IF NOT EXISTS "customerNumber" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "parentCompanyId" TEXT,
    ADD COLUMN IF NOT EXISTS "parentCompanyName" TEXT,
    ADD COLUMN IF NOT EXISTS "mainContactName" TEXT,
    ADD COLUMN IF NOT EXISTS "isMainContact" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "isInvoiceRecipient" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "isActivityReportRecipient" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "companyName" TEXT,
    ADD COLUMN IF NOT EXISTS "firstName" TEXT,
    ADD COLUMN IF NOT EXISTS "lastName" TEXT,
    ADD COLUMN IF NOT EXISTS "salutation" TEXT,
    ADD COLUMN IF NOT EXISTS "additionalSalutation" TEXT,
    ADD COLUMN IF NOT EXISTS "position" TEXT,
    ADD COLUMN IF NOT EXISTS "email" TEXT,
    ADD COLUMN IF NOT EXISTS "phone" TEXT,
    ADD COLUMN IF NOT EXISTS "mobile" TEXT,
    ADD COLUMN IF NOT EXISTS "fax" TEXT,
    ADD COLUMN IF NOT EXISTS "website" TEXT,
    ADD COLUMN IF NOT EXISTS "source" TEXT,
    ADD COLUMN IF NOT EXISTS "reachability" TEXT,
    ADD COLUMN IF NOT EXISTS "street" TEXT,
    ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
    ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
    ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
    ADD COLUMN IF NOT EXISTS "city" TEXT,
    ADD COLUMN IF NOT EXISTS "country" TEXT,
    ADD COLUMN IF NOT EXISTS "paymentTermDays" INTEGER,
    ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "discountTermDays" INTEGER,
    ADD COLUMN IF NOT EXISTS "priceGroup" TEXT,
    ADD COLUMN IF NOT EXISTS "iban" TEXT,
    ADD COLUMN IF NOT EXISTS "bic" TEXT,
    ADD COLUMN IF NOT EXISTS "bankName" TEXT,
    ADD COLUMN IF NOT EXISTS "taxId" TEXT,
    ADD COLUMN IF NOT EXISTS "debtorCreditorAccount" TEXT,
    ADD COLUMN IF NOT EXISTS "leitwegId" TEXT
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

function buildActivityReportNumber(entries: ProjectLogbookEntryRow[]) {
  const highestNumber = entries.reduce((highest, entry) => {
    const entryNumbers = cleanAttachments(entry.attachments)
      .map((attachment) => attachment.name.match(/^DOK-(\d{4,})\.pdf$/i)?.[1])
      .filter(Boolean)
      .map((value) => Number(value));
    return Math.max(highest, 0, ...entryNumbers);
  }, 0);

  return `DOK-${String(highestNumber + 1).padStart(4, "0")}`;
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

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size = 9,
  color = INK
) {
  page.drawText(text, { x, y, font, size, color });
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size = 9,
  color = INK
) {
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

  lines.forEach((lineText, index) => {
    drawText(page, lineText, x, y - index * lineHeight, font, size, color);
  });

  return y - lines.length * lineHeight;
}

function drawInfoRow(page: PDFPage, label: string, value: string, x: number, y: number, fonts: { regular: PDFFont; bold: PDFFont }) {
  drawText(page, label, x, y, fonts.bold, 8, MUTED);
  drawText(page, value || "-", x + 92, y, fonts.regular, 8, INK);
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

async function embedReportImage(pdfDoc: PDFDocument, image: ReportImage) {
  const base64 = image.dataUrl?.split(",")[1] ?? "";
  const bytes = Buffer.from(base64, "base64");
  const mimeType = image.mimeType?.toLowerCase() ?? "";
  const orientation = getJpegOrientation(bytes);

  if (mimeType.includes("png")) {
    try {
      return { embedded: await pdfDoc.embedPng(bytes), orientation: 1 };
    } catch {
      return { embedded: await pdfDoc.embedJpg(bytes), orientation };
    }
  }

  try {
    return { embedded: await pdfDoc.embedJpg(bytes), orientation };
  } catch {
    return { embedded: await pdfDoc.embedPng(bytes), orientation: 1 };
  }
}

function getJpegOrientation(bytes: Buffer) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (marker === 0xe1 && offset + 4 + segmentLength <= bytes.length) {
      const exifStart = offset + 4;
      if (bytes.toString("ascii", exifStart, exifStart + 6) !== "Exif\u0000\u0000") return 1;
      const tiffStart = exifStart + 6;
      const littleEndian = bytes.toString("ascii", tiffStart, tiffStart + 2) === "II";
      const readUInt16 = (position: number) =>
        littleEndian ? bytes.readUInt16LE(position) : bytes.readUInt16BE(position);
      const readUInt32 = (position: number) =>
        littleEndian ? bytes.readUInt32LE(position) : bytes.readUInt32BE(position);
      const firstIfdOffset = readUInt32(tiffStart + 4);
      const ifdStart = tiffStart + firstIfdOffset;
      const entryCount = readUInt16(ifdStart);

      for (let index = 0; index < entryCount; index += 1) {
        const entryOffset = ifdStart + 2 + index * 12;
        if (entryOffset + 12 > bytes.length) break;
        const tag = readUInt16(entryOffset);
        if (tag === 0x0112) return readUInt16(entryOffset + 8);
      }
      return 1;
    }
    offset += 2 + segmentLength;
  }

  return 1;
}

function drawImageContained(
  page: PDFPage,
  embedded: PDFImage,
  box: { x: number; y: number; width: number; height: number },
  orientation = 1
) {
  const quarterTurn = orientation === 6 || orientation === 8;
  const effectiveWidth = quarterTurn ? embedded.height : embedded.width;
  const effectiveHeight = quarterTurn ? embedded.width : embedded.height;
  const scale = Math.min(box.width / effectiveWidth, box.height / effectiveHeight);
  const width = embedded.width * scale;
  const height = embedded.height * scale;
  const targetX = box.x + (box.width - effectiveWidth * scale) / 2;
  const targetY = box.y + (box.height - effectiveHeight * scale) / 2;

  if (orientation === 6) {
    page.drawImage(embedded, { x: targetX, y: targetY + width, width, height, rotate: degrees(270) });
    return;
  }

  if (orientation === 8) {
    page.drawImage(embedded, { x: targetX + height, y: targetY, width, height, rotate: degrees(90) });
    return;
  }

  if (orientation === 3) {
    page.drawImage(embedded, { x: targetX + width, y: targetY + height, width, height, rotate: degrees(180) });
    return;
  }

  page.drawImage(embedded, { x: targetX, y: targetY, width, height });
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getReportImageIdentity(image: LogbookAttachment) {
  const normalizedFileStem = cleanString(image.name)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ");

  return normalizedFileStem || cleanString(image.dataUrl).slice(0, 240);
}

function getReportImages(entries: ProjectLogbookEntryRow[], category: "Vorherbilder" | "Nachherbilder", month: string, useMonth: boolean) {
  const uniqueImages = new Map<string, ReportImage>();

  entries
    .filter((entry) => entry.title === `Bilder: ${category}`)
    .filter((entry) => !useMonth || entry.projectMonth === month || (!entry.projectMonth && getMonthKey(entry.createdAt) === month))
    .forEach((entry) => {
      cleanAttachments(entry.attachments)
        .filter((attachment) => attachment.type === "Bild" && attachment.dataUrl)
        .forEach((attachment) => {
          const key = getReportImageIdentity(attachment);
          if (!uniqueImages.has(key)) {
            uniqueImages.set(key, { ...attachment, entryDate: entry.createdAt });
          }
        });
    });

  return Array.from(uniqueImages.values());
}

async function generateActivityReportPdf(input: {
  project: ProjectRow;
  customerContact?: ContactRow | null;
  contactPerson?: ContactRow | null;
  beforeImages: ReportImage[];
  afterImages: ReportImage[];
  reportName: string;
  month: string;
  useMonth: boolean;
}) {
  const company = input.project.branch || "";
  const templateBytes = await readFile(getTemplatePath(company));
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const today = new Date();

  const firstPage = await addTemplatePage(pdfDoc, templateDoc, 0);
  const recipientLines = contactAddressLines(input.customerContact);
  const fallbackAddress = [input.project.customer || "Kunde", ...formatProjectAddress(input.project)];
  const addressLines = recipientLines.length > 0 ? recipientLines : fallbackAddress;

  let y = 672;
  addressLines.slice(0, 3).forEach((line, index) => {
    drawText(firstPage, line, 71, y, index === 0 ? fonts.bold : fonts.bold, index === 0 ? 8.7 : 8.4);
    y -= 12;
  });

  const documentDate = formatDate(today);
  const infoRows = [
    ["Dokumentennummer", input.reportName],
    ["Projektnummer", input.project.projectNumber],
    ["Datum", documentDate],
    ["Ansprechpartner", input.project.responsibleName || contactName(input.contactPerson)],
    ["Telefon", input.contactPerson?.phone || input.contactPerson?.mobile || ""],
    ["E-Mail", input.contactPerson?.email || ""],
  ];
  infoRows.forEach(([label, value], index) => {
    const rowY = 676 - index * 13;
    drawText(firstPage, label, 313, rowY, fonts.bold, 8.5, MUTED);
    drawRightAlignedText(firstPage, value || "-", 552, rowY, fonts.regular, 8.5, INK);
  });

  drawText(firstPage, `Betreff: ${input.project.title || "-"}`, 71, 544, fonts.bold, 10.7, INK);
  const salutationName = contactName(input.contactPerson);
  const salutation = salutationName ? `Sehr geehrte/r ${salutationName},` : "Sehr geehrte Damen und Herren,";
  drawText(firstPage, salutation, 71, 508, fonts.regular, 8.8);
  drawWrappedText(
    firstPage,
    "anbei erhalten Sie unseren Arbeitsbericht mit den entsprechenden Vorher- und Nachher-Bildern, damit Sie sich einen detaillierten Eindruck von den durchgeführten Maßnahmen verschaffen können.",
    71,
    488,
    480,
    fonts.regular,
    8.8,
    12
  );
  drawWrappedText(
    firstPage,
    "Wir möchten Ihnen damit die Möglichkeit geben, die Qualität und den Umfang unserer Arbeiten transparent nachzuvollziehen.",
    71,
    444,
    480,
    fonts.regular,
    8.8,
    12
  );
  drawWrappedText(
    firstPage,
    "Die Dokumentation dient zugleich als Nachweis der erbrachten Leistung und als Grundlage für die weitere Abstimmung.",
    71,
    412,
    480,
    fonts.regular,
    8.8,
    12
  );
  drawText(firstPage, "Projekt", 71, 350, fonts.bold, 8.8, MUTED);
  drawText(
    firstPage,
    [input.project.projectNumber, input.project.title].filter(Boolean).join(" | ") || "-",
    205,
    350,
    fonts.regular,
    8.8
  );
  if (input.useMonth) {
    drawText(firstPage, "Auswertungsmonat", 71, 328, fonts.bold, 8.8, MUTED);
    drawText(firstPage, input.month, 205, 328, fonts.regular, 8.8);
  }
  drawText(firstPage, "Mit freundlichen Grüßen", 71, 248, fonts.regular, 8.8);
  drawText(firstPage, "OK solutions GmbH", 71, 230, fonts.bold, 8.8);

  const drawImageSection = async (title: string, label: string, images: ReportImage[], color = BLUE) => {
    for (const [imageIndex, image] of images.entries()) {
      const page = await addTemplatePage(pdfDoc, templateDoc, 1);
      const sectionTitle = imageIndex === 0 ? title : `${title} (Fortsetzung)`;
      const imageBox = { x: 56, y: 132, width: 483, height: 548 };

      drawText(page, sectionTitle, 56, 716, fonts.bold, 16, INK);
      page.drawLine({ start: { x: 56, y: 700 }, end: { x: 539, y: 700 }, thickness: 0.8, color: LINE });
      page.drawRectangle({ x: 56, y: 682, width: 74, height: 24, color });
      drawText(page, label, 69, 689, fonts.bold, 9, rgb(1, 1, 1));
      drawText(page, `${imageIndex + 1}. ${image.name} | ${formatDate(image.entryDate)}`, 142, 689, fonts.regular, 8.5, MUTED);
      page.drawRectangle({ x: imageBox.x, y: imageBox.y, width: imageBox.width, height: imageBox.height, borderColor: LINE, borderWidth: 0.8 });

      try {
        const { embedded, orientation } = await embedReportImage(pdfDoc, image);
        drawImageContained(page, embedded, { x: imageBox.x + 8, y: imageBox.y + 8, width: imageBox.width - 16, height: imageBox.height - 16 }, orientation);
      } catch {
        throw new Error(`${image.name} konnte nicht in den Tätigkeitsbericht eingebettet werden. Bitte das Bild erneut als JPG oder PNG hochladen.`);
      }
    }
  };

  await drawImageSection("Vorherbilder", "VORHER", input.beforeImages, rgb(0.04, 0.38, 0.82));
  await drawImageSection("Nachherbilder", "NACHHER", input.afterImages, rgb(0.04, 0.55, 0.32));

  pdfDoc.setTitle(input.reportName);
  return Buffer.from(await pdfDoc.save()).toString("base64");
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const projectId = cleanString(body.projectId);
  const month = cleanString(body.month);

  if (!projectId) {
    return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  }

  const { organization } = await getDemoContext();
  await ensureActivityReportReadTables();
  await ensureProjectLogbookEntryTable();

  const projects = await prisma.$queryRaw<ProjectRow[]>`
    SELECT id, "organizationId", "projectNumber", title, customer, "contactId", "contactPersonId",
           "projectKind", branch, address, "responsibleName"
    FROM "WorkPilotProject"
    WHERE id = ${projectId} AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const project = projects[0];

  if (!project) {
    return NextResponse.json({ error: "Projekt wurde nicht gefunden." }, { status: 404 });
  }

  const contactIds = [project.contactId, project.contactPersonId].map((id) => cleanString(id)).filter(Boolean);
  const contacts = contactIds.length > 0
    ? await prisma.$queryRaw<ContactRow[]>`
        SELECT id, "companyName", "firstName", "lastName", salutation, email, phone, mobile,
               street, "addressLine1", "addressLine2", "postalCode", city
        FROM "Contact"
        WHERE "organizationId" = ${organization.id} AND id IN (${Prisma.join(contactIds)})
      `
    : [];
  const customerContact = contacts.find((contact) => contact.id === project.contactId);
  const contactPerson = contacts.find((contact) => contact.id === project.contactPersonId);

  const entries = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    SELECT *
    FROM "ProjectLogbookEntry"
    WHERE "organizationId" = ${organization.id}
      AND "projectId" = ${projectId}
    ORDER BY "createdAt" ASC
  `;
  const useMonth = cleanString(project.projectKind).toLowerCase().includes("dauer") && /^\d{4}-\d{2}$/.test(month);
  const beforeImages = getReportImages(entries, "Vorherbilder", month, useMonth);
  const afterImages = getReportImages(entries, "Nachherbilder", month, useMonth);
  const existingReport = entries.find((entry) =>
    entry.title === "Dokumente: Tätigkeitsberichte" &&
    (!useMonth || entry.projectMonth === month || (!entry.projectMonth && getMonthKey(entry.createdAt) === month)) &&
    cleanAttachments(entry.attachments).some((attachment) =>
      attachment.type === "Dokument" &&
      /^DOK-\d{4,}\.pdf$/i.test(attachment.name) &&
      attachment.dataUrl?.startsWith("data:application/pdf")
    )
  );
  const existingReportAttachment = existingReport
    ? cleanAttachments(existingReport.attachments).find((attachment) =>
        attachment.type === "Dokument" &&
        /^DOK-\d{4,}\.pdf$/i.test(attachment.name) &&
        attachment.dataUrl?.startsWith("data:application/pdf")
      )
    : null;

  if (beforeImages.length === 0 || afterImages.length === 0) {
    return NextResponse.json(
      { error: "Für den Tätigkeitsbericht wird mindestens ein Vorher- und ein Nachherbild benötigt." },
      { status: 400 }
    );
  }

  const reportName =
    cleanString(existingReportAttachment?.name).replace(/\.pdf$/i, "") ||
    buildActivityReportNumber(entries);
  let pdfData = "";
  try {
    pdfData = await generateActivityReportPdf({
      project,
      customerContact,
      contactPerson,
      beforeImages,
      afterImages,
      reportName,
      month,
      useMonth,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tätigkeitsbericht konnte nicht erstellt werden." },
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
  const reportCreatedAt = useMonth ? new Date(`${month}-01T12:00:00`) : new Date();

  if (existingReport) {
    const rows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
      UPDATE "ProjectLogbookEntry"
      SET "attachments" = ${JSON.stringify([attachment])}::jsonb,
          "body" = ${`${reportName} automatisch aktualisiert.`},
          "projectMonth" = ${useMonth ? month : null}
      WHERE "id" = ${existingReport.id}
        AND "organizationId" = ${organization.id}
      RETURNING *
    `;

    return NextResponse.json(formatEntry(rows[0]));
  }

  const rows = await prisma.$queryRaw<ProjectLogbookEntryRow[]>`
    INSERT INTO "ProjectLogbookEntry" (
      "id", "organizationId", "projectId", "title", "body", "author", "colleague", "visibleFor", "attachments", "projectMonth", "createdAt"
    ) VALUES (
      ${randomUUID()}, ${organization.id}, ${projectId}, ${"Dokumente: Tätigkeitsberichte"},
      ${`${reportName} automatisch erstellt.`}, ${"System"}, ${""},
      ${JSON.stringify(["Geschaeftsfuehrer", "Vertriebler", "Niederlassungsleiter", "Buchhaltung"])}::jsonb,
      ${JSON.stringify([attachment])}::jsonb,
      ${useMonth ? month : null},
      ${reportCreatedAt}
    )
    RETURNING *
  `;

  return NextResponse.json(formatEntry(rows[0]), { status: 201 });
}
