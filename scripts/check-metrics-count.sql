-- Check how many metrics exist for the job
-- Replace 'YOUR_JOB_ID' with your actual job ID

-- Count total metrics
SELECT COUNT(*) as total_metrics
FROM local_training_metrics
WHERE job_id = '13e9416f-65d6-4d1e-8757-0980cb6fb77f';

-- See all metrics with details
SELECT 
  step,
  epoch,
  train_loss,
  eval_loss,
  learning_rate,
  gpu_utilization_percent,
  gpu_memory_allocated_gb,
  created_at
FROM local_training_metrics
WHERE job_id = '13e9416f-65d6-4d1e-8757-0980cb6fb77f'
ORDER BY step ASC;

-- Check if RLS is blocking some metrics
SET ROLE anon;
SELECT COUNT(*) as metrics_visible_to_anon
FROM local_training_metrics
WHERE job_id = '13e9416f-65d6-4d1e-8757-0980cb6fb77f';
RESET ROLE;

-- Check the training job details
SELECT 
  id,
  status,
  current_step,
  total_steps,
  user_id,
  created_at
FROM local_training_jobs
WHERE id = '13e9416f-65d6-4d1e-8757-0980cb6fb77f';
