-- Verify UPDATE permissions were granted on all columns
SELECT
  grantee,
  privilege_type,
  column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'local_training_jobs'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'UPDATE'
ORDER BY grantee, column_name;
