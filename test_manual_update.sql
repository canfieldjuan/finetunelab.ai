-- Test manual update to verify permissions are working
-- This simulates what the training pod is doing

-- First, check current values
SELECT id, current_step, loss, progress, updated_at
FROM local_training_jobs
WHERE id = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11';

-- Try to update as if we're the anon role with the correct token
-- Note: This runs as service_role in SQL editor, but let's verify the row can be updated

UPDATE local_training_jobs
SET
  current_step = 999,
  loss = 1.234,
  progress = 0.75,
  updated_at = NOW()
WHERE id = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11'
  AND job_token = 'ZDyUtonqeuT6DFwBK5WERTHr-I22R81AZ6UOJcNfHKA';

-- Check if update worked
SELECT id, current_step, loss, progress, updated_at
FROM local_training_jobs
WHERE id = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11';

-- If the above worked, the issue is with the anon role permissions, not the query itself
