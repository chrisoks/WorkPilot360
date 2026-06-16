import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export type StatusEntityType = "project" | "task" | "potential" | "sales_target";

type RecordStatusTransitionInput = {
  organizationId: string;
  entityType: StatusEntityType;
  entityId: string;
  entityLabel?: string;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId?: string | null;
  actorName?: string;
  note?: string;
  at?: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function ensureStatusTrackingTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "StatusTimelineEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "entityLabel" TEXT NOT NULL DEFAULT '',
      "fromStatus" TEXT,
      "toStatus" TEXT NOT NULL,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endedAt" TIMESTAMP(3),
      "durationMinutes" INTEGER,
      "actorUserId" TEXT,
      "actorName" TEXT NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "StatusTimelineEntry"
    ADD COLUMN IF NOT EXISTS "entityLabel" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "fromStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER,
    ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "actorName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "note" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "StatusEscalationRule" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "thresholdHours" INTEGER NOT NULL DEFAULT 24,
      "notifyResponsible" BOOLEAN NOT NULL DEFAULT true,
      "notifyProjectOwner" BOOLEAN NOT NULL DEFAULT false,
      "notifyManagement" BOOLEAN NOT NULL DEFAULT true,
      "notificationEnabled" BOOLEAN NOT NULL DEFAULT true,
      "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "StatusEscalationRule"
    ADD COLUMN IF NOT EXISTS "notifyResponsible" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "notifyProjectOwner" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "notifyManagement" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "notificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "StatusEscalationEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "ruleId" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "entityLabel" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL,
      "thresholdHours" INTEGER NOT NULL,
      "actualHours" INTEGER NOT NULL,
      "recipientUserId" TEXT,
      "notificationId" TEXT,
      "dailyReportDate" TEXT,
      "resolvedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "StatusEscalationEvent"
    ADD COLUMN IF NOT EXISTS "entityLabel" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "notificationId" TEXT,
    ADD COLUMN IF NOT EXISTS "dailyReportDate" TEXT,
    ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "StatusTimelineEntry_org_entity_idx" ON "StatusTimelineEntry" ("organizationId", "entityType", "entityId")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "StatusEscalationRule_org_status_idx" ON "StatusEscalationRule" ("organizationId", "entityType", "status")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "StatusEscalationEvent_open_idx" ON "StatusEscalationEvent" ("organizationId", "ruleId", "entityType", "entityId", "resolvedAt")`;
}

export async function ensureDefaultStatusEscalationRules(organizationId: string) {
  await ensureStatusTrackingTables();

  const defaults = [
    { entityType: "project", status: "Lead / Klärung", name: "Projekt in Lead / Klärung", thresholdHours: 168 },
    { entityType: "project", status: "Angebot", name: "Projekt im Angebotsstatus", thresholdHours: 168 },
    { entityType: "project", status: "Zur Planung bereit", name: "Projekt bereit zur Planung", thresholdHours: 72 },
    { entityType: "project", status: "Umsetzung", name: "Projekt in Umsetzung", thresholdHours: 336 },
    { entityType: "project", status: "Endkontrolle", name: "Projekt in Endkontrolle", thresholdHours: 72 },
    { entityType: "project", status: "Zur Abrechnung bereit", name: "Projekt bereit zur Abrechnung", thresholdHours: 72 },
    { entityType: "project", status: "Abgeschlossen", name: "Projekt abgeschlossen", thresholdHours: 720 },
    { entityType: "task", status: "wartet auf Rückmeldung", name: "Aufgabe wartet auf Rückmeldung", thresholdHours: 168 },
    { entityType: "task", status: "überfällig", name: "Aufgabe überfällig", thresholdHours: 24 },
    { entityType: "task", status: "erledigt", name: "Aufgabe erledigt", thresholdHours: 720 },
    { entityType: "task", status: "abgelehnt", name: "Aufgabe abgelehnt", thresholdHours: 24 },
    { entityType: "task", status: "archiviert", name: "Aufgabe archiviert", thresholdHours: 720 },
    { entityType: "potential", status: "follow_up", name: "Potenzial im Nachfassen", thresholdHours: 168 },
    { entityType: "potential", status: "offered", name: "Potenzial angeboten", thresholdHours: 336 },
    { entityType: "potential", status: "lost", name: "Potenzial kein Interesse", thresholdHours: 720 },
    { entityType: "sales_target", status: "open", name: "Sales-Ziel offen", thresholdHours: 168 },
    { entityType: "sales_target", status: "in_contact", name: "Sales-Ziel in Kontakt", thresholdHours: 168 },
    { entityType: "sales_target", status: "done", name: "Sales-Ziel erledigt", thresholdHours: 720 },
    { entityType: "sales_target", status: "discarded", name: "Sales-Ziel verworfen", thresholdHours: 720 },
    { entityType: "potential", status: "open", name: "Potenzial offen", thresholdHours: 168 },
    { entityType: "project", status: "Lead / Klärung", name: "Projekt in Lead / Klärung", thresholdHours: 168 },
    { entityType: "project", status: "Warten auf Kunde", name: "Projekt wartet auf Kunde", thresholdHours: 336 },
    { entityType: "task", status: "offen", name: "Aufgabe offen", thresholdHours: 48 },
    { entityType: "task", status: "in Bearbeitung", name: "Aufgabe in Bearbeitung", thresholdHours: 120 },
  ] as const;

  for (const rule of defaults) {
    await prisma.$executeRaw`
      INSERT INTO "StatusEscalationRule" (
        "id",
        "organizationId",
        "entityType",
        "status",
        "name",
        "thresholdHours",
        "notifyResponsible",
        "notifyProjectOwner",
        "notifyManagement",
        "notificationEnabled",
        "dailyReportEnabled",
        "isActive"
      )
      SELECT
        ${randomUUID()},
        ${organizationId},
        ${rule.entityType},
        ${rule.status},
        ${rule.name},
        ${rule.thresholdHours},
        true,
        ${rule.entityType === "project"},
        true,
        true,
        true,
        true
      WHERE NOT EXISTS (
        SELECT 1
        FROM "StatusEscalationRule"
        WHERE "organizationId" = ${organizationId}
          AND "entityType" = ${rule.entityType}
          AND "status" = ${rule.status}
      )
    `;
  }
}

export async function seedCurrentStatusTimeline(input: {
  organizationId: string;
  entityType: StatusEntityType;
  entityId: string;
  entityLabel?: string;
  status: string;
  startedAt?: Date | string | null;
  correctOpenStartedAt?: boolean;
}) {
  await ensureStatusTrackingTables();
  const entityId = cleanString(input.entityId);
  const status = cleanString(input.status);
  if (!entityId || !status) return;

  const startedAt =
    input.startedAt instanceof Date
      ? input.startedAt
      : cleanString(input.startedAt)
        ? new Date(cleanString(input.startedAt))
        : new Date();

  await prisma.$executeRaw`
    INSERT INTO "StatusTimelineEntry" (
      "id",
      "organizationId",
      "entityType",
      "entityId",
      "entityLabel",
      "fromStatus",
      "toStatus",
      "startedAt",
      "actorName",
      "note"
    )
    SELECT
      ${randomUUID()},
      ${input.organizationId},
      ${input.entityType},
      ${entityId},
      ${cleanString(input.entityLabel)},
      NULL,
      ${status},
      ${Number.isFinite(startedAt.getTime()) ? startedAt : new Date()},
      'System',
      'Startstatus für Statusmessung übernommen.'
    WHERE NOT EXISTS (
      SELECT 1
      FROM "StatusTimelineEntry"
      WHERE "organizationId" = ${input.organizationId}
        AND "entityType" = ${input.entityType}
        AND "entityId" = ${entityId}
    )
  `;

  if (input.correctOpenStartedAt) {
    await prisma.$executeRaw`
      UPDATE "StatusTimelineEntry"
      SET
        "entityLabel" = ${cleanString(input.entityLabel)},
        "startedAt" = ${Number.isFinite(startedAt.getTime()) ? startedAt : new Date()},
        "note" = 'Startstatus fuer Statusmessung aus Fachhistorie korrigiert.'
      WHERE "organizationId" = ${input.organizationId}
        AND "entityType" = ${input.entityType}
        AND "entityId" = ${entityId}
        AND "toStatus" = ${status}
        AND "endedAt" IS NULL
        AND "startedAt" > ${Number.isFinite(startedAt.getTime()) ? startedAt : new Date()}
    `;
  }
}

export async function recordStatusTransition(input: RecordStatusTransitionInput) {
  await ensureStatusTrackingTables();

  const entityId = cleanString(input.entityId);
  const toStatus = cleanString(input.toStatus);
  const fromStatus = cleanString(input.fromStatus);

  if (!entityId || !toStatus || fromStatus === toStatus) return;

  const changedAt = input.at ?? new Date();

  await prisma.$executeRaw`
    UPDATE "StatusTimelineEntry"
    SET
      "endedAt" = ${changedAt},
      "durationMinutes" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${changedAt} - "startedAt")) / 60)::INTEGER)
    WHERE "organizationId" = ${input.organizationId}
      AND "entityType" = ${input.entityType}
      AND "entityId" = ${entityId}
      AND "endedAt" IS NULL
  `;

  await prisma.$executeRaw`
    INSERT INTO "StatusTimelineEntry" (
      "id",
      "organizationId",
      "entityType",
      "entityId",
      "entityLabel",
      "fromStatus",
      "toStatus",
      "startedAt",
      "actorUserId",
      "actorName",
      "note"
    )
    VALUES (
      ${randomUUID()},
      ${input.organizationId},
      ${input.entityType},
      ${entityId},
      ${cleanString(input.entityLabel)},
      ${fromStatus || null},
      ${toStatus},
      ${changedAt},
      ${cleanString(input.actorUserId) || null},
      ${cleanString(input.actorName)},
      ${cleanString(input.note)}
    )
  `;

  await prisma.$executeRaw`
    UPDATE "StatusEscalationEvent"
    SET "resolvedAt" = ${changedAt}
    WHERE "organizationId" = ${input.organizationId}
      AND "entityType" = ${input.entityType}
      AND "entityId" = ${entityId}
      AND "resolvedAt" IS NULL
      AND "status" <> ${toStatus}
  `;
}

export function serializeJson(value: unknown) {
  return JSON.stringify(value ?? Prisma.JsonNull);
}
