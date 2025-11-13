-- Check what the Python training server logged when it started this job
-- This will show us if there were any model loading warnings/errors

-- First, let's see if there are any error logs or warnings in the job
SELECT 
    id,
    model_name,
    status,
    config->'model'->>'name' as model_from_config,
    started_at,
    total_steps,
    final_loss,
    best_eval_loss
FROM local_training_jobs
WHERE id = '8d0d8022-44ab-425c-87fd-e3f9db795384';

-- Check if there are logs table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%log%' OR table_name LIKE '%error%')
ORDER BY table_name;
