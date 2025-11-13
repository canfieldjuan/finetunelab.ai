-- First, let's check the column type and see what we have
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'llm_models'
  AND column_name = 'metadata';

-- Check what your vLLM models look like currently
SELECT
  id,
  name,
  provider,
  model_id,
  base_url,
  metadata
FROM llm_models
WHERE provider = 'vllm'
ORDER BY created_at DESC;

-- If metadata is TEXT/VARCHAR, use this to see the structure:
SELECT
  id,
  name,
  model_id,
  metadata::text as metadata_text
FROM llm_models
WHERE provider = 'vllm'
LIMIT 5;
