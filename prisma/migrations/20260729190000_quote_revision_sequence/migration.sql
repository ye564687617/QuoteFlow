-- Keep revision numbers monotonic even when a previous revision was deleted.
ALTER TABLE "QuoteSeries"
  ADD COLUMN "nextRevisionNumber" INTEGER NOT NULL DEFAULT 2;

UPDATE "QuoteSeries" series
SET "nextRevisionNumber" = COALESCE((
  SELECT MAX(revision."revisionNumber") + 1
  FROM "QuoteRevision" revision
  WHERE revision."seriesId" = series."id"
), 2);
