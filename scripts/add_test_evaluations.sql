-- ============================================================================
-- ADD TEST EVALUATIONS FOR SFT MODEL
-- This will make the Training Method Effectiveness card show ratings
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Find recent messages from SFT model to evaluate
-- ----------------------------------------------------------------------------
SELECT
  m.id,
  m.content,
  m.created_at,
  lm.name as model_name,
  lm.training_method
FROM messages m
JOIN llm_models lm ON lm.id::text = m.model_id
WHERE m.role = 'assistant'
  AND lm.training_method = 'sft'
ORDER BY m.created_at DESC
LIMIT 20;

-- Copy some message IDs from the results above


-- ----------------------------------------------------------------------------
-- Step 2: Get your user_id (needed for evaluations)
-- ----------------------------------------------------------------------------
SELECT id, email FROM auth.users LIMIT 1;

-- Copy your user_id from the results


-- ----------------------------------------------------------------------------
-- Step 3: Add test evaluations (manual approach)
-- Replace <message_id> and <user_id> with actual values
-- ----------------------------------------------------------------------------

-- Example: Add 5 positive evaluations
INSERT INTO message_evaluations (message_id, evaluator_id, rating, success, created_at)
VALUES
  ('<message_id_1>', '<user_id>', 5, true, NOW()),
  ('<message_id_2>', '<user_id>', 4, true, NOW()),
  ('<message_id_3>', '<user_id>', 5, true, NOW()),
  ('<message_id_4>', '<user_id>', 4, true, NOW()),
  ('<message_id_5>', '<user_id>', 5, true, NOW());

-- Verify evaluations were added
SELECT
  me.id,
  me.message_id,
  me.rating,
  me.success,
  m.content as message_content,
  lm.training_method
FROM message_evaluations me
JOIN messages m ON m.id = me.message_id
JOIN llm_models lm ON lm.id::text = m.model_id
WHERE lm.training_method = 'sft'
ORDER BY me.created_at DESC
LIMIT 10;


-- ----------------------------------------------------------------------------
-- Step 4: Bulk add evaluations (automated - adds to 20 recent messages)
-- SAFER OPTION: Uses your actual user_id automatically
-- ----------------------------------------------------------------------------
WITH user_info AS (
  SELECT id as user_id FROM auth.users LIMIT 1
),
recent_sft_messages AS (
  SELECT DISTINCT m.id
  FROM messages m
  JOIN llm_models lm ON lm.id::text = m.model_id
  WHERE m.role = 'assistant'
    AND lm.training_method = 'sft'
    AND NOT EXISTS (
      SELECT 1 FROM message_evaluations me WHERE me.message_id = m.id
    )
  ORDER BY m.created_at DESC
  LIMIT 20
)
INSERT INTO message_evaluations (message_id, evaluator_id, rating, success, created_at)
SELECT
  rsm.id,
  ui.user_id,
  -- Random rating between 3-5 (simulating good responses)
  (3 + FLOOR(RANDOM() * 3))::integer,
  -- 80% success rate
  (RANDOM() > 0.2),
  NOW()
FROM recent_sft_messages rsm
CROSS JOIN user_info ui;

-- Verify bulk insert
SELECT COUNT(*) as evaluations_added FROM message_evaluations
WHERE created_at > NOW() - INTERVAL '1 minute';


-- ----------------------------------------------------------------------------
-- Step 5: Verify Training Method Effectiveness data after adding evaluations
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(lm.training_method, 'base') as training_method,
  COUNT(DISTINCT lm.id) as model_count,
  COUNT(DISTINCT m.id) as total_messages,
  COUNT(DISTINCT me.id) as evaluation_count,
  CAST(AVG(me.rating) AS NUMERIC(10,1)) as avg_rating,
  CAST(
    (COUNT(me.id) FILTER (WHERE me.success = true)::float /
     NULLIF(COUNT(me.id), 0)) * 100
    AS NUMERIC(10,1)
  ) as success_rate_pct
FROM llm_models lm
LEFT JOIN messages m ON m.model_id = lm.id::text AND m.role = 'assistant'
LEFT JOIN message_evaluations me ON me.message_id = m.id
GROUP BY COALESCE(lm.training_method, 'base')
ORDER BY training_method;

-- Expected result after adding evaluations:
-- training_method | model_count | total_messages | evaluation_count | avg_rating | success_rate_pct
-- ----------------|-------------|----------------|------------------|------------|------------------
-- base            | 11          | 17             | 8                | 3.9        | [%]
-- sft             | 1           | 296            | 20               | 4.2        | 80.0


-- ============================================================================
-- ALTERNATIVE: Use LLM Judge to Auto-Evaluate (Recommended for production)
-- ============================================================================

-- This is pseudocode - you'd run this via your LLM judge feature in the UI
-- or create a script that:
-- 1. Fetches messages without evaluations
-- 2. Sends to LLM judge API
-- 3. Stores results in message_evaluations table

/*
FOR EACH message in (SELECT * FROM messages WHERE model_id = <sft_model_id> AND no evaluation)
  CALL llm_judge_api(message.content)
  INSERT INTO message_evaluations (message_id, rating, success, failure_tags)
  VALUES (message.id, judge_result.rating, judge_result.success, judge_result.tags)
END FOR
*/


-- ============================================================================
-- CLEANUP: Remove test evaluations if needed
-- ============================================================================

-- Delete evaluations added in last hour (if you want to redo)
-- DELETE FROM message_evaluations
-- WHERE created_at > NOW() - INTERVAL '1 hour';
