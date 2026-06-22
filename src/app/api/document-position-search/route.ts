import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type PositionSearchRow = {
  documentId: string;
  documentType: string;
  documentNumber: string;
  status: string;
  customerName: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  lineId: string;
  position: number;
  catalogType: string;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  totalNet: number;
  createdAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanString(actorId);
  if (!requestedActorId) {
    return null;
  }

  return users.find((candidate) => candidate.id === requestedActorId && candidate.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

function includesSearch(row: PositionSearchRow, search: string) {
  if (!search) return true;
  return [
    row.documentType,
    row.documentNumber,
    row.status,
    row.customerName,
    row.projectNumber,
    row.projectTitle,
    row.position,
    row.catalogType,
    row.title,
    row.description,
    row.quantity,
    row.unit,
    row.totalNet,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .some((value) => value.includes(search));
}

function serializeRow(row: PositionSearchRow) {
  const text = [row.title, row.description].filter(Boolean).join(" - ");
  return {
    documentId: row.documentId,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    status: row.status,
    customerName: row.customerName,
    projectId: row.projectId,
    projectNumber: row.projectNumber,
    projectTitle: row.projectTitle,
    lineId: row.lineId,
    position: row.position,
    catalogType: row.catalogType,
    title: row.title,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    totalNet: row.totalNet,
    matchText: text || row.title || row.description || "-",
    pdfUrl:
      row.documentType === "Angebot" || row.documentType === "Nachtragsangebot"
        ? `/api/offers?pdfId=${encodeURIComponent(row.documentId)}`
        : `/api/invoices?pdfId=${encodeURIComponent(row.documentId)}`,
    createdAt: row.createdAt.toISOString(),
  };
}

const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 50;
const DELETED_DOCUMENT_STATUSES = ["Gelöscht", "Gel\u00c3\u00b6scht"];

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const actor = getRequestActor(users, searchParams.get("actorId"));
  if (!actor) {
    return unauthorizedActorResponse();
  }
  const query = normalizeSearch(cleanString(searchParams.get("q")));

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({
      query,
      minQueryLength: MIN_QUERY_LENGTH,
      limit: RESULT_LIMIT,
      total: 0,
      limited: false,
      results: [],
    });
  }

  const offerRows = await prisma.$queryRaw<PositionSearchRow[]>`
    SELECT
      o."id" AS "documentId",
      CASE WHEN o."offerType" = 'addendum' THEN 'Nachtragsangebot' ELSE 'Angebot' END AS "documentType",
      o."offerNumber" AS "documentNumber",
      o."status",
      o."customerName",
      o."projectId",
      o."projectNumber",
      o."projectTitle",
      l."id" AS "lineId",
      l."position",
      l."catalogType",
      l."title",
      l."description",
      l."quantity",
      l."unit",
      l."totalNet",
      o."createdAt"
    FROM "OfferLine" l
    INNER JOIN "Offer" o ON o."id" = l."offerId" AND o."organizationId" = l."organizationId"
    WHERE l."organizationId" = ${organization.id}
      AND o."status" NOT IN (${DELETED_DOCUMENT_STATUSES[0]}, ${DELETED_DOCUMENT_STATUSES[1]})
  `;

  const invoiceRows = await prisma.$queryRaw<PositionSearchRow[]>`
    SELECT
      i."id" AS "documentId",
      CASE WHEN i."status" = 'Stornorechnung' THEN 'Storno' ELSE 'Rechnung' END AS "documentType",
      i."invoiceNumber" AS "documentNumber",
      i."status",
      i."customerName",
      i."projectId",
      i."projectNumber",
      i."projectTitle",
      l."id" AS "lineId",
      l."position",
      l."catalogType",
      l."title",
      l."description",
      l."quantity",
      l."unit",
      l."totalNet",
      i."createdAt"
    FROM "InvoiceLine" l
    INNER JOIN "Invoice" i ON i."id" = l."invoiceId" AND i."organizationId" = l."organizationId"
    WHERE l."organizationId" = ${organization.id}
      AND i."status" NOT IN (${DELETED_DOCUMENT_STATUSES[0]}, ${DELETED_DOCUMENT_STATUSES[1]})
  `;

  const matchedRows = [...offerRows, ...invoiceRows]
    .filter((row) => includesSearch(row, query))
    .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());

  return NextResponse.json({
    query,
    minQueryLength: MIN_QUERY_LENGTH,
    limit: RESULT_LIMIT,
    total: matchedRows.length,
    limited: matchedRows.length > RESULT_LIMIT,
    results: matchedRows.slice(0, RESULT_LIMIT).map(serializeRow),
  });
}
