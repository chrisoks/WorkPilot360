import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureNewsFeedTables } from "@/lib/sales-hub/ensure";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function getRequestActor(users: User[], actorId: unknown) {
  const cleanActorId = cleanString(actorId);
  if (!cleanActorId) return null;
  const actor = users.find((candidate) => candidate.id === cleanActorId);
  return actor?.isActive ? actor : null;
}

function unauthorizedActorResponse() {
  return NextResponse.json({ error: "Aktiver Benutzer erforderlich." }, { status: 401 });
}

export async function POST(req: Request) {
  await ensureNewsFeedTables();
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  const postId = cleanString(body.postId);
  const text = cleanString(body.body);

  if (!postId || !text) {
    return NextResponse.json({ error: "Bitte Beitrag und Kommentar angeben." }, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO "NewsComment" ("id", "organizationId", "postId", "body", "authorUserId", "authorName")
    VALUES (${randomUUID()}, ${organization.id}, ${postId}, ${text}, ${actor.id}, ${getUserName(actor)})
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
