-- =============================================================================
-- SQL Queries to Get Training Metrics
-- Run these in Supabase Dashboard > SQL Editor
-- Job ID: bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5
-- =============================================================================

-- Query 1: Count total metrics for this job
-- =============================================================================
SELECT
  COUNT(*) as total_metrics,
  COUNT(CASE WHEN train_loss IS NOT NULL THEN 1 END) as train_loss_count,
  COUNT(CASE WHEN eval_loss IS NOT NULL THEN 1 END) as eval_loss_count,
  MIN(step) as first_step,
  MAX(step) as last_step,
  MIN(epoch) as first_epoch,
  MAX(epoch) as last_epoch,
  MIN(created_at) as first_recorded,
  MAX(created_at) as last_recorded
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- Query 2: Get ALL metrics for the job (ordered by step)
-- =============================================================================
SELECT
  step,
  epoch,
  train_loss,
  eval_loss,
  perplexity,
  learning_rate,
  grad_norm,
  gpu_memory_allocated_gb,
  gpu_memory_reserved_gb,
  gpu_utilization_percent,
  samples_per_second,
  created_at
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
ORDER BY step ASC;

-- Query 3: Get LAST 20 training steps
-- =============================================================================
SELECT
  step,
  epoch,
  train_loss,
  eval_loss,
  perplexity,
  learning_rate,
  grad_norm,
  samples_per_second,
  created_at
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
ORDER BY step DESC
LIMIT 20;

-- Query 4: Training Loss Statistics
-- =============================================================================
SELECT
  COUNT(*) as total_steps,
  MIN(train_loss) as best_train_loss,
  MAX(train_loss) as worst_train_loss,
  AVG(train_loss) as avg_train_loss,
  STDDEV(train_loss) as stddev_train_loss,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY train_loss) as median_train_loss
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND train_loss IS NOT NULL;

-- Query 5: Eval Loss Statistics
-- =============================================================================
SELECT
  COUNT(*) as total_evals,
  MIN(eval_loss) as best_eval_loss,
  MAX(eval_loss) as worst_eval_loss,
  AVG(eval_loss) as avg_eval_loss,
  STDDEV(eval_loss) as stddev_eval_loss,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eval_loss) as median_eval_loss
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND eval_loss IS NOT NULL;

-- Query 6: Perplexity Statistics
-- =============================================================================
SELECT
  COUNT(*) as total_records,
  MIN(perplexity) as best_perplexity,
  MAX(perplexity) as worst_perplexity,
  AVG(perplexity) as avg_perplexity,
  STDDEV(perplexity) as stddev_perplexity
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND perplexity IS NOT NULL;

-- Query 7: Training Progression by Epoch
-- =============================================================================
SELECT
  epoch,
  COUNT(*) as steps_in_epoch,
  MIN(train_loss) as best_train_loss,
  MAX(train_loss) as worst_train_loss,
  AVG(train_loss) as avg_train_loss,
  MIN(eval_loss) as best_eval_loss,
  AVG(eval_loss) as avg_eval_loss,
  MIN(perplexity) as best_perplexity,
  AVG(samples_per_second) as avg_throughput
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
GROUP BY epoch
ORDER BY epoch ASC;

-- Query 8: Find Best Checkpoint (lowest eval loss)
-- =============================================================================
SELECT
  step,
  epoch,
  train_loss,
  eval_loss,
  perplexity,
  learning_rate,
  created_at
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND eval_loss IS NOT NULL
ORDER BY eval_loss ASC
LIMIT 5;

-- Query 9: GPU Memory Usage Statistics
-- =============================================================================
SELECT
  AVG(gpu_memory_allocated_gb) as avg_memory_allocated,
  MAX(gpu_memory_allocated_gb) as peak_memory_allocated,
  MIN(gpu_memory_allocated_gb) as min_memory_allocated,
  AVG(gpu_memory_reserved_gb) as avg_memory_reserved,
  MAX(gpu_memory_reserved_gb) as peak_memory_reserved,
  AVG(gpu_utilization_percent) as avg_gpu_util,
  MAX(gpu_utilization_percent) as peak_gpu_util
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- Query 10: Throughput Statistics
-- =============================================================================
SELECT
  AVG(samples_per_second) as avg_throughput,
  MIN(samples_per_second) as min_throughput,
  MAX(samples_per_second) as max_throughput,
  STDDEV(samples_per_second) as stddev_throughput
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND samples_per_second IS NOT NULL;

