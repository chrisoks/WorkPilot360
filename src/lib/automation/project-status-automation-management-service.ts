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
  operation: "switch";
  enabled: boolean;
} | {
  operation: "rule";
  status: string;
  enabled?: boolean;
  responsibleAfterDays?: number;
  managementAfterDays?: number;
};

type AutomationImpact = {
  monitoredProjects: number;
  responsibleNotices: number;
  managementNotices: number;
  missingResponsible: number;
};

export type ProjectStatusAutomationManagementEvaluation = {
  operation: "switch" | "rule";
  currentEnabled: boolean;
  targetEnabled: boolean;
  rule?: {
    status: string;
    before: { enabled: boolean; responsibleAfterDays: number; managementAfterDays: number };
    after: { enabled: boolean; responsibleAfterDays: number; managementAfterDays: number };
  };
  currentImpact: AutomationImpact;
  targetImpact: AutomationImpact;
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
  if (request.operation === "rule") {
    return normalizeDeadlineSettings({
      ...current,
      projectStatusRules: current.projectStatusRules.map((rule) => rule.status === request.status ? {
        ...rule,
        ...(request.enabled === undefined ? {} : { enabled: request.enabled }),
        ...(request.responsibleAfterDays === undefined ? {} : { responsibleAfterDays: request.responsibleAfterDays }),
        ...(request.managementAfterDays === undefined ? {} : { managementAfterDays: request.managementAfterDays }),
      } : rule),
    });
  }
  return normalizeDeadlineSettings({
    ...current,
    projectStatusEscalationEnabled: request.enabled,
  });
}

function impactOf(preview: Awaited<ReturnType<typeof evaluateProjectStatusEscalations>>): AutomationImpact {
  return {
    monitoredProjects: preview.monitoredProjects,
    responsibleNotices: preview.items.filter((item) => item.stage === "responsible").length,
    managementNotices: preview.items.filter((item) => item.stage === "management").length,
    missingResponsible: preview.items.filter((item) => !item.responsibleUserId).length,
  };
}

