import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type DocumentTypeRow = {
  id: string;
  name: string;
  baseType: string;
  folder: string;
  status: string;
  config: unknown;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const defaultOfferConfig = {
  baseType: "Angebot",
  name: "Angebot OK immocare",
  status: "Aktiv",
  folder: "Angebote",
  numberRange: "ANG-179 | Angebot",
  moveProjectStatus: "(keine Aenderung)",
  marginTop: "40",
  marginBottom: "35",
  marginLeft: "0",
  marginRight: "0",
  baseLayout: "Klassisch",
  fontFamily: "Arial",
  fontSize: "10pt",
  showFoldMarks: true,
  mainTop: "100",
  mainLeft: "25",
  mainRight: "15",
  introText: "Angebot - Einleitung WorkPilot360",
  closingText: "Angebot - Abschluss WorkPilot360",
  showPositionDescription: true,
  showPositionImages: true,
  showQuantityPdf: true,
  showEan: false,
  showArticleNumbers: false,
  hideSinglePrices: false,
  showTitleSums: false,
  hideOrderValue: false,
  showVat: true,
  showVatRate: false,
  showTitleSummary: true,
  showSurcharge: true,
  showLaborMachineCosts: false,
  showArticlePricesInServices: false,
  footerText: "OK solutions GmbH | Im Kroetenteich 3/4 | 74722 Buchen",
  footerDistance: "20",
  footerFontSize: "7pt",
  showLetterhead: true,
  letterheadFileName: "",
  letterheadDataUrl: "",
  addressLineEnabled: true,
  addressLineText: "OK solutions GmbH, Im Kroetenteich 3/4, 74722 Buchen",
  addressLineTop: "45",
  addressLineLeft: "25",
  subjectOneEnabled: true,
  subjectOneBold: true,
  subjectOneSource: "Projektname",
  subjectOneFont: "Arial",
  subjectOneSize: "13pt",
  subjectOnePrefix: "Projekt:",
  subjectTwoEnabled: true,
  subjectTwoBold: true,
  subjectTwoFont: "Arial",
  subjectTwoSize: "13pt",
  showFirstPageLogo: true,
  showFirstPageAddress: false,
  firstPageLogoTop: "10",
  firstPageLogoLeft: "150",
  firstPageLogoWidth: "45",
  firstPageLogoHeight: "30",
  firstPageAddressText: "OK solutions GmbH\nIm Kroetenteich 3/4\n74722 Buchen",
  firstPageInfoBlock: true,
  firstPageInfoTop: "55",
  firstPageInfoLeft: "110",
  firstPageInfoWidth: "85",
  showCustomerNumber: true,
  showDocumentNumber: true,
  showRecipientVatId: false,
  showContactName: true,
  showContactPhone: true,
  showContactMobile: false,
  showContactFax: true,
  showContactEmail: true,
  contactDisplayMode: "Hauptansprechpartner/in",
  deliveryDateMode: "Nicht anzeigen",
  paymentTypeMode: "Nicht anzeigen",
  showFreeInfoBlock: false,
  freeInfoTop: "",
  freeInfoLeft: "",
  freeInfoWidth: "",
  freeInfoContent: "",
  followingShowLogo: true,
  followingShowAddress: false,
  followingLogoTop: "10",
  followingLogoLeft: "150",
  followingLogoWidth: "45",
  followingLogoHeight: "30",
  followingInfoBlock: true,
  followingInfoAlsoFirstPage: false,
  followingInfoTop: "10",
  followingInfoLeft: "25",
  followingInfoWidth: "75",
  followingShowDocumentNumber: true,
  followingShowProjectNumber: true,
  followingShowContact: true,
  followingShowPhone: false,
  followingShowMobile: false,
  followingShowFax: false,
  followingShowEmail: false,
  subjectPrefix: "Angebot Nr.",
  bookingRelevant: false,
  bookingCategory: "Standard",
  bookingSide: "Soll",
  bookingAccount: "",
  costCenter: "",
  correctionDocumentType: "Stornorechnung",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function formatDocumentType(row: DocumentTypeRow) {
  return {
    id: row.id,
    name: row.name,
    baseType: row.baseType,
    folder: row.folder,
    status: row.status,
    config: row.config,
    isArchived: Boolean(row.archivedAt),
    updatedAt: row.updatedAt.toISOString(),
    updatedAtLabel: formatDate(row.updatedAt),
  };
}

async function ensureDocumentTypeTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "DocumentTypeConfig" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "baseType" TEXT NOT NULL DEFAULT 'Dokument',
      "folder" TEXT NOT NULL DEFAULT 'Allgemein',
      "status" TEXT NOT NULL DEFAULT 'Aktiv',
      "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "archivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DocumentTypeConfig_pkey" PRIMARY KEY ("id")
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTypeConfig_org_name_key"
    ON "DocumentTypeConfig" ("organizationId", "name")
  `;
}

async function ensureDefaultOfferDocumentType(organizationId: string) {
  const configJson = JSON.stringify(defaultOfferConfig);

  await prisma.$executeRaw`
    INSERT INTO "DocumentTypeConfig" (
      "id",
      "organizationId",
      "name",
      "baseType",
      "folder",
      "status",
      "config"
    )
    VALUES (
      ${randomUUID()},
      ${organizationId},
      ${defaultOfferConfig.name},
      ${defaultOfferConfig.baseType},
      ${defaultOfferConfig.folder},
      ${defaultOfferConfig.status},
      ${configJson}::jsonb
    )
    ON CONFLICT ("organizationId", "name") DO NOTHING
  `;
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureDocumentTypeTable();
  await ensureDefaultOfferDocumentType(organization.id);

  const rows = await prisma.$queryRaw<DocumentTypeRow[]>`
    SELECT
      "id",
      "name",
      "baseType",
      "folder",
      "status",
      "config",
      "archivedAt",
      "createdAt",
      "updatedAt"
    FROM "DocumentTypeConfig"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "name" ASC
  `;

  return NextResponse.json(rows.map(formatDocumentType));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
  await ensureDocumentTypeTable();

  const name = String(body.name ?? body.config?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Bitte einen Namen fuer den Dokumententyp angeben." }, { status: 400 });
  }

  const config = {
    ...defaultOfferConfig,
    ...(body.config ?? {}),
    name,
  };
  const configJson = JSON.stringify(config);

  try {
    await prisma.$executeRaw`
      INSERT INTO "DocumentTypeConfig" (
        "id",
        "organizationId",
        "name",
        "baseType",
        "folder",
        "status",
        "config",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${organization.id},
        ${name},
        ${String(body.baseType ?? config.baseType ?? "Dokument")},
        ${String(body.folder ?? config.folder ?? "Allgemein")},
        ${String(body.status ?? config.status ?? "Aktiv")},
        ${configJson}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
  } catch {
    return NextResponse.json(
      { error: "Ein Dokumententyp mit diesem Namen ist bereits vorhanden." },
      { status: 409 }
    );
  }

  return GET();
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
  await ensureDocumentTypeTable();

  const id = String(body.id ?? "");
  const name = String(body.name ?? body.config?.name ?? "").trim();
  if (!id || !name) {
    return NextResponse.json({ error: "Dokumententyp oder Name fehlt." }, { status: 400 });
  }

  const config = {
    ...defaultOfferConfig,
    ...(body.config ?? {}),
    name,
  };
  const configJson = JSON.stringify(config);

  await prisma.$executeRaw`
    UPDATE "DocumentTypeConfig"
    SET
      "name" = ${name},
      "baseType" = ${String(body.baseType ?? config.baseType ?? "Dokument")},
      "folder" = ${String(body.folder ?? config.folder ?? "Allgemein")},
      "status" = ${String(body.status ?? config.status ?? "Aktiv")},
      "config" = ${configJson}::jsonb,
      "archivedAt" = CASE WHEN ${String(body.status ?? config.status) === "Archiviert"} THEN CURRENT_TIMESTAMP ELSE "archivedAt" END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
  `;

  return GET();
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization } = await getDemoContext();
  await ensureDocumentTypeTable();

  await prisma.$executeRaw`
    UPDATE "DocumentTypeConfig"
    SET
      "status" = 'Archiviert',
      "archivedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${String(body.id ?? "")}
      AND "organizationId" = ${organization.id}
  `;

  return GET();
}
