-- Check if new columns exist in llm_traces table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'llm_traces'
  AND column_name IN (
    'api_endpoint',
    'request_headers_sanitized', 
    'queue_time_ms',
    'inference_time_ms',
    'streaming_enabled',
    'context_tokens',
    'groundedness_score'
  )
ORDER BY column_name;
