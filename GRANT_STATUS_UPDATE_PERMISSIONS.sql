-- Grant UPDATE permission on status-related columns
-- This allows training scripts to update job status, timestamps, and errors

GRANT UPDATE (
  total_steps,
  status,
  started_at,
  completed_at,
  error_message
) ON local_training_jobs TO anon, authenticated;

-- Verify permissions
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'local_training_jobs'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'UPDATE';
