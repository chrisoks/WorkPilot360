import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureDefaultStatusEscalationRules, ensureStatusTrackingTables, seedCurrentStatusTimeline } from "@/lib/status-tracking";

type TimelineRow = {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  fromStatus: string | null;
  toStatus: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  actorUserId: string | null;
  actorName: string;
  note: string;
  createdAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStatusStartedAtFromHistory(
  history: unknown,
  currentStatus: string,
  knownStatuses: string[],
  fallback: Date
) {
  if (!Array.isArray(history) || !currentStatus) return fallback;

  const entries = history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as { at?: unknown; action?: unknown };
      const at = cleanString(item.at);
      const action = cleanString(item.action);
      const parsedAt = at ? new Date(at) : new Date(NaN);
      if (!Number.isFinite(parsedAt.getTime())) return null;
      return { at: parsedAt, action };
    })
    .filter((entry): entry is { at: Date; action: string } => Boolean(entry))
    .sort((left, right) => left.at.getTime() - right.at.getTime());

  if (entries.length === 0) return fallback;

  let statusStart: Date | null = null;
  for (const entry of entries) {
    if (entry.action === currentStatus) {
      statusStart ??= entry.at;
      continue;
    }

    if (knownStatuses.includes(entry.action)) {
      statusStart = null;
    }
  }

  return statusStart ?? fallback;
}

function formatEntry(row: TimelineRow) {
  const now = Date.now();
  const startedAt = row.startedAt.getTime();
  const endedAt = row.endedAt?.getTime() ?? now;
  const currentDurationMinutes =
    row.endedAt && row.durationMinutes !== null
      ? row.durationMinutes
      : Number.isFinite(startedAt)
        ? Math.max(0, Math.floor((endedAt - startedAt) / 60_000))
        : 0;

  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    fromStatus: row.fromStatus ?? "",
    toStatus: row.toStatus,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? "",
    durationMinutes: currentDurationMinutes,
    durationHours: Math.floor(currentDurationMinutes / 60),
    actorUserId: row.actorUserId ?? "",
    actorName: row.actorName,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

async function seedCurrentStatuses(organizationId: string) {
  const projects = await prisma.$queryRaw<Array<{ id: string; projectNumber: string; title: string; status: string; createdAt: Date }>>`
    SELECT id, "projectNumber", title, status, "createdAt"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
  `;
  for (const project of projects) {
    await seedCurrentStatusTimeline({
      organizationId,
      entityType: "project",
      entityId: project.id,
      entityLabel: `${project.projectNumber || project.id} | ${project.title}`,
      status: project.status,
      startedAt: project.createdAt,
    });
  }

  await prisma.$executeRaw`
    UPDATE "StatusTimelineEntry"
    SET
      "startedAt" = "createdAt",
      "durationMinutes" = NULL,
      "note" = COALESCE(NULLIF("note", ''), 'Projektstatus geaendert.')
    WHERE "organizationId" = ${organizationId}
      AND "entityType" = 'project'
      AND "endedAt" IS NULL
      AND "fromStatus" IS NOT NULL
      AND "createdAt" IS NOT NULL
      AND "startedAt" < "createdAt"
  `;

  const tasks = await prisma.$queryRaw<Array<{ id: string; title: string; status: string; createdAt: Date }>>`
    SELECT id, title, status::text AS status, "createdAt"
    FROM "Task"
    WHERE "organizationId" = ${organizationId}
  `;
  for (const task of tasks) {
    await seedCurrentStatusTimeline({
      organizationId,
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      status: task.status,
      startedAt: task.createdAt,
    });
  }

  const potentials = await prisma.$queryRaw<Array<{ id: string; description: string; status: string; history: unknown; createdAt: Date }>>`
    SELECT id, description, status, history, "createdAt"
    FROM "ProjectPotential"
    WHERE "organizationId" = ${organizationId}
  `;
  for (const potential of potentials) {
    const statusStartedAt = getStatusStartedAtFromHistory(
      potential.history,
      potential.status,
      ["open", "follow_up", "offered", "lost"],
      potential.createdAt
    );
    await seedCurrentStatusTimeline({
      organizationId,
      entityType: "potential",
      entityId: potential.id,
      entityLabel: potential.description,
      status: potential.status,
      startedAt: statusStartedAt,
      correctOpenStartedAt: true,
    });
  }

  const salesTargets = await prisma.$queryRaw<Array<{ id: string; title: string; status: string; history: unknown; createdAt: Date }>>`
    SELECT id, title, status, history, "createdAt"
    FROM "SalesTarget"
    WHERE "organizationId" = ${organizationId}
  `;
  for (const target of salesTargets) {
    const statusStartedAt = getStatusStartedAtFromHistory(
      target.history,
      target.status,
      ["open", "in_contact", "done", "discarded"],
      target.createdAt
    );
    await seedCurrentStatusTimeline({
      organizationId,
      entityType: "sales_target",
      entityId: target.id,
      entityLabel: target.title,
      status: target.status,
      startedAt: statusStartedAt,
      correctOpenStartedAt: true,
    });
  }
}

export async function GET(req: Request) {
  const { organization } = await getDemoContext();
  await ensureDefaultStatusEscalationRules(organization.id);
  await seedCurrentStatuses(organization.id);

  const { searchParams } = new URL(req.url);
  const entityType = cleanString(searchParams.get("entityType"));
  const entityId = cleanString(searchParams.get("entityId"));

  const rows = await prisma.$queryRaw<TimelineRow[]>`
    SELECT *
    FROM "StatusTimelineEntry"
    WHERE "organizationId" = ${organization.id}
      AND (${entityType || null}::text IS NULL OR "entityType" = ${entityType})
      AND (${entityId || null}::text IS NULL OR "entityId" = ${entityId})
    ORDER BY "startedAt" DESC
  `;

  return NextResponse.json(rows.map(formatEntry));
}

export async function POST() {
  const { organization } = await getDemoContext();
  await ensureStatusTrackingTables();
  await seedCurrentStatuses(organization.id);
  return NextResponse.json({ success: true });
}
