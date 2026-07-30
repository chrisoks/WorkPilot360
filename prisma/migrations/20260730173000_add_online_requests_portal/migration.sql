-- CreateTable
CREATE TABLE "OnlineRequestPortal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowedTradeIds" JSONB NOT NULL DEFAULT '[]',
    "notificationUserIds" JSONB NOT NULL DEFAULT '[]',
    "trustedHostnames" JSONB NOT NULL DEFAULT '[]',
    "turnstileSiteKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineRequestPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "clientSubmissionId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "requestType" TEXT NOT NULL,
    "tradeId" TEXT,
    "tradeName" TEXT NOT NULL,
    "recommendationTradeIds" JSONB NOT NULL DEFAULT '[]',
    "recommendationNames" JSONB NOT NULL DEFAULT '[]',
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
    "securitySignals" JSONB NOT NULL DEFAULT '[]',
    "assignedUserId" TEXT,
    "matchedContactId" TEXT,
    "customerDecision" TEXT NOT NULL DEFAULT 'unreviewed',
    "convertedProjectId" TEXT,
    "handledAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineRequestPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "onlineRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineRequestPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineRequestAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "onlineRequestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineRequestAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineRequestPublicSession" (
    "idHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "notBefore" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineRequestPublicSession_pkey" PRIMARY KEY ("idHash")
);

-- CreateTable
CREATE TABLE "OnlineRequestRateLimitBucket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineRequestRateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnlineRequestPortal_slug_key" ON "OnlineRequestPortal"("slug");
CREATE INDEX "OnlineRequestPortal_organizationId_isActive_idx" ON "OnlineRequestPortal"("organizationId", "isActive");
CREATE UNIQUE INDEX "OnlineRequest_organizationId_referenceNumber_key" ON "OnlineRequest"("organizationId", "referenceNumber");
CREATE UNIQUE INDEX "OnlineRequest_portalId_clientSubmissionId_key" ON "OnlineRequest"("portalId", "clientSubmissionId");
CREATE INDEX "OnlineRequest_organizationId_status_createdAt_idx" ON "OnlineRequest"("organizationId", "status", "createdAt");
CREATE INDEX "OnlineRequest_organizationId_matchedContactId_idx" ON "OnlineRequest"("organizationId", "matchedContactId");
CREATE INDEX "OnlineRequest_organizationId_convertedProjectId_idx" ON "OnlineRequest"("organizationId", "convertedProjectId");
CREATE UNIQUE INDEX "OnlineRequestPhoto_onlineRequestId_sortOrder_key" ON "OnlineRequestPhoto"("onlineRequestId", "sortOrder");
CREATE INDEX "OnlineRequestPhoto_organizationId_onlineRequestId_idx" ON "OnlineRequestPhoto"("organizationId", "onlineRequestId");
CREATE INDEX "OnlineRequestAuditEvent_organizationId_onlineRequestId_crea_idx" ON "OnlineRequestAuditEvent"("organizationId", "onlineRequestId", "createdAt");
CREATE INDEX "OnlineRequestPublicSession_organizationId_portalId_expiresA_idx" ON "OnlineRequestPublicSession"("organizationId", "portalId", "expiresAt");
CREATE INDEX "OnlineRequestPublicSession_portalId_ipHash_issuedAt_idx" ON "OnlineRequestPublicSession"("portalId", "ipHash", "issuedAt");
CREATE UNIQUE INDEX "OnlineRequestRateLimitBucket_portalId_ipHash_kind_windowSta_key" ON "OnlineRequestRateLimitBucket"("portalId", "ipHash", "kind", "windowStart");
CREATE INDEX "OnlineRequestRateLimitBucket_organizationId_portalId_kind_w_idx" ON "OnlineRequestRateLimitBucket"("organizationId", "portalId", "kind", "windowStart");

-- AddForeignKey
ALTER TABLE "OnlineRequestPortal" ADD CONSTRAINT "OnlineRequestPortal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequest" ADD CONSTRAINT "OnlineRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequest" ADD CONSTRAINT "OnlineRequest_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "OnlineRequestPortal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestPhoto" ADD CONSTRAINT "OnlineRequestPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestPhoto" ADD CONSTRAINT "OnlineRequestPhoto_onlineRequestId_fkey" FOREIGN KEY ("onlineRequestId") REFERENCES "OnlineRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestAuditEvent" ADD CONSTRAINT "OnlineRequestAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestAuditEvent" ADD CONSTRAINT "OnlineRequestAuditEvent_onlineRequestId_fkey" FOREIGN KEY ("onlineRequestId") REFERENCES "OnlineRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestPublicSession" ADD CONSTRAINT "OnlineRequestPublicSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestPublicSession" ADD CONSTRAINT "OnlineRequestPublicSession_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "OnlineRequestPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestRateLimitBucket" ADD CONSTRAINT "OnlineRequestRateLimitBucket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineRequestRateLimitBucket" ADD CONSTRAINT "OnlineRequestRateLimitBucket_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "OnlineRequestPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
