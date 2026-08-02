import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canManageProjectTimeEntries, canViewInternalCostData } from "@/lib/permissions";
import {
  ensureProjectTimeEntryTable,
  ProjectTimeEntryServiceError,
  saveProjectTimeEntry,
} from "@/lib/time/project-time-entry-service";
import {
  evaluateProjectTimeEntryManagement,
  executeProjectTimeEntryManagement,
} from "@/lib/time/project-time-entry-management-service";

type DemoUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
};

type ProjectTimeEntryRow = {
  id: string;
  organizationId: string;
  mode: string | null;
  projectId: string;
  projectLabel: string | null;
  trade: string | null;
  planningEntryId: string | null;
  planningBillingGroupId: string | null;
  offerId: string | null;
  offerLabel: string | null;
  billingCatalogItemId: string | null;
  billingCatalogItemLabel: string | null;
  userId: string | null;
  employee: string | null;
  entrySource: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMs: bigint | number;
  pauseMs: bigint | number;
  laborCostRateSnapshot: number;
  laborCostSnapshot: number;
  costSnapshotAt: Date | null;
  comment: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  marketingContentItemId: string | null;
  marketingContentType: string | null;
  completionStatus: string | null;
  overtimeApprovalStatus: string | null;
  overtimeApprovedByUserId: string | null;
  overtimeApprovedByName: string | null;
  overtimeApprovedAt: Date | null;
  editHistory: unknown;
  deletedAt: Date | null;
  createdAt: Date;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateKeyValue(value: string) {
  const trimmedValue = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) return trimmedValue;

  const germanMatch = trimmedValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})/);
  if (!germanMatch) return trimmedValue;

  const [, dayValue, monthValue, yearValue] = germanMatch;
  const parsedYear = Number(yearValue);
  const year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;

  return `${year}-${monthValue.padStart(2, "0")}-${dayValue.padStart(2, "0")}`;
}

