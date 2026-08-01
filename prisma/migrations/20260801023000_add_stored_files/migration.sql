-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 's3',
    "storageBucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "etag" TEXT,
    "lastError" TEXT,
    "createdByUserId" TEXT,
    "availableAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_objectKey_key" ON "StoredFile"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_organizationId_sourceType_sourceEntityId_key"
ON "StoredFile"("organizationId", "sourceType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "StoredFile_organizationId_ownerType_ownerId_status_idx"
ON "StoredFile"("organizationId", "ownerType", "ownerId", "status");

-- CreateIndex
CREATE INDEX "StoredFile_organizationId_status_createdAt_idx"
ON "StoredFile"("organizationId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "StoredFile"
ADD CONSTRAINT "StoredFile_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
