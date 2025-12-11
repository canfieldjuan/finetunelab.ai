-- Check recent cloud deployments
SELECT
  id,
  platform,
  training_config_id,
  deployment_id as pod_id,
  status as deployment_status,
  url as pod_url,
  created_at,
  error_message,
  estimated_cost,
  cost_per_hour
FROM cloud_deployments
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Check if we can find the training job by matching the deployment time
SELECT
  ltj.id as job_id,
  ltj.status as job_status,
  ltj.model_name,
  ltj.created_at as job_created_at,
  cd.deployment_id as pod_id,
  cd.status as deployment_status,
  cd.url as pod_url
FROM local_training_jobs ltj
LEFT JOIN cloud_deployments cd ON DATE_TRUNC('minute', ltj.created_at) = DATE_TRUNC('minute', cd.created_at)
WHERE ltj.created_at > NOW() - INTERVAL '24 hours'
  AND ltj.id IN (
    'ad01f229-e59d-4284-8180-0e69d92d0c34',
    'b31cf612-1cc8-4bbe-acb6-5aff535f6cd8'
  )
ORDER BY ltj.created_at DESC;
