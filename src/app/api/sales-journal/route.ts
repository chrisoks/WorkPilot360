import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { randomUUID } from "crypto";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import {
  canReadAllSalesJournalEntries,
  isSalesJournalActivityType,
  normalizeSalesJournalDays,
  resolveSalesJournalOwnerScope,
  salesJournalActivityLabels,
  type SalesJournalActivityType,
} from "@/lib/sales-journal";

type AuditRow = {
  id: string;
  entityId: string;
  actorId: string | null;
  payload: unknown;
  createdAt: Date;
  customerName: string | null;
};

type PhoneRow = {
  id: string;
  customerId: string;
  title: string;
  body: string;
  createdByUserId: string | null;
  createdByName: string;
  occurredAt: Date;
  customerName: string | null;
};

type OfferRow = {
  id: string;
  offerId: string;
  projectId: string;
  offerNumber: string;
  eventType: string;
  title: string;
  note: string;
  actorName: string;
  createdAt: Date;
  customerName: string;
  contactId: string | null;
};

type PotentialRow = {
  id: string;
  contactId: string | null;
  customerName: string | null;
  description: string;
  ownerUserId: string | null;
  ownerName: string | null;
  createdAt: Date;
};

type JournalEntry = {
  id: string;
  activityType: string;
  activityLabel: string;
  customerId: string;
  customerName: string;
  note: string;
  actorUserId: string;
  actorName: string;
  occurredAt: string;
  source: "manual" | "phone" | "offer" | "potential";
  isSystemGenerated: boolean;
  countsAsActivity: boolean;
  referenceId?: string;
};

