-- ============================================================================
-- Migration: Add New Usage Limits to Subscription Plans
-- Created: 2025-12-17
-- Purpose: Add 5 new usage limit fields to existing subscription plans
--
-- This migration extends the subscription_plans.limits JSONB column with:
-- - batch_test_runs_per_month
-- - scheduled_eval_runs_per_month
-- - chat_messages_per_month
-- - inference_calls_per_month
-- - compute_minutes_per_month
--
-- Breaking Changes: NONE (adds optional fields to JSONB)
-- Dependencies: Assumes subscription_plans table exists
-- Rollback: Not needed (adding fields doesn't break existing queries)
-- ============================================================================

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 1. This migration assumes subscription_plans table exists with a 'limits' JSONB column
-- 2. It updates plans by 'name' field ('free', 'pro', 'enterprise')
-- 3. If your plan names differ, adjust the WHERE clauses
-- 4. Uses || operator to merge JSONB (preserves existing limits)
-- 5. -1 means unlimited
-- ============================================================================

-- ============================================================================
-- VERIFICATION: Check if subscription_plans table exists
-- ============================================================================

DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'subscription_plans'
  ) THEN
    RAISE NOTICE '⚠️  WARNING: subscription_plans table does not exist. This migration will have no effect.';
    RAISE NOTICE '   If this is a new installation, you may need to create subscription_plans manually.';
  ELSE
    RAISE NOTICE '✅ subscription_plans table exists. Proceeding with limit updates.';
  END IF;
END $$;

-- ============================================================================
-- UPDATE: Free Plan
-- Limits designed for individual developers testing the platform
-- ============================================================================

UPDATE public.subscription_plans
SET limits = limits || jsonb_build_object(
  'batch_test_runs_per_month', 50,       -- 50 batch test runs/month
  'scheduled_eval_runs_per_month', 5,     -- 5 active scheduled evaluations
  'chat_messages_per_month', 100,         -- 100 chat messages/month
  'inference_calls_per_month', 100,       -- 100 inference calls/month
  'compute_minutes_per_month', 60         -- 60 minutes of compute time/month
),
updated_at = NOW()
WHERE name = 'free'
  AND limits IS NOT NULL; -- Only update if limits column exists

-- ============================================================================
-- UPDATE: Pro Plan
-- Limits designed for professional developers and small teams
-- ============================================================================

UPDATE public.subscription_plans
SET limits = limits || jsonb_build_object(
  'batch_test_runs_per_month', 500,      -- 500 batch test runs/month
  'scheduled_eval_runs_per_month', 50,    -- 50 active scheduled evaluations
  'chat_messages_per_month', 10000,       -- 10,000 chat messages/month
  'inference_calls_per_month', 10000,     -- 10,000 inference calls/month
  'compute_minutes_per_month', 1000       -- 1,000 minutes (16.7 hours)/month
),
updated_at = NOW()
WHERE name = 'pro'
  AND limits IS NOT NULL;

-- ============================================================================
-- UPDATE: Enterprise Plan
-- Designed for large teams with high usage
-- Most limits unlimited (-1), except scheduled evals (performance constraint)
-- ============================================================================

UPDATE public.subscription_plans
SET limits = limits || jsonb_build_object(
  'batch_test_runs_per_month', -1,       -- Unlimited
  'scheduled_eval_runs_per_month', 200,   -- 200 active schedules (performance limit)
  'chat_messages_per_month', -1,          -- Unlimited
  'inference_calls_per_month', -1,        -- Unlimited
  'compute_minutes_per_month', -1         -- Unlimited
),
updated_at = NOW()
WHERE name = 'enterprise'
  AND limits IS NOT NULL;

-- ============================================================================
-- LOGGING: Show updated plans
-- ============================================================================

DO $$
DECLARE
  plan_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Updated Subscription Plans:';
  RAISE NOTICE '=============================================================================';

  FOR plan_record IN
    SELECT
      name,
      display_name,
      (limits->>'batch_test_runs_per_month') as batch_tests,
      (limits->>'scheduled_eval_runs_per_month') as scheduled_evals,
      (limits->>'chat_messages_per_month') as chat_messages,
      (limits->>'inference_calls_per_month') as inference_calls,
      (limits->>'compute_minutes_per_month') as compute_minutes
    FROM public.subscription_plans
    WHERE limits IS NOT NULL
    ORDER BY
      CASE name
        WHEN 'free' THEN 1
        WHEN 'pro' THEN 2
        WHEN 'enterprise' THEN 3
        ELSE 4
      END
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE 'Plan: % (%)', plan_record.display_name, plan_record.name;
    RAISE NOTICE '  Batch Tests/month:       %', COALESCE(plan_record.batch_tests, 'NOT SET');
    RAISE NOTICE '  Scheduled Evals/month:   %', COALESCE(plan_record.scheduled_evals, 'NOT SET');
    RAISE NOTICE '  Chat Messages/month:     %', COALESCE(plan_record.chat_messages, 'NOT SET');
    RAISE NOTICE '  Inference Calls/month:   %', COALESCE(plan_record.inference_calls, 'NOT SET');
    RAISE NOTICE '  Compute Minutes/month:   %', COALESCE(plan_record.compute_minutes, 'NOT SET');
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Note: -1 indicates unlimited';
  RAISE NOTICE '=============================================================================';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (optional - comment out in production)
-- ============================================================================

-- Verify all plans have the new limits
-- SELECT
--   name,
--   display_name,
--   limits->>'batch_test_runs_per_month' as batch_tests,
--   limits->>'scheduled_eval_runs_per_month' as scheduled_evals,
--   limits->>'chat_messages_per_month' as chat_messages,
--   limits->>'inference_calls_per_month' as inference_calls,
--   limits->>'compute_minutes_per_month' as compute_minutes
-- FROM public.subscription_plans
-- ORDER BY
--   CASE name
--     WHEN 'free' THEN 1
--     WHEN 'pro' THEN 2
--     WHEN 'enterprise' THEN 3
--     ELSE 4
--   END;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- If you need to remove the new limit fields (not recommended):
--
-- UPDATE public.subscription_plans
-- SET limits = limits - 'batch_test_runs_per_month'
--                      - 'scheduled_eval_runs_per_month'
--                      - 'chat_messages_per_month'
--                      - 'inference_calls_per_month'
--                      - 'compute_minutes_per_month';

-- ============================================================================
-- NOTES FOR FUTURE ADJUSTMENTS
-- ============================================================================

-- To adjust limits for a specific plan:
-- UPDATE public.subscription_plans
-- SET limits = jsonb_set(limits, '{batch_test_runs_per_month}', '100')
-- WHERE name = 'free';

-- To add a new plan with all limits:
-- INSERT INTO public.subscription_plans (name, display_name, limits, ...)
-- VALUES (
--   'custom',
--   'Custom Plan',
--   jsonb_build_object(
--     'api_calls_per_month', 50000,
--     'storage_mb', 5000,
--     'models_limit', 20,
--     'batch_test_runs_per_month', 200,
--     'scheduled_eval_runs_per_month', 20,
--     'chat_messages_per_month', 5000,
--     'inference_calls_per_month', 5000,
--     'compute_minutes_per_month', 500
--   ),
--   ...
-- );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
