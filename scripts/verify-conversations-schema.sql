-- Verify conversations table schema
-- Run this in Supabase SQL Editor to see all columns and their types

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- Also check if metadata and user_rating columns exist
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'metadata'
    ) THEN '✅ metadata column exists'
    ELSE '❌ metadata column MISSING - need to add it'
  END as metadata_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'user_rating'
    ) THEN '✅ user_rating column exists'
    ELSE '❌ user_rating column MISSING - need to add it'
  END as user_rating_status;
