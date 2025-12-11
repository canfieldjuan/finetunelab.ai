-- Check if job_token exists in the database
SELECT
  id,
  job_token,
  CASE
    WHEN job_token IS NULL THEN '❌ NO TOKEN - RLS will block updates'
    WHEN job_token IS NOT NULL THEN '✅ Token exists - RLS should allow updates'
  END as token_status,
  user_id,
  status,
  created_at,
  updated_at
FROM local_training_jobs
WHERE id = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11';
