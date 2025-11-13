-- Check the realtime schema configuration
SELECT 
  nspname,
  nspowner::regrole
FROM pg_namespace
WHERE nspname = 'realtime';

-- Check what extensions are installed (Realtime might need specific ones)
SELECT 
  extname,
  extversion
FROM pg_extension
WHERE extname LIKE '%wal%' OR extname LIKE '%realtime%' OR extname LIKE '%logical%';

-- Check if there are any check constraints on realtime.subscription that might prevent inserts
SELECT
  conname,
  contype,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'realtime.subscription'::regclass;
