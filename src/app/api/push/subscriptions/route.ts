import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { ensurePushSubscriptionTable } from "@/lib/push/web-push";

type PushSubscriptionBody = {
  userId?: unknown;
  userAgent?: unknown;
  subscription?: {
    endpoint?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readJsonBody(req: Request): Promise<PushSubscriptionBody> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function invalidSubscriptionResponse() {
  return NextResponse.json({ error: "Push-Subscription ist unvollständig." }, { status: 400 });
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  const userId = cleanString(body.userId);
  const endpoint = cleanString(body.subscription?.endpoint);
  const p256dh = cleanString(body.subscription?.keys?.p256dh);
  const auth = cleanString(body.subscription?.keys?.auth);
  const userAgent = cleanString(body.userAgent || req.headers.get("user-agent"));

  if (!userId || !endpoint || !p256dh || !auth) {
    return invalidSubscriptionResponse();
  }

  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, userId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  await ensurePushSubscriptionTable();
  await prisma.$executeRaw`
    INSERT INTO "PushSubscription" (
      "id", "organizationId", "userId", "endpoint", "p256dh", "auth", "userAgent", "createdAt", "updatedAt"
    )
    VALUES (
      ${randomUUID()}, ${organization.id}, ${actorResult.actor.id}, ${endpoint}, ${p256dh}, ${auth},
      ${userAgent || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "endpoint") DO UPDATE SET
      "organizationId" = EXCLUDED."organizationId",
      "p256dh" = EXCLUDED."p256dh",
      "auth" = EXCLUDED."auth",
      "userAgent" = EXCLUDED."userAgent",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const body = await readJsonBody(req);
  const userId = cleanString(body.userId);
  const endpoint = cleanString(body.subscription?.endpoint || (body as Record<string, unknown>).endpoint);

  if (!userId || !endpoint) {
    return invalidSubscriptionResponse();
  }

  const { users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, userId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }

  await ensurePushSubscriptionTable();
  await prisma.$executeRaw`
    DELETE FROM "PushSubscription"
    WHERE "userId" = ${actorResult.actor.id}
      AND "endpoint" = ${endpoint}
  `;

  return NextResponse.json({ success: true });
}
