import { getInternalAutomationHeaders } from "@/lib/auth/internal-automation";

type SchedulerState = {
  initialTimer?: ReturnType<typeof setTimeout>;
  intervalTimer?: ReturnType<typeof setInterval>;
  isRunning?: boolean;
  lastAttemptAt?: string;
  lastStatus?: "ok" | "error";
  lastHttpStatus?: number;
};

const runtime = globalThis as typeof globalThis & {
  __workpilot360ProjectStatusEscalationScheduler?: SchedulerState;
};
const schedulerState = runtime.__workpilot360ProjectStatusEscalationScheduler ??= {};

function getInternalBaseUrl() {
  const configuredUrl = process.env.WORKPILOT_INTERNAL_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT || "3000"}`;
}

export function isProjectStatusEscalationAutomationEnabled() {
  return process.env.WORKPILOT_PROJECT_STATUS_AUTOMATION_ENABLED === "true";
}

async function runAutomation() {
  if (schedulerState.isRunning) return;
  schedulerState.isRunning = true;
  schedulerState.lastAttemptAt = new Date().toISOString();
  try {
    const response = await fetch(
      `${getInternalBaseUrl()}/api/project-status-escalations/automation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getInternalAutomationHeaders() },
        body: JSON.stringify({ source: "scheduler" }),
      }
    );
    schedulerState.lastHttpStatus = response.status;
    schedulerState.lastStatus = response.ok ? "ok" : "error";
  } catch (error) {
    schedulerState.lastStatus = "error";
    schedulerState.lastHttpStatus = 0;
    console.error("Projektstatus-Eskalationsautomatik konnte nicht gestartet werden.", error);
  } finally {
    schedulerState.isRunning = false;
  }
}

export function getProjectStatusEscalationSchedulerStatus() {
  return {
    enabled: isProjectStatusEscalationAutomationEnabled(),
    schedulerRunning: Boolean(schedulerState.initialTimer || schedulerState.intervalTimer),
    schedulerLastAttemptAt: schedulerState.lastAttemptAt ?? "",
    schedulerLastStatus: schedulerState.lastStatus ?? "",
    schedulerLastHttpStatus: schedulerState.lastHttpStatus ?? 0,
  };
}

export function startProjectStatusEscalationScheduler() {
  if (!isProjectStatusEscalationAutomationEnabled()) return;
  if (schedulerState.initialTimer || schedulerState.intervalTimer) return;

  schedulerState.initialTimer = setTimeout(() => {
    schedulerState.initialTimer = undefined;
    void runAutomation();
  }, 60_000);
  schedulerState.initialTimer.unref?.();
  schedulerState.intervalTimer = setInterval(() => void runAutomation(), 15 * 60 * 1000);
  schedulerState.intervalTimer.unref?.();
}
