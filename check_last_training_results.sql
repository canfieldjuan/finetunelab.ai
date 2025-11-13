-- ============================================================================
-- Check Last Training Job Results
-- Purpose: Analyze the most recent training job and its metrics
-- Date: 2025-11-05
-- ============================================================================

-- ============================================================================
-- 1. Get the most recent training job details
-- ============================================================================

SELECT
    id,
    model_name,
    status,
    total_epochs,
    total_steps,
    current_epoch,
    current_step,
    progress,

    -- Loss metrics
    loss as current_loss,
    eval_loss as current_eval_loss,
    best_eval_loss,
    best_epoch,
    best_step,

    -- Training parameters
    learning_rate as current_learning_rate,
    batch_size,
    gradient_accumulation_steps,

    -- Resource usage
    gpu_memory_allocated_gb,
    gpu_memory_reserved_gb,
    gpu_utilization_percent,

    -- Performance
    samples_per_second,

    -- Timing
    started_at,
    completed_at,
    elapsed_seconds,
    remaining_seconds,
    ROUND((EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)::numeric, 2) as total_minutes,

    -- Dataset info
    total_samples,
    train_samples,
    val_samples,

    -- Status
    loss_trend,
    epochs_without_improvement,
    error_message,

    created_at,
    updated_at
FROM local_training_jobs
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================================
-- 2. Get metrics summary for the last job
-- ============================================================================

