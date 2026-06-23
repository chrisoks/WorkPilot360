import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import legacyInvoiceSeed from "@/data/hero-legacy-invoices.json";

type LegacyInvoiceSeedRow = {
  sourceRow: number;
  importKey: string;
  invoiceNumber: string;
  fileName: string;
  documentType: string;
  folder: string;
  customerName: string;
  projectAddress: string;
  netTotal: number;
  invoiceDate: string;
  company: string;
  status: string;
  isEvaluable: boolean;
};

type LegacyInvoiceRow = LegacyInvoiceSeedRow & {
  id: string;
  organizationId: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getLegacyInvoiceCents(value: number) {
  return Math.round(Number(value || 0) * 100);
}

function classifyLegacyInvoices(rows: LegacyInvoiceRow[]) {
  const canceledPositiveIds = new Set<string>();
  const positiveRows = rows.filter((row) => getLegacyInvoiceCents(row.netTotal) > 0);
  const negativeRows = rows
    .filter((row) => getLegacyInvoiceCents(row.netTotal) < 0)
    .sort((first, second) => first.invoiceDate.localeCompare(second.invoiceDate));

  for (const negativeRow of negativeRows) {
    const targetCents = Math.abs(getLegacyInvoiceCents(negativeRow.netTotal));
    const candidates = positiveRows
      .filter(
        (row) =>
          !canceledPositiveIds.has(row.id) &&
          getLegacyInvoiceCents(row.netTotal) === targetCents &&
          row.customerName === negativeRow.customerName
      )
      .sort((first, second) => {
        const firstDistance = Math.abs(
          new Date(first.invoiceDate).getTime() - new Date(negativeRow.invoiceDate).getTime()
        );
        const secondDistance = Math.abs(
          new Date(second.invoiceDate).getTime() - new Date(negativeRow.invoiceDate).getTime()
        );
        return firstDistance - secondDistance || first.invoiceDate.localeCompare(second.invoiceDate);
      });

    const matchingPositive = candidates[0];
    if (matchingPositive) {
      canceledPositiveIds.add(matchingPositive.id);
    }
  }

  return rows.map((row) => {
    if (!canceledPositiveIds.has(row.id)) return row;
    return {
      ...row,
      status: "Storniert",
      isEvaluable: false,
    };
  });
}

function serializeLegacyInvoice(row: LegacyInvoiceRow) {
  return {
    id: row.id,
    source: row.source,
    sourceRow: row.sourceRow,
    importKey: row.importKey,
    invoiceNumber: row.invoiceNumber,
    fileName: row.fileName,
    documentType: row.documentType,
    folder: row.folder,
    customerName: row.customerName,
    projectAddress: row.projectAddress,
    netTotal: Number(row.netTotal || 0),
    invoiceDate: row.invoiceDate,
    company: row.company,
    status: row.status,
    isEvaluable: Boolean(row.isEvaluable),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureLegacyInvoiceTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "LegacyInvoice" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'HERO',
      "sourceRow" INTEGER NOT NULL DEFAULT 0,
      "importKey" TEXT NOT NULL,
      "invoiceNumber" TEXT NOT NULL DEFAULT '',
      "fileName" TEXT NOT NULL DEFAULT '',
      "documentType" TEXT NOT NULL DEFAULT '',
      "folder" TEXT NOT NULL DEFAULT '',
      "customerName" TEXT NOT NULL DEFAULT '',
      "projectAddress" TEXT NOT NULL DEFAULT '',
      "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "invoiceDate" TEXT NOT NULL DEFAULT '',
      "company" TEXT NOT NULL DEFAULT 'Unbekannt',
      "status" TEXT NOT NULL DEFAULT 'Importiert',
      "isEvaluable" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "LegacyInvoice_organizationId_importKey_key"
    ON "LegacyInvoice" ("organizationId", "importKey")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "LegacyInvoice_organizationId_invoiceDate_idx"
    ON "LegacyInvoice" ("organizationId", "invoiceDate")
  `;
}

async function seedLegacyInvoices(organizationId: string) {
  const existing = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count
    FROM "LegacyInvoice"
    WHERE "organizationId" = ${organizationId}
      AND "source" = 'HERO'
  `;
  if (Number(existing[0]?.count ?? 0) > 0) return;

  for (const row of legacyInvoiceSeed as LegacyInvoiceSeedRow[]) {
    await prisma.$executeRaw`
      INSERT INTO "LegacyInvoice" (
        "id", "organizationId", "source", "sourceRow", "importKey",
        "invoiceNumber", "fileName", "documentType", "folder", "customerName",
        "projectAddress", "netTotal", "invoiceDate", "company", "status", "isEvaluable"
      )
      VALUES (
        ${randomUUID()}, ${organizationId}, 'HERO', ${row.sourceRow}, ${row.importKey},
        ${row.invoiceNumber}, ${row.fileName}, ${row.documentType}, ${row.folder}, ${row.customerName},
        ${row.projectAddress}, ${row.netTotal}, ${row.invoiceDate}, ${row.company}, ${row.status}, ${row.isEvaluable}
      )
      ON CONFLICT ("organizationId", "importKey") DO NOTHING
    `;
  }
}

export async function GET(request: Request) {
  await ensureLegacyInvoiceTable();
  const { searchParams } = new URL(request.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(request, users, searchParams.get("actorId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  await seedLegacyInvoices(organization.id);

  const source = cleanString(searchParams.get("source")) || "HERO";
  const rows = await prisma.$queryRaw<LegacyInvoiceRow[]>`
    SELECT *
    FROM "LegacyInvoice"
    WHERE "organizationId" = ${organization.id}
      AND "source" = ${source}
    ORDER BY "invoiceDate" DESC, "sourceRow" ASC
  `;

  return NextResponse.json(classifyLegacyInvoices(rows).map(serializeLegacyInvoice));
}

export async function DELETE(request: Request) {
  await ensureLegacyInvoiceTable();
  const { searchParams } = new URL(request.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(request, users, searchParams.get("actorId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM "LegacyInvoice" WHERE "organizationId" = ${organization.id} AND "source" = 'HERO'`
  );
  return NextResponse.json({ ok: true });
}
