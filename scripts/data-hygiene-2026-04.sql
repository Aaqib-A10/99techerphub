-- Data hygiene migration — 2026-04-30
--
-- Adds DB-level invariants matching app-level rules. Prisma's schema language
-- can't express partial unique indexes, so this lives outside schema.prisma.
--
-- HOW TO APPLY (idempotent — safe to run twice):
--   psql "$DATABASE_URL" -f scripts/data-hygiene-2026-04.sql
-- On the prod server:
--   psql -U erp -d ninety9tech_erp -f scripts/data-hygiene-2026-04.sql
--
-- If the safety check below aborts with "multiple open assignments", run:
--   SELECT "assetId", COUNT(*)
--   FROM asset_assignments
--   WHERE "returnedDate" IS NULL
--   GROUP BY "assetId"
--   HAVING COUNT(*) > 1;
-- Then return all-but-one of the duplicate open assignments before re-running.

-- ----------------------------------------------------------------
-- 1. Refuse to install the unique index if duplicates already exist.
-- ----------------------------------------------------------------
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT "assetId"
    FROM asset_assignments
    WHERE "returnedDate" IS NULL
    GROUP BY "assetId"
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Aborting: % asset(s) currently have multiple open assignments. '
      'Resolve duplicates before applying this migration.',
      dup_count;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 2. Partial unique index: an asset can have at most one open assignment.
--    The app-layer check at app/api/assets/[id]/assign/route.ts is now
--    backed by a DB constraint, so a transaction bug can't bypass it.
-- ----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS asset_assignments_asset_open_unique
  ON asset_assignments ("assetId")
  WHERE "returnedDate" IS NULL;
