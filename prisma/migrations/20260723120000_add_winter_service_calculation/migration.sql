CREATE TABLE "WinterServiceCalculation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "generatedPackageIds" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WinterServiceCalculation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WinterServiceCalculation_organizationId_seriesId_version_key"
    ON "WinterServiceCalculation"("organizationId", "seriesId", "version");

CREATE INDEX "WinterServiceCalculation_organizationId_customerId_createdAt_idx"
    ON "WinterServiceCalculation"("organizationId", "customerId", "createdAt");

CREATE INDEX "WinterServiceCalculation_organizationId_projectId_createdAt_idx"
    ON "WinterServiceCalculation"("organizationId", "projectId", "createdAt");

CREATE INDEX "WinterServiceCalculation_organizationId_createdAt_idx"
    ON "WinterServiceCalculation"("organizationId", "createdAt");
