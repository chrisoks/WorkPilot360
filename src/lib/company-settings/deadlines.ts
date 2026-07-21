import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";

const DEADLINE_SETTINGS_KEY = "deadlines";

const DEFAULT_DEADLINE_SETTINGS = {
  offerFollowUpWorkdays: 5,
  potentialDecisionReminderWorkdays: 1,
  potentialDecisionEscalationWorkdays: 2,
  completedTaskArchiveDays: 5,
  taskEmployeeActiveLimit: 8,
  taskEmployeeOverdueLimit: 2,
  taskEmployeeStaleWorkdays: 3,
  taskWaitingFeedbackWorkdays: 7,
  taskLeadershipEscalationWorkdays: 2,
  taskLeadershipImmediateActiveLimit: 12,
  taskLeadershipImmediateOverdueLimit: 4,
  taskManagementEscalationWorkdays: 3,
  taskManagementImmediateActiveLimit: 15,
  taskManagementImmediateOverdueLimit: 6,
  interruptedWorkFollowUpDays: 2,
  interruptedWorkManagementEscalationDays: 7,
  punctualityStartToleranceMinutes: 10,
  punctualityEndToleranceMinutes: 10,
  hourlyBillingRoundingFactorHours: 0.5,
};

export type DeadlineSettings = typeof DEFAULT_DEADLINE_SETTINGS;

type DeadlineSettingValue = Partial<DeadlineSettings>;

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numericValue)));
}

function normalizeRoundingFactor(value: unknown, fallback: number) {
  const numericValue = Number(value);
  const allowedValues = [0.25, 0.5, 1];
  return allowedValues.includes(numericValue) ? numericValue : fallback;
}

export function normalizeDeadlineSettings(value: unknown): DeadlineSettings {
  const settings = (value && typeof value === "object" ? value : {}) as DeadlineSettingValue;
  const taskEmployeeActiveLimit = clampInteger(
    settings.taskEmployeeActiveLimit,
    DEFAULT_DEADLINE_SETTINGS.taskEmployeeActiveLimit,
    1,
    100
  );
  const taskEmployeeOverdueLimit = clampInteger(
    settings.taskEmployeeOverdueLimit,
    DEFAULT_DEADLINE_SETTINGS.taskEmployeeOverdueLimit,
    1,
    100
  );
  const taskLeadershipImmediateActiveLimit = Math.max(
    taskEmployeeActiveLimit,
    clampInteger(
      settings.taskLeadershipImmediateActiveLimit,
      DEFAULT_DEADLINE_SETTINGS.taskLeadershipImmediateActiveLimit,
      1,
      100
    )
  );
  const taskLeadershipImmediateOverdueLimit = Math.max(
    taskEmployeeOverdueLimit,
    clampInteger(
      settings.taskLeadershipImmediateOverdueLimit,
      DEFAULT_DEADLINE_SETTINGS.taskLeadershipImmediateOverdueLimit,
      1,
      100
    )
  );
  return {
    offerFollowUpWorkdays: clampInteger(
      settings.offerFollowUpWorkdays,
      DEFAULT_DEADLINE_SETTINGS.offerFollowUpWorkdays,
      1,
      30
    ),
    potentialDecisionReminderWorkdays: clampInteger(
      settings.potentialDecisionReminderWorkdays,
      DEFAULT_DEADLINE_SETTINGS.potentialDecisionReminderWorkdays,
      1,
      30
    ),
    potentialDecisionEscalationWorkdays: clampInteger(
      settings.potentialDecisionEscalationWorkdays,
      DEFAULT_DEADLINE_SETTINGS.potentialDecisionEscalationWorkdays,
      1,
      60
    ),
    completedTaskArchiveDays: clampInteger(
      settings.completedTaskArchiveDays,
      DEFAULT_DEADLINE_SETTINGS.completedTaskArchiveDays,
      1,
      30
    ),
    taskEmployeeActiveLimit,
    taskEmployeeOverdueLimit,
    taskEmployeeStaleWorkdays: clampInteger(
      settings.taskEmployeeStaleWorkdays,
      DEFAULT_DEADLINE_SETTINGS.taskEmployeeStaleWorkdays,
      1,
      60
    ),
    taskWaitingFeedbackWorkdays: clampInteger(
      settings.taskWaitingFeedbackWorkdays,
      DEFAULT_DEADLINE_SETTINGS.taskWaitingFeedbackWorkdays,
      1,
      60
    ),
    taskLeadershipEscalationWorkdays: clampInteger(
      settings.taskLeadershipEscalationWorkdays,
      DEFAULT_DEADLINE_SETTINGS.taskLeadershipEscalationWorkdays,
      1,
      60
    ),
    taskLeadershipImmediateActiveLimit,
    taskLeadershipImmediateOverdueLimit,
    taskManagementEscalationWorkdays: clampInteger(
      settings.taskManagementEscalationWorkdays,
      DEFAULT_DEADLINE_SETTINGS.taskManagementEscalationWorkdays,
      1,
      60
    ),
    taskManagementImmediateActiveLimit: Math.max(
      taskLeadershipImmediateActiveLimit,
      clampInteger(
        settings.taskManagementImmediateActiveLimit,
        DEFAULT_DEADLINE_SETTINGS.taskManagementImmediateActiveLimit,
        1,
        100
      )
    ),
    taskManagementImmediateOverdueLimit: Math.max(
      taskLeadershipImmediateOverdueLimit,
      clampInteger(
        settings.taskManagementImmediateOverdueLimit,
        DEFAULT_DEADLINE_SETTINGS.taskManagementImmediateOverdueLimit,
        1,
        100
      )
    ),
    interruptedWorkFollowUpDays: clampInteger(
      settings.interruptedWorkFollowUpDays,
      DEFAULT_DEADLINE_SETTINGS.interruptedWorkFollowUpDays,
      1,
      30
    ),
    interruptedWorkManagementEscalationDays: clampInteger(
      settings.interruptedWorkManagementEscalationDays,
      DEFAULT_DEADLINE_SETTINGS.interruptedWorkManagementEscalationDays,
      1,
      60
    ),
    punctualityStartToleranceMinutes: clampInteger(
      settings.punctualityStartToleranceMinutes,
      DEFAULT_DEADLINE_SETTINGS.punctualityStartToleranceMinutes,
      0,
      120
    ),
    punctualityEndToleranceMinutes: clampInteger(
      settings.punctualityEndToleranceMinutes,
      DEFAULT_DEADLINE_SETTINGS.punctualityEndToleranceMinutes,
      0,
      120
    ),
    hourlyBillingRoundingFactorHours: normalizeRoundingFactor(
      settings.hourlyBillingRoundingFactorHours,
      DEFAULT_DEADLINE_SETTINGS.hourlyBillingRoundingFactorHours
    ),
  };
}

