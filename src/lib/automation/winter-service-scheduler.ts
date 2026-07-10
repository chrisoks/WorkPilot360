import { getInternalAutomationHeaders } from "@/lib/auth/internal-automation";

type WinterServiceSchedulerState = {
  initialTimer?: ReturnType<typeof setTimeout>;
  intervalTimer?: ReturnType<typeof setInterval>;
  isRunning?: boolean;
  lastAttemptAt?: string;
  lastStatus?: "ok" | "error";
  lastHttpStatus?: number;
};

const runtime = globalThis as typeof globalThis & {
  __workpilot360WinterServiceScheduler?: WinterServiceSchedulerState;
};
const schedulerState = runtime.__workpilot360WinterServiceScheduler ??= {};

function getInternalBaseUrl() {
  const configuredUrl = process.env.WORKPILOT_INTERNAL_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT || "3000"}`;
}

async function runWinterServiceAutomation() {
  if (schedulerState.isRunning) return;
  schedulerState.isRunning = true;
  schedulerState.lastAttemptAt = new Date().toISOString();
  try {
    const response = await fetch(`${getInternalBaseUrl()}/api/winter-service-automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getInternalAutomationHeaders() },
      body: JSON.stringify({ source: "scheduler" }),
    });
    schedulerState.lastHttpStatus = response.status;
    schedulerState.lastStatus = response.ok ? "ok" : "error";
    if (!response.ok) {
      console.error(`Winterdienst-Automatik antwortete mit HTTP ${response.status}.`);
    }
  } catch (error) {
    schedulerState.lastStatus = "error";
    schedulerState.lastHttpStatus = 0;
    console.error("Winterdienst-Automatik konnte nicht gestartet werden.", error);
  } finally {
    schedulerState.isRunning = false;
  }
}

export function getWinterServiceSchedulerStatus() {
  return {
    schedulerRunning: Boolean(schedulerState.initialTimer || schedulerState.intervalTimer),
    schedulerLastAttemptAt: schedulerState.lastAttemptAt ?? "",
    schedulerLastStatus: schedulerState.lastStatus ?? "",
    schedulerLastHttpStatus: schedulerState.lastHttpStatus ?? 0,
  };
}

export function startWinterServiceScheduler() {
  if (schedulerState.initialTimer || schedulerState.intervalTimer) return;

  schedulerState.initialTimer = setTimeout(() => {
    schedulerState.initialTimer = undefined;
    void runWinterServiceAutomation();
  }, 30_000);
  schedulerState.initialTimer.unref?.();

  schedulerState.intervalTimer = setInterval(() => {
    void runWinterServiceAutomation();
  }, 10 * 60 * 1000);
  schedulerState.intervalTimer.unref?.();
}
