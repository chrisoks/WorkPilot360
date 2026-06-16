import { prisma } from "@/lib/db/client";

export async function ensureNewsFeedTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "NewsPost" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL DEFAULT '',
      "authorUserId" TEXT,
      "authorName" TEXT NOT NULL DEFAULT '',
      "visibility" TEXT NOT NULL DEFAULT 'all',
      "departmentIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "teamIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "userIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "pollQuestion" TEXT NOT NULL DEFAULT '',
      "pollOptions" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "pollAllowMultiple" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "NewsPost"
    ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "pollQuestion" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "pollOptions" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "pollAllowMultiple" BOOLEAN NOT NULL DEFAULT false
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "NewsPollVote" (
      "organizationId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "optionId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NewsPollVote_pkey" PRIMARY KEY ("postId", "optionId", "userId")
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "NewsComment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "authorUserId" TEXT,
      "authorName" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "NewsReaction" (
      "organizationId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "reaction" TEXT NOT NULL DEFAULT 'up',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NewsReaction_pkey" PRIMARY KEY ("postId", "userId")
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "NewsReadState" (
      "organizationId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NewsReadState_pkey" PRIMARY KEY ("postId", "userId")
    )
  `;
}

export async function ensureSalesHubTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "SalesOpportunity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "customerName" TEXT NOT NULL DEFAULT '',
      "contactId" TEXT,
      "projectId" TEXT,
      "offerId" TEXT,
      "ownerUserId" TEXT,
      "ownerName" TEXT NOT NULL DEFAULT '',
      "stage" TEXT NOT NULL DEFAULT 'lead',
      "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "probability" INTEGER NOT NULL DEFAULT 0,
      "nextAction" TEXT NOT NULL DEFAULT '',
      "nextActionAt" TIMESTAMP(3),
      "source" TEXT NOT NULL DEFAULT '',
      "notes" TEXT NOT NULL DEFAULT '',
      "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "SalesActivity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "opportunityId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'note',
      "body" TEXT NOT NULL,
      "actorUserId" TEXT,
      "actorName" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "SalesTarget" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "contactId" TEXT,
      "projectId" TEXT,
      "customerName" TEXT NOT NULL DEFAULT '',
      "projectLabel" TEXT NOT NULL DEFAULT '',
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "ownerUserId" TEXT,
      "ownerName" TEXT NOT NULL DEFAULT '',
      "priority" TEXT NOT NULL DEFAULT 'normal',
      "metricKey" TEXT NOT NULL DEFAULT '',
      "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "periodStart" TEXT NOT NULL DEFAULT '',
      "periodEnd" TEXT NOT NULL DEFAULT '',
      "targetMonth" TEXT NOT NULL DEFAULT '',
      "followUpAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'open',
      "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "SalesTarget"
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "projectId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "projectLabel" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "ownerName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS "metricKey" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "periodStart" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "periodEnd" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "targetMonth" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "followUpAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CustomerFeedbackRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "invoiceId" TEXT,
      "invoiceNumber" TEXT NOT NULL DEFAULT '',
      "projectId" TEXT,
      "contactId" TEXT,
      "customerName" TEXT NOT NULL DEFAULT '',
      "recipientEmail" TEXT NOT NULL DEFAULT '',
      "salesUserId" TEXT,
      "salesUserName" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'open',
      "sentAt" TIMESTAMP(3),
      "respondedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CustomerFeedbackRequest"
    ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "projectId" TEXT,
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "salesUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "salesUserName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CustomerFeedback" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "requestId" TEXT,
      "invoiceId" TEXT,
      "invoiceNumber" TEXT NOT NULL DEFAULT '',
      "projectId" TEXT,
      "contactId" TEXT,
      "customerName" TEXT NOT NULL DEFAULT '',
      "rating" INTEGER NOT NULL,
      "comment" TEXT NOT NULL DEFAULT '',
      "wantsContact" BOOLEAN NOT NULL DEFAULT false,
      "source" TEXT NOT NULL DEFAULT 'manual',
      "salesUserId" TEXT,
      "salesUserName" TEXT NOT NULL DEFAULT '',
      "hotAlert" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "CustomerFeedback"
    ADD COLUMN IF NOT EXISTS "requestId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "projectId" TEXT,
    ADD COLUMN IF NOT EXISTS "contactId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS "comment" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "wantsContact" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS "salesUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "salesUserName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "hotAlert" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `;

  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}
