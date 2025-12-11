-- Check the currently running job's metrics
SELECT
  id,
  status,
  current_step,
  total_steps,
  current_epoch,
  total_epochs,
  loss,
  eval_loss,
  train_perplexity,
  learning_rate,
  progress,
  gpu_memory_allocated_gb,
  elapsed_seconds,
  remaining_seconds,
  loss_trend,
  best_eval_loss,
  epochs_without_improvement,
  total_samples,
  train_samples,
  val_samples
FROM local_training_jobs
WHERE status = 'training'
  OR (created_at > NOW() - INTERVAL '1 hour' AND status IN ('pending', 'running'))
ORDER BY created_at DESC
LIMIT 1;
