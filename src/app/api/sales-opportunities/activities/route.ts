import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureSalesHubTables } from "@/lib/sales-hub/ensure";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

export async function POST(req: Request) {
  await ensureSalesHubTables();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((candidate) => candidate.id === cleanString(body.actorId)) ?? user;
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