export async function ensureOrganizationSettingsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OrganizationSetting" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationSetting_org_key"
    ON "OrganizationSetting" ("organizationId", "key")
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "OrganizationSetting_organizationId_idx"
    ON "OrganizationSetting" ("organizationId")
  `;
}

export async function getDeadlineSettings(organizationId: string) {
  await ensureOrganizationSettingsTable();
  const rows = await prisma.$queryRaw<Array<{ value: unknown }>>`
    SELECT "value"
    FROM "OrganizationSetting"
    WHERE "organizationId" = ${organizationId}
      AND "key" = ${DEADLINE_SETTINGS_KEY}
    LIMIT 1
  `;

  return normalizeDeadlineSettings(rows[0]?.value);
}

export async function saveDeadlineSettings(organizationId: string, input: Record<string, unknown>) {
  await ensureOrganizationSettingsTable();
  const currentSettings = await getDeadlineSettings(organizationId);
  const settings = normalizeDeadlineSettings({
    ...currentSettings,
    offerFollowUpWorkdays: input.offerFollowUpWorkdays ?? currentSettings.offerFollowUpWorkdays,
    potentialDecisionReminderWorkdays:
      input.potentialDecisionReminderWorkdays ?? currentSettings.potentialDecisionReminderWorkdays,
    potentialDecisionEscalationWorkdays:
      input.potentialDecisionEscalationWorkdays ?? currentSettings.potentialDecisionEscalationWorkdays,
    completedTaskArchiveDays: input.completedTaskArchiveDays ?? currentSettings.completedTaskArchiveDays,
    taskEmployeeActiveLimit: input.taskEmployeeActiveLimit ?? currentSettings.taskEmployeeActiveLimit,
    taskEmployeeOverdueLimit: input.taskEmployeeOverdueLimit ?? currentSettings.taskEmployeeOverdueLimit,
    taskEmployeeStaleWorkdays: input.taskEmployeeStaleWorkdays ?? currentSettings.taskEmployeeStaleWorkdays,
    taskWaitingFeedbackWorkdays:
      input.taskWaitingFeedbackWorkdays ?? currentSettings.taskWaitingFeedbackWorkdays,
    taskLeadershipEscalationWorkdays:
      input.taskLeadershipEscalationWorkdays ?? currentSettings.taskLeadershipEscalationWorkdays,
    taskLeadershipImmediateActiveLimit:
      input.taskLeadershipImmediateActiveLimit ?? currentSettings.taskLeadershipImmediateActiveLimit,
    taskLeadershipImmediateOverdueLimit:
      input.taskLeadershipImmediateOverdueLimit ?? currentSettings.taskLeadershipImmediateOverdueLimit,
    taskManagementEscalationWorkdays:
      input.taskManagementEscalationWorkdays ?? currentSettings.taskManagementEscalationWorkdays,
    taskManagementImmediateActiveLimit:
      input.taskManagementImmediateActiveLimit ?? currentSettings.taskManagementImmediateActiveLimit,
    taskManagementImmediateOverdueLimit:
      input.taskManagementImmediateOverdueLimit ?? currentSettings.taskManagementImmediateOverdueLimit,
    interruptedWorkFollowUpDays: input.interruptedWorkFollowUpDays ?? currentSettings.interruptedWorkFollowUpDays,
    interruptedWorkManagementEscalationDays:
      input.interruptedWorkManagementEscalationDays ?? currentSettings.interruptedWorkManagementEscalationDays,
    punctualityStartToleranceMinutes:
      input.punctualityStartToleranceMinutes ?? currentSettings.punctualityStartToleranceMinutes,
    punctualityEndToleranceMinutes:
      input.punctualityEndToleranceMinutes ?? currentSettings.punctualityEndToleranceMinutes,
    hourlyBillingRoundingFactorHours:
      input.hourlyBillingRoundingFactorHours ?? currentSettings.hourlyBillingRoundingFactorHours,
  });

  await prisma.$executeRaw`
    INSERT INTO "OrganizationSetting" ("id", "organizationId", "key", "value", "updatedAt")
    VALUES (
      ${randomUUID()},
      ${organizationId},
      ${DEADLINE_SETTINGS_KEY},
      ${JSON.stringify(settings)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("organizationId", "key") DO UPDATE SET
      "value" = EXCLUDED."value",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return settings;
}
