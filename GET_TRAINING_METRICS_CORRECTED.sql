-- =============================================================================
-- SQL Queries to Get Training Metrics - CORRECTED TABLE NAMES
-- Run these in Supabase Dashboard > SQL Editor
-- Job ID: bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5
-- =============================================================================

-- STEP 1: Check which table has the data
-- =============================================================================
-- Check local_training_metrics
SELECT 'local_training_metrics' as table_name, COUNT(*) as metric_count
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'

UNION ALL

-- Check training_metrics
SELECT 'training_metrics' as table_name, COUNT(*) as metric_count
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- =============================================================================
-- QUERY SET A: For local_training_metrics table
-- =============================================================================

-- A1: Count total metrics in local_training_metrics
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
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- A2: Get ALL metrics from local_training_metrics (ordered by step)
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
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
ORDER BY step ASC;

-- A3: Get LAST 20 training steps from local_training_metrics
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
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
ORDER BY step DESC
LIMIT 20;

-- A4: Training Loss Statistics from local_training_metrics
-- =============================================================================
SELECT
  COUNT(*) as total_steps,
  MIN(train_loss) as best_train_loss,
  MAX(train_loss) as worst_train_loss,
  AVG(train_loss) as avg_train_loss,
  STDDEV(train_loss) as stddev_train_loss,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY train_loss) as median_train_loss
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND train_loss IS NOT NULL;

-- A5: Eval Loss Statistics from local_training_metrics
-- =============================================================================
SELECT
  COUNT(*) as total_evals,
  MIN(eval_loss) as best_eval_loss,
  MAX(eval_loss) as worst_eval_loss,
  AVG(eval_loss) as avg_eval_loss,
  STDDEV(eval_loss) as stddev_eval_loss,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eval_loss) as median_eval_loss
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND eval_loss IS NOT NULL;

-- A6: Training Progression by Epoch from local_training_metrics
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
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
GROUP BY epoch
ORDER BY epoch ASC;

-- A7: Find Best Checkpoint from local_training_metrics
-- =============================================================================
SELECT
  step,
  epoch,
  train_loss,
  eval_loss,
  perplexity,
  learning_rate,
  created_at
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND eval_loss IS NOT NULL
ORDER BY eval_loss ASC
LIMIT 5;

-- A8: GPU Memory Usage Statistics from local_training_metrics
-- =============================================================================
SELECT
  AVG(gpu_memory_allocated_gb) as avg_memory_allocated,
  MAX(gpu_memory_allocated_gb) as peak_memory_allocated,
  MIN(gpu_memory_allocated_gb) as min_memory_allocated,
  AVG(gpu_memory_reserved_gb) as avg_memory_reserved,
  MAX(gpu_memory_reserved_gb) as peak_memory_reserved,
  AVG(gpu_utilization_percent) as avg_gpu_util,
  MAX(gpu_utilization_percent) as peak_gpu_util
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- A9: Loss Improvement Over Time from local_training_metrics
-- =============================================================================
WITH first_last AS (
  SELECT
    MIN(step) as first_step,
    MAX(step) as last_step
  FROM local_training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
),
first_loss AS (
  SELECT train_loss as initial_train_loss, eval_loss as initial_eval_loss
  FROM local_training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
    AND step = (SELECT first_step FROM first_last)
  LIMIT 1
),
last_loss AS (
  SELECT train_loss as final_train_loss, eval_loss as final_eval_loss
  FROM local_training_metrics
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
  CASE
    WHEN f.initial_eval_loss IS NOT NULL AND f.initial_eval_loss > 0
    THEN ((f.initial_eval_loss - l.final_eval_loss) / f.initial_eval_loss * 100)
    ELSE NULL
  END as eval_loss_improvement_percent
FROM first_loss f, last_loss l;

-- =============================================================================
-- QUERY SET B: For training_metrics table
-- (Same queries as above but using training_metrics table)
-- =============================================================================

-- B1: Count total metrics in training_metrics
-- =============================================================================
SELECT
  COUNT(*) as total_metrics,
  COUNT(CASE WHEN train_loss IS NOT NULL THEN 1 END) as train_loss_count,
  COUNT(CASE WHEN eval_loss IS NOT NULL THEN 1 END) as eval_loss_count,
  MIN(step) as first_step,
  MAX(step) as last_step,
  MIN(epoch) as first_epoch,
  MAX(epoch) as last_epoch
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- B2: Get LAST 20 training steps from training_metrics
-- =============================================================================
SELECT
  step,
  epoch,
  train_loss,
  eval_loss,
  perplexity,
  learning_rate,
  samples_per_second,
  created_at
FROM training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
ORDER BY step DESC
LIMIT 20;

-- =============================================================================
-- QUICK REFERENCE COMMANDS
-- =============================================================================

-- Check table structures to see which columns exist:
-- =============================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'local_training_metrics'
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'training_metrics'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- RECOMMENDED QUERY ORDER:
-- =============================================================================
-- 1. Run STEP 1 first to see which table has data
-- 2. If local_training_metrics has data, run Query A1-A9
-- 3. If training_metrics has data, run Query B1-B2
-- 4. Most likely it's local_training_metrics based on naming convention
-- =============================================================================
