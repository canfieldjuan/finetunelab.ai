-- Add missing llm_models entry for gpt-4o-mini
-- This will fix the model name lookup for recent messages

INSERT INTO llm_models (id, name, model_id, provider, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'GPT-4o Mini',
  'gpt-4o-mini',
  'openai',
  NOW(),
  NOW()
)
ON CONFLICT (model_id) DO NOTHING;

-- Verify the entry was added
SELECT id, name, model_id, provider 
FROM llm_models 
WHERE model_id = 'gpt-4o-mini';
