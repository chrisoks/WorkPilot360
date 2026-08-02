import { randomUUID } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  canApproveProjectOvertime,
  canManageProjectTimeEntries,
  canViewInternalCostData,
} from "@/lib/permissions";

export const WITHOUT_OFFER_ASSIGNMENT = "__without_offer_assignment__";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export type ProjectTimeEntryActor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
};

export type ProjectTimeEntryUser = ProjectTimeEntryActor;

export type ProjectTimeEntryWriteInput = {
  id?: string;
  mode?: "project" | "unproductive";
  projectId?: string;
  projectLabel?: string;
  unproductiveLabel?: string;
  trade?: string;
  planningEntryId?: string;
  planningBillingGroupId?: string;
  offerId?: string;
  offerLabel?: string;
  billingCatalogItemId?: string;
  billingCatalogItemLabel?: string;
  userId?: string;
  entrySource?: "stamped" | "manual";
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  pauseMs?: number;
  comment?: string;
  marketingContentItemId?: string;
  marketingContentType?: string;
  completionStatus?: "" | "finished" | "interrupted";
  overtimeApprovalStatus?: "not_required" | "pending" | "approved";
  overtimeApprovedAt?: string;
  editHistory?: unknown[];
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

export class ProjectTimeEntryServiceError extends Error {
  constructor(
    public readonly code:
      | "invalid_input"
      | "forbidden"
      | "not_found"
      | "conflict",
    message: string,
    public readonly status: 400 | 403 | 404 | 409
  ) {
    super(message);
    this.name = "ProjectTimeEntryServiceError";
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(
  user: Pick<ProjectTimeEntryUser, "firstName" | "lastName" | "email">
) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeUnit(value: string | null) {
  return normalize(value ?? "").replace(/\./g, "");
}

function normalizeDateKeyValue(value: string) {
  const trimmedValue = value.trim();
  const germanMatch = trimmedValue.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/
  );
  const normalized = germanMatch
    ? `${Number(germanMatch[3]) < 100 ? 2000 + Number(germanMatch[3]) : Number(germanMatch[3])}-${germanMatch[2].padStart(2, "0")}-${germanMatch[1].padStart(2, "0")}`
    : trimmedValue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const date = new Date(`${normalized}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === normalized
    ? normalized
    : "";
}

function parseTimeMinutes(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isRecurringProjectKind(value: string | null) {
  return normalize(value ?? "").includes("dauerlaufer");
}

function isActiveFinalOfferStatus(value: string) {
  const status = normalize(value);
  return (
    status !== "entwurf" &&
    !status.includes("verloren") &&
    !status.includes("geloscht")
  );
}

export async function ensureProjectTimeEntryTable(
  db: DatabaseClient = prisma
) {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ProjectTimeEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'project',
      "projectId" TEXT NOT NULL,
      "projectLabel" TEXT,
      "trade" TEXT,
      "planningEntryId" TEXT,
      "planningBillingGroupId" TEXT,
      "offerId" TEXT,
      "offerLabel" TEXT,
      "billingCatalogItemId" TEXT,
      "billingCatalogItemLabel" TEXT,
      "userId" TEXT,
      "employee" TEXT,
      "entrySource" TEXT NOT NULL DEFAULT 'stamped',
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "durationMs" BIGINT NOT NULL DEFAULT 0,
      "pauseMs" BIGINT NOT NULL DEFAULT 0,
      "laborCostRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "costSnapshotAt" TIMESTAMP(3),
      "comment" TEXT,
      "invoiceId" TEXT,
      "invoiceNumber" TEXT,
      "invoicedAt" TIMESTAMP(3),
      "completionStatus" TEXT,
      "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'not_required',
      "overtimeApprovedByUserId" TEXT,
      "overtimeApprovedByName" TEXT,
      "overtimeApprovedAt" TIMESTAMP(3),
      "editHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "deletedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await db.$executeRaw`
    ALTER TABLE "ProjectTimeEntry"
    ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'project',
    ADD COLUMN IF NOT EXISTS "userId" TEXT,
    ADD COLUMN IF NOT EXISTS "trade" TEXT,
    ADD COLUMN IF NOT EXISTS "planningEntryId" TEXT,
    ADD COLUMN IF NOT EXISTS "planningBillingGroupId" TEXT,
    ADD COLUMN IF NOT EXISTS "offerId" TEXT,
    ADD COLUMN IF NOT EXISTS "offerLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "billingCatalogItemLabel" TEXT,
    ADD COLUMN IF NOT EXISTS "entrySource" TEXT NOT NULL DEFAULT 'stamped',
    ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "laborCostRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "laborCostSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "costSnapshotAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "marketingContentItemId" TEXT,
    ADD COLUMN IF NOT EXISTS "marketingContentType" TEXT,
    ADD COLUMN IF NOT EXISTS "completionStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedByName" TEXT,
    ADD COLUMN IF NOT EXISTS "overtimeApprovedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "editHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)
  `;
}

export async function getEmployeeHourlyCostRateSnapshot(
  db: DatabaseClient,
  organizationId: string,
  userId: string
) {
  const rows = await db.$queryRaw<
    Array<{
      monthlySalary: number;
      fullCostFactor: number;
      annualHours: number;
      vacationDays: number;
      trainingDays: number;
      sickDays: number;
      hoursPerDay: number;
    }>
  >`
    SELECT "monthlySalary", "fullCostFactor", "annualHours", "vacationDays",
           "trainingDays", "sickDays", "hoursPerDay"
    FROM "EmployeeCostCalculation"
    WHERE "organizationId" = ${organizationId} AND "userId" = ${userId}
    LIMIT 1
  `;
  const cost = rows[0];
  if (!cost) return 0;
  const deductionHours =
    (Number(cost.vacationDays || 0) +
      Number(cost.trainingDays || 0) +
      Number(cost.sickDays || 0)) *
    Number(cost.hoursPerDay || 0);
  const sellableAnnualHours = Math.max(
    0,
    Number(cost.annualHours || 0) - deductionHours
  );
  return sellableAnnualHours > 0
    ? roundMoney(
        (Number(cost.monthlySalary || 0) *
          12 *
          Number(cost.fullCostFactor || 0)) /
          sellableAnnualHours
      )
    : 0;
}

export function formatProjectTimeEntry(
  entry: ProjectTimeEntryRow,
  options: { includeInternalCosts?: boolean } = {}
) {
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
    laborCostRateSnapshot: includeInternalCosts
      ? Number(entry.laborCostRateSnapshot ?? 0)
      : 0,
    laborCostSnapshot: includeInternalCosts
      ? Number(entry.laborCostSnapshot ?? 0)
      : 0,
    costSnapshotAt: includeInternalCosts
      ? entry.costSnapshotAt?.toISOString() ?? ""
      : "",
    comment: entry.comment ?? "",
    invoiceId: entry.invoiceId ?? "",
    invoiceNumber: entry.invoiceNumber ?? "",
    invoicedAt: entry.invoicedAt?.toISOString() ?? "",
    marketingContentItemId: entry.marketingContentItemId ?? "",
    marketingContentType: entry.marketingContentType ?? "",
    completionStatus:
      entry.completionStatus === "finished" ||
      entry.completionStatus === "interrupted"
        ? entry.completionStatus
        : "",
    overtimeApprovalStatus:
      entry.overtimeApprovalStatus === "pending" ||
      entry.overtimeApprovalStatus === "approved"
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

export async function saveProjectTimeEntry(input: {
  db?: DatabaseClient;
  organizationId: string;
  actor: ProjectTimeEntryActor;
  users: ProjectTimeEntryUser[];
  payload: ProjectTimeEntryWriteInput;
  createOnly?: boolean;
  createLogbookEntry?: boolean;
  allowManagedUpdate?: boolean;
}) {
  const db = input.db ?? prisma;
  const payload = input.payload;
  const mode = payload.mode === "unproductive" ? "unproductive" : "project";
  const entrySource = payload.entrySource === "manual" ? "manual" : "stamped";
  const id = cleanString(payload.id) || randomUUID();
  if (id.length > 120) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Die technische ID des Zeiteintrags ist ungültig.",
      400
    );
  }
  const targetUser = input.users.find(
    (user) => user.id === cleanString(payload.userId) && user.isActive
  );
  if (!targetUser) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Bitte einen aktiven Mitarbeiter auswählen.",
      400
    );
  }

  const existingRows = await db.$queryRaw<ProjectTimeEntryRow[]>`
    SELECT * FROM "ProjectTimeEntry"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  const existingEntry = existingRows[0] ?? null;
  if (
    existingEntry &&
    existingEntry.organizationId !== input.organizationId
  ) {
    throw new ProjectTimeEntryServiceError(
      "conflict",
      "Diese technische Ausführungs-ID ist bereits anderweitig gebunden.",
      409
    );
  }
  if (existingEntry && !input.createOnly && !input.allowManagedUpdate) {
    throw new ProjectTimeEntryServiceError(
      "conflict",
      "Bestehende Zeiteinträge dürfen nur über den kontrollierten Korrekturweg geändert werden.",
      409
    );
  }
  const actorCanManageProjectTime = canManageProjectTimeEntries(input.actor);
  if (
    !actorCanManageProjectTime &&
    !(
      targetUser.id === input.actor.id &&
      entrySource === "manual" &&
      (!existingEntry || existingEntry.entrySource === "manual")
    )
  ) {
    throw new ProjectTimeEntryServiceError(
      "forbidden",
      "Du darfst nur eigene manuelle Zeiteinträge anlegen oder bearbeiten.",
      403
    );
  }

  const date = normalizeDateKeyValue(cleanString(payload.date));
  const startTime = cleanString(payload.startTime);
  const endTime = cleanString(payload.endTime);
  const startMinutes = parseTimeMinutes(startTime);
  const endMinutes = parseTimeMinutes(endTime);
  const pauseMs = Math.round(Number(payload.pauseMs ?? 0));
  if (
    !date ||
    startMinutes === null ||
    endMinutes === null ||
    !Number.isSafeInteger(pauseMs) ||
    pauseMs < 0
  ) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Datum, Beginn, Ende oder Pause sind ungültig.",
      400
    );
  }
  if (pauseMs > 86_400_000) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Die Pause darf 24 Stunden nicht überschreiten.",
      400
    );
  }
  const durationMs = (endMinutes - startMinutes) * 60_000 - pauseMs;
  if (durationMs <= 0) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Die Arbeitszeit nach Abzug der Pause muss größer als 0 sein.",
      400
    );
  }
  if (
    Number.isFinite(Number(payload.durationMs)) &&
    Number(payload.durationMs) > 0 &&
    Math.round(Number(payload.durationMs)) !== durationMs
  ) {
    throw new ProjectTimeEntryServiceError(
      "conflict",
      "Die angegebene Laufzeit passt nicht zu Beginn, Ende und Pause.",
      409
    );
  }

  const projectId =
    mode === "unproductive" ? "__unproductive__" : cleanString(payload.projectId);
  let projectLabel = "";
  let project:
    | {
        id: string;
        projectNumber: string;
        title: string;
        trade: string | null;
        projectKind: string | null;
        recurringBillingMode: string | null;
      }
    | null = null;
  if (mode === "project") {
    if (!projectId) {
      throw new ProjectTimeEntryServiceError(
        "invalid_input",
        "Bitte ein Projekt auswählen.",
        400
      );
    }
    project = await db.workPilotProject.findFirst({
      where: { id: projectId, organizationId: input.organizationId },
      select: {
        id: true,
        projectNumber: true,
        title: true,
        trade: true,
        projectKind: true,
        recurringBillingMode: true,
      },
    });
    if (!project) {
      throw new ProjectTimeEntryServiceError(
        "not_found",
        "Das ausgewählte Projekt wurde in dieser Organisation nicht gefunden.",
        404
      );
    }
    projectLabel = project.title;
  } else {
    projectLabel =
      cleanString(payload.unproductiveLabel) ||
      cleanString(payload.projectLabel);
    if (!projectLabel) {
      throw new ProjectTimeEntryServiceError(
        "invalid_input",
        "Bitte eine Bezeichnung für die unproduktive Zeit angeben.",
        400
      );
    }
  }
  if (projectLabel.length > 240) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Die Tätigkeits- oder Projektbezeichnung ist zu lang.",
      400
    );
  }

  const hourlyRecurring =
    Boolean(project) &&
    project?.recurringBillingMode === "hourly" &&
    isRecurringProjectKind(project.projectKind);
  const oneTime = Boolean(project) && !isRecurringProjectKind(project?.projectKind ?? null);
  const trade = mode === "project" ? cleanString(payload.trade) : "";
  if (trade.length > 180) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Das Gewerk ist zu lang.",
      400
    );
  }
  let billingCatalogItemId =
    mode === "project" ? cleanString(payload.billingCatalogItemId) : "";
  let billingCatalogItemLabel = "";
  if (hourlyRecurring) {
    if (!trade) {
      throw new ProjectTimeEntryServiceError(
        "invalid_input",
        "Bitte für diese Stundenabrechnung ein Gewerk auswählen.",
        400
      );
    }
    if (!billingCatalogItemId) {
      throw new ProjectTimeEntryServiceError(
        "invalid_input",
        "Bitte für diese Stundenabrechnung eine Abrechnungsleistung auswählen.",
        400
      );
    }
    const item = await db.catalogItem.findFirst({
      where: {
        id: billingCatalogItemId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        number: true,
        name: true,
        type: true,
        unit: true,
        trade: true,
        salesPrice: true,
        isActive: true,
        isLaborPosition: true,
      },
    });
    if (
      !item ||
      !item.isActive ||
      item.type !== "service" ||
      !item.isLaborPosition ||
      normalizeUnit(item.unit) !== "std" ||
      Number(item.salesPrice || 0) <= 0 ||
      normalize(item.trade ?? "") !== normalize(trade)
    ) {
      throw new ProjectTimeEntryServiceError(
        "invalid_input",
        "Die ausgewählte Abrechnungsleistung ist keine aktive, zum Gewerk passende Stundenleistung.",
        400
      );
    }
    billingCatalogItemLabel = [item.number, item.name]
      .filter(Boolean)
      .join(" | ");
  } else {
    billingCatalogItemId = "";
  }

  const requestedOfferId =
    mode === "project" ? cleanString(payload.offerId) : "";
  const withoutOffer =
    requestedOfferId === WITHOUT_OFFER_ASSIGNMENT ||
    (!requestedOfferId &&
      normalize(cleanString(payload.offerLabel)) ===
        normalize("Ohne Angebotszuweisung"));
  let offerId = withoutOffer ? "" : requestedOfferId;
  let offerLabel = withoutOffer ? "Ohne Angebotszuweisung" : "";
  const comment = cleanString(payload.comment);
  if (comment.length > 2000) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Der Kommentar darf höchstens 2.000 Zeichen enthalten.",
      400
    );
  }
  const requiresManualOfferContext = oneTime && entrySource === "manual";
  if (requiresManualOfferContext && !offerId && !withoutOffer) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Bitte eine Auftragsgrundlage auswählen.",
      400
    );
  }
  if (requiresManualOfferContext && withoutOffer && !comment) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Bitte im Kommentar begründen, warum keine Angebotszuweisung möglich ist.",
      400
    );
  }
  if (offerId) {
    const offer = await db.offer.findFirst({
      where: {
        id: offerId,
        organizationId: input.organizationId,
        projectId,
      },
      select: { id: true, offerNumber: true, offerType: true, status: true },
    });
    if (!offer || !isActiveFinalOfferStatus(offer.status)) {
      throw new ProjectTimeEntryServiceError(
        "invalid_input",
        "Die ausgewählte Auftragsgrundlage ist kein aktives finales Angebot dieses Projekts.",
        400
      );
    }
    offerId = offer.id;
    const offerKind = offer.offerType === "addendum" ? "Nachtrag" : "Angebot";
    offerLabel = `${offer.offerNumber} · ${offerKind} · ${offer.status}`;
  }

  const completionStatus =
    mode === "project" &&
    (payload.completionStatus === "finished" ||
      payload.completionStatus === "interrupted")
      ? payload.completionStatus
      : "";
  if (completionStatus === "interrupted" && !comment) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Bitte den Grund für die Unterbrechung im Kommentar dokumentieren.",
      400
    );
  }
  const actorCanApproveOvertime = canApproveProjectOvertime(input.actor);
  const requestedOvertimeApprovalStatus =
    payload.overtimeApprovalStatus === "pending" ||
    payload.overtimeApprovalStatus === "approved"
      ? payload.overtimeApprovalStatus
      : "not_required";
  const overtimeApprovalStatus = actorCanApproveOvertime
    ? requestedOvertimeApprovalStatus
    : existingEntry?.overtimeApprovalStatus ?? "not_required";
  const actorName = getUserName(input.actor);
  const overtimeApprovedByUserId =
    actorCanApproveOvertime && overtimeApprovalStatus === "approved"
      ? input.actor.id
      : existingEntry?.overtimeApprovedByUserId ?? "";
  const overtimeApprovedByName =
    actorCanApproveOvertime && overtimeApprovalStatus === "approved"
      ? actorName
      : existingEntry?.overtimeApprovedByName ?? "";
  const overtimeApprovedAt =
    actorCanApproveOvertime && overtimeApprovalStatus === "approved"
      ? cleanString(payload.overtimeApprovedAt) || new Date().toISOString()
      : existingEntry?.overtimeApprovedAt?.toISOString() ?? "";
  if (
    overtimeApprovedAt &&
    !Number.isFinite(new Date(overtimeApprovedAt).getTime())
  ) {
    throw new ProjectTimeEntryServiceError(
      "invalid_input",
      "Der Freigabezeitpunkt der Überstunden ist ungültig.",
      400
    );
  }
  const editHistory = Array.isArray(payload.editHistory)
    ? payload.editHistory.map((entry, index) =>
        index === 0 && entry && typeof entry === "object"
          ? {
              ...(entry as Record<string, unknown>),
              actorUserId: input.actor.id,
              actorName,
            }
          : entry
      )
    : [];
  const laborCostRateSnapshot = existingEntry
    ? Number(existingEntry.laborCostRateSnapshot ?? 0)
    : await getEmployeeHourlyCostRateSnapshot(
        db,
        input.organizationId,
        targetUser.id
      );
  const laborCostSnapshot = roundMoney(
    (durationMs / 3_600_000) * laborCostRateSnapshot
  );

  if (input.createOnly && existingEntry) {
    const same =
      existingEntry.mode === mode &&
      existingEntry.projectId === projectId &&
      existingEntry.userId === targetUser.id &&
      existingEntry.date === date &&
      existingEntry.startTime === startTime &&
      existingEntry.endTime === endTime &&
      Number(existingEntry.durationMs) === durationMs &&
      Number(existingEntry.pauseMs) === pauseMs &&
      (existingEntry.comment ?? "") === comment &&
      existingEntry.entrySource === entrySource &&
      (existingEntry.trade ?? "") ===
        (hourlyRecurring ? trade : project?.trade ?? "") &&
      (existingEntry.offerId ?? "") === offerId &&
      (existingEntry.billingCatalogItemId ?? "") === billingCatalogItemId &&
      (existingEntry.completionStatus ?? "") === completionStatus &&
      (existingEntry.overtimeApprovalStatus ?? "not_required") ===
        overtimeApprovalStatus;
    if (!same) {
      throw new ProjectTimeEntryServiceError(
        "conflict",
        "Unter dieser Ausführungs-ID existiert bereits ein abweichender Zeiteintrag.",
        409
      );
    }
    return formatProjectTimeEntry(existingEntry, {
      includeInternalCosts: canViewInternalCostData(input.actor),
    });
  }

  const rows = await db.$queryRaw<ProjectTimeEntryRow[]>`
    INSERT INTO "ProjectTimeEntry" (
      "id", "organizationId", "mode", "projectId", "projectLabel", "trade",
      "planningEntryId", "planningBillingGroupId", "offerId", "offerLabel",
      "billingCatalogItemId", "billingCatalogItemLabel", "userId", "employee",
      "entrySource", "date", "startTime", "endTime", "durationMs", "pauseMs",
      "laborCostRateSnapshot", "laborCostSnapshot", "costSnapshotAt", "comment",
      "marketingContentItemId", "marketingContentType", "completionStatus",
      "overtimeApprovalStatus", "overtimeApprovedByUserId",
      "overtimeApprovedByName", "overtimeApprovedAt", "editHistory"
    ) VALUES (
      ${id}, ${input.organizationId}, ${mode}, ${projectId}, ${projectLabel},
      ${mode === "project" ? (hourlyRecurring ? trade : project?.trade ?? "") || null : null},
      ${cleanString(payload.planningEntryId) || null},
      ${cleanString(payload.planningBillingGroupId) || null},
      ${offerId || null}, ${offerLabel || null},
      ${billingCatalogItemId || null}, ${billingCatalogItemLabel || null},
      ${targetUser.id}, ${getUserName(targetUser)}, ${entrySource}, ${date},
      ${startTime}, ${endTime}, ${durationMs}, ${pauseMs},
      ${laborCostRateSnapshot}, ${laborCostSnapshot}, CURRENT_TIMESTAMP,
      ${comment || null}, ${cleanString(payload.marketingContentItemId) || null},
      ${cleanString(payload.marketingContentType) || null},
      ${completionStatus || null}, ${overtimeApprovalStatus},
      ${overtimeApprovedByUserId || null}, ${overtimeApprovedByName || null},
      ${overtimeApprovedAt ? new Date(overtimeApprovedAt) : null},
      CAST(${JSON.stringify(editHistory)} AS jsonb)
    )
    ON CONFLICT ("id") DO UPDATE SET
      "mode" = EXCLUDED."mode",
      "projectLabel" = EXCLUDED."projectLabel",
      "trade" = EXCLUDED."trade",
      "planningEntryId" = EXCLUDED."planningEntryId",
      "planningBillingGroupId" = EXCLUDED."planningBillingGroupId",
      "offerId" = EXCLUDED."offerId",
      "offerLabel" = EXCLUDED."offerLabel",
      "billingCatalogItemId" = EXCLUDED."billingCatalogItemId",
      "billingCatalogItemLabel" = EXCLUDED."billingCatalogItemLabel",
      "userId" = EXCLUDED."userId",
      "employee" = EXCLUDED."employee",
      "entrySource" = EXCLUDED."entrySource",
      "date" = EXCLUDED."date",
      "startTime" = EXCLUDED."startTime",
      "endTime" = EXCLUDED."endTime",
      "durationMs" = EXCLUDED."durationMs",
      "pauseMs" = EXCLUDED."pauseMs",
      "laborCostRateSnapshot" = EXCLUDED."laborCostRateSnapshot",
      "laborCostSnapshot" = EXCLUDED."laborCostSnapshot",
      "costSnapshotAt" = EXCLUDED."costSnapshotAt",
      "comment" = EXCLUDED."comment",
      "marketingContentItemId" = EXCLUDED."marketingContentItemId",
      "marketingContentType" = EXCLUDED."marketingContentType",
      "completionStatus" = EXCLUDED."completionStatus",
      "overtimeApprovalStatus" = EXCLUDED."overtimeApprovalStatus",
      "overtimeApprovedByUserId" = EXCLUDED."overtimeApprovedByUserId",
      "overtimeApprovedByName" = EXCLUDED."overtimeApprovedByName",
      "overtimeApprovedAt" = EXCLUDED."overtimeApprovedAt",
      "editHistory" = EXCLUDED."editHistory"
    WHERE "ProjectTimeEntry"."organizationId" = EXCLUDED."organizationId"
    RETURNING *
  `;
  const saved = rows[0];
  if (!saved) {
    throw new ProjectTimeEntryServiceError(
      "conflict",
      "Der Zeiteintrag konnte nicht bestätigt gespeichert werden.",
      409
    );
  }

  if (input.createLogbookEntry && mode === "project") {
    await db.projectLogbookEntry.upsert({
      where: {
        organizationId_source_callReference_projectId: {
          organizationId: input.organizationId,
          source: "jarvis-time-entry",
          callReference: id,
          projectId,
        },
      },
      create: {
        id: randomUUID(),
        organizationId: input.organizationId,
        projectId,
        title: "Zeit & Lohn",
        body: `Manueller Zeiteintrag: ${getUserName(targetUser)}, ${date} ${startTime}-${endTime}, ${Math.round(durationMs / 60000)} Minuten.`,
        author: actorName,
        authorUserId: input.actor.id,
        source: "jarvis-time-entry",
        callReference: id,
      },
      update: {},
    });
  }

  return formatProjectTimeEntry(saved, {
    includeInternalCosts: canViewInternalCostData(input.actor),
  });
}
