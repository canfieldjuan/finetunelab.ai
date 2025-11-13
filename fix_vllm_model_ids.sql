-- Fix vLLM Model IDs
-- Date: 2025-11-02
-- Issue: model_id was set to modelName instead of modelPath
-- This causes vLLM to return 404 "model does not exist"
--
-- This script updates existing vLLM models to use the correct model_id from metadata

-- Update vLLM models where model_id doesn't match the actual model path
UPDATE llm_models
SET model_id = metadata->>'model_path'
WHERE provider = 'vllm'
  AND metadata->>'model_path' IS NOT NULL
  AND model_id != metadata->>'model_path';

-- Verify the update
SELECT
  id,
  name,
  provider,
  model_id,
  metadata->>'model_path' as stored_path,
  metadata->>'display_name' as display_name
FROM llm_models
WHERE provider = 'vllm'
ORDER BY created_at DESC;
