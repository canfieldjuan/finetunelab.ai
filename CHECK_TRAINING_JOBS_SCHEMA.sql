-- ============================================================================
-- CHECK TRAINING JOBS SCHEMA
-- Compare actual database columns vs TypeScript interface expectations
-- ============================================================================

-- Query 1: List ALL columns in local_training_jobs table
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'local_training_jobs'
ORDER BY ordinal_position;

-- Query 2: Count total columns
-- ============================================================================
SELECT COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'local_training_jobs';

-- Query 3: Check for specific columns expected by TypeScript interface
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'id') THEN '✓' ELSE '✗'
  END as id,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'user_id') THEN '✓' ELSE '✗'
  END as user_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'status') THEN '✓' ELSE '✗'
  END as status,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'model_name') THEN '✓' ELSE '✗'
  END as model_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'dataset_path') THEN '✓' ELSE '✗'
  END as dataset_path,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'base_model') THEN '✓' ELSE '✗'
  END as base_model,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'created_at') THEN '✓' ELSE '✗'
  END as created_at,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'started_at') THEN '✓' ELSE '✗'
  END as started_at,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'completed_at') THEN '✓' ELSE '✗'
  END as completed_at,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'updated_at') THEN '✓' ELSE '✗'
  END as updated_at;

-- Query 4: Check Progress Tracking Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'current_step') THEN '✓' ELSE '✗'
  END as current_step,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'current_epoch') THEN '✓' ELSE '✗'
  END as current_epoch,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'total_steps') THEN '✓' ELSE '✗'
  END as total_steps,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'total_epochs') THEN '✓' ELSE '✗'
  END as total_epochs,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'progress') THEN '✓' ELSE '✗'
  END as progress;

-- Query 5: Check Training Parameters Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'learning_rate') THEN '✓' ELSE '✗'
  END as learning_rate,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'batch_size') THEN '✓' ELSE '✗'
  END as batch_size,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'gradient_accumulation_steps') THEN '✓' ELSE '✗'
  END as gradient_accumulation_steps;

-- Query 6: Check Real-Time Metrics Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'loss') THEN '✓' ELSE '✗'
  END as loss,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'eval_loss') THEN '✓' ELSE '✗'
  END as eval_loss,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'grad_norm') THEN '✓' ELSE '✗'
  END as grad_norm,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'perplexity') THEN '✓' ELSE '✗'
  END as perplexity,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'train_perplexity') THEN '✓' ELSE '✗'
  END as train_perplexity;

-- Query 7: Check Resource Metrics Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'gpu_memory_allocated_gb') THEN '✓' ELSE '✗'
  END as gpu_memory_allocated_gb,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'gpu_memory_reserved_gb') THEN '✓' ELSE '✗'
  END as gpu_memory_reserved_gb,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'gpu_utilization_percent') THEN '✓' ELSE '✗'
  END as gpu_utilization_percent,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'samples_per_second') THEN '✓' ELSE '✗'
  END as samples_per_second;

-- Query 8: Check Timing Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'elapsed_seconds') THEN '✓' ELSE '✗'
  END as elapsed_seconds,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'remaining_seconds') THEN '✓' ELSE '✗'
  END as remaining_seconds;

-- Query 9: Check Advanced Metrics Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'epochs_without_improvement') THEN '✓' ELSE '✗'
  END as epochs_without_improvement,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'loss_trend') THEN '✓' ELSE '✗'
  END as loss_trend,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'total_samples') THEN '✓' ELSE '✗'
  END as total_samples,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'train_samples') THEN '✓' ELSE '✗'
  END as train_samples,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'val_samples') THEN '✓' ELSE '✗'
  END as val_samples,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'total_tokens_processed') THEN '✓' ELSE '✗'
  END as total_tokens_processed;