function formatEntry(entry: ProjectTimeEntryRow, options: { includeInternalCosts?: boolean } = {}) {
  const includeInternalCosts = options.includeInternalCosts === true;
  return {
    id: entry.id,
    mode: entry.mode === "unproductive" ? "unproductive" : "project",
    projectId: entry.projectId,
    projectLabel: entry.projectLabel ?? "",
    trade: entry.trade ?? "",
    planningEntryId: entry.planningEntryId ?? "",
    planningBillingGroupId: entry.planningBillingGroupId ?? "",
    offerId: entry.offerId ?? "",
    offerLabel: entry.offerLabel ?? "",
    billingCatalogItemId: entry.billingCatalogItemId ?? "",
    billingCatalogItemLabel: entry.billingCatalogItemLabel ?? "",
    userId: entry.userId ?? "",
    employee: entry.employee ?? "",
    entrySource: entry.entrySource === "manual" ? "manual" : "stamped",
    date: normalizeDateKeyValue(entry.date),
    startTime: entry.startTime,
    endTime: entry.endTime,
    durationMs: Number(entry.durationMs),
    pauseMs: Number(entry.pauseMs),
    laborCostRateSnapshot: includeInternalCosts ? Number(entry.laborCostRateSnapshot ?? 0) : 0,
    laborCostSnapshot: includeInternalCosts ? Number(entry.laborCostSnapshot ?? 0) : 0,
    costSnapshotAt: includeInternalCosts ? entry.costSnapshotAt?.toISOString() ?? "" : "",
    comment: entry.comment ?? "",
    invoiceId: entry.invoiceId ?? "",
    invoiceNumber: entry.invoiceNumber ?? "",
    invoicedAt: entry.invoicedAt?.toISOString() ?? "",
    marketingContentItemId: entry.marketingContentItemId ?? "",
    marketingContentType: entry.marketingContentType ?? "",
    completionStatus:
      entry.completionStatus === "finished" || entry.completionStatus === "interrupted"
        ? entry.completionStatus
        : "",
    overtimeApprovalStatus:
      entry.overtimeApprovalStatus === "pending" || entry.overtimeApprovalStatus === "approved"
        ? entry.overtimeApprovalStatus
        : "not_required",
    overtimeApprovedByUserId: entry.overtimeApprovedByUserId ?? "",
    overtimeApprovedByName: entry.overtimeApprovedByName ?? "",
    overtimeApprovedAt: entry.overtimeApprovedAt?.toISOString() ?? "",
    editHistory: Array.isArray(entry.editHistory) ? entry.editHistory : [],
    deletedAt: entry.deletedAt?.toISOString() ?? "",
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  const requestedActorId = searchParams.get("actorUserId");
  const projectIdFilter = cleanString(searchParams.get("projectId"));
  const includeDeleted = searchParams.get("includeDeleted") === "1";
  const actorResult = await getSessionBoundActor(req, users, requestedActorId);
  if (!actorResult.ok) {
    if (!requestedActorId && actorResult.status === 401) {
      return NextResponse.json([]);
    }

    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const includeInternalCosts = canViewInternalCostData(actor);

  const canManageTimeEntries = canManageProjectTimeEntries(actor);
  const entries = projectIdFilter
    ? canManageTimeEntries
      ? includeDeleted
        ? await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
            ORDER BY "createdAt" DESC
          `
        : await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
              AND "deletedAt" IS NULL
            ORDER BY "createdAt" DESC
          `
      : includeDeleted
        ? await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
              AND "userId" = ${actor.id}
            ORDER BY "createdAt" DESC
          `
        : await prisma.$queryRaw<ProjectTimeEntryRow[]>`
            SELECT *
            FROM "ProjectTimeEntry"
            WHERE "organizationId" = ${organization.id}
              AND "projectId" = ${projectIdFilter}
              AND "userId" = ${actor.id}
              AND "deletedAt" IS NULL
            ORDER BY "createdAt" DESC
          `
    : canManageTimeEntries
      ? await prisma.$queryRaw<ProjectTimeEntryRow[]>`
          SELECT *
          FROM "ProjectTimeEntry"
          WHERE "organizationId" = ${organization.id}
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
        `
      : await prisma.$queryRaw<ProjectTimeEntryRow[]>`
          SELECT *
          FROM "ProjectTimeEntry"
          WHERE "organizationId" = ${organization.id}
            AND "userId" = ${actor.id}
            AND "deletedAt" IS NULL
          ORDER BY "createdAt" DESC
        `;

  return NextResponse.json(entries.map((entry) => formatEntry(entry, { includeInternalCosts })));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  await ensureProjectTimeEntryTable();
  const actorResult = await getSessionBoundActor(req, users, body.actorUserId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  try {
    const saved = await saveProjectTimeEntry({
      organizationId: organization.id,
      actor: actorResult.actor,
      users,
      payload: body,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectTimeEntryServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  await ensureProjectTimeEntryTable();
  const actorResult = await getSessionBoundActor(req, users, body.actorUserId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);

  try {
    const evaluation = await evaluateProjectTimeEntryManagement({
      organizationId: organization.id,
      actor: actorResult.actor,
      entryId: cleanString(body.id),
      action: "update",
      reason: cleanString(body.editReason || body.reason),
    });
    const saved = await executeProjectTimeEntryManagement({
      organizationId: organization.id,
      actor: actorResult.actor,
      users,
      entryId: evaluation.entry.id,
      action: "update",
      reason: evaluation.reason,
      expectedFingerprint: evaluation.fingerprint,
      changes: body,
    });
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof ProjectTimeEntryServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = cleanString(searchParams.get("id"));
  const historyId = cleanString(searchParams.get("historyId"));
  const note = cleanString(searchParams.get("note"));

  if (!id) {
    return NextResponse.json({ error: "Zeiteintrag fehlt." }, { status: 400 });
  }

  const { organization, users } = await getDemoContext();
  await ensureProjectTimeEntryTable();

  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorUserId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;
  const includeInternalCosts = canViewInternalCostData(actor);

  const existingRows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
    SELECT *
    FROM "ProjectTimeEntry"
    WHERE "id" = ${id}
      AND "organizationId" = ${organization.id}
    LIMIT 1
  `;
  const existingEntry = existingRows[0];
  if (!existingEntry) {
    return NextResponse.json({ ok: true });
  }

  if (historyId) {
    if (actor.role !== Role.GESCHAEFTSFUEHRER) {
      return NextResponse.json(
        { error: "Nur Gesch\u00e4ftsf\u00fchrer d\u00fcrfen Historieneintr\u00e4ge l\u00f6schen." },
        { status: 403 }
      );
    }

    const currentHistory = Array.isArray(existingEntry.editHistory) ? existingEntry.editHistory : [];
    const nextHistory = currentHistory.filter((entry) => {
      if (!entry || typeof entry !== "object") return true;
      return String((entry as { id?: unknown }).id ?? "") !== historyId;
    });
    const rows = await prisma.$queryRaw<ProjectTimeEntryRow[]>`
      UPDATE "ProjectTimeEntry"
      SET "editHistory" = CAST(${JSON.stringify(nextHistory)} AS jsonb)
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
      RETURNING *
    `;

    return NextResponse.json(formatEntry(rows[0], { includeInternalCosts }));
  }

  try {
    const evaluation = await evaluateProjectTimeEntryManagement({
      organizationId: organization.id,
      actor,
      entryId: id,
      action: "delete",
      reason: note,
    });
    const deleted = await executeProjectTimeEntryManagement({
      organizationId: organization.id,
      actor,
      users,
      entryId: id,
      action: "delete",
      reason: evaluation.reason,
      expectedFingerprint: evaluation.fingerprint,
    });
    return NextResponse.json(deleted);
  } catch (error) {
    if (error instanceof ProjectTimeEntryServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }
}
