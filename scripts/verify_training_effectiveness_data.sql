-- ============================================================================
-- VERIFICATION QUERIES FOR TRAINING METHOD EFFECTIVENESS
-- Copy/paste these into Supabase SQL Editor to verify database state
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Query 1: Check all models and their training_method values
-- ----------------------------------------------------------------------------
SELECT
  id,
  name,
  model_id,
  provider,
  training_method,
  base_model,
  created_at
FROM llm_models
ORDER BY created_at DESC;

-- Expected: Should show all 12 models
-- Look for: What is "Trained Model" training_method value? (currently "full", should be "sft")


-- ----------------------------------------------------------------------------
-- Query 2: Count models by training_method
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(training_method, 'NULL') as method,
  COUNT(*) as count,
  STRING_AGG(name, ', ' ORDER BY name) as models
FROM llm_models
GROUP BY training_method
ORDER BY training_method;

-- Expected output:
-- method | count | models
-- -------|-------|-------
-- full   | 1     | Trained Model
-- NULL   | 11    | GPT-4o Mini, Claude 3.5 Sonnet, ...


-- ----------------------------------------------------------------------------
-- Query 3: Check messages linked to models (with training methods)
-- ----------------------------------------------------------------------------
SELECT
  lm.name as model_name,
  COALESCE(lm.training_method, 'base (default)') as training_method,
  COUNT(m.id) as message_count,
  MIN(m.created_at) as first_message,
  MAX(m.created_at) as last_message
FROM llm_models lm
LEFT JOIN messages m ON m.model_id = lm.id::text AND m.role = 'assistant'
GROUP BY lm.id, lm.name, lm.training_method
HAVING COUNT(m.id) > 0
ORDER BY COUNT(m.id) DESC;

-- Expected: Should show "Trained Model" with ~99 messages


-- ----------------------------------------------------------------------------
-- Query 4: Check for orphaned messages (model_id doesn't match any llm_models.id)
-- ----------------------------------------------------------------------------
SELECT
  m.id,
  m.model_id,
  m.created_at,
  'Orphaned - no matching llm_models.id' as issue
FROM messages m
WHERE m.model_id IS NOT NULL
  AND m.role = 'assistant'
  AND NOT EXISTS (
    SELECT 1 FROM llm_models lm WHERE lm.id::text = m.model_id
  )
LIMIT 10;

-- Expected: Should show 1 orphaned message with model_id = 'gpt-4o-mini'


-- ----------------------------------------------------------------------------
-- Query 5: Check evaluations for messages
-- ----------------------------------------------------------------------------
SELECT
  COUNT(DISTINCT me.id) as total_evaluations,
  COUNT(DISTINCT me.message_id) as unique_messages_evaluated,
  ROUND(AVG(me.rating), 2) as avg_rating,
  COUNT(*) FILTER (WHERE me.success = true) as success_count,
  COUNT(*) FILTER (WHERE me.success = false) as failure_count,
  ROUND(
    (COUNT(*) FILTER (WHERE me.success = true)::float / NULLIF(COUNT(*), 0)) * 100,
    1
  ) as success_rate_pct
FROM message_evaluations me
JOIN messages m ON m.id = me.message_id
WHERE m.role = 'assistant';

-- Expected: Currently 0 evaluations (this is why card shows "-" for ratings)


-- ----------------------------------------------------------------------------
-- Query 6: SIMULATE what Training Method Effectiveness will show
-- This is exactly what the analytics hook aggregates
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(lm.training_method, 'base') as training_method,
  COUNT(DISTINCT lm.id) as model_count,
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT me.id) as evaluation_count,

  -- Quality metrics (will be NULL/0 if no evaluations)
  ROUND(AVG(me.rating), 1) as avg_rating,
  ROUND(
    (COUNT(me.id) FILTER (WHERE me.success = true)::float /
     NULLIF(COUNT(me.id), 0)) * 100,
    1
  ) as success_rate,

  -- Efficiency metrics
  ROUND(AVG(m.latency_ms), 0) as avg_latency_ms,
  ROUND(AVG(m.input_tokens), 0) as avg_input_tokens,
  ROUND(AVG(m.output_tokens), 0) as avg_output_tokens

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

