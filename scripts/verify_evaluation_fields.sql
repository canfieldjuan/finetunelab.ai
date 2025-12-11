-- ============================================================================
-- VERIFY EVALUATION DATA STRUCTURE AND RELATIONSHIPS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Check message_evaluations table schema
-- ----------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'message_evaluations'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected fields:
-- - id
-- - message_id
-- - evaluator_id
-- - rating (1-5 stars)
-- - success (boolean - thumbs up/down)
-- - failure_tags (array)
-- - created_at


-- ----------------------------------------------------------------------------
-- 2. Check actual data - what fields are populated?
-- ----------------------------------------------------------------------------
SELECT
  COUNT(*) as total_evaluations,
  COUNT(rating) as has_rating,
  COUNT(success) as has_success,
  COUNT(failure_tags) as has_failure_tags,
  MIN(rating) as min_rating,
  MAX(rating) as max_rating,
  COUNT(*) FILTER (WHERE success = true) as success_count,
  COUNT(*) FILTER (WHERE success = false) as failure_count,
  COUNT(*) FILTER (WHERE success IS NULL) as success_null_count
FROM message_evaluations;


-- ----------------------------------------------------------------------------
-- 3. Check if rating and success are independent or derived
-- ----------------------------------------------------------------------------
-- Do evaluations have both rating AND success?
-- Or is success derived from rating?
SELECT
  rating,
  success,
  COUNT(*) as count
FROM message_evaluations
GROUP BY rating, success
ORDER BY rating, success;

-- If we see:
-- rating | success | count
-- -------|---------|------
-- 1      | false   | 10    ← Low ratings = false
-- 2      | false   | 8
-- 3      | null    | 5     ← OR all ratings but success is separate
-- 4      | true    | 20
-- 5      | true    | 30    ← High ratings = true

-- This tells us if they're independent or calculated


-- ----------------------------------------------------------------------------
-- 4. Check conversations table for sentiment fields
-- ----------------------------------------------------------------------------
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND table_schema = 'public'
  AND (column_name LIKE '%sentiment%' OR column_name LIKE '%emotion%')
ORDER BY ordinal_position;


-- ----------------------------------------------------------------------------
-- 5. Check if sentiment is stored anywhere
-- ----------------------------------------------------------------------------
-- Check conversations metadata for sentiment
SELECT
  id,
  metadata->'sentiment' as sentiment_in_metadata,
  metadata->'overall_sentiment' as overall_sentiment,
  user_rating
FROM conversations
WHERE metadata IS NOT NULL
  AND (
    metadata ? 'sentiment'
    OR metadata ? 'overall_sentiment'
    OR metadata ? 'sentiment_score'
  )
LIMIT 10;


-- ----------------------------------------------------------------------------
-- 6. Verify Rating Distribution data source
-- ----------------------------------------------------------------------------
-- This is what useAnalytics aggregates for Rating Distribution chart
SELECT
  me.rating,
  COUNT(*) as count
FROM message_evaluations me
WHERE me.rating IS NOT NULL
GROUP BY me.rating
ORDER BY me.rating;


-- ----------------------------------------------------------------------------
-- 7. Verify Success Rate data source
-- ----------------------------------------------------------------------------
-- This is what useAnalytics aggregates for Success Rate chart
SELECT
  CASE
    WHEN me.success = true THEN 'Success'
    WHEN me.success = false THEN 'Failure'
    ELSE 'Unknown'
  END as status,
  COUNT(*) as count
FROM message_evaluations me
GROUP BY me.success
ORDER BY me.success DESC NULLS LAST;


-- ----------------------------------------------------------------------------
-- 8. Verify Judgments data source (failure_tags)
-- ----------------------------------------------------------------------------
-- This is what useAnalytics aggregates for Judgments Breakdown
SELECT
  tag,
  COUNT(*) as count
FROM message_evaluations,
  LATERAL UNNEST(failure_tags) as tag
GROUP BY tag
ORDER BY COUNT(*) DESC
LIMIT 20;


-- ============================================================================
-- SUMMARY QUERY - Relationships between all evaluation metrics
-- ============================================================================
SELECT
  'Total Evaluations' as metric,
  COUNT(*)::text as value
FROM message_evaluations

UNION ALL

SELECT
  'Has Rating (1-5 stars)',
  CAST(COUNT(*) FILTER (WHERE rating IS NOT NULL) AS TEXT) || ' (' ||
  CAST(ROUND(100.0 * COUNT(*) FILTER (WHERE rating IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS TEXT) || '%)'
FROM message_evaluations

UNION ALL

SELECT
  'Has Success (thumbs)',
  CAST(COUNT(*) FILTER (WHERE success IS NOT NULL) AS TEXT) || ' (' ||
  CAST(ROUND(100.0 * COUNT(*) FILTER (WHERE success IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS TEXT) || '%)'
FROM message_evaluations

UNION ALL

SELECT
  'Has Failure Tags',
  CAST(COUNT(*) FILTER (WHERE failure_tags IS NOT NULL AND array_length(failure_tags, 1) > 0) AS TEXT) || ' (' ||
  CAST(ROUND(100.0 * COUNT(*) FILTER (WHERE failure_tags IS NOT NULL AND array_length(failure_tags, 1) > 0) / NULLIF(COUNT(*), 0), 1) AS TEXT) || '%)'
FROM message_evaluations

UNION ALL

SELECT
  'Avg Rating',
  CAST(ROUND(AVG(rating), 2) AS TEXT) || ' stars'
FROM message_evaluations
WHERE rating IS NOT NULL

UNION ALL

SELECT
  'Success Rate',
  CAST(ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*) FILTER (WHERE success IS NOT NULL), 0), 1) AS TEXT) || '%'
FROM message_evaluations

UNION ALL

SELECT
  'Most Common Tag',
  tag || ' (' || COUNT(*)::text || ')'
FROM message_evaluations,
  LATERAL UNNEST(failure_tags) as tag
GROUP BY tag
ORDER BY COUNT(*) DESC
LIMIT 1;
