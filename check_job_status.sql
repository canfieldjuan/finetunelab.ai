-- Check current job statuses and their details
SELECT
  id,
  status,
  model_name,
  created_at,
  started_at,
  completed_at,
  error_message,
  current_step,
  total_steps,
  progress
FROM local_training_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Check if there are any cloud deployments for these jobs
SELECT
  ltd.job_id,
  ltd.provider,
  ltd.status as deployment_status,
  ltd.pod_id,
  ltd.created_at,
  ltd.error_message as deployment_error,
  ltj.status as job_status
FROM local_training_deployments ltd
LEFT JOIN local_training_jobs ltj ON ltd.job_id = ltj.id
WHERE ltd.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ltd.created_at DESC
LIMIT 10;
