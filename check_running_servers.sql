-- Check what vLLM servers are currently running
SELECT
  id,
  name,
  server_type,
  base_url,
  port,
  model_name,
  model_path,
  status,
  process_id,
  started_at
FROM inference_servers
WHERE server_type = 'vllm'
ORDER BY started_at DESC;
