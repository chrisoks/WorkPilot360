import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { formatBerlinDateTime } from "@/lib/date-time";
import { canManageContacts, canReadContacts } from "@/lib/permissions";

type CustomerLogbookAuditRow = {
  id: string;
  entityId: string;
  payload: unknown;
  createdAt: Date;
};

type LogbookAttachment = {
  name: string;
  type: "Bild" | "Dokument";
  mimeType?: string;
  size?: number;
  dataUrl?: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringList(value: unknown) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

function cleanAttachments(value: unknown): LogbookAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<LogbookAttachment[]>((attachments, item) => {
    if (!item || typeof item !== "object") return attachments;
    const candidate = item as Partial<LogbookAttachment>;
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

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "System";
}

function readPayload(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function customerExists(organizationId: string, customerId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${customerId}
    LIMIT 1
  `;
  return rows.length > 0;
}

function formatEntry(row: CustomerLogbookAuditRow) {
  const payload = readPayload(row.payload);
  return {
    id: row.id,
    customerId: row.entityId,
    date: formatBerlinDateTime(row.createdAt),
    text: cleanString(payload.text),
    author: cleanString(payload.author) || "System",
    authorUserId: cleanString(payload.authorUserId),
    colleague: cleanString(payload.colleague),
    visibleFor: cleanStringList(payload.visibleFor),
    attachments: cleanAttachments(payload.attachments),
    taskTitle: cleanString(payload.taskTitle),
    isSystem: payload.isSystem === true,
  };
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const customerId = cleanString(searchParams.get("customerId"));
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canReadContacts(actorResult.actor)) {
    return NextResponse.json({ error: "Keine Berechtigung für Kundenlogbücher." }, { status: 403 });
  }
  if (!customerId) {
    return NextResponse.json({ error: "Keine Kunden-ID übergeben." }, { status: 400 });
  }
  if (!(await customerExists(organization.id, customerId))) {
    return NextResponse.json({ error: "Kunde wurde nicht gefunden." }, { status: 404 });
  }

  const rows = await prisma.$queryRaw<CustomerLogbookAuditRow[]>`
    SELECT "id", "entityId", "payload", "createdAt"
    FROM "AuditLog"
    WHERE "organizationId" = ${organization.id}
      AND "entityType" = 'contact-logbook'
      AND "entityId" = ${customerId}
    ORDER BY "createdAt" DESC
  `;

  return NextResponse.json(rows.map(formatEntry));
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const body = await req.json();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  const actor = actorResult.actor;
  if (!canManageContacts(actor)) {
    return NextResponse.json({ error: "Keine Berechtigung für Kundenlogbücher." }, { status: 403 });
  }

  const customerId = cleanString(body.customerId);
  const text = cleanString(body.text);
  if (!customerId || !text) {
    return NextResponse.json({ error: "Kunde und Logbuchtext sind erforderlich." }, { status: 400 });
  }
  if (!(await customerExists(organization.id, customerId))) {
    return NextResponse.json({ error: "Kunde wurde nicht gefunden." }, { status: 404 });
  }

  const entry = await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      actorId: actor.id,
      action: "customer_logbook_entry_created",
      entityType: "contact-logbook",
      entityId: customerId,
      payload: {
        text,
        author: getActorName(actor),
        authorUserId: actor.id,
        colleague: cleanString(body.colleague),
        visibleFor: cleanStringList(body.visibleFor),
        attachments: cleanAttachments(body.attachments),
        taskTitle: cleanString(body.taskTitle),
        isSystem: false,
      },
    },
    select: {
      id: true,
      entityId: true,
      payload: true,
      createdAt: true,
    },
  });

  return NextResponse.json(formatEntry(entry));
}
