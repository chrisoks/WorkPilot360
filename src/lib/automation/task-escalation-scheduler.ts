import { getInternalAutomationHeaders } from "@/lib/auth/internal-automation";

type TaskEscalationSchedulerState = {
  initialTimer?: ReturnType<typeof setTimeout>;
  intervalTimer?: ReturnType<typeof setInterval>;
  isRunning?: boolean;
  lastAttemptAt?: string;
  lastStatus?: "ok" | "error";
  lastHttpStatus?: number;
};

const runtime = globalThis as typeof globalThis & {
  __workpilot360TaskEscalationScheduler?: TaskEscalationSchedulerState;
};
const schedulerState = runtime.__workpilot360TaskEscalationScheduler ??= {};

function getInternalBaseUrl() {
  const configuredUrl = process.env.WORKPILOT_INTERNAL_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT || "3000"}`;
}

export function isTaskEscalationAutomationEnabled() {
  return process.env.WORKPILOT_TASK_ESCALATION_AUTOMATION_ENABLED === "true";
}

async function runTaskEscalationAutomation() {
  if (schedulerState.isRunning) return;
  schedulerState.isRunning = true;
  schedulerState.lastAttemptAt = new Date().toISOString();
  try {
    const response = await fetch(`${getInternalBaseUrl()}/api/task-escalations/automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getInternalAutomationHeaders() },
      body: JSON.stringify({ source: "scheduler" }),
    });
    schedulerState.lastHttpStatus = response.status;
    const completedWithoutFailures = response.status === 200;
    schedulerState.lastStatus = completedWithoutFailures ? "ok" : "error";
    if (!completedWithoutFailures) {
      console.error(`Aufgaben-Eskalationsautomatik antwortete mit HTTP ${response.status}.`);
    }
  } catch (error) {
    schedulerState.lastStatus = "error";
    schedulerState.lastHttpStatus = 0;
    console.error("Aufgaben-Eskalationsautomatik konnte nicht gestartet werden.", error);
  } finally {
    schedulerState.isRunning = false;
  }
}

export function getTaskEscalationSchedulerStatus() {
  return {
    enabled: isTaskEscalationAutomationEnabled(),
    schedulerRunning: Boolean(schedulerState.initialTimer || schedulerState.intervalTimer),
    schedulerLastAttemptAt: schedulerState.lastAttemptAt ?? "",
    schedulerLastStatus: schedulerState.lastStatus ?? "",
    schedulerLastHttpStatus: schedulerState.lastHttpStatus ?? 0,
  };
}

export function startTaskEscalationScheduler() {
  if (!isTaskEscalationAutomationEnabled()) return;
  if (schedulerState.initialTimer || schedulerState.intervalTimer) return;

  schedulerState.initialTimer = setTimeout(() => {
    schedulerState.initialTimer = undefined;
    void runTaskEscalationAutomation();
  }, 45_000);
  schedulerState.initialTimer.unref?.();

  schedulerState.intervalTimer = setInterval(() => {
    void runTaskEscalationAutomation();
  }, 15 * 60 * 1000);
  schedulerState.intervalTimer.unref?.();
}
