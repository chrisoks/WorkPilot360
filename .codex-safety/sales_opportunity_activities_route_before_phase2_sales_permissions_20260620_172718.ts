import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanString(actorId);
  if (!requestedActorId) return null;

  return users.find((candidate) => candidate.id === requestedActorId && candidate.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

export async function POST(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }

  const opportunityId = cleanString(body.opportunityId);
  const text = cleanString(body.body);
  const type = cleanString(body.type) || "note";

  if (!opportunityId || !text) {
    return NextResponse.json({ error: "Bitte Chance und Aktivitaet angeben." }, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO "SalesActivity" ("id", "organizationId", "opportunityId", "type", "body", "actorUserId", "actorName")
    VALUES (${randomUUID()}, ${organization.id}, ${opportunityId}, ${type}, ${text}, ${actor.id}, ${getUserName(actor)})
  `;

  await prisma.$executeRaw`
    UPDATE "SalesOpportunity"
    SET "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = ${organization.id}
      AND id = ${opportunityId}
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
