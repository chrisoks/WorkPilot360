import { createHash } from "node:crypto";
import { Prisma, type User } from "@prisma/client";
import {
  ensureOrganizationSettingsTable,
  getDeadlineSettings,
  normalizeDeadlineSettings,
  type DeadlineSettings,
} from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import { evaluateProjectStatusEscalations } from "@/lib/projects/status-escalation";

const SETTINGS_KEY = "deadlines";

export type ProjectStatusAutomationManagementRequest = {
  enabled: boolean;
};

export type ProjectStatusAutomationManagementEvaluation = {
  currentEnabled: boolean;
  targetEnabled: boolean;
  monitoredProjects: number;
  responsibleNotices: number;
  managementNotices: number;
  missingResponsible: number;
  items: Array<{
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customer: string;
    status: string;
    elapsedDays: number;
    stage: "responsible" | "management";
    responsibleName: string;
  }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

type SettingRow = { value: unknown; updatedAt: Date };

export class ProjectStatusAutomationManagementServiceError extends Error {
  constructor(
    public readonly code: "invalid_input" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
  }
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function proposedSettings(current: DeadlineSettings, request: ProjectStatusAutomationManagementRequest) {
  return normalizeDeadlineSettings({
    ...current,
    projectStatusEscalationEnabled: request.enabled,
  });
}

function settingsFingerprint(input: {
  organizationId: string;
  updatedAt: string | null;
  current: DeadlineSettings;
  proposed: DeadlineSettings;
}) {
  return hashJson({
    organizationId: input.organizationId,
    settingsKey: SETTINGS_KEY,
    updatedAt: input.updatedAt,
    current: input.current,
    proposed: input.proposed,
  });
}

async function readSettingRow(organizationId: string) {
  await ensureOrganizationSettingsTable();
  const rows = await prisma.$queryRaw<SettingRow[]>`
    SELECT "value", "updatedAt"
    FROM "OrganizationSetting"
    WHERE "organizationId" = ${organizationId}
      AND "key" = ${SETTINGS_KEY}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export function getProjectStatusAutomationConfirmationText(enabled: boolean) {
  return enabled
    ? "PROJEKTSTATUS-AUTOMATION AKTIVIEREN"
    : "PROJEKTSTATUS-AUTOMATION DEAKTIVIEREN";
}

export async function evaluateProjectStatusAutomationManagement(input: {
  organizationId: string;
  users: readonly User[];
  request: ProjectStatusAutomationManagementRequest;
}) {
  const row = await readSettingRow(input.organizationId);
  const current = row ? normalizeDeadlineSettings(row.value) : await getDeadlineSettings(input.organizationId);
  const proposed = proposedSettings(current, input.request);
  const preview = await evaluateProjectStatusEscalations({
    organizationId: input.organizationId,
    users: input.users,
    enabled: proposed.projectStatusEscalationEnabled,
    rules: proposed.projectStatusRules,
  });
  const blockingIssues = current.projectStatusEscalationEnabled === proposed.projectStatusEscalationEnabled
    ? [`Die Projektstatus-Automation ist bereits ${proposed.projectStatusEscalationEnabled ? "aktiv" : "inaktiv"}.`]
    : [];
  const responsibleNotices = preview.items.filter((item) => item.stage === "responsible").length;
  const managementNotices = preview.items.filter((item) => item.stage === "management").length;
  const missingResponsible = preview.items.filter((item) => !item.responsibleUserId).length;
  return {
    currentEnabled: current.projectStatusEscalationEnabled,
    targetEnabled: proposed.projectStatusEscalationEnabled,
    monitoredProjects: preview.monitoredProjects,
    responsibleNotices,
    managementNotices,
    missingResponsible,
    items: preview.items.slice(0, 100).map((item) => ({
      projectId: item.projectId,
      projectNumber: item.projectNumber,
      projectTitle: item.projectTitle,
      customer: item.customer,
      status: item.status,
      elapsedDays: item.elapsedDays,
      stage: item.stage,
      responsibleName: item.responsibleName,
    })),
    checks: [
      {
        key: "dry-run",
        label: "Aktueller Dry-Run",
        status: "ok" as const,
        detail: `${preview.monitoredProjects} Projekt(e) überwacht; ${preview.items.length} aktuelle Schwellenüberschreitung(en).`,
      },
      {
        key: "delivery",
        label: "Keine unmittelbare Zustellung",
        status: "ok" as const,
        detail: "JARVIS ändert nur den Schalter. Dieser Schritt versendet keine Meldung oder E-Mail und ändert keinen Projektstatus.",
      },
      {
        key: "responsibility",
        label: "Zuständigkeiten",
        status: missingResponsible > 0 ? ("warning" as const) : ("ok" as const),
        detail: missingResponsible > 0
          ? `${missingResponsible} Treffer haben keine eindeutig auflösbare verantwortliche Person.`
          : "Alle aktuellen Treffer besitzen eine eindeutig auflösbare verantwortliche Person.",
      },
    ],
    warnings: input.request.enabled
      ? ["Nach der Aktivierung dürfen ausschließlich der bestehende interne Scheduler und dessen serverseitiger Kill-Switch Zustellungen auslösen."]
      : ["Die Deaktivierung stoppt neue automatische Projektstatus-Hinweise; bestehende Meldungen und Auditdaten bleiben erhalten."],
    blockingIssues,
    fingerprint: settingsFingerprint({
      organizationId: input.organizationId,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      current,
      proposed,
    }),
  } satisfies ProjectStatusAutomationManagementEvaluation;
}

export async function executeProjectStatusAutomationManagement(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  actorId: string;
  requestId: string;
  request: ProjectStatusAutomationManagementRequest;
  expectedFingerprint: string;
}) {
  await input.tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${`workpilot:project-status-automation:${input.organizationId}`}))
  `;
  const rows = await input.tx.$queryRaw<SettingRow[]>`
    SELECT "value", "updatedAt"
    FROM "OrganizationSetting"
    WHERE "organizationId" = ${input.organizationId}
      AND "key" = ${SETTINGS_KEY}
    FOR UPDATE
  `;
  const row = rows[0] ?? null;
  const current = normalizeDeadlineSettings(row?.value);
  const proposed = proposedSettings(current, input.request);
  if (current.projectStatusEscalationEnabled === proposed.projectStatusEscalationEnabled) {
    throw new ProjectStatusAutomationManagementServiceError(
      "conflict",
      `Die Projektstatus-Automation ist bereits ${proposed.projectStatusEscalationEnabled ? "aktiv" : "inaktiv"}.`
    );
  }
  const fingerprint = settingsFingerprint({
    organizationId: input.organizationId,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    current,
    proposed,
  });
  if (fingerprint !== input.expectedFingerprint) {
    throw new ProjectStatusAutomationManagementServiceError(
      "stale_context",
      "Die Automationseinstellungen wurden seit dem Dry-Run verändert. Bitte prüfe die Auswirkung erneut."
    );
  }
  await input.tx.$executeRaw`
    INSERT INTO "OrganizationSetting" ("id", "organizationId", "key", "value", "updatedAt")
    VALUES (
      ${input.requestId},
      ${input.organizationId},
      ${SETTINGS_KEY},
      ${JSON.stringify(proposed)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("organizationId", "key") DO UPDATE SET
      "value" = EXCLUDED."value",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
  await input.tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "automation.project-status.changed",
      entityType: "organization-setting",
      entityId: `${input.organizationId}:${SETTINGS_KEY}`,
      payload: {
        requestId: input.requestId,
        before: { enabled: current.projectStatusEscalationEnabled },
        after: { enabled: proposed.projectStatusEscalationEnabled },
        rulesUnchanged: true,
        source: "jarvis",
      },
    },
  });
  return proposed;
}
