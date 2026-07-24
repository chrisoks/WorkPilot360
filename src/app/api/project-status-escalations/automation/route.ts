import { NextResponse } from "next/server";
import { isInternalAutomationRequest } from "@/lib/auth/internal-automation";
import { runProjectStatusEscalationAutomation } from "@/lib/projects/status-escalation-automation";

export async function POST(req: Request) {
  if (!isInternalAutomationRequest(req)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const result = await runProjectStatusEscalationAutomation({
    deliveryEnabled: process.env.WORKPILOT_PROJECT_STATUS_DELIVERY_ENABLED === "true",
  });
  return NextResponse.json(result, {
    status: result.summary.failedOrganizations === 0 ? 200 : 207,
  });
}
