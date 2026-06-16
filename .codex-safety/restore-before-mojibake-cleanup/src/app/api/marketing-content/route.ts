import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type MarketingQuotaRow = {
  id: string;
  projectId: string;
  month: string;
  catalogItemId: string;
  serviceName: string;
  category: string;
  unit: string;
  targetQuantity: number;
  planningMinutesPerUnit: number;
  allowAdditional: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MarketingItemRow = {
  id: string;
  projectId: string;
  projectLabel: string;
  customerName: string;
  month: string;
  quotaId: string | null;
  catalogItemId: string | null;
  serviceName: string;
  category: string;
  unit: string;
  title: string;
  status: string;
  responsibleUserId: string | null;
  responsibleName: string;
  platform: string;
  formatDetails: string;
  plannedDate: string;
  dueDate: string;
  assetLink: string;
  isAdditional: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type MarketingScheduleRow = {
  id: string;
  contentItemId: string;
  projectId: string;
  planningEntryId: string | null;
  title: string;
  phase: string;
  userId: string | null;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  note: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanMonth(value: unknown) {
  const month = cleanString(value);
  return /^\d{4}-\d{2}$/.test(month) ? month : "";
}

function cleanDate(value: unknown) {
  const date = cleanString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function cleanTime(value: unknown, fallback = "") {
  const time = cleanString(value);
  return /^\d{2}:\d{2}$/.test(time) ? time : fallback;
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMinutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  return ["Offen", "In Arbeit", "Freigabe", "Erledigt", "Veröffentlicht", "Abgeschlossen"].includes(status)
    ? status
    : "Offen";
}

function formatQuota(row: MarketingQuotaRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    month: row.month,
    catalogItemId: row.catalogItemId,
    serviceName: row.serviceName,
    category: row.category,
    unit: row.unit,
    targetQuantity: Number(row.targetQuantity),
    planningMinutesPerUnit: Number(row.planningMinutesPerUnit),
    allowAdditional: Boolean(row.allowAdditional),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatItem(row: MarketingItemRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectLabel: row.projectLabel,
    customerName: row.customerName,
    month: row.month,
    quotaId: row.quotaId ?? "",
    catalogItemId: row.catalogItemId ?? "",
    serviceName: row.serviceName,
    category: row.category,
    unit: row.unit,
    title: row.title,
    status: row.status,
    responsibleUserId: row.responsibleUserId ?? "",
    responsibleName: row.responsibleName,
    platform: row.platform,
    formatDetails: row.formatDetails,
    plannedDate: row.plannedDate,
    dueDate: row.dueDate,
    assetLink: row.assetLink,
    isAdditional: Boolean(row.isAdditional),
    sortOrder: Number(row.sortOrder),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatSchedule(row: MarketingScheduleRow) {
  return {
    id: row.id,
    contentItemId: row.contentItemId,
    projectId: row.projectId,
    planningEntryId: row.planningEntryId ?? "",
    title: row.title,
    phase: row.phase,
    userId: row.userId ?? "",
    employeeName: row.employeeName,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMinutes: Number(row.durationMinutes),
    note: row.note,
    deletedAt: row.deletedAt?.toISOString() ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureMarketingTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "MarketingContentQuota" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "month" TEXT NOT NULL,
      "catalogItemId" TEXT NOT NULL,
      "serviceName" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Sonstiges',
      "unit" TEXT NOT NULL DEFAULT 'Stk',
      "targetQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "planningMinutesPerUnit" INTEGER NOT NULL DEFAULT 0,
      "allowAdditional" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "MarketingContentQuota_org_project_month_catalog_key"
    ON "MarketingContentQuota" ("organizationId", "projectId", "month", "catalogItemId")
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "MarketingContentItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT NOT NULL DEFAULT '',
      "customerName" TEXT NOT NULL DEFAULT '',
      "month" TEXT NOT NULL,
      "quotaId" TEXT,
      "catalogItemId" TEXT,
      "serviceName" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'Sonstiges',
      "unit" TEXT NOT NULL DEFAULT 'Stk',
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Offen',
      "responsibleUserId" TEXT,
      "responsibleName" TEXT NOT NULL DEFAULT '',
      "platform" TEXT NOT NULL DEFAULT '',
      "formatDetails" TEXT NOT NULL DEFAULT '',
      "plannedDate" TEXT NOT NULL DEFAULT '',
      "dueDate" TEXT NOT NULL DEFAULT '',
      "assetLink" TEXT NOT NULL DEFAULT '',
      "isAdditional" BOOLEAN NOT NULL DEFAULT false,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "MarketingContentSchedule" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "contentItemId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "planningEntryId" TEXT,
      "title" TEXT NOT NULL,
      "phase" TEXT NOT NULL DEFAULT 'Arbeit',
      "userId" TEXT,
      "employeeName" TEXT NOT NULL DEFAULT '',
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMinutes" INTEGER NOT NULL DEFAULT 0,
      "note" TEXT NOT NULL DEFAULT '',
      "deletedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "PlanningEntry"
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentScheduleId" TEXT
  `;

  await prisma.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentType" TEXT
  `;
}

async function listMarketingContent(organizationId: string, projectId = "", month = "") {
  const quotas = await prisma.$queryRaw<MarketingQuotaRow[]>`
    SELECT *
    FROM "MarketingContentQuota"
    WHERE "organizationId" = ${organizationId}
      AND (${projectId} = '' OR "projectId" = ${projectId})
      AND (${month} = '' OR "month" = ${month})
    ORDER BY "category" ASC, "serviceName" ASC
  `;
  const items = await prisma.$queryRaw<MarketingItemRow[]>`
    SELECT *
    FROM "MarketingContentItem"
    WHERE "organizationId" = ${organizationId}
      AND (${projectId} = '' OR "projectId" = ${projectId})
      AND (${month} = '' OR "month" = ${month})
    ORDER BY "month" DESC, "category" ASC, "serviceName" ASC, "sortOrder" ASC, "createdAt" ASC
  `;
  const schedules = await prisma.$queryRaw<MarketingScheduleRow[]>`
    SELECT *
    FROM "MarketingContentSchedule"
    WHERE "organizationId" = ${organizationId}
      AND (${projectId} = '' OR "projectId" = ${projectId})
    ORDER BY "date" ASC, "startTime" ASC
  `;

  return {
    quotas: quotas.map(formatQuota),
    items: items.map(formatItem),
    schedules: schedules.map(formatSchedule),
  };
}

export async function GET(req: Request) {
  const { organization } = await getDemoContext();
  await ensureMarketingTables();
  const { searchParams } = new URL(req.url);
  return NextResponse.json(
    await listMarketingContent(
      organization.id,
      cleanString(searchParams.get("projectId")),
      cleanMonth(searchParams.get("month"))
    )
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = cleanString(body.action);
  const { organization } = await getDemoContext();
  await ensureMarketingTables();

  if (action === "saveQuota") return saveQuota(organization.id, body);
  if (action === "generateItems") return generateItems(organization.id, body);
  if (action === "saveItem") return saveItem(organization.id, body);
  if (action === "saveSchedule") return saveSchedule(organization.id, body);
  if (action === "deleteSchedule") return deleteSchedule(organization.id, body);
  if (action === "deleteItem") return deleteItem(organization.id, body);

  return NextResponse.json({ error: "Unbekannte Marketing-Aktion." }, { status: 400 });
}

async function saveQuota(organizationId: string, body: Record<string, unknown>) {
  const id = cleanString(body.id) || randomUUID();
  const projectId = cleanString(body.projectId);
  const month = cleanMonth(body.month);
  const catalogItemId = cleanString(body.catalogItemId);
  const serviceName = cleanString(body.serviceName);
  if (!projectId || !month || !catalogItemId || !serviceName) {
    return NextResponse.json({ error: "Projekt, Monat und Leistung fehlen." }, { status: 400 });
  }
  const rows = await prisma.$queryRaw<MarketingQuotaRow[]>`
    INSERT INTO "MarketingContentQuota" (
      "id", "organizationId", "projectId", "month", "catalogItemId", "serviceName", "category", "unit",
      "targetQuantity", "planningMinutesPerUnit", "allowAdditional", "updatedAt"
    )
    VALUES (
      ${id}, ${organizationId}, ${projectId}, ${month}, ${catalogItemId}, ${serviceName},
      ${cleanString(body.category) || "Sonstiges"}, ${cleanString(body.unit) || "Stk"},
      ${Math.max(0, cleanNumber(body.targetQuantity))}, ${Math.max(0, Math.round(cleanNumber(body.planningMinutesPerUnit)))},
      ${body.allowAdditional !== false}, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("organizationId", "projectId", "month", "catalogItemId") DO UPDATE SET
      "serviceName" = EXCLUDED."serviceName",
      "category" = EXCLUDED."category",
      "unit" = EXCLUDED."unit",
      "targetQuantity" = EXCLUDED."targetQuantity",
      "planningMinutesPerUnit" = EXCLUDED."planningMinutesPerUnit",
      "allowAdditional" = EXCLUDED."allowAdditional",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return NextResponse.json(formatQuota(rows[0]));
}

async function generateItems(organizationId: string, body: Record<string, unknown>) {
  const projectId = cleanString(body.projectId);
  const month = cleanMonth(body.month);
  if (!projectId || !month) return NextResponse.json({ error: "Projekt und Monat fehlen." }, { status: 400 });
  const quotas = await prisma.$queryRaw<MarketingQuotaRow[]>`
    SELECT *
    FROM "MarketingContentQuota"
    WHERE "organizationId" = ${organizationId}
      AND "projectId" = ${projectId}
      AND "month" = ${month}
  `;

  if (quotas.length === 0) {
    return NextResponse.json({ error: "Bitte zuerst ein Monatskontingent hinterlegen." }, { status: 400 });
  }

  let createdCount = 0;
  for (const quota of quotas) {
    const existing = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "MarketingContentItem"
      WHERE "organizationId" = ${organizationId}
        AND "quotaId" = ${quota.id}
        AND "isAdditional" = false
    `;
    const missing = Math.max(0, Math.round(Number(quota.targetQuantity)) - Number(existing[0]?.count ?? 0));
    for (let index = 0; index < missing; index += 1) {
      const sortOrder = Number(existing[0]?.count ?? 0) + index + 1;
      await prisma.$executeRaw`
        INSERT INTO "MarketingContentItem" (
          "id", "organizationId", "projectId", "projectLabel", "customerName", "month", "quotaId", "catalogItemId",
          "serviceName", "category", "unit", "title", "status", "sortOrder", "updatedAt"
        )
        VALUES (
          ${randomUUID()}, ${organizationId}, ${projectId}, ${cleanString(body.projectLabel)}, ${cleanString(body.customerName)},
          ${month}, ${quota.id}, ${quota.catalogItemId}, ${quota.serviceName}, ${quota.category}, ${quota.unit},
          ${`${quota.serviceName} ${sortOrder}`}, ${"Offen"}, ${sortOrder}, CURRENT_TIMESTAMP
        )
      `;
      createdCount += 1;
    }
  }

  return NextResponse.json({
    ...(await listMarketingContent(organizationId, projectId, month)),
    createdCount,
  });
}

async function saveItem(organizationId: string, body: Record<string, unknown>) {
  const id = cleanString(body.id) || randomUUID();
  const projectId = cleanString(body.projectId);
  const month = cleanMonth(body.month);
  const title = cleanString(body.title);
  if (!projectId || !month || !title) {
    return NextResponse.json({ error: "Projekt, Monat und Titel fehlen." }, { status: 400 });
  }
  const rows = await prisma.$queryRaw<MarketingItemRow[]>`
    INSERT INTO "MarketingContentItem" (
      "id", "organizationId", "projectId", "projectLabel", "customerName", "month", "quotaId", "catalogItemId",
      "serviceName", "category", "unit", "title", "status", "responsibleUserId", "responsibleName",
      "platform", "formatDetails", "plannedDate", "dueDate", "assetLink", "isAdditional", "sortOrder", "updatedAt"
    )
    VALUES (
      ${id}, ${organizationId}, ${projectId}, ${cleanString(body.projectLabel)}, ${cleanString(body.customerName)}, ${month},
      ${cleanString(body.quotaId) || null}, ${cleanString(body.catalogItemId) || null}, ${cleanString(body.serviceName) || "Marketing"},
      ${cleanString(body.category) || "Sonstiges"}, ${cleanString(body.unit) || "Stk"}, ${title}, ${cleanStatus(body.status)},
      ${cleanString(body.responsibleUserId) || null}, ${cleanString(body.responsibleName)}, ${cleanString(body.platform)},
      ${cleanString(body.formatDetails)}, ${cleanDate(body.plannedDate)}, ${cleanDate(body.dueDate)}, ${cleanString(body.assetLink)},
      ${Boolean(body.isAdditional)}, ${Math.max(0, Math.round(cleanNumber(body.sortOrder)))}, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "status" = EXCLUDED."status",
      "responsibleUserId" = EXCLUDED."responsibleUserId",
      "responsibleName" = EXCLUDED."responsibleName",
      "platform" = EXCLUDED."platform",
      "formatDetails" = EXCLUDED."formatDetails",
      "plannedDate" = EXCLUDED."plannedDate",
      "dueDate" = EXCLUDED."dueDate",
      "assetLink" = EXCLUDED."assetLink",
      "isAdditional" = EXCLUDED."isAdditional",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return NextResponse.json(formatItem(rows[0]));
}

async function saveSchedule(organizationId: string, body: Record<string, unknown>) {
  const id = cleanString(body.id) || randomUUID();
  const contentItemId = cleanString(body.contentItemId);
  const projectId = cleanString(body.projectId);
  const date = cleanDate(body.date);
  const startTime = cleanTime(body.startTime);
  const endTime = cleanTime(body.endTime);
  if (!contentItemId || !projectId || !date || !startTime || !endTime) {
    return NextResponse.json({ error: "Content, Projekt, Datum und Zeit fehlen." }, { status: 400 });
  }
  const durationMinutes = Math.max(0, Math.round(cleanNumber(body.durationMinutes))) || getMinutesBetween(startTime, endTime);
  const rows = await prisma.$queryRaw<MarketingScheduleRow[]>`
    INSERT INTO "MarketingContentSchedule" (
      "id", "organizationId", "contentItemId", "projectId", "title", "phase", "userId", "employeeName",
      "date", "startTime", "endTime", "durationMinutes", "note", "updatedAt"
    )
    VALUES (
      ${id}, ${organizationId}, ${contentItemId}, ${projectId}, ${cleanString(body.title) || "Marketing-Termin"},
      ${cleanString(body.phase) || "Arbeit"}, ${cleanString(body.userId) || null}, ${cleanString(body.employeeName)},
      ${date}, ${startTime}, ${endTime}, ${durationMinutes}, ${cleanString(body.note)}, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "phase" = EXCLUDED."phase",
      "userId" = EXCLUDED."userId",
      "employeeName" = EXCLUDED."employeeName",
      "date" = EXCLUDED."date",
      "startTime" = EXCLUDED."startTime",
      "endTime" = EXCLUDED."endTime",
      "durationMinutes" = EXCLUDED."durationMinutes",
      "note" = EXCLUDED."note",
      "deletedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const schedule = rows[0];
  const planningEntryId = await upsertPlanningEntryForSchedule(organizationId, schedule, body);
  const updatedRows = await prisma.$queryRaw<MarketingScheduleRow[]>`
    UPDATE "MarketingContentSchedule"
    SET "planningEntryId" = ${planningEntryId},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${schedule.id}
      AND "organizationId" = ${organizationId}
    RETURNING *
  `;
  return NextResponse.json(formatSchedule(updatedRows[0]));
}

async function upsertPlanningEntryForSchedule(
  organizationId: string,
  schedule: MarketingScheduleRow,
  body: Record<string, unknown>
) {
  const planningEntryId = schedule.planningEntryId || randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "PlanningEntry" (
      "id", "organizationId", "source", "board", "groupName", "userId", "employeeName", "date", "startTime",
      "endTime", "durationMinutes", "title", "description", "customer", "projectId", "projectLabel",
      "approvalStatus", "marketingContentItemId", "marketingContentScheduleId", "updatedAt"
    )
    VALUES (
      ${planningEntryId}, ${organizationId}, ${"marketingContent"}, ${"OK solutions"}, ${"Marketing"},
      ${schedule.userId || null}, ${schedule.employeeName || null}, ${schedule.date}, ${schedule.startTime},
      ${schedule.endTime}, ${schedule.durationMinutes}, ${schedule.title},
      ${[schedule.phase, schedule.note].filter(Boolean).join(" | ") || null},
      ${cleanString(body.customerName) || null}, ${schedule.projectId}, ${cleanString(body.projectLabel) || null},
      ${"confirmed"}, ${schedule.contentItemId}, ${schedule.id}, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "source" = EXCLUDED."source",
      "board" = EXCLUDED."board",
      "groupName" = EXCLUDED."groupName",
      "userId" = EXCLUDED."userId",
      "employeeName" = EXCLUDED."employeeName",
      "date" = EXCLUDED."date",
      "startTime" = EXCLUDED."startTime",
      "endTime" = EXCLUDED."endTime",
      "durationMinutes" = EXCLUDED."durationMinutes",
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "customer" = EXCLUDED."customer",
      "projectId" = EXCLUDED."projectId",
      "projectLabel" = EXCLUDED."projectLabel",
      "marketingContentItemId" = EXCLUDED."marketingContentItemId",
      "marketingContentScheduleId" = EXCLUDED."marketingContentScheduleId",
      "deletedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
  `;
  return planningEntryId;
}

async function deleteSchedule(organizationId: string, body: Record<string, unknown>) {
  const id = cleanString(body.id);
  if (!id) return NextResponse.json({ error: "Termin fehlt." }, { status: 400 });
  const rows = await prisma.$queryRaw<MarketingScheduleRow[]>`
    UPDATE "MarketingContentSchedule"
    SET "deletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "organizationId" = ${organizationId}
    RETURNING *
  `;
  const schedule = rows[0];
  if (schedule?.planningEntryId) {
    await prisma.$executeRaw`
      UPDATE "PlanningEntry"
      SET "deletedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${schedule.planningEntryId}
        AND "organizationId" = ${organizationId}
    `;
  }
  return NextResponse.json(schedule ? formatSchedule(schedule) : { ok: true });
}

async function deleteItem(organizationId: string, body: Record<string, unknown>) {
  const id = cleanString(body.id);
  if (!id) return NextResponse.json({ error: "Arbeitsstück fehlt." }, { status: 400 });
  await prisma.$executeRaw`
    UPDATE "MarketingContentSchedule"
    SET "deletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organizationId}
      AND "contentItemId" = ${id}
  `;
  await prisma.$executeRaw`
    UPDATE "PlanningEntry"
    SET "deletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organizationId}
      AND "marketingContentItemId" = ${id}
  `;
  await prisma.$executeRaw`
    DELETE FROM "MarketingContentItem"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${id}
  `;
  return NextResponse.json({ ok: true });
}
