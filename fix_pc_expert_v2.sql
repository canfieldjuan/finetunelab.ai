-- Fix PC Expert-V2 model_id to use the correct path from metadata
-- The model_id should be the filesystem path that vLLM is serving

-- Option 1: Fix just PC Expert-V2
UPDATE llm_models
SET model_id = metadata->>'model_path'
WHERE id = 'fdb16d5b-e019-4ad7-987d-842942208e65';

-- Option 2: Fix all vLLM models that have model_path in metadata
-- (This won't affect "PC Ecpert" since it has empty metadata)
UPDATE llm_models
SET model_id = metadata->>'model_path'
WHERE provider = 'vllm'
  AND metadata ? 'model_path'
  AND model_id != metadata->>'model_path';

-- Verify the fix
SELECT
  id,
  name,
  provider,
  model_id,
  base_url,
  metadata->>'model_path' as stored_path
FROM llm_models
WHERE provider = 'vllm'
ORDER BY created_at DESC;
