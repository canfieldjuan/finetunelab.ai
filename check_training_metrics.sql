-- Check the actual training metrics for this job
-- This will show you the real-time training performance

-- STEP 1: Find all tables related to training
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%training%'
  OR table_name LIKE '%metric%'
ORDER BY table_name;

-- STEP 2: See the structure of training_metrics table (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'training_metrics'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- STEP 3: Alternative - check local_training_jobs table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- STEP 4: Get recent metrics in readable format
-- Since metrics are stored in key-value format, we need to pivot them
SELECT 
    timestamp,
    MAX(CASE WHEN metric_name = 'loss' THEN metric_value END) as train_loss,
    MAX(CASE WHEN metric_name = 'eval_loss' THEN metric_value END) as eval_loss,
    MAX(CASE WHEN metric_name = 'learning_rate' THEN metric_value END) as learning_rate,
    MAX(CASE WHEN metric_name = 'perplexity' THEN metric_value END) as perplexity,
    MAX(CASE WHEN metric_name = 'epoch' THEN metric_value END) as epoch,
    MAX(CASE WHEN metric_name = 'step' THEN metric_value END) as step
FROM training_metrics
WHERE job_id = '8d0d8022-44ab-425c-87fd-e3f9db795384'
GROUP BY timestamp
ORDER BY timestamp DESC
LIMIT 20;

-- STEP 5: Get all unique metric names for this job
SELECT DISTINCT metric_name, COUNT(*) as count
FROM training_metrics
WHERE job_id = '8d0d8022-44ab-425c-87fd-e3f9db795384'
GROUP BY metric_name
ORDER BY metric_name;

-- STEP 6: Summary statistics
SELECT 
    metric_name,
    COUNT(*) as total_records,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    AVG(metric_value) as avg_value,
    ROUND(STDDEV(metric_value)::numeric, 4) as std_dev
FROM training_metrics
WHERE job_id = '8d0d8022-44ab-425c-87fd-e3f9db795384'
  AND metric_value IS NOT NULL
GROUP BY metric_name
ORDER BY metric_name;

-- Compare with typical 0.6B metrics (if you have old jobs)
-- Qwen3-0.6B typically shows:
--   - Train loss: 3.5-4.5 in early epochs
--   - Eval loss: 3.0-4.0
--   - Perplexity: 40-80
-- 
-- Qwen3-1.7B typically shows:
--   - Train loss: 2.5-3.5 in early epochs
--   - Eval loss: 2.5-3.2
--   - Perplexity: 12-30
