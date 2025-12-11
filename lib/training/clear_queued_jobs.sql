-- Step 1: Check current jobs with 'queued' status
SELECT id, status, model_name, created_at 
FROM local_training_jobs 
WHERE status = 'queued'
ORDER BY created_at DESC;

-- Step 2: Mark queued jobs as cancelled (recommended - keeps history)
UPDATE local_training_jobs 
SET status = 'cancelled', 
    completed_at = NOW(),
    updated_at = NOW()
WHERE status = 'queued';

-- Step 3: Verify - should return 0 rows
SELECT COUNT(*) as remaining_queued_jobs
FROM local_training_jobs 
WHERE status = 'queued';
