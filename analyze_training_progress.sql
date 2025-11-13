-- Get the full training history to analyze progress
SELECT 
    metric_name,
    metric_value,
    timestamp,
    metadata->>'step' as step,
    metadata->>'epoch' as epoch
FROM training_metrics
WHERE job_id = '8d0d8022-44ab-425c-87fd-e3f9db795384'
  AND metric_name IN ('loss', 'eval_loss', 'learning_rate', 'grad_norm')
ORDER BY timestamp DESC
LIMIT 100;

-- Summary: Is loss decreasing over time?
WITH loss_over_time AS (
    SELECT 
        metric_value as loss,
        timestamp,
        ROW_NUMBER() OVER (ORDER BY timestamp) as time_order
    FROM training_metrics
    WHERE job_id = '8d0d8022-44ab-425c-87fd-e3f9db795384'
      AND metric_name = 'loss'
)
SELECT 
    MIN(loss) as best_train_loss,
    MAX(loss) as worst_train_loss,
    AVG(loss) as avg_train_loss,
    (SELECT loss FROM loss_over_time WHERE time_order = 1) as first_loss,
    (SELECT loss FROM loss_over_time ORDER BY time_order DESC LIMIT 1) as latest_loss,
    COUNT(*) as total_steps
FROM loss_over_time;

-- Eval loss progression
SELECT 
    metric_value as eval_loss,
    timestamp,
    metadata->>'step' as step
FROM training_metrics
WHERE job_id = '8d0d8022-44ab-425c-87fd-e3f9db795384'
  AND metric_name = 'eval_loss'
ORDER BY timestamp DESC
LIMIT 10;
