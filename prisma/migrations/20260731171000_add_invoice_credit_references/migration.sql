ALTER TABLE "Invoice"
  ADD COLUMN "sourceInvoiceId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sourceInvoiceNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "correctionReason" TEXT NOT NULL DEFAULT '';

ALTER TABLE "InvoiceLine"
  ADD COLUMN "sourceInvoiceLineId" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Invoice_organizationId_sourceInvoiceId_idx"
  ON "Invoice"("organizationId", "sourceInvoiceId");

CREATE INDEX "InvoiceLine_organizationId_sourceInvoiceLineId_idx"
  ON "InvoiceLine"("organizationId", "sourceInvoiceLineId");
