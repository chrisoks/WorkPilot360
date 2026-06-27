import webPush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "@/lib/db/client";

type PushPayload = {
  title: string;
  body: string;
  notificationId: string;
  linkTarget: string;
  linkTargetId: string;
  url: string;
};

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_PUBLIC_KEY || "";
}

function getVapidPrivateKey() {
  return process.env.VAPID_PRIVATE_KEY || process.env.WEB_PUSH_PRIVATE_KEY || "";
}

function getVapidSubject() {
  return process.env.VAPID_SUBJECT || process.env.WEB_PUSH_SUBJECT || "mailto:info@oks-cloudservices.com";
}

export function getPushStatus() {
  return {
    configured: Boolean(getVapidPublicKey() && getVapidPrivateKey()),
    publicKey: getVapidPublicKey(),
  };
}

function configureVapid() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return false;

  if (!vapidConfigured) {
    webPush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
    vapidConfigured = true;
  }

  return true;
}

export async function ensurePushSubscriptionTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "PushSubscription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL,
      "p256dh" TEXT NOT NULL,
      "auth" TEXT NOT NULL,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "PushSubscription"
    ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "endpoint" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "p256dh" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "auth" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_user_endpoint_key"
    ON "PushSubscription" ("userId", "endpoint")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "PushSubscription_org_user_idx"
    ON "PushSubscription" ("organizationId", "userId")
  `;
}

export async function sendPushToUserSafely(input: {
  organizationId: string;
  userId: string;
  payload: PushPayload;
}) {
  if (!configureVapid()) return;

  try {
    await ensurePushSubscriptionTable();
    const subscriptions = await prisma.$queryRaw<StoredPushSubscription[]>`
      SELECT id, endpoint, p256dh, auth
      FROM "PushSubscription"
      WHERE "organizationId" = ${input.organizationId}
        AND "userId" = ${input.userId}
    `;

    for (const subscription of subscriptions) {
      const webPushSubscription: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      try {
        await webPush.sendNotification(webPushSubscription, JSON.stringify(input.payload));
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : 0;

        if (statusCode === 404 || statusCode === 410) {
          await prisma.$executeRaw`
            DELETE FROM "PushSubscription"
            WHERE "id" = ${subscription.id}
          `;
          continue;
        }

        console.error("Web push could not be sent", error);
      }
    }
  } catch (error) {
    console.error("Web push processing failed", error);
  }
}
