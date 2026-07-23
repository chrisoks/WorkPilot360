CREATE TABLE "CatalogInventoryMovement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "catalogItemId" TEXT NOT NULL,
  "movementType" TEXT NOT NULL,
  "quantityDelta" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "referenceType" TEXT NOT NULL DEFAULT '',
  "referenceId" TEXT NOT NULL DEFAULT '',
  "referenceNumber" TEXT NOT NULL DEFAULT '',
  "customerId" TEXT NOT NULL DEFAULT '',
  "customerName" TEXT NOT NULL DEFAULT '',
  "projectId" TEXT NOT NULL DEFAULT '',
  "projectNumber" TEXT NOT NULL DEFAULT '',
  "invoiceId" TEXT NOT NULL DEFAULT '',
  "invoiceNumber" TEXT NOT NULL DEFAULT '',
  "actorUserId" TEXT,
  "actorName" TEXT NOT NULL DEFAULT '',
  "supplierName" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogInventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogInventoryMovement_organizationId_catalogItemId_occurredAt_idx"
  ON "CatalogInventoryMovement"("organizationId", "catalogItemId", "occurredAt");
CREATE INDEX "CatalogInventoryMovement_organizationId_customerId_occurredAt_idx"
  ON "CatalogInventoryMovement"("organizationId", "customerId", "occurredAt");
CREATE INDEX "CatalogInventoryMovement_organizationId_referenceType_referenceId_idx"
  ON "CatalogInventoryMovement"("organizationId", "referenceType", "referenceId");
CREATE INDEX "CatalogInventoryMovement_organizationId_invoiceId_idx"
  ON "CatalogInventoryMovement"("organizationId", "invoiceId");

ALTER TABLE "CatalogInventoryMovement"
  ADD CONSTRAINT "CatalogInventoryMovement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogInventoryMovement"
  ADD CONSTRAINT "CatalogInventoryMovement_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
