-- Check data types for metrics columns
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
AND column_name IN (
  'current_step',
  'current_epoch',
  'total_steps',
  'total_epochs',
  'progress',
  'loss',
  'eval_loss',
  'learning_rate',
  'grad_norm',
  'samples_per_second',
  'gpu_memory_allocated_gb',
  'gpu_memory_reserved_gb',
  'elapsed_seconds',
  'remaining_seconds'
)
ORDER BY column_name;