function requestBlockingIssues(current: DeadlineSettings, proposed: DeadlineSettings, request: ProjectStatusAutomationManagementRequest) {
  const issues: string[] = [];
  if (request.operation === "rule") {
    const currentRule = current.projectStatusRules.find((rule) => rule.status === request.status);
    const proposedRule = proposed.projectStatusRules.find((rule) => rule.status === request.status);
    if (!currentRule || !proposedRule) issues.push("Die benannte Projektstatus-Regel ist nicht freigegeben.");
    const responsible = request.responsibleAfterDays ?? currentRule?.responsibleAfterDays ?? 0;
    const management = request.managementAfterDays ?? currentRule?.managementAfterDays ?? 0;
    if (responsible < 1 || responsible > 180) issues.push("Die Schwelle für die verantwortliche Person muss zwischen 1 und 180 Tagen liegen.");
    if (management < 1 || management > 365) issues.push("Die Schwelle für die Geschäftsführung muss zwischen 1 und 365 Tagen liegen.");
    if (management < responsible) issues.push("Die Geschäftsführungsschwelle darf nicht vor der Schwelle der verantwortlichen Person liegen.");
  }
  if (JSON.stringify(current) === JSON.stringify(proposed)) {
    issues.push(request.operation === "switch"
      ? `Die Projektstatus-Automation ist bereits ${proposed.projectStatusEscalationEnabled ? "aktiv" : "inaktiv"}.`
      : "Die benannte Projektstatus-Regel besitzt bereits genau diese Werte.");
  }
  return issues;
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

export function getProjectStatusAutomationConfirmationText(request: ProjectStatusAutomationManagementRequest) {
  if (request.operation === "rule") return `PROJEKTSTATUS-REGEL ÄNDERN ${request.status.toLocaleUpperCase("de-DE")}`;
  return request.enabled
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
  const currentPreview = await evaluateProjectStatusEscalations({
    organizationId: input.organizationId,
    users: input.users,
    enabled: current.projectStatusEscalationEnabled,
    rules: current.projectStatusRules,
  });
  const preview = await evaluateProjectStatusEscalations({
    organizationId: input.organizationId,
    users: input.users,
    enabled: proposed.projectStatusEscalationEnabled,
    rules: proposed.projectStatusRules,
  });
  const blockingIssues = requestBlockingIssues(current, proposed, input.request);
  const currentImpact = impactOf(currentPreview);
  const targetImpact = impactOf(preview);
  const ruleStatus = input.request.operation === "rule" ? input.request.status : undefined;
  const currentRule = ruleStatus ? current.projectStatusRules.find((rule) => rule.status === ruleStatus) : undefined;
  const targetRule = ruleStatus ? proposed.projectStatusRules.find((rule) => rule.status === ruleStatus) : undefined;
  return {
    operation: input.request.operation,
    currentEnabled: current.projectStatusEscalationEnabled,
    targetEnabled: proposed.projectStatusEscalationEnabled,
    ...(currentRule && targetRule ? {
      rule: {
        status: currentRule.status,
        before: { enabled: currentRule.enabled, responsibleAfterDays: currentRule.responsibleAfterDays, managementAfterDays: currentRule.managementAfterDays },
        after: { enabled: targetRule.enabled, responsibleAfterDays: targetRule.responsibleAfterDays, managementAfterDays: targetRule.managementAfterDays },
      },
    } : {}),
    currentImpact,
    targetImpact,
    monitoredProjects: targetImpact.monitoredProjects,
    responsibleNotices: targetImpact.responsibleNotices,
    managementNotices: targetImpact.managementNotices,
    missingResponsible: targetImpact.missingResponsible,
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
        detail: input.request.operation === "rule"
          ? `Vorher ${currentPreview.items.length}, nachher ${preview.items.length} aktuelle Schwellenüberschreitung(en); es wird noch nichts zugestellt.`
          : `${preview.monitoredProjects} Projekt(e) überwacht; ${preview.items.length} aktuelle Schwellenüberschreitung(en).`,
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
        status: targetImpact.missingResponsible > 0 ? ("warning" as const) : ("ok" as const),
        detail: targetImpact.missingResponsible > 0
          ? `${targetImpact.missingResponsible} Treffer haben keine eindeutig auflösbare verantwortliche Person.`
          : "Alle aktuellen Treffer besitzen eine eindeutig auflösbare verantwortliche Person.",
      },
    ],
    warnings: input.request.operation === "rule"
      ? ["Die Regeländerung wirkt erst bei einem späteren, separat ausgelösten Schedulerlauf. Bestehende Meldungen und Auditdaten bleiben erhalten."]
      : input.request.enabled
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
  const blockingIssues = requestBlockingIssues(current, proposed, input.request);
  if (blockingIssues.length) {
    throw new ProjectStatusAutomationManagementServiceError(
      blockingIssues.some((issue) => issue.includes("bereits")) ? "conflict" : "invalid_input",
      blockingIssues[0]
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
  const ruleStatus = input.request.operation === "rule" ? input.request.status : undefined;
  await input.tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "automation.project-status.changed",
      entityType: "organization-setting",
      entityId: `${input.organizationId}:${SETTINGS_KEY}`,
      payload: {
        requestId: input.requestId,
        operation: input.request.operation,
        before: input.request.operation === "switch"
          ? { enabled: current.projectStatusEscalationEnabled }
          : current.projectStatusRules.find((rule) => rule.status === ruleStatus),
        after: input.request.operation === "switch"
          ? { enabled: proposed.projectStatusEscalationEnabled }
          : proposed.projectStatusRules.find((rule) => rule.status === ruleStatus),
        rulesUnchanged: input.request.operation === "switch",
        source: "jarvis",
      },
    },
  });
  return proposed;
}
