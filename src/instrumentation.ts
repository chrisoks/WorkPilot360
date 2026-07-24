export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startWinterServiceScheduler } = await import("./lib/automation/winter-service-scheduler");
  startWinterServiceScheduler();

  const { startTaskEscalationScheduler } = await import(
    "./lib/automation/task-escalation-scheduler"
  );
  startTaskEscalationScheduler();

  const { startProjectStatusEscalationScheduler } = await import(
    "./lib/automation/project-status-escalation-scheduler"
  );
  startProjectStatusEscalationScheduler();
}
