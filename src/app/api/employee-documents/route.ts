import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getAuthenticatedSessionUser } from "@/lib/auth/session";
import {
  canUploadEmployeeDocument,
  canViewEmployeeDocuments,
} from "@/lib/employee-documents/permissions";
import {
  cleanupStorageBackedPayload,
  persistStorageBackedPayload,
  prepareStorageBackedPayload,
} from "@/lib/storage/document-file";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CATEGORIES = new Set([
  "employment_contract",
  "payroll",
  "certificate",
  "sick_note",
  "vacation_proof",
  "training",
]);
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function getTarget(userId: string, organizationId: string) {
  return prisma.user.findFirst({
    where: { id: userId, organizationId, isActive: true },
    select: { id: true },
  });
}

function fileSignatureMatches(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return false;
}

export async function GET(request: Request) {
  const sessionUser = await getAuthenticatedSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Aktive Sitzung erforderlich." }, { status: 401 });
  const actor = await prisma.user.findFirst({
    where: { id: sessionUser.id, isActive: true },
    select: { id: true, organizationId: true, role: true },
  });
  if (!actor) return NextResponse.json({ error: "Aktiver Benutzer nicht gefunden." }, { status: 401 });

  const userId = new URL(request.url).searchParams.get("userId")?.trim() || sessionUser.id;
  const target = await getTarget(userId, actor.organizationId);
  if (!target) return NextResponse.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
  if (!canViewEmployeeDocuments(actor, userId)) {
    return NextResponse.json({ error: "Keine Berechtigung für diese Personalunterlagen." }, { status: 403 });
  }

  const documents = await prisma.employeeDocument.findMany({
    where: { organizationId: actor.organizationId, employeeId: userId, deletedAt: null },
    select: {
      id: true,
      category: true,
      originalFileName: true,
      mimeType: true,
      size: true,
      uploadedById: true,
      uploadedByName: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const sessionUser = await getAuthenticatedSessionUser(request);
  if (!sessionUser) return NextResponse.json({ error: "Aktive Sitzung erforderlich." }, { status: 401 });
  const actor = await prisma.user.findFirst({
    where: { id: sessionUser.id, isActive: true },
    select: { id: true, organizationId: true, role: true, firstName: true, lastName: true },
  });
  if (!actor) return NextResponse.json({ error: "Aktiver Benutzer nicht gefunden." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Upload konnte nicht gelesen werden." }, { status: 400 });
  const userId = String(formData.get("userId") || "").trim() || sessionUser.id;
  const category = String(formData.get("category") || "").trim();
  const file = formData.get("file");
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Ungültige Dokumentart." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Bitte eine Datei auswählen." }, { status: 400 });

  const target = await getTarget(userId, actor.organizationId);
  if (!target) return NextResponse.json({ error: "Mitarbeiter nicht gefunden." }, { status: 404 });
  if (!canUploadEmployeeDocument(actor, userId, category)) {
    return NextResponse.json({ error: "Diese Dokumentart kann nur durch die Geschäftsführung hochgeladen werden." }, { status: 403 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Erlaubt sind PDF-, JPG- und PNG-Dateien." }, { status: 415 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Die Datei darf maximal 10 MB groß sein." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!fileSignatureMatches(bytes, file.type)) {
    return NextResponse.json({ error: "Dateiinhalt und Dateityp stimmen nicht überein." }, { status: 415 });
  }
  const originalFileName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 180) || "Dokument";
  const documentId = randomUUID();
  const preparedFile = await prepareStorageBackedPayload({
    organizationId: actor.organizationId,
    ownerType: "employee",
    ownerId: documentId,
    sourceType: "employee-document",
    category: "employee-documents",
    originalName: originalFileName,
    contentType: file.type as "application/pdf" | "image/jpeg" | "image/png",
    bytes,
    createdByUserId: actor.id,
  });
  try {
    const document = await prisma.$transaction(async (tx) => {
      await persistStorageBackedPayload(tx, preparedFile);
      return tx.employeeDocument.create({
        data: {
          id: documentId,
          organizationId: actor.organizationId,
          employeeId: userId,
          category,
          originalFileName,
          mimeType: file.type,
          size: file.size,
          // Nur bei erfolgreich verifiziertem Objektspeicher wird die schwere
          // ByteA-Nutzlast aus PostgreSQL herausgehalten. Sonst bleibt der
          // bisherige Datenbankpfad als Fail-safe erhalten.
          fileData: preparedFile.storedFileId ? new Uint8Array() : bytes,
          uploadedById: actor.id,
          uploadedByName: `${actor.firstName} ${actor.lastName}`.trim(),
        },
        select: {
          id: true,
          category: true,
          originalFileName: true,
          mimeType: true,
          size: true,
          uploadedById: true,
          uploadedByName: true,
          createdAt: true,
        },
      });
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    await cleanupStorageBackedPayload(preparedFile);
    throw error;
  }
}
