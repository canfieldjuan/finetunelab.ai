-- ============================================================================
-- FIXED VERIFICATION QUERIES (corrected for Supabase/PostgreSQL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Query 5 (FIXED): Check evaluations for messages
-- ----------------------------------------------------------------------------
SELECT
  COUNT(DISTINCT me.id) as total_evaluations,
  COUNT(DISTINCT me.message_id) as unique_messages_evaluated,
  CAST(AVG(me.rating) AS NUMERIC(10,2)) as avg_rating,
  COUNT(*) FILTER (WHERE me.success = true) as success_count,
  COUNT(*) FILTER (WHERE me.success = false) as failure_count,
  CAST(
    (COUNT(*) FILTER (WHERE me.success = true)::float / NULLIF(COUNT(*), 0)) * 100
    AS NUMERIC(10,1)
  ) as success_rate_pct
FROM message_evaluations me
JOIN messages m ON m.id = me.message_id
WHERE m.role = 'assistant';


-- ----------------------------------------------------------------------------
-- Query 6 (FIXED): SIMULATE what Training Method Effectiveness will show
-- THIS IS THE KEY QUERY - Shows exactly what the card displays
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(lm.training_method, 'base') as training_method,
  COUNT(DISTINCT lm.id) as model_count,
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT me.id) as evaluation_count,

  -- Quality metrics (will be NULL if no evaluations)
  CAST(AVG(me.rating) AS NUMERIC(10,1)) as avg_rating,
  CAST(
    (COUNT(me.id) FILTER (WHERE me.success = true)::float /
     NULLIF(COUNT(me.id), 0)) * 100
    AS NUMERIC(10,1)
  ) as success_rate,

  -- Efficiency metrics
  CAST(AVG(m.latency_ms) AS INTEGER) as avg_latency_ms,
  CAST(AVG(m.input_tokens) AS INTEGER) as avg_input_tokens,
  CAST(AVG(m.output_tokens) AS INTEGER) as avg_output_tokens

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


-- ----------------------------------------------------------------------------
-- Query 7 (FIXED): Individual model breakdown
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(lm.training_method, 'base') as training_method,
  lm.name as model_name,
  lm.base_model,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT me.id) as evaluation_count,
  CAST(AVG(me.rating) AS NUMERIC(10,1)) as avg_rating,
  CAST(
    (COUNT(me.id) FILTER (WHERE me.success = true)::float /
     NULLIF(COUNT(me.id), 0)) * 100
    AS NUMERIC(10,1)
  ) as success_rate
FROM llm_models lm
LEFT JOIN messages m ON m.model_id = lm.id::text AND m.role = 'assistant'
LEFT JOIN message_evaluations me ON me.message_id = m.id
GROUP BY lm.id, lm.name, lm.training_method, lm.base_model
HAVING COUNT(m.id) > 0
ORDER BY
  COALESCE(lm.training_method, 'base'),
  COUNT(m.id) DESC;


-- ============================================================================
-- QUICK DIAGNOSIS - Run this for instant overview
-- ============================================================================
SELECT
  'Models in registry' as metric,
  COUNT(*)::text as value
FROM llm_models

UNION ALL

SELECT
  'Models with training_method',
  COUNT(*)::text
FROM llm_models WHERE training_method IS NOT NULL

UNION ALL

SELECT
  'Messages with model_id',
  COUNT(*)::text
FROM messages WHERE role = 'assistant' AND model_id IS NOT NULL

UNION ALL

SELECT
  'Evaluations',
  COUNT(*)::text
FROM message_evaluations

UNION ALL

SELECT
  'Invalid training_method values',
  STRING_AGG(DISTINCT training_method, ', ')
FROM llm_models
WHERE training_method NOT IN ('base', 'sft', 'dpo', 'rlhf')
  AND training_method IS NOT NULL

UNION ALL

SELECT
  'Orphaned messages',
  COUNT(*)::text
FROM messages m
WHERE m.model_id IS NOT NULL
  AND m.role = 'assistant'
  AND NOT EXISTS (SELECT 1 FROM llm_models lm WHERE lm.id::text = m.model_id);