-- Expected output (current state):
-- training_method | model_count | total_messages | evaluation_count | avg_rating | success_rate
-- ----------------|-------------|----------------|------------------|------------|-------------
-- base            | 11          | 0              | 0                | NULL       | NULL
-- full            | 1           | 99             | 0                | NULL       | NULL

-- After fix (changing "full" to "sft"):
-- training_method | model_count | total_messages | evaluation_count | avg_rating | success_rate
-- ----------------|-------------|----------------|------------------|------------|-------------
-- base            | 11          | 0              | 0                | NULL       | NULL
-- sft             | 1           | 99             | 0                | NULL       | NULL


-- ----------------------------------------------------------------------------
-- Query 7: Check individual model breakdown (what shows in expandable sections)
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(lm.training_method, 'base') as training_method,
  lm.name as model_name,
  lm.base_model,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT me.id) as evaluation_count,
  ROUND(AVG(me.rating), 1) as avg_rating,
  ROUND(
    (COUNT(me.id) FILTER (WHERE me.success = true)::float /
     NULLIF(COUNT(me.id), 0)) * 100,
    1
  ) as success_rate
FROM llm_models lm
LEFT JOIN messages m ON m.model_id = lm.id::text AND m.role = 'assistant'
LEFT JOIN message_evaluations me ON me.message_id = m.id
GROUP BY lm.id, lm.name, lm.training_method, lm.base_model
HAVING COUNT(m.id) > 0  -- Only show models with messages
ORDER BY
  COALESCE(lm.training_method, 'base'),
  COUNT(m.id) DESC;


-- ----------------------------------------------------------------------------
-- Query 8: Check if user has any data at all in analytics
-- This helps confirm if the whole analytics page would be empty
-- ----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM llm_models) as total_models,
  (SELECT COUNT(*) FROM messages WHERE role = 'assistant') as total_assistant_messages,
  (SELECT COUNT(*) FROM messages WHERE role = 'assistant' AND model_id IS NOT NULL) as messages_with_model,
  (SELECT COUNT(*) FROM message_evaluations) as total_evaluations,
  (SELECT COUNT(*) FROM conversations) as total_conversations,
  (SELECT COUNT(DISTINCT training_method) FROM llm_models WHERE training_method IS NOT NULL) as unique_training_methods;

-- Expected:
-- total_models | total_assistant_messages | messages_with_model | total_evaluations | total_conversations | unique_training_methods
-- -------------|--------------------------|---------------------|-------------------|---------------------|------------------------
-- 12           | 100+                     | 100                 | 0                 | ?                   | 1 (just "full")


-- ============================================================================
-- SUMMARY CHECK - Run this last for quick overview
-- ============================================================================
SELECT
  '✓ Models registered' as check_item,
  COUNT(*)::text as result,
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM llm_models

UNION ALL

SELECT
  '✓ Models with training_method',
  COUNT(*)::text,
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '⚠️  WARNING' END
FROM llm_models WHERE training_method IS NOT NULL

UNION ALL

SELECT
  '✓ Messages with model_id',
  COUNT(*)::text,
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM messages WHERE role = 'assistant' AND model_id IS NOT NULL

UNION ALL

SELECT
  '✓ Evaluations exist',
  COUNT(*)::text,
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '⚠️  WARNING - Card will show dashes' END
FROM message_evaluations

UNION ALL

SELECT
  '✓ Valid training_method values',
  COUNT(*)::text || ' invalid ("full" instead of sft/dpo/rlhf)',
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ NEEDS FIX' END
FROM llm_models
WHERE training_method NOT IN ('base', 'sft', 'dpo', 'rlhf')
  AND training_method IS NOT NULL

UNION ALL

SELECT
  '✓ No orphaned messages',
  COUNT(*)::text || ' orphaned',
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '⚠️  WARNING' END
FROM messages m
WHERE m.model_id IS NOT NULL
  AND m.role = 'assistant'
  AND NOT EXISTS (SELECT 1 FROM llm_models lm WHERE lm.id::text = m.model_id);
