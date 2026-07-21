import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { canManageStatusRules } from "@/lib/permissions";
import { evaluateOrganizationTaskEscalations } from "@/lib/tasks/escalation-sync";

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, null);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageStatusRules(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen die Eskalationsvorschau ausführen." },
      { status: 403 }
    );
  }

  const items = await evaluateOrganizationTaskEscalations({ organizationId: organization.id, users });

  return NextResponse.json({
    dryRun: true,
    generatedAt: new Date().toISOString(),
    calculationBasis: "Montag bis Freitag; aktuelle Aufgaben- und Zuständigkeitsdaten",
    summary: {
      employees: items.filter((item) => item.stage === "employee").length,
      leadership: items.filter((item) => item.stage === "leadership").length,
      management: items.filter((item) => item.stage === "management").length,
      missingLeadership: items.filter(
        (item) =>
          item.stage !== "employee" &&
          item.leadershipRequired &&
          !item.leadershipRecipientId
      ).length,
    },
    items,
  });
}
