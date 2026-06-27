import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { ensureNewsFeedTables } from "@/lib/sales-hub/ensure";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

export async function POST(req: Request) {
  await ensureNewsFeedTables();
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((candidate) => candidate.id === cleanString(body.actorId)) ?? user;
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
