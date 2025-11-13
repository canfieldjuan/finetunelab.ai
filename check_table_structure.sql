-- Check columns in local_training_jobs table
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
ORDER BY ordinal_position;

-- Check columns in local_training_metrics table
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'local_training_metrics'
ORDER BY ordinal_position;

-- Quick count of existing data
SELECT 'Jobs' as table_name, COUNT(*) as row_count FROM local_training_jobs
UNION ALL
SELECT 'Metrics' as table_name, COUNT(*) as row_count FROM local_training_metrics;

-- Show recent jobs if any exist
SELECT
    id,
    model_name,
    status,
    total_steps,
    best_eval_loss,
    created_at
FROM local_training_jobs
ORDER BY created_at DESC
LIMIT 5;

-- Show metrics count per job
SELECT
    job_id,
    COUNT(*) as metric_count,
    MIN(step) as first_step,
    MAX(step) as last_step
FROM local_training_metrics
GROUP BY job_id
ORDER BY MAX(created_at) DESC;