WITH last_job AS (
    SELECT id, model_name, started_at, completed_at
    FROM local_training_jobs
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    lj.id as job_id,
    lj.model_name,
    lj.started_at,
    lj.completed_at,
    COUNT(*) as total_metrics_captured,
    MIN(ltm.step) as first_step,
    MAX(ltm.step) as last_step,
    MIN(ltm.epoch) as first_epoch,
    MAX(ltm.epoch) as last_epoch,

    -- Loss progression
    ROUND(MIN(ltm.train_loss)::numeric, 4) as min_train_loss,
    ROUND(MAX(ltm.train_loss)::numeric, 4) as max_train_loss,
    ROUND(AVG(ltm.train_loss)::numeric, 4) as avg_train_loss,

    -- Eval loss (if available)
    ROUND(MIN(ltm.eval_loss)::numeric, 4) as min_eval_loss,
    ROUND(MAX(ltm.eval_loss)::numeric, 4) as max_eval_loss,
    ROUND(AVG(ltm.eval_loss)::numeric, 4) as avg_eval_loss,

    -- Learning rate
    ROUND(MIN(ltm.learning_rate)::numeric, 8) as min_lr,
    ROUND(MAX(ltm.learning_rate)::numeric, 8) as max_lr,

    -- GPU usage
    ROUND(AVG(ltm.gpu_memory_allocated_gb)::numeric, 2) as avg_gpu_memory_gb,
    ROUND(MAX(ltm.gpu_utilization_percent)::numeric, 1) as max_gpu_util
FROM last_job lj
LEFT JOIN local_training_metrics ltm ON ltm.job_id = lj.id
GROUP BY lj.id, lj.model_name, lj.started_at, lj.completed_at;

-- ============================================================================
-- 3. Get detailed metrics progression (every 10th step)
-- ============================================================================

WITH last_job AS (
    SELECT id FROM local_training_jobs ORDER BY created_at DESC LIMIT 1
)
SELECT
    step,
    epoch,
    ROUND(train_loss::numeric, 4) as train_loss,
    ROUND(eval_loss::numeric, 4) as eval_loss,
    ROUND(learning_rate::numeric, 8) as learning_rate,
    ROUND(grad_norm::numeric, 4) as grad_norm,
    ROUND(gpu_memory_allocated_gb::numeric, 2) as gpu_memory_gb,
    gpu_utilization_percent,
    ROUND(samples_per_second::numeric, 2) as samples_per_sec,
    timestamp
FROM local_training_metrics
WHERE job_id = (SELECT id FROM last_job)
  AND (step % 10 = 0 OR step = 1)  -- Every 10th step + first step
ORDER BY step ASC;

-- ============================================================================
-- 4. Loss trend analysis - Check if model is improving
-- ============================================================================

WITH last_job AS (
    SELECT id FROM local_training_jobs ORDER BY created_at DESC LIMIT 1
),
metrics_with_moving_avg AS (
    SELECT
        step,
        train_loss,
        AVG(train_loss) OVER (
            ORDER BY step
            ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
        ) as moving_avg_10
    FROM local_training_metrics
    WHERE job_id = (SELECT id FROM last_job)
      AND train_loss IS NOT NULL
)
SELECT
    MIN(step) as step_range_start,
    MAX(step) as step_range_end,
    COUNT(*) as metrics_in_range,
    ROUND(MIN(train_loss)::numeric, 4) as min_loss,
    ROUND(MAX(train_loss)::numeric, 4) as max_loss,
    ROUND(AVG(train_loss)::numeric, 4) as avg_loss,
    ROUND(MIN(moving_avg_10)::numeric, 4) as min_moving_avg,
    ROUND(MAX(moving_avg_10)::numeric, 4) as max_moving_avg,
    ROUND(
        ((MAX(moving_avg_10) - MIN(moving_avg_10)) / NULLIF(MIN(moving_avg_10), 0) * 100)::numeric,
        2
    ) as loss_change_percent
FROM metrics_with_moving_avg;

-- ============================================================================
-- 5. Check metrics coverage - How much data we captured
-- ============================================================================

WITH last_job AS (
    SELECT
        id,
        total_steps,
        current_step,
        status
    FROM local_training_jobs
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    lj.id as job_id,
    lj.status,
    lj.total_steps as expected_total_steps,
    lj.current_step as last_recorded_step,
    COUNT(ltm.id) as metrics_captured,
    ROUND((COUNT(ltm.id)::numeric / NULLIF(lj.total_steps, 0) * 100), 2) as capture_percentage,
    CASE
        WHEN COUNT(ltm.id)::numeric / NULLIF(lj.total_steps, 0) >= 0.80 THEN '✅ Good coverage (80%+)'
        WHEN COUNT(ltm.id)::numeric / NULLIF(lj.total_steps, 0) >= 0.50 THEN '⚠️ Moderate coverage (50-80%)'
        ELSE '❌ Low coverage (<50%)'
    END as coverage_status
FROM last_job lj
LEFT JOIN local_training_metrics ltm ON ltm.job_id = lj.id
GROUP BY lj.id, lj.status, lj.total_steps, lj.current_step;

-- ============================================================================
-- 6. Best checkpoint analysis
-- ============================================================================

WITH last_job AS (
    SELECT id, best_eval_loss, best_epoch, best_step
    FROM local_training_jobs
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    lj.best_epoch,
    lj.best_step,
    ROUND(lj.best_eval_loss::numeric, 4) as best_eval_loss,
    ltm.step as actual_step,
    ROUND(ltm.train_loss::numeric, 4) as train_loss_at_best,
    ROUND(ltm.eval_loss::numeric, 4) as eval_loss_at_best,
    ROUND(ltm.learning_rate::numeric, 8) as lr_at_best,
    ltm.timestamp as recorded_at
FROM last_job lj
LEFT JOIN local_training_metrics ltm ON
    ltm.job_id = lj.id
    AND ltm.step = lj.best_step
LIMIT 1;

-- ============================================================================
-- 7. Training efficiency metrics
-- ============================================================================

WITH last_job AS (
    SELECT
        id,
        total_samples,
        started_at,
        completed_at,
        elapsed_seconds
    FROM local_training_jobs
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    lj.total_samples,
    lj.elapsed_seconds,
    ROUND((lj.elapsed_seconds / 60.0)::numeric, 2) as total_minutes,
    ROUND((lj.elapsed_seconds / 3600.0)::numeric, 2) as total_hours,
    ROUND((lj.total_samples::numeric / NULLIF(lj.elapsed_seconds, 0)), 2) as samples_per_second,
    ROUND((lj.total_samples::numeric / NULLIF(lj.elapsed_seconds / 60.0, 0)), 2) as samples_per_minute,
    AVG(ltm.gpu_utilization_percent) as avg_gpu_utilization,
    MAX(ltm.gpu_memory_allocated_gb) as peak_gpu_memory_gb
FROM last_job lj
LEFT JOIN local_training_metrics ltm ON ltm.job_id = lj.id
GROUP BY lj.total_samples, lj.elapsed_seconds;

-- ============================================================================
-- QUICK ANALYSIS: Run this for a fast overview
-- ============================================================================

-- Uncomment and run for quick results:
/*
WITH last_job AS (
    SELECT * FROM local_training_jobs ORDER BY created_at DESC LIMIT 1
)
SELECT
    'Job ID' as metric, id as value FROM last_job
UNION ALL
SELECT 'Model', model_name FROM last_job
UNION ALL
SELECT 'Status', status FROM last_job
UNION ALL
SELECT 'Progress', ROUND(progress::numeric, 1)::text || '%' FROM last_job
UNION ALL
SELECT 'Steps Completed', current_step::text || ' / ' || total_steps::text FROM last_job
UNION ALL
SELECT 'Final Loss', ROUND(loss::numeric, 4)::text FROM last_job
UNION ALL
SELECT 'Best Eval Loss', ROUND(best_eval_loss::numeric, 4)::text FROM last_job
UNION ALL
SELECT 'Training Time', ROUND((elapsed_seconds / 60.0)::numeric, 1)::text || ' minutes' FROM last_job
UNION ALL
SELECT 'Metrics Captured', (
    SELECT COUNT(*)::text
    FROM local_training_metrics
    WHERE job_id = (SELECT id FROM last_job)
) FROM last_job;
*/
