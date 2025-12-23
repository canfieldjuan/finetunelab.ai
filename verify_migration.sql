-- Verify columns exist and check a recent trace
SELECT 
  api_endpoint,
  streaming_enabled,
  inference_time_ms,
  queue_time_ms,
  context_tokens,
  provider_request_id,
  created_at,
  trace_id
FROM llm_traces 
ORDER BY created_at DESC 
LIMIT 1;
