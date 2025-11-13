-- Check all vLLM servers ever deployed
SELECT 
  id,
  server_type,
  name,
  base_url,
  port,
  model_path,
  model_name,
  training_job_id,
  status,
  config_json,
  started_at,
  stopped_at
FROM local_inference_servers
ORDER BY started_at DESC
LIMIT 20;

-- Check if any servers are currently running
SELECT 
  id,
  server_type,
  name,
  base_url,
  port,
  model_path,
  status,
  started_at
FROM local_inference_servers
WHERE status = 'running'
ORDER BY started_at DESC;

-- Check training jobs and their deployments
SELECT 
  tj.id as job_id,
  tj.model_name,
  tj.status as job_status,
  tj.started_at as trained_at,
  lis.id as server_id,
  lis.server_type,
  lis.base_url,
  lis.port,
  lis.model_path,
  lis.status as server_status,
  lis.started_at as deployed_at
FROM local_training_jobs tj
LEFT JOIN local_inference_servers lis ON lis.training_job_id = tj.id
WHERE tj.status = 'completed'
ORDER BY tj.started_at DESC
LIMIT 10;

-- Check model paths patterns
SELECT DISTINCT 
  model_path,
  model_name,
  server_type,
  config_json,
  started_at
FROM local_inference_servers
WHERE model_path IS NOT NULL
ORDER BY started_at DESC
LIMIT 20;

-- Check external vs internal vLLM deployments
SELECT 
  server_type,
  CASE 
    WHEN config_json->>'external' = 'true' THEN 'External (Docker/Remote)'
    WHEN process_id IS NULL THEN 'External (No PID)'
    ELSE 'Internal (Spawned Process)'
  END as deployment_type,
  COUNT(*) as count,
  MAX(started_at) as last_deployment
FROM local_inference_servers
GROUP BY server_type, deployment_type
ORDER BY server_type, deployment_type;
