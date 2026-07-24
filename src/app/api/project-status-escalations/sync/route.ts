import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { canManageStatusRules } from "@/lib/permissions";
import { synchronizeProjectStatusEscalations } from "@/lib/projects/status-escalation";

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageStatusRules(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Projektstatus-Eskalationen synchronisieren." },
      { status: 403 }
    );
  }

  const result = await synchronizeProjectStatusEscalations({
    organizationId: organization.id,
    users,
    deliveryEnabled: process.env.WORKPILOT_PROJECT_STATUS_DELIVERY_ENABLED === "true",
  });
  return NextResponse.json({
    ...result,
    message: !result.enabled
      ? "Die Vorschau wurde aktualisiert. Die Projektstatus-Eskalation ist noch ausgeschaltet."
      : result.delivery.enabled
        ? "Fällige Projektstatus-Hinweise wurden verarbeitet."
        : "Der Status wurde geprüft. Notifications und Systemmails sind serverseitig noch deaktiviert.",
  });
}
