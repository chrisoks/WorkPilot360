const INTERNAL_AUTOMATION_HEADER = "x-workpilot-internal-automation";
const internalAutomationToken =
  process.env.WORKPILOT_INTERNAL_AUTOMATION_TOKEN?.trim() ||
  process.env.PUSH_REMINDER_CRON_SECRET?.trim() ||
  crypto.randomUUID();
process.env.WORKPILOT_INTERNAL_AUTOMATION_TOKEN = internalAutomationToken;

export function getInternalAutomationHeaders() {
  return { [INTERNAL_AUTOMATION_HEADER]: internalAutomationToken };
}

export function isInternalAutomationRequest(req: Request) {
  const submittedToken = req.headers.get(INTERNAL_AUTOMATION_HEADER) ?? "";
  return submittedToken === internalAutomationToken;
}