-- Query 11: Learning Rate Schedule
-- =============================================================================
SELECT
  step,
  epoch,
  learning_rate,
  train_loss
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND learning_rate IS NOT NULL
ORDER BY step ASC;

-- Query 12: Gradient Norm Statistics (check for exploding gradients)
-- =============================================================================
SELECT
  AVG(grad_norm) as avg_grad_norm,
  MIN(grad_norm) as min_grad_norm,
  MAX(grad_norm) as max_grad_norm,
  STDDEV(grad_norm) as stddev_grad_norm,
  COUNT(CASE WHEN grad_norm > 10 THEN 1 END) as high_grad_norm_count
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND grad_norm IS NOT NULL;

-- Query 13: Loss Improvement Over Time
-- =============================================================================
WITH first_last AS (
  SELECT
    MIN(step) as first_step,
    MAX(step) as last_step
  FROM training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
),
first_loss AS (
  SELECT train_loss as initial_train_loss, eval_loss as initial_eval_loss
  FROM training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
    AND step = (SELECT first_step FROM first_last)
  LIMIT 1
),
last_loss AS (
  SELECT train_loss as final_train_loss, eval_loss as final_eval_loss
  FROM training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
    AND step = (SELECT last_step FROM first_last)
  LIMIT 1
)
SELECT
  f.initial_train_loss,
  l.final_train_loss,
  (f.initial_train_loss - l.final_train_loss) as train_loss_improvement,
  ((f.initial_train_loss - l.final_train_loss) / f.initial_train_loss * 100) as train_loss_improvement_percent,
  f.initial_eval_loss,
  l.final_eval_loss,
  (f.initial_eval_loss - l.final_eval_loss) as eval_loss_improvement,
  ((f.initial_eval_loss - l.final_eval_loss) / f.initial_eval_loss * 100) as eval_loss_improvement_percent
FROM first_loss f, last_loss l;

-- Query 14: Export metrics as CSV-friendly format
-- =============================================================================
SELECT
  step,
  epoch,
  ROUND(train_loss::numeric, 6) as train_loss,
  ROUND(eval_loss::numeric, 6) as eval_loss,
  ROUND(perplexity::numeric, 4) as perplexity,
  learning_rate,
  ROUND(grad_norm::numeric, 4) as grad_norm,
  ROUND(gpu_memory_allocated_gb::numeric, 2) as gpu_memory_gb,
  ROUND(gpu_utilization_percent::numeric, 1) as gpu_util_pct,
  ROUND(samples_per_second::numeric, 2) as samples_per_sec,
  created_at
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
ORDER BY step ASC;

-- Query 15: Timeline - Every 10th step for overview
-- =============================================================================
SELECT
  step,
  epoch,
  train_loss,
  eval_loss,
  perplexity,
  learning_rate,
  samples_per_second
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND step % 10 = 0
ORDER BY step ASC;

-- =============================================================================
-- INSTRUCTIONS:
-- =============================================================================
-- 1. Run Query 1 first to verify metrics exist
-- 2. Run Query 2 to get ALL raw metrics (may be large!)
-- 3. Run Query 3 for most recent 20 steps
-- 4. Run Query 4-6 for statistical summaries
-- 5. Run Query 7 for epoch-by-epoch breakdown
-- 6. Run Query 8 to find best checkpoint
-- 7. Run Query 13 to see overall improvement
-- 8. Run Query 14 to export data (copy/paste to spreadsheet)
-- =============================================================================

-- =============================================================================
-- QUICK DIAGNOSTIC QUERY
-- =============================================================================
-- Run this FIRST to see if metrics exist at all:
SELECT COUNT(*) FROM training_metrics WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';
