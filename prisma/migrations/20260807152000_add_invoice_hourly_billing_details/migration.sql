ALTER TABLE "InvoiceLine"
  ADD COLUMN IF NOT EXISTS "hourlyBillingDetails" JSONB NOT NULL DEFAULT '[]'::jsonb;
