import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { canManageStatusRules } from "@/lib/permissions";
import { evaluateProjectStatusEscalations } from "@/lib/projects/status-escalation";
import { getProjectStatusEscalationSchedulerStatus } from "@/lib/automation/project-status-escalation-scheduler";
import { normalizeDeadlineSettings } from "@/lib/company-settings/deadlines";

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageStatusRules(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen die Projektstatus-Vorschau ausführen." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    rules?: Array<{
      status: string;
      enabled: boolean;
      responsibleAfterDays: number;
      managementAfterDays: number;
    }>;
  };
  const normalized = normalizeDeadlineSettings({
    projectStatusEscalationEnabled: body.enabled === true,
    projectStatusRules: body.rules,
  });
  const result = await evaluateProjectStatusEscalations({
    organizationId: organization.id,
    users,
    enabled: normalized.projectStatusEscalationEnabled,
    rules: normalized.projectStatusRules,
  });
  return NextResponse.json({
    dryRun: true,
    generatedAt: new Date().toISOString(),
    calculationBasis: "Kalendertage seit Beginn des aktuellen Projektstatus",
    ...result,
    automation: {
      ...getProjectStatusEscalationSchedulerStatus(),
      deliveryEnabled: process.env.WORKPILOT_PROJECT_STATUS_DELIVERY_ENABLED === "true",
    },
  });
}
