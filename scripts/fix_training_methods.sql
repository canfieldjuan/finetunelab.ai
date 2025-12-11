-- Fix Training Method Effectiveness Issues
-- Run this via Supabase SQL Editor or psql

-- ============================================================================
-- Issue #1: Fix invalid training_method value "full" → "sft"
-- ============================================================================
UPDATE llm_models
SET training_method = 'sft'
WHERE training_method = 'full';

-- Verify the fix
SELECT id, name, training_method, base_model
FROM llm_models
WHERE name = 'Trained Model';


-- ============================================================================
-- Issue #2: Set training_method = 'base' for base models (optional)
-- ============================================================================
-- This makes it explicit instead of relying on NULL → 'base' default
-- Comment out if you want to keep NULL

UPDATE llm_models
SET training_method = 'base'
WHERE training_method IS NULL
  AND name IN (
    'GPT-4o Mini',
    'GPT-4 Turbo',
    'GPT-4o',
    'Claude 3.5 Sonnet',
    'Claude 3 Haiku',
    'Claude 3 Opus',
    'Llama 3.2 3B Instruct',
    'Mistral 7B Instruct'
  );

-- Verify
SELECT training_method, COUNT(*) as count
FROM llm_models
GROUP BY training_method
ORDER BY training_method;


-- ============================================================================
-- Issue #3: Fix orphaned message with string model_id instead of UUID
-- ============================================================================
-- Find the orphaned message
SELECT id, model_id, role, created_at
FROM messages
WHERE model_id NOT IN (SELECT id::text FROM llm_models)
  AND role = 'assistant'
  AND model_id IS NOT NULL
LIMIT 5;

-- Fix it by finding the correct UUID for 'gpt-4o-mini'
UPDATE messages
SET model_id = (
  SELECT id
  FROM llm_models
  WHERE name ILIKE '%gpt-4o%mini%'
  OR model_id = 'gpt-4o-mini'
  LIMIT 1
)::text
WHERE model_id = 'gpt-4o-mini';

-- Verify no more orphaned messages
SELECT COUNT(*) as orphaned_count
FROM messages m
WHERE m.model_id IS NOT NULL
  AND m.role = 'assistant'
  AND NOT EXISTS (
    SELECT 1 FROM llm_models lm WHERE lm.id::text = m.model_id
  );


-- ============================================================================
-- Final Verification Query
-- ============================================================================
-- This shows what Training Method Effectiveness will display
SELECT
  COALESCE(lm.training_method, 'base') as training_method,
  COUNT(DISTINCT lm.id) as model_count,
  COUNT(m.id) as message_count,
  AVG(me.rating) as avg_rating,
  ROUND(
    (COUNT(me.id) FILTER (WHERE me.success = true)::float /
     NULLIF(COUNT(me.id), 0)) * 100,
    1
  ) as success_rate
FROM llm_models lm
LEFT JOIN messages m ON m.model_id = lm.id::text AND m.role = 'assistant'
LEFT JOIN message_evaluations me ON me.message_id = m.id
GROUP BY COALESCE(lm.training_method, 'base')
ORDER BY
  CASE COALESCE(lm.training_method, 'base')
    WHEN 'base' THEN 0
    WHEN 'sft' THEN 1
    WHEN 'dpo' THEN 2
    WHEN 'rlhf' THEN 3
    ELSE 999
  END;
