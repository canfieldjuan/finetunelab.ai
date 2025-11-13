-- =============================================================================
-- Complete Analysis for Job bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5
-- =============================================================================

-- 1. Total metrics count
SELECT COUNT(*) as total_metrics
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- 2. Count training vs evaluation steps
SELECT
  COUNT(CASE WHEN train_loss IS NOT NULL THEN 1 END) as training_steps,
  COUNT(CASE WHEN eval_loss IS NOT NULL THEN 1 END) as evaluation_steps,
  COUNT(CASE WHEN train_loss IS NULL AND eval_loss IS NOT NULL THEN 1 END) as eval_only_steps
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- 3. Get training steps (with train_loss)
SELECT
  step,
  epoch,
  train_loss,
  eval_loss,
  perplexity,
  learning_rate,
  samples_per_second
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND train_loss IS NOT NULL
ORDER BY step DESC
LIMIT 20;

-- 4. Training loss progression (first, middle, last)
WITH numbered_steps AS (
  SELECT
    step,
    train_loss,
    ROW_NUMBER() OVER (ORDER BY step) as rn,
    COUNT(*) OVER () as total
  FROM local_training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
    AND train_loss IS NOT NULL
)
SELECT
  CASE
    WHEN rn = 1 THEN 'First Step'
    WHEN rn = total THEN 'Last Step'
    WHEN rn = total / 2 THEN 'Middle Step'
  END as position,
  step,
  train_loss
FROM numbered_steps
WHERE rn IN (1, total / 2, total)
ORDER BY step;

-- 5. Best and worst eval losses
SELECT
  MIN(eval_loss) as best_eval_loss,
  MAX(eval_loss) as worst_eval_loss,
  AVG(eval_loss) as avg_eval_loss,
  MIN(perplexity) as best_perplexity,
  AVG(perplexity) as avg_perplexity
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND eval_loss IS NOT NULL;

-- 6. Get sample of actual training steps (every 100th step)
SELECT
  step,
  train_loss,
  learning_rate,
  grad_norm,
  samples_per_second
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND train_loss IS NOT NULL
  AND step % 100 = 0
ORDER BY step ASC;

-- 7. Training duration and throughput
SELECT
  MIN(created_at) as training_start,
  MAX(created_at) as training_end,
  MAX(created_at) - MIN(created_at) as total_duration,
  AVG(samples_per_second) as avg_throughput,
  MAX(step) as total_steps
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';

-- 8. Loss improvement calculation
WITH first_train AS (
  SELECT train_loss as initial_loss
  FROM local_training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
    AND train_loss IS NOT NULL
  ORDER BY step ASC
  LIMIT 1
),
last_train AS (
  SELECT train_loss as final_loss
  FROM local_training_metrics
  WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
    AND train_loss IS NOT NULL
  ORDER BY step DESC
  LIMIT 1
)
SELECT
  initial_loss,
  final_loss,
  (initial_loss - final_loss) as improvement,
  ((initial_loss - final_loss) / initial_loss * 100) as improvement_percent
FROM first_train, last_train;

-- 9. Check if all eval metrics are identical (suspicious)
SELECT
  COUNT(DISTINCT eval_loss) as unique_eval_losses,
  COUNT(DISTINCT perplexity) as unique_perplexities
FROM local_training_metrics
WHERE job_id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5'
  AND eval_loss IS NOT NULL;

-- 10. Get job details from local_training_jobs
SELECT
  id,
  status,
  model_name,
  started_at,
  completed_at,
  error_message,
  config->'training'->>'num_train_epochs' as epochs,
  config->'training'->>'batch_size' as batch_size,
  config->'training'->>'learning_rate' as learning_rate,
  config->'model'->>'model_id' as model_id
FROM local_training_jobs
WHERE id = 'bd5c0fe9-e0b0-433f-8a9b-c24d7ab1d7c5';
