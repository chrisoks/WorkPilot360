import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSessionUser } from "@/lib/auth/session";
import {
  canDeleteEmployeeDocument,
  canViewEmployeeDocuments,
} from "@/lib/employee-documents/permissions";

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
  return new NextResponse(document.fileData, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.size),
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
