-- Get latest training metrics for health check
SELECT 
  step,
  epoch,
  ROUND(train_loss::numeric, 4) as train_loss,
  ROUND(eval_loss::numeric, 4) as eval_loss,
  ROUND(learning_rate::numeric, 8) as learning_rate,
  ROUND(grad_norm::numeric, 4) as grad_norm,
  ROUND(gpu_utilization_percent::numeric, 1) as gpu_util,
  ROUND(samples_per_second::numeric, 2) as samples_per_sec,
  ROUND(perplexity::numeric, 2) as perplexity
FROM local_training_metrics 
WHERE job_id = (
  SELECT id FROM local_training_jobs 
  WHERE status IN ('running', 'completed')
  ORDER BY created_at DESC 
  LIMIT 1
)
ORDER BY step
LIMIT 50;

-- Get training job config
SELECT 
  id,
  status,
  model_name,
  current_step,
  total_steps,
  current_epoch,
  total_epochs,
  ROUND(progress::numeric, 2) as progress,
  ROUND(learning_rate::numeric, 8) as current_lr,
  batch_size,
  gradient_accumulation_steps,
  ROUND(best_eval_loss::numeric, 4) as best_eval_loss,
  best_epoch,
  epochs_without_improvement
FROM local_training_jobs 
WHERE status IN ('running', 'completed')
ORDER BY created_at DESC 
LIMIT 1;
