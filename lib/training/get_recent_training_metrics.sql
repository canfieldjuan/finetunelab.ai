-- ============================================================================
-- Get Last Two Successful Training Jobs
-- Purpose: Retrieve metrics from Qwen 0.6B and 1.7B model trainings
-- Date: 2025-11-01
-- ============================================================================

-- Step 1: Find the last two completed training jobs
-- (One should be 0.6B, one should be 1.7B)
SELECT 
  id,
  model_name,
  status,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at))/60 as duration_minutes,
  total_epochs,
  total_steps,
  final_loss,
  final_eval_loss,
  best_eval_loss,
  best_epoch,
  best_step,
  config
FROM local_training_jobs
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 5;

-- ============================================================================
-- Step 2: Get detailed metrics for specific job
-- Replace 'YOUR_JOB_ID_HERE' with the actual job_id from Step 1
-- ============================================================================

-- For Qwen 0.6B model (replace job_id)
SELECT 
  j.id as job_id,
  j.model_name,
  j.total_epochs,
  j.total_steps,
  j.final_loss,
  j.final_eval_loss,
  j.best_eval_loss,
  j.best_epoch,
  j.best_step,
  COUNT(m.id) as total_metric_points,
  MIN(m.train_loss) as min_train_loss,
  MAX(m.train_loss) as max_train_loss,
  AVG(m.train_loss) as avg_train_loss,
  MIN(m.eval_loss) as min_eval_loss,
  MAX(m.eval_loss) as max_eval_loss,
  AVG(m.eval_loss) as avg_eval_loss,
  AVG(m.learning_rate) as avg_learning_rate,
  AVG(m.gpu_memory_allocated_gb) as avg_gpu_memory_gb
FROM local_training_jobs j
LEFT JOIN local_training_metrics m ON j.id = m.job_id
WHERE j.id = 'YOUR_QWEN_06B_JOB_ID_HERE'
GROUP BY j.id, j.model_name, j.total_epochs, j.total_steps, 
         j.final_loss, j.final_eval_loss, j.best_eval_loss, 
         j.best_epoch, j.best_step;

-- For Qwen 1.7B model (replace job_id)
SELECT 
  j.id as job_id,
  j.model_name,
  j.total_epochs,
  j.total_steps,
  j.final_loss,
  j.final_eval_loss,
  j.best_eval_loss,
  j.best_epoch,
  j.best_step,
  COUNT(m.id) as total_metric_points,
  MIN(m.train_loss) as min_train_loss,
  MAX(m.train_loss) as max_train_loss,
  AVG(m.train_loss) as avg_train_loss,
  MIN(m.eval_loss) as min_eval_loss,
  MAX(m.eval_loss) as max_eval_loss,
  AVG(m.eval_loss) as avg_eval_loss,
  AVG(m.learning_rate) as avg_learning_rate,
  AVG(m.gpu_memory_allocated_gb) as avg_gpu_memory_gb
FROM local_training_jobs j
LEFT JOIN local_training_metrics m ON j.id = m.job_id
WHERE j.id = 'YOUR_QWEN_17B_JOB_ID_HERE'
GROUP BY j.id, j.model_name, j.total_epochs, j.total_steps, 
         j.final_loss, j.final_eval_loss, j.best_eval_loss, 
         j.best_epoch, j.best_step;

-- ============================================================================
-- Step 3: Get epoch-by-epoch progression for both models
-- ============================================================================

-- Qwen 0.6B - Loss progression by epoch
SELECT 
  epoch,
  COUNT(*) as steps_in_epoch,
  MIN(train_loss) as min_train_loss,
  MAX(train_loss) as max_train_loss,
  AVG(train_loss) as avg_train_loss,
  MIN(eval_loss) as min_eval_loss,
  AVG(eval_loss) as avg_eval_loss,
  AVG(learning_rate) as avg_lr,
  AVG(gpu_memory_allocated_gb) as avg_gpu_mem
FROM local_training_metrics
WHERE job_id = 'YOUR_QWEN_06B_JOB_ID_HERE'
GROUP BY epoch
ORDER BY epoch;

-- Qwen 1.7B - Loss progression by epoch
SELECT 
  epoch,
  COUNT(*) as steps_in_epoch,
  MIN(train_loss) as min_train_loss,
  MAX(train_loss) as max_train_loss,
  AVG(train_loss) as avg_train_loss,
  MIN(eval_loss) as min_eval_loss,
  AVG(eval_loss) as avg_eval_loss,
  AVG(learning_rate) as avg_lr,
  AVG(gpu_memory_allocated_gb) as avg_gpu_mem
FROM local_training_metrics
WHERE job_id = 'YOUR_QWEN_17B_JOB_ID_HERE'
GROUP BY epoch
ORDER BY epoch;

