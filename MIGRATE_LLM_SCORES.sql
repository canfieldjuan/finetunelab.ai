-- Migration Script: Normalize LLM Judge Scores from 1-10 to 0-1
-- Date: December 3, 2025
-- Purpose: Fix score normalization mismatch between LLM judges (1-10) and rule validators (0-1)

-- ============================================================================
-- IMPORTANT: RUN THIS MIGRATION AFTER DEPLOYING THE CODE FIX
-- ============================================================================

-- Step 1: Verify the issue exists
-- Check current score ranges by judge type
SELECT
  judge_type,
  COUNT(*) as total_judgments,
  MIN(score) as min_score,
  MAX(score) as max_score,
  AVG(score) as avg_score,
  ROUND(AVG(score)::numeric, 2) as avg_rounded
FROM judgments
GROUP BY judge_type
ORDER BY judge_type;

-- Expected BEFORE migration:
-- judge_type | total_judgments | min_score | max_score | avg_score | avg_rounded
-- rule       | 1000            | 0.0       | 1.0       | 0.75      | 0.75
-- llm        | 500             | 1.0       | 10.0      | 7.5       | 7.50  ← NEEDS FIX
-- human      | 50              | 0.0       | 1.0       | 0.82      | 0.82

-- Step 2: Count how many LLM judgments need migration
SELECT COUNT(*) as llm_judgments_to_migrate
FROM judgments
WHERE judge_type = 'llm'
  AND score > 1.0;  -- Scores > 1.0 are on 1-10 scale

-- Step 3: Show sample records before migration
SELECT
  id,
  message_id,
  judge_type,
  judge_name,
  criterion,
  score,
  passed,
  created_at
FROM judgments
WHERE judge_type = 'llm'
  AND score > 1.0
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- BACKUP: Create backup table before migration (RECOMMENDED)
-- ============================================================================

-- Create backup table
CREATE TABLE IF NOT EXISTS judgments_backup_pre_normalization AS
SELECT * FROM judgments WHERE judge_type = 'llm';

-- Verify backup
SELECT COUNT(*) as backed_up_llm_judgments FROM judgments_backup_pre_normalization;

-- ============================================================================
-- MIGRATION: Normalize LLM scores from 1-10 to 0-1
-- ============================================================================

-- Update LLM judgment scores: divide by 10 to normalize to 0-1 range
UPDATE judgments
SET
  score = score / 10,
  notes = CASE
    WHEN notes IS NOT NULL THEN
      'AI evaluation: ' || CAST(score AS TEXT) || '/10 (' || notes || ')'
    ELSE
      'AI evaluation: ' || CAST(score AS TEXT) || '/10 (migrated score)'
  END
WHERE judge_type = 'llm'
  AND score > 1.0;  -- Only update scores that are still on 1-10 scale

-- Get update count
SELECT COUNT(*) as records_updated
FROM judgments
WHERE judge_type = 'llm'
  AND score <= 1.0;

-- ============================================================================
-- VERIFICATION: Confirm migration success
-- ============================================================================

-- Step 1: Check score ranges again
SELECT
  judge_type,
  COUNT(*) as total_judgments,
  ROUND(MIN(score)::numeric, 3) as min_score,
  ROUND(MAX(score)::numeric, 3) as max_score,
  ROUND(AVG(score)::numeric, 3) as avg_score
FROM judgments
GROUP BY judge_type
ORDER BY judge_type;

-- Expected AFTER migration:
-- judge_type | total_judgments | min_score | max_score | avg_score
-- rule       | 1000            | 0.000     | 1.000     | 0.750
-- llm        | 500             | 0.100     | 1.000     | 0.750  ← FIXED!
-- human      | 50              | 0.000     | 1.000     | 0.820

-- Step 2: Verify no LLM scores > 1.0 remain
SELECT COUNT(*) as remaining_unnormalized_scores
FROM judgments
WHERE judge_type = 'llm'
  AND score > 1.0;

-- Should return 0

-- Step 3: Sample migrated records
SELECT
  id,
  judge_type,
  judge_name,
  criterion,
  ROUND(score::numeric, 3) as normalized_score,
  passed,
  notes,
  created_at
FROM judgments
WHERE judge_type = 'llm'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- If migration fails or causes issues, restore from backup:
--
-- WARNING: This will delete ALL llm judgments and restore from backup
-- Only run if you need to undo the migration
--
-- DELETE FROM judgments WHERE judge_type = 'llm';
-- INSERT INTO judgments
-- SELECT * FROM judgments_backup_pre_normalization;
--
-- Then drop backup table:
-- DROP TABLE judgments_backup_pre_normalization;

-- ============================================================================
-- CLEANUP (after successful migration)
-- ============================================================================

-- After confirming migration success, you can drop the backup table:
-- DROP TABLE IF NOT EXISTS judgments_backup_pre_normalization;

-- ============================================================================
-- ANALYTICS VERIFICATION
-- ============================================================================

-- Test mixed judge type analytics (should now work correctly)
SELECT
  m.id as message_id,
  m.role,
  j.judge_type,
  j.judge_name,
  j.criterion,
  ROUND(j.score::numeric, 3) as score,
  j.passed
FROM messages m
JOIN judgments j ON j.message_id = m.id
WHERE m.created_at > NOW() - INTERVAL '1 day'
  AND m.role = 'assistant'
ORDER BY m.created_at DESC, j.judge_type
LIMIT 20;

-- Test average scores across all judge types
-- (should now be comparable since all use 0-1 scale)
SELECT
  judge_type,
  COUNT(*) as count,
  ROUND(AVG(score)::numeric, 3) as avg_score,
  ROUND((SUM(CASE WHEN passed THEN 1 ELSE 0 END)::float / COUNT(*) * 100)::numeric, 1) as pass_rate_pct
FROM judgments
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY judge_type
ORDER BY judge_type;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- ✅ All LLM judge scores normalized from 1-10 to 0-1 scale
-- ✅ Original scores preserved in notes field
-- ✅ Consistent with rule validators and human judgments
-- ✅ Analytics queries now work correctly across judge types
-- ✅ UI displays scores correctly (no more "800%")

COMMIT;
