import { prisma } from "@/lib/db/client";

let ensureOnlineRequestStoragePromise: Promise<void> | null = null;

async function createOnlineRequestStorage() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OnlineRequestPortal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "slug" TEXT NOT NULL UNIQUE,
      "displayName" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "allowedTradeIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "notificationUserIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "trustedHostnames" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "turnstileSiteKey" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OnlineRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "portalId" TEXT NOT NULL REFERENCES "OnlineRequestPortal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      "referenceNumber" TEXT NOT NULL,
      "clientSubmissionId" TEXT NOT NULL,
      "payloadHash" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'new',
      "requestType" TEXT NOT NULL,
      "tradeId" TEXT,
      "tradeName" TEXT NOT NULL,
      "recommendationTradeIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "recommendationNames" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "desiredDate" TEXT,
      "desiredTimeWindow" TEXT,
      "callbackTimeWindow" TEXT,
      "urgency" TEXT,
      "street" TEXT NOT NULL,
      "postalCode" TEXT NOT NULL,
      "city" TEXT NOT NULL,
      "objectHint" TEXT,
      "description" TEXT NOT NULL,
      "customerKind" TEXT NOT NULL,
      "company" TEXT,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "preferredContact" TEXT NOT NULL,
      "consentAt" TIMESTAMP(3) NOT NULL,
      "submissionIpHash" TEXT NOT NULL,
      "userAgentHash" TEXT,
      "securityScore" INTEGER NOT NULL DEFAULT 0,
      "securitySignals" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "assignedUserId" TEXT,
      "matchedContactId" TEXT,
      "customerDecision" TEXT NOT NULL DEFAULT 'unreviewed',
      "convertedProjectId" TEXT,
      "handledAt" TIMESTAMP(3),
      "convertedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OnlineRequestPhoto" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "onlineRequestId" TEXT NOT NULL REFERENCES "OnlineRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "byteSize" INTEGER NOT NULL,
      "sha256" TEXT NOT NULL,
      "width" INTEGER NOT NULL,
      "height" INTEGER NOT NULL,
      "sortOrder" INTEGER NOT NULL,
      "data" BYTEA NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OnlineRequestAuditEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "onlineRequestId" TEXT NOT NULL REFERENCES "OnlineRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "eventType" TEXT NOT NULL,
      "actorUserId" TEXT,
      "actorName" TEXT NOT NULL,
      "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OnlineRequestPublicSession" (
      "idHash" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "portalId" TEXT NOT NULL REFERENCES "OnlineRequestPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "ipHash" TEXT NOT NULL,
      "issuedAt" TIMESTAMP(3) NOT NULL,
      "notBefore" TIMESTAMP(3) NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "consumedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "OnlineRequestRateLimitBucket" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "portalId" TEXT NOT NULL REFERENCES "OnlineRequestPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "ipHash" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "windowStart" TIMESTAMP(3) NOT NULL,
      "requestCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )
  `;

  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequestPortal_organizationId_isActive_idx" ON "OnlineRequestPortal"("organizationId", "isActive")`;
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "OnlineRequest_organizationId_referenceNumber_key" ON "OnlineRequest"("organizationId", "referenceNumber")`;
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "OnlineRequest_portalId_clientSubmissionId_key" ON "OnlineRequest"("portalId", "clientSubmissionId")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequest_organizationId_status_createdAt_idx" ON "OnlineRequest"("organizationId", "status", "createdAt")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequest_organizationId_matchedContactId_idx" ON "OnlineRequest"("organizationId", "matchedContactId")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequest_organizationId_convertedProjectId_idx" ON "OnlineRequest"("organizationId", "convertedProjectId")`;
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "OnlineRequestPhoto_onlineRequestId_sortOrder_key" ON "OnlineRequestPhoto"("onlineRequestId", "sortOrder")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequestPhoto_organizationId_onlineRequestId_idx" ON "OnlineRequestPhoto"("organizationId", "onlineRequestId")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequestAuditEvent_organizationId_onlineRequestId_crea_idx" ON "OnlineRequestAuditEvent"("organizationId", "onlineRequestId", "createdAt")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequestPublicSession_organizationId_portalId_expiresA_idx" ON "OnlineRequestPublicSession"("organizationId", "portalId", "expiresAt")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequestPublicSession_portalId_ipHash_issuedAt_idx" ON "OnlineRequestPublicSession"("portalId", "ipHash", "issuedAt")`;
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "OnlineRequestRateLimitBucket_portalId_ipHash_kind_windowSta_key" ON "OnlineRequestRateLimitBucket"("portalId", "ipHash", "kind", "windowStart")`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "OnlineRequestRateLimitBucket_organizationId_portalId_kind_w_idx" ON "OnlineRequestRateLimitBucket"("organizationId", "portalId", "kind", "windowStart")`;

  // Runtime DDL predates the formal migration on some environments. Normalize
  // those installations to the exact Prisma datamodel without dropping data.
  await prisma.$executeRaw`ALTER TABLE "OnlineRequest" ALTER COLUMN "updatedAt" DROP DEFAULT`;
  await prisma.$executeRaw`ALTER TABLE "OnlineRequestPortal" ALTER COLUMN "updatedAt" DROP DEFAULT`;
  await prisma.$executeRaw`ALTER TABLE "OnlineRequestRateLimitBucket" ALTER COLUMN "updatedAt" DROP DEFAULT`;
  await prisma.$executeRaw`DROP INDEX IF EXISTS "OnlineRequestAuditEvent_organization_request_created_idx"`;
  await prisma.$executeRaw`DROP INDEX IF EXISTS "OnlineRequestPublicSession_organization_portal_expiry_idx"`;
  await prisma.$executeRaw`DROP INDEX IF EXISTS "OnlineRequestPublicSession_portal_ip_issued_idx"`;
  await prisma.$executeRaw`DROP INDEX IF EXISTS "OnlineRequestRateLimitBucket_portal_ip_kind_window_key"`;
  await prisma.$executeRaw`DROP INDEX IF EXISTS "OnlineRequestRateLimitBucket_org_portal_kind_window_idx"`;
}

export async function ensureOnlineRequestStorage() {
  if (!ensureOnlineRequestStoragePromise) {
    ensureOnlineRequestStoragePromise = createOnlineRequestStorage().catch((error) => {
      ensureOnlineRequestStoragePromise = null;
      throw error;
    });
  }
  return ensureOnlineRequestStoragePromise;
}
