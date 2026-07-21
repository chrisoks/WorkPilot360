import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { canManageStatusRules } from "@/lib/permissions";
import { synchronizeTaskEscalationEpisodes } from "@/lib/tasks/escalation-sync";

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageStatusRules(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen den Eskalationsstatus synchronisieren." },
      { status: 403 }
    );
  }

  const result = await synchronizeTaskEscalationEpisodes({
    organizationId: organization.id,
    users,
    deliveryEnabled: process.env.WORKPILOT_TASK_ESCALATION_DELIVERY_ENABLED === "true",
  });

  return NextResponse.json({
    ...result,
    deliveryEnabled: result.delivery.enabled,
    message: result.delivery.enabled
      ? "Der Eskalationsstatus wurde gespeichert und fällige Benachrichtigungen wurden verarbeitet."
      : "Der Eskalationsstatus wurde gespeichert. Notifications und Systemmails sind noch deaktiviert.",
  });
}