const relevantOfferEvents = new Set(["created", "email_sent", "won", "lost", "customer_accepted"]);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getActorName(actor: User) {
  return [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "Mitarbeiter";
}

function getUserName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function resolveActorIdByName(users: User[], actorName: string) {
  const normalized = actorName.trim().toLocaleLowerCase("de");
  if (!normalized) return "";
  const matches = users.filter((user) => getUserName(user).toLocaleLowerCase("de") === normalized);
  return matches.length === 1 ? matches[0].id : "";
}

function getContactNameSql(alias = '"Contact"') {
  return `COALESCE(NULLIF(${alias}."companyName", ''), NULLIF(TRIM(CONCAT(COALESCE(${alias}."firstName", ''), ' ', COALESCE(${alias}."lastName", ''))), ''), 'Kunde')`;
}

function offerActivityType(eventType: string) {
  if (eventType === "email_sent") return { key: "offer", label: "Angebot versendet" };
  if (eventType === "won" || eventType === "customer_accepted") return { key: "offer", label: "Angebot gewonnen" };
  if (eventType === "lost") return { key: "offer", label: "Angebot verloren" };
  return { key: "offer", label: "Angebot erstellt" };
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  const actor = actorResult.actor;
  const canReadAll = canReadAllSalesJournalEntries(actor.role);
  const ownerScope = resolveSalesJournalOwnerScope({
    actorId: actor.id,
    actorRole: actor.role,
    requestedOwnerId: searchParams.get("employeeId"),
  });
  const days = normalizeSalesJournalDays(searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const customerId = cleanString(searchParams.get("customerId"));
  const activityType = cleanString(searchParams.get("activityType"));

  const [auditRows, phoneRows, offerRows, potentialRows] = await Promise.all([
    prisma.$queryRawUnsafe<AuditRow[]>(`
      SELECT a."id", a."entityId", a."actorId", a."payload", a."createdAt",
        ${getContactNameSql("c")} AS "customerName"
      FROM "AuditLog" a
      LEFT JOIN "Contact" c ON c."id" = a."entityId" AND c."organizationId" = a."organizationId"
      WHERE a."organizationId" = $1
        AND a."entityType" = 'contact-logbook'
        AND a."action" = 'sales_journal_entry_created'
        AND a."createdAt" >= $2
      ORDER BY a."createdAt" DESC
      LIMIT 750
    `, organization.id, since),
    prisma.$queryRawUnsafe<PhoneRow[]>(`
      SELECT e."id", e."customerId", e."title", e."body", e."createdByUserId", e."createdByName", e."occurredAt",
        ${getContactNameSql("c")} AS "customerName"
      FROM "CustomerLogbookEntry" e
      LEFT JOIN "Contact" c ON c."id" = e."customerId" AND c."organizationId" = e."organizationId"
      WHERE e."organizationId" = $1
        AND e."occurredAt" >= $2
        AND (e."source" = 'oks-phone' OR e."eventType" ILIKE '%phone%' OR e."eventType" ILIKE '%call%')
      ORDER BY e."occurredAt" DESC
      LIMIT 750
    `, organization.id, since),
    prisma.$queryRaw<OfferRow[]>`
      SELECT h."id", h."offerId", h."projectId", h."offerNumber", h."eventType", h."title", h."note", h."actorName", h."createdAt",
        COALESCE(NULLIF(o."customerName", ''), NULLIF(p."customer", ''), 'Kunde') AS "customerName",
        p."contactId"
      FROM "OfferHistory" h
      LEFT JOIN "Offer" o ON o."id" = h."offerId" AND o."organizationId" = h."organizationId"
      LEFT JOIN "WorkPilotProject" p ON p."id" = h."projectId" AND p."organizationId" = h."organizationId"
      WHERE h."organizationId" = ${organization.id}
        AND h."createdAt" >= ${since}
      ORDER BY h."createdAt" DESC
      LIMIT 750
    `,
    prisma.$queryRaw<PotentialRow[]>`
      SELECT "id", "contactId", "customerName", "description", "ownerUserId", "ownerName", "createdAt"
      FROM "ProjectPotential"
      WHERE "organizationId" = ${organization.id}
        AND "createdAt" >= ${since}
      ORDER BY "createdAt" DESC
      LIMIT 750
    `,
  ]);

  const entries: JournalEntry[] = [];

  for (const row of auditRows) {
    const payload = readObject(row.payload);
    const type = cleanString(payload.salesActivityType);
    if (!isSalesJournalActivityType(type)) continue;
    const actorUserId = cleanString(payload.authorUserId) || row.actorId || "";
    entries.push({
      id: `manual-${row.id}`,
      activityType: type,
      activityLabel: salesJournalActivityLabels[type],
      customerId: row.entityId,
      customerName: row.customerName || "Kunde",
      note: cleanString(payload.text),
      actorUserId,
      actorName: cleanString(payload.author) || "Mitarbeiter",
      occurredAt: row.createdAt.toISOString(),
      source: "manual",
      isSystemGenerated: false,
      countsAsActivity: true,
    });
  }

  for (const row of phoneRows) {
    entries.push({
      id: `phone-${row.id}`,
      activityType: "call",
      activityLabel: "Telefonat",
      customerId: row.customerId,
      customerName: row.customerName || "Kunde",
      note: row.body || row.title,
      actorUserId: row.createdByUserId || "",
      actorName: row.createdByName || "Mitarbeiter",
      occurredAt: row.occurredAt.toISOString(),
      source: "phone",
      isSystemGenerated: true,
      countsAsActivity: Boolean(row.createdByUserId),
    });
  }

  for (const row of offerRows) {
    if (!relevantOfferEvents.has(row.eventType)) continue;
    const type = offerActivityType(row.eventType);
    entries.push({
      id: `offer-${row.id}`,
      activityType: type.key,
      activityLabel: type.label,
      customerId: row.contactId || "",
      customerName: row.customerName || "Kunde",
      note: row.note || row.title,
      actorUserId: resolveActorIdByName(users, row.actorName),
      actorName: row.actorName || "System",
      occurredAt: row.createdAt.toISOString(),
      source: "offer",
      isSystemGenerated: true,
      countsAsActivity: Boolean(resolveActorIdByName(users, row.actorName)) && row.eventType !== "customer_accepted",
      referenceId: row.offerNumber,
    });
  }

  for (const row of potentialRows) {
    entries.push({
      id: `potential-${row.id}`,
      activityType: "opportunity",
      activityLabel: "Zusatzverkauf erkannt",
      customerId: row.contactId || "",
      customerName: row.customerName || "Kunde",
      note: row.description,
      actorUserId: row.ownerUserId || "",
      actorName: row.ownerName || "System",
      occurredAt: row.createdAt.toISOString(),
      source: "potential",
      isSystemGenerated: true,
      countsAsActivity: false,
    });
  }

  const visibleEntries = entries
    .filter((entry) => !ownerScope || entry.actorUserId === ownerScope)
    .filter((entry) => !customerId || entry.customerId === customerId)
    .filter((entry) => !activityType || entry.activityType === activityType)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  return NextResponse.json({
    entries: visibleEntries,
    scope: canReadAll ? "all" : "own",
    canReadAll,
  });
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const body = await req.json();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  const actor = actorResult.actor;
  const customerId = cleanString(body.customerId);
  const note = cleanString(body.note);
  const activityType = cleanString(body.activityType);

  if (!customerId || !note || !isSalesJournalActivityType(activityType)) {
    return NextResponse.json({ error: "Kunde, Aktivitätsart und kurze Notiz sind erforderlich." }, { status: 400 });
  }

  const contacts = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Contact"
    WHERE "organizationId" = ${organization.id}
      AND "id" = ${customerId}
      AND "category" = 'Kunde'
      AND "deletionMarkedAt" IS NULL
    LIMIT 1
  `;
  if (!contacts.length) {
    return NextResponse.json({ error: "Der ausgewählte Kunde wurde nicht gefunden." }, { status: 404 });
  }

  const actorName = getActorName(actor);
  const entry = await prisma.auditLog.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      actorId: actor.id,
      action: "sales_journal_entry_created",
      entityType: "contact-logbook",
      entityId: customerId,
      payload: {
        text: note,
        author: actorName,
        authorUserId: actor.id,
        activityLabel: salesJournalActivityLabels[activityType],
        salesActivityType: activityType,
        salesJournal: true,
        isSystem: false,
      },
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ id: entry.id, occurredAt: entry.createdAt.toISOString() }, { status: 201 });
}
