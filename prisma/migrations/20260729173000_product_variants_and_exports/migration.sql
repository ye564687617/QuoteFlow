DROP INDEX IF EXISTS "Product_pnNormalized_key";
DROP INDEX IF EXISTS "Product_archivedAt_pnNormalized_idx";

ALTER TABLE "Product"
  DROP COLUMN "category",
  ADD COLUMN "descriptionNormalized" TEXT,
  ADD COLUMN "variantLabel" TEXT,
  ADD COLUMN "regularPriceUsd" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- Keep existing products usable when upgrading an already populated database.
UPDATE "Product"
SET
  "descriptionNormalized" = lower(regexp_replace(trim("description"), '\\s+', ' ', 'g')),
  "variantLabel" = COALESCE((regexp_match("description", '([0-9]+(?:\\.[0-9]+)?[[:space:]]*[Ww])'))[1], 'Variant');

ALTER TABLE "Product"
  ALTER COLUMN "descriptionNormalized" SET NOT NULL,
  ALTER COLUMN "variantLabel" SET NOT NULL;

ALTER TABLE "QuoteRevision"
  DROP COLUMN "shippingNote",
  DROP COLUMN "exportedPath";

ALTER TABLE "QuoteItem"
  ADD COLUMN "variantLabelSnapshot" TEXT;

ALTER TABLE "ExportJob"
  DROP COLUMN "outputPath",
  ADD COLUMN "pngNoBankPath" TEXT,
  ADD COLUMN "pngWithBankPath" TEXT,
  ADD COLUMN "pdfNoBankPath" TEXT,
  ADD COLUMN "pdfWithBankPath" TEXT;

CREATE INDEX "Product_archivedAt_pnNormalized_idx" ON "Product"("archivedAt", "pnNormalized");
CREATE INDEX "Product_pnNormalized_descriptionNormalized_idx" ON "Product"("pnNormalized", "descriptionNormalized");
