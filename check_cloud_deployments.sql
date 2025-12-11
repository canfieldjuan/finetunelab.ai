-- Check cloud deployments for recent jobs
SELECT
  cd.id,
  cd.job_id,
  cd.platform,
  cd.status as deployment_status,
  cd.deployment_id as pod_id,
  cd.created_at,
  cd.error_message,
  ltj.status as job_status,
  ltj.model_name
FROM cloud_deployments cd
LEFT JOIN local_training_jobs ltj ON cd.job_id = ltj.id
WHERE cd.created_at > NOW() - INTERVAL '24 hours'
ORDER BY cd.created_at DESC
LIMIT 10;

-- Also check the most recent pending job specifically
SELECT
  cd.id,
  cd.platform,
  cd.deployment_id as pod_id,
  cd.status as deployment_status,
  cd.url as pod_url,
  cd.created_at
FROM cloud_deployments cd
WHERE cd.job_id = 'ad01f229-e59d-4284-8180-0e69d92d0c34';
