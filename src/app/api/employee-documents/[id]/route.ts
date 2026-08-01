import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSessionUser } from "@/lib/auth/session";
import {
  canDeleteEmployeeDocument,
  canViewEmployeeDocuments,
} from "@/lib/employee-documents/permissions";
import { readStoredFileBytes } from "@/lib/storage/document-file";

function safeDownloadName(value: string) {
  return value.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "Dokument";
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionUser = await getAuthenticatedSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Aktive Sitzung erforderlich." }, { status: 401 });
  const actor = await prisma.user.findFirst({
    where: { id: sessionUser.id, isActive: true },
    select: { id: true, organizationId: true, role: true },
  });
  if (!actor) return NextResponse.json({ error: "Aktiver Benutzer nicht gefunden." }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.employeeDocument.findFirst({
    where: { id, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!document) return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  if (!canViewEmployeeDocuments(actor, document.employeeId)) {
    return NextResponse.json({ error: "Keine Berechtigung für dieses Dokument." }, { status: 403 });
  }
  let bytes = Buffer.from(document.fileData);
  const storedFile = await prisma.storedFile.findFirst({
    where: {
      organizationId: actor.organizationId,
      ownerType: "employee",
      ownerId: document.id,
      sourceType: "employee-document",
      status: "available",
      deletedAt: null,
    },
    orderBy: [{ availableAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (storedFile) {
    try {
      const stored = await readStoredFileBytes({
        organizationId: actor.organizationId,
        fileId: storedFile.id,
        expectedOwnerType: "employee",
        expectedOwnerId: document.id,
      });
      if (stored) bytes = stored.bytes;
    } catch (error) {
      console.error("Employee document storage read failed", {
        documentId: document.id,
        error: error instanceof Error ? error.name : "unknown",
      });
      if (!bytes.byteLength) {
        return NextResponse.json(
          { error: "Der Dateispeicher ist voruebergehend nicht erreichbar." },
          { status: 503, headers: { "Retry-After": "30" } }
        );
      }
    }
  }
  if (!bytes.byteLength) {
    return NextResponse.json({ error: "Dokumentinhalt wurde nicht gefunden." }, { status: 404 });
  }
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${safeDownloadName(document.originalFileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionUser = await getAuthenticatedSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Aktive Sitzung erforderlich." }, { status: 401 });
  const actor = await prisma.user.findFirst({
    where: { id: sessionUser.id, isActive: true },
    select: { id: true, organizationId: true, role: true },
  });
  if (!actor) return NextResponse.json({ error: "Aktiver Benutzer nicht gefunden." }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.employeeDocument.findFirst({
    where: { id, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, employeeId: true, uploadedById: true, category: true },
  });
  if (!document) return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  if (!canDeleteEmployeeDocument(actor, document)) {
    return NextResponse.json({ error: "Keine Berechtigung zum Löschen dieses Dokuments." }, { status: 403 });
  }
  await prisma.employeeDocument.update({
    where: { id: document.id },
    data: { deletedAt: new Date(), deletedById: actor.id },
  });
  return NextResponse.json({ success: true });
}
