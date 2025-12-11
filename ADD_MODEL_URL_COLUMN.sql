-- ============================================================================
-- ADD MODEL URL COLUMN
-- ============================================================================
-- Purpose: Add column to store HuggingFace model URL after training upload
-- Date: 2025-11-25
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this ENTIRE file
-- 3. Click "RUN"
-- 4. You should see "Success. No rows returned" (this is normal)
-- ============================================================================

-- Add model_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'local_training_jobs'
    AND column_name = 'model_url'
  ) THEN
    ALTER TABLE local_training_jobs ADD COLUMN model_url TEXT;
    RAISE NOTICE 'Added model_url column to local_training_jobs';
  ELSE
    RAISE NOTICE 'model_url column already exists';
  END IF;
END $$;

-- Grant UPDATE permission on the new column
GRANT UPDATE (model_url) ON local_training_jobs TO anon, authenticated;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
  AND column_name = 'model_url';

-- ============================================================================
-- Expected Result: One row showing model_url column exists
-- ============================================================================
