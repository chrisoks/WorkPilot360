ALTER TABLE "Contact"
  ADD COLUMN IF NOT EXISTS "prospectSince" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "prospectConvertedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Contact_organizationId_category_prospectSince_idx"
  ON "Contact"("organizationId", "category", "prospectSince");
