import { NextResponse } from "next/server";
import { isInternalAutomationRequest } from "@/lib/auth/internal-automation";
import { runTaskEscalationAutomation } from "@/lib/tasks/escalation-automation";

export async function POST(req: Request) {
  if (!isInternalAutomationRequest(req)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const result = await runTaskEscalationAutomation({
    deliveryEnabled: process.env.WORKPILOT_TASK_ESCALATION_DELIVERY_ENABLED === "true",
  });
  const { successfulOrganizations, failedOrganizations } = result.summary;
  const status = failedOrganizations === 0 ? 200 : successfulOrganizations > 0 ? 207 : 500;
  return NextResponse.json(result, { status });
}
