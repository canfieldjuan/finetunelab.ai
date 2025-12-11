-- Check actual column types for conversations and messages tables
-- Run this in Supabase SQL Editor to verify types

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('conversations', 'messages')
AND column_name = 'id'
ORDER BY table_name, column_name;
