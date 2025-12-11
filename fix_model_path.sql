-- Fix model paths in training configs
-- Replace cache paths with proper HuggingFace model IDs

UPDATE training_configs
SET config_json = jsonb_set(
  config_json,
  '{model,name}',
  '"Qwen/Qwen3-0.6B"'
)
WHERE config_json->'model'->>'name' LIKE '%hub/models--Qwen--Qwen3-0.6B%';

-- Also fix tokenizer name to match
UPDATE training_configs
SET config_json = jsonb_set(
  config_json,
  '{tokenizer,name}',
  '"Qwen/Qwen3-0.6B"'
)
WHERE config_json->'tokenizer'->>'name' LIKE '%hub/models--Qwen--Qwen3-0.6B%';

-- Show updated configs
SELECT id, name, 
       config_json->'model'->>'name' as model_name,
       config_json->'tokenizer'->>'name' as tokenizer_name
FROM training_configs
WHERE config_json->'model'->>'name' = 'Qwen/Qwen3-0.6B';
