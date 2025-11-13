-- Fix PC Ecpert model to point to correct vLLM Docker port and model
UPDATE llm_models 
SET base_url = 'http://localhost:8003/v1',
    model_id = 'Qwen/Qwen2.5-0.5B-Instruct'
WHERE id = '981d308a-62a2-4d03-a31e-a6f9a8d33e6a'
  AND name = 'PC Ecpert'
  AND provider = 'vllm';
