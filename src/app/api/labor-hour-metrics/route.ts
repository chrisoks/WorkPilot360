import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

type MetricSourceRow = {
  projectId: string | null;
  projectLabel: string | null;
  userId: string | null;
  employeeName: string | null;
  hours: number | bigint | null;
  count?: number | bigint | null;
};

type LaborMetricRow = {
  projectId: string;
  projectLabel: string;
  userId: string;
  employeeName: string;
  productiveStampedHours: number;
  offerTargetHours: number;
  offerScheduledHours: number;
  manualScheduledHours: number;
  soldHours: number;
  sourceCounts: {
    productiveStamps: number;
    offerLaborItems: number;
    offerPlanningEntries: number;
    manualPlanningEntries: number;
    invoiceLaborItems: number;
  };
};

function cleanNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass(${`"${tableName}"`}) IS NOT NULL AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function ensureReportingColumns() {
  if (await tableExists("ProjectTimeEntry")) {
    await prisma.$executeRaw`
      ALTER TABLE "ProjectTimeEntry"
      ADD COLUMN IF NOT EXISTS "userId" TEXT
    `;
  }
}

function getMetricKey(row: MetricSourceRow) {
  const projectId = String(row.projectId ?? "");
  const userKey = String(row.userId || row.employeeName || "");
  return `${projectId}::${userKey}`;
}