-- Query 10: Check Config and Results Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'config') THEN '✓' ELSE '✗'
  END as config,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'final_loss') THEN '✓' ELSE '✗'
  END as final_loss,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'final_eval_loss') THEN '✓' ELSE '✗'
  END as final_eval_loss,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'best_eval_loss') THEN '✓' ELSE '✗'
  END as best_eval_loss,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'best_epoch') THEN '✓' ELSE '✗'
  END as best_epoch,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'best_step') THEN '✓' ELSE '✗'
  END as best_step,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'best_checkpoint_path') THEN '✓' ELSE '✗'
  END as best_checkpoint_path;

-- Query 11: Check Checkpoint Resumption Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'resumed_from_job_id') THEN '✓' ELSE '✗'
  END as resumed_from_job_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'resumed_from_checkpoint') THEN '✓' ELSE '✗'
  END as resumed_from_checkpoint;

-- Query 12: Check Runtime Parameter Columns
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'max_learning_rate') THEN '✓' ELSE '✗'
  END as max_learning_rate,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'min_learning_rate') THEN '✓' ELSE '✗'
  END as min_learning_rate,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'warmup_steps') THEN '✓' ELSE '✗'
  END as warmup_steps;

-- Query 13: Check Error Tracking Column
-- ============================================================================
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'local_training_jobs' AND column_name = 'error_message') THEN '✓' ELSE '✗'
  END as error_message;

-- Query 14: Find MISSING columns (columns in TypeScript but NOT in database)
-- ============================================================================
WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'id', 'user_id', 'status', 'model_name', 'dataset_path', 'base_model',
    'created_at', 'started_at', 'completed_at', 'updated_at',
    'current_step', 'current_epoch', 'total_steps', 'total_epochs', 'progress',
    'learning_rate', 'batch_size', 'gradient_accumulation_steps',
    'loss', 'eval_loss', 'grad_norm', 'perplexity', 'train_perplexity',
    'gpu_memory_allocated_gb', 'gpu_memory_reserved_gb', 'gpu_utilization_percent', 'samples_per_second',
    'elapsed_seconds', 'remaining_seconds',
    'epochs_without_improvement', 'loss_trend', 'total_samples', 'train_samples', 'val_samples', 'total_tokens_processed',
    'config', 'final_loss', 'final_eval_loss', 'best_eval_loss', 'best_epoch', 'best_step', 'best_checkpoint_path',
    'resumed_from_job_id', 'resumed_from_checkpoint',
    'max_learning_rate', 'min_learning_rate', 'warmup_steps',
    'error_message'
  ]) AS column_name
),
actual_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'local_training_jobs'
)
SELECT
  ec.column_name as missing_column
FROM expected_columns ec
LEFT JOIN actual_columns ac ON ec.column_name = ac.column_name
WHERE ac.column_name IS NULL
ORDER BY ec.column_name;

-- Query 15: Find EXTRA columns (columns in database but NOT expected by TypeScript)
-- ============================================================================
WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'id', 'user_id', 'status', 'model_name', 'dataset_path', 'base_model',
    'created_at', 'started_at', 'completed_at', 'updated_at',
    'current_step', 'current_epoch', 'total_steps', 'total_epochs', 'progress',
    'learning_rate', 'batch_size', 'gradient_accumulation_steps',
    'loss', 'eval_loss', 'grad_norm', 'perplexity', 'train_perplexity',
    'gpu_memory_allocated_gb', 'gpu_memory_reserved_gb', 'gpu_utilization_percent', 'samples_per_second',
    'elapsed_seconds', 'remaining_seconds',
    'epochs_without_improvement', 'loss_trend', 'total_samples', 'train_samples', 'val_samples', 'total_tokens_processed',
    'config', 'final_loss', 'final_eval_loss', 'best_eval_loss', 'best_epoch', 'best_step', 'best_checkpoint_path',
    'resumed_from_job_id', 'resumed_from_checkpoint',
    'max_learning_rate', 'min_learning_rate', 'warmup_steps',
    'error_message'
  ]) AS column_name
),
actual_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'local_training_jobs'
)
SELECT
  ac.column_name as extra_column
FROM actual_columns ac
LEFT JOIN expected_columns ec ON ac.column_name = ec.column_name
WHERE ec.column_name IS NULL
ORDER BY ac.column_name;