-- ============================================================================
-- Step 4: Get ALL metrics data points for detailed analysis
-- (Use for charting/graphing)
-- ============================================================================

-- Qwen 0.6B - All metric points
SELECT 
  step,
  epoch,
  train_loss,
  eval_loss,
  learning_rate,
  grad_norm,
  gpu_memory_allocated_gb,
  timestamp
FROM local_training_metrics
WHERE job_id = 'YOUR_QWEN_06B_JOB_ID_HERE'
ORDER BY step;

-- Qwen 1.7B - All metric points
SELECT 
  step,
  epoch,
  train_loss,
  eval_loss,
  learning_rate,
  grad_norm,
  gpu_memory_allocated_gb,
  timestamp
FROM local_training_metrics
WHERE job_id = 'YOUR_QWEN_17B_JOB_ID_HERE'
ORDER BY step;

-- ============================================================================
-- Step 5: Compare both models side-by-side
-- ============================================================================

WITH qwen_06b AS (
  SELECT 
    'Qwen 0.6B' as model,
    j.id as job_id,
    j.total_epochs,
    j.total_steps,
    j.final_loss,
    j.final_eval_loss,
    j.best_eval_loss,
    j.best_epoch,
    EXTRACT(EPOCH FROM (j.completed_at - j.started_at))/60 as duration_minutes,
    COUNT(m.id) as metric_points,
    AVG(m.train_loss) as avg_train_loss,
    AVG(m.eval_loss) as avg_eval_loss,
    AVG(m.gpu_memory_allocated_gb) as avg_gpu_memory_gb
  FROM local_training_jobs j
  LEFT JOIN local_training_metrics m ON j.id = m.job_id
  WHERE j.id = 'YOUR_QWEN_06B_JOB_ID_HERE'
  GROUP BY j.id, j.total_epochs, j.total_steps, j.final_loss, 
           j.final_eval_loss, j.best_eval_loss, j.best_epoch,
           j.completed_at, j.started_at
),
qwen_17b AS (
  SELECT 
    'Qwen 1.7B' as model,
    j.id as job_id,
    j.total_epochs,
    j.total_steps,
    j.final_loss,
    j.final_eval_loss,
    j.best_eval_loss,
    j.best_epoch,
    EXTRACT(EPOCH FROM (j.completed_at - j.started_at))/60 as duration_minutes,
    COUNT(m.id) as metric_points,
    AVG(m.train_loss) as avg_train_loss,
    AVG(m.eval_loss) as avg_eval_loss,
    AVG(m.gpu_memory_allocated_gb) as avg_gpu_memory_gb
  FROM local_training_jobs j
  LEFT JOIN local_training_metrics m ON j.id = m.job_id
  WHERE j.id = 'YOUR_QWEN_17B_JOB_ID_HERE'
  GROUP BY j.id, j.total_epochs, j.total_steps, j.final_loss, 
           j.final_eval_loss, j.best_eval_loss, j.best_epoch,
           j.completed_at, j.started_at
)
SELECT * FROM qwen_06b
UNION ALL
SELECT * FROM qwen_17b;

-- ============================================================================
-- Step 6: Find jobs by model name pattern (if you don't know exact IDs)
-- ============================================================================

-- Find Qwen 0.6B jobs
SELECT 
  id,
  model_name,
  status,
  started_at,
  completed_at,
  final_loss,
  best_eval_loss,
  total_epochs,
  total_steps
FROM local_training_jobs
WHERE status = 'completed'
  AND (
    model_name ILIKE '%qwen%0.6%' 
    OR model_name ILIKE '%qwen%06%'
    OR model_name ILIKE '%qwen2%0.5%'
  )
ORDER BY completed_at DESC
LIMIT 3;

-- Find Qwen 1.7B jobs
SELECT 
  id,
  model_name,
  status,
  started_at,
  completed_at,
  final_loss,
  best_eval_loss,
  total_epochs,
  total_steps
FROM local_training_jobs
WHERE status = 'completed'
  AND (
    model_name ILIKE '%qwen%1.7%' 
    OR model_name ILIKE '%qwen%17%'
    OR model_name ILIKE '%qwen2%1.5%'
  )
ORDER BY completed_at DESC
LIMIT 3;

-- ============================================================================
-- USAGE INSTRUCTIONS:
-- ============================================================================
-- 1. Run Step 1 to see all recent completed jobs
-- 2. Run Step 6 to find jobs by model name pattern
-- 3. Copy the job IDs for your 0.6B and 1.7B models
-- 4. Replace 'YOUR_QWEN_06B_JOB_ID_HERE' and 'YOUR_QWEN_17B_JOB_ID_HERE' 
--    in the other queries
-- 5. Run Steps 2-5 to get detailed metrics and comparisons
-- ============================================================================