function ensureMetric(metrics: Map<string, LaborMetricRow>, row: MetricSourceRow) {
  const key = getMetricKey(row);
  const existing = metrics.get(key);
  if (existing) {
    if (!existing.projectLabel && row.projectLabel) existing.projectLabel = row.projectLabel;
    if (!existing.userId && row.userId) existing.userId = row.userId;
    if (!existing.employeeName && row.employeeName) existing.employeeName = row.employeeName;
    return existing;
  }

  const metric: LaborMetricRow = {
    projectId: row.projectId ?? "",
    projectLabel: row.projectLabel ?? "",
    userId: row.userId ?? "",
    employeeName: row.employeeName ?? "",
    productiveStampedHours: 0,
    offerTargetHours: 0,
    offerScheduledHours: 0,
    manualScheduledHours: 0,
    soldHours: 0,
    sourceCounts: {
      productiveStamps: 0,
      offerLaborItems: 0,
      offerPlanningEntries: 0,
      manualPlanningEntries: 0,
      invoiceLaborItems: 0,
    },
  };
  metrics.set(key, metric);
  return metric;
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureReportingColumns();

  const metrics = new Map<string, LaborMetricRow>();

  if (await tableExists("ProjectTimeEntry")) {
    const rows = await prisma.$queryRaw<MetricSourceRow[]>`
      SELECT
        "projectId",
        MAX("projectLabel") AS "projectLabel",
        COALESCE("userId", '') AS "userId",
        COALESCE("employee", '') AS "employeeName",
        SUM("durationMs")::double precision / 3600000 AS "hours",
        COUNT(*) AS "count"
      FROM "ProjectTimeEntry"
      WHERE "organizationId" = ${organization.id}
        AND "mode" = 'project'
      GROUP BY "projectId", COALESCE("userId", ''), COALESCE("employee", '')
    `;
    for (const row of rows) {
      const metric = ensureMetric(metrics, row);
      metric.productiveStampedHours += cleanNumber(row.hours);
      metric.sourceCounts.productiveStamps += cleanNumber(row.count);
    }
  }

  if ((await tableExists("Offer")) && (await tableExists("OfferLineLabor"))) {
    const rows = await prisma.$queryRaw<MetricSourceRow[]>`
      SELECT
        o."projectId",
        MAX(CONCAT(o."projectNumber", ' | ', o."projectTitle")) AS "projectLabel",
        COALESCE(l."userId", '') AS "userId",
        COALESCE(l."employeeName", '') AS "employeeName",
        SUM(l."plannedHours") AS "hours",
        COUNT(*) AS "count"
      FROM "OfferLineLabor" l
      INNER JOIN "Offer" o ON o."id" = l."offerId"
      WHERE l."organizationId" = ${organization.id}
        AND o."organizationId" = ${organization.id}
      GROUP BY o."projectId", COALESCE(l."userId", ''), COALESCE(l."employeeName", '')
    `;
    for (const row of rows) {
      const metric = ensureMetric(metrics, row);
      metric.offerTargetHours += cleanNumber(row.hours);
      metric.sourceCounts.offerLaborItems += cleanNumber(row.count);
    }
  }

  if (await tableExists("PlanningEntry")) {
    const rows = await prisma.$queryRaw<Array<MetricSourceRow & { source: string | null }>>`
      SELECT
        "projectId",
        MAX("projectLabel") AS "projectLabel",
        COALESCE("userId", '') AS "userId",
        COALESCE("employeeName", '') AS "employeeName",
        "source",
        SUM("durationMinutes")::double precision / 60 AS "hours",
        COUNT(*) AS "count"
      FROM "PlanningEntry"
      WHERE "organizationId" = ${organization.id}
        AND "projectId" IS NOT NULL
        AND "deletedAt" IS NULL
      GROUP BY "projectId", COALESCE("userId", ''), COALESCE("employeeName", ''), "source"
    `;
    for (const row of rows) {
      const metric = ensureMetric(metrics, row);
      if (row.source === "offer") {
        metric.offerScheduledHours += cleanNumber(row.hours);
        metric.sourceCounts.offerPlanningEntries += cleanNumber(row.count);
      } else {
        metric.manualScheduledHours += cleanNumber(row.hours);
        metric.sourceCounts.manualPlanningEntries += cleanNumber(row.count);
      }
    }
  }

  if ((await tableExists("Invoice")) && (await tableExists("InvoiceLineLabor"))) {
    const rows = await prisma.$queryRaw<MetricSourceRow[]>`
      SELECT
        i."projectId",
        MAX(CONCAT(i."projectNumber", ' | ', i."projectTitle")) AS "projectLabel",
        COALESCE(l."userId", '') AS "userId",
        COALESCE(l."employeeName", '') AS "employeeName",
        SUM(l."plannedHours") AS "hours",
        COUNT(*) AS "count"
      FROM "InvoiceLineLabor" l
      INNER JOIN "Invoice" i ON i."id" = l."invoiceId"
      WHERE l."organizationId" = ${organization.id}
        AND i."organizationId" = ${organization.id}
        AND i."status" NOT IN ('Storniert', 'Stornorechnung', 'Gelöscht')
      GROUP BY i."projectId", COALESCE(l."userId", ''), COALESCE(l."employeeName", '')
    `;
    for (const row of rows) {
      const metric = ensureMetric(metrics, row);
      metric.soldHours += cleanNumber(row.hours);
      metric.sourceCounts.invoiceLaborItems += cleanNumber(row.count);
    }
  }

  const rows = Array.from(metrics.values())
    .map((row) => ({
      ...row,
      productiveStampedHours: Number(row.productiveStampedHours.toFixed(2)),
      offerTargetHours: Number(row.offerTargetHours.toFixed(2)),
      offerScheduledHours: Number(row.offerScheduledHours.toFixed(2)),
      manualScheduledHours: Number(row.manualScheduledHours.toFixed(2)),
      soldHours: Number(row.soldHours.toFixed(2)),
    }))
    .sort((first, second) =>
      `${first.projectLabel}${first.employeeName}`.localeCompare(
        `${second.projectLabel}${second.employeeName}`,
        "de"
      )
    );

  const totals = rows.reduce(
    (sum, row) => ({
      productiveStampedHours: sum.productiveStampedHours + row.productiveStampedHours,
      offerTargetHours: sum.offerTargetHours + row.offerTargetHours,
      offerScheduledHours: sum.offerScheduledHours + row.offerScheduledHours,
      manualScheduledHours: sum.manualScheduledHours + row.manualScheduledHours,
      soldHours: sum.soldHours + row.soldHours,
    }),
    {
      productiveStampedHours: 0,
      offerTargetHours: 0,
      offerScheduledHours: 0,
      manualScheduledHours: 0,
      soldHours: 0,
    }
  );

  return NextResponse.json({
    rows,
    totals: {
      productiveStampedHours: Number(totals.productiveStampedHours.toFixed(2)),
      offerTargetHours: Number(totals.offerTargetHours.toFixed(2)),
      offerScheduledHours: Number(totals.offerScheduledHours.toFixed(2)),
      manualScheduledHours: Number(totals.manualScheduledHours.toFixed(2)),
      soldHours: Number(totals.soldHours.toFixed(2)),
    },
  });
}
