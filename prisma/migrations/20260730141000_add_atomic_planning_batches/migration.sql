ALTER TABLE "PlanningEntry"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT,
  ADD COLUMN IF NOT EXISTS "overbookingKind" TEXT,
  ADD COLUMN IF NOT EXISTS "overbookingReason" TEXT;

CREATE INDEX IF NOT EXISTS "PlanningEntry_organizationId_batchId_idx"
  ON "PlanningEntry" ("organizationId", "batchId");

CREATE TABLE IF NOT EXISTS "PlanningBatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "actorUserId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "approvalStatus" TEXT NOT NULL,
  "overbookingKind" TEXT,
  "overbookingReason" TEXT,
  "overbookingFingerprint" TEXT,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PlanningBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanningBatch_organizationId_requestId_key"
    UNIQUE ("organizationId", "requestId")
);

CREATE INDEX IF NOT EXISTS "PlanningBatch_organizationId_projectId_createdAt_idx"
  ON "PlanningBatch" ("organizationId", "projectId", "createdAt");
