-- ============================================================================
-- MIGRATION: Add expected_answers column to test_suites table
-- ============================================================================
-- Purpose: Store expected/reference answers for each prompt in test suites
--          to enable answer similarity validation
-- Date: 2025-12-03
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Paste this ENTIRE file
-- 3. Click "RUN"
--
-- ROLLBACK:
-- To undo this migration, run:
--   ALTER TABLE test_suites DROP COLUMN IF EXISTS expected_answers;
-- ============================================================================

-- Add expected_answers column as JSONB array
-- Structure: Array of strings matching the prompts array
-- Example: ["Answer 1", "Answer 2", "Answer 3"]
-- The array index must match the prompts array index
ALTER TABLE test_suites
ADD COLUMN IF NOT EXISTS expected_answers JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN test_suites.expected_answers IS
'Array of expected/reference answers corresponding to prompts array. Index must match prompts.';

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'test_suites'
    AND column_name = 'expected_answers'
  ) THEN
    RAISE NOTICE 'Migration successful: expected_answers column added to test_suites';
  ELSE
    RAISE EXCEPTION 'Migration failed: expected_answers column not found';
  END IF;
END $$;

-- ============================================================================
-- Expected Result: "Migration successful: expected_answers column added to test_suites"
-- ============================================================================
