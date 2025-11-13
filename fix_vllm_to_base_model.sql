-- Fix PC Expert-V2 to use the model that vLLM is actually serving
-- vLLM server at localhost:8003 is serving: Qwen/Qwen2.5-0.5B-Instruct

UPDATE llm_models
SET model_id = 'Qwen/Qwen2.5-0.5B-Instruct'
WHERE id = 'fdb16d5b-e019-4ad7-987d-842942208e65';

-- Verify the update
SELECT
  id,
  name,
  provider,
  model_id,
  base_url
FROM llm_models
WHERE provider = 'vllm'
ORDER BY created_at DESC;
