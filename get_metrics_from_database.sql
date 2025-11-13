-- Get all metrics for the latest training job
-- Job ID: f49eed94-4fef-46b1-82f1-56bf4c9aaa5f

-- Full metrics with all columns
SELECT
    id,
    job_id,
    step,
    epoch,
    train_loss,
    eval_loss,
    learning_rate,
    grad_norm,
    gpu_memory_allocated_gb,
    timestamp,
    created_at
FROM local_training_metrics
WHERE job_id = 'f49eed94-4fef-46b1-82f1-56bf4c9aaa5f'
ORDER BY step ASC;

-- Summary view (easier to read)
SELECT
    step,
    epoch,
    ROUND(train_loss::numeric, 4) as train_loss,
    ROUND(eval_loss::numeric, 4) as eval_loss,
    ROUND(learning_rate::numeric, 6) as learning_rate,
    ROUND(gpu_memory_allocated_gb::numeric, 2) as gpu_gb
FROM local_training_metrics
WHERE job_id = 'f49eed94-4fef-46b1-82f1-56bf4c9aaa5f'
ORDER BY step ASC;

-- Compare with old broken job
SELECT
    'OLD (broken)' as version,
    COUNT(*) as total_metrics,
    MIN(step) as first_step,
    MAX(step) as last_step,
    COUNT(DISTINCT step) as unique_steps
FROM local_training_metrics
WHERE job_id = '97bae79d-365f-4f7a-a2c2-b5eb1367c4fa'

UNION ALL

SELECT
    'NEW (fixed)' as version,
    COUNT(*) as total_metrics,
    MIN(step) as first_step,
    MAX(step) as last_step,
    COUNT(DISTINCT step) as unique_steps
FROM local_training_metrics
WHERE job_id = 'f49eed94-4fef-46b1-82f1-56bf4c9aaa5f';

-- Get job metadata along with metrics
SELECT
    j.id as job_id,
    j.model_name,
    j.status,
    j.total_steps,
    j.best_eval_loss,
    j.best_step,
    COUNT(m.id) as metrics_count
FROM local_training_jobs j
LEFT JOIN local_training_metrics m ON j.id = m.job_id
WHERE j.id = 'f49eed94-4fef-46b1-82f1-56bf4c9aaa5f'
GROUP BY j.id, j.model_name, j.status, j.total_steps, j.best_eval_loss, j.best_step;
