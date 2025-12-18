-- ============================================================================
-- Migration: Create Usage Tracking System (CLEAN VERSION)
-- Created: 2025-12-17
-- Purpose: Drop and recreate usage tracking tables with correct schema
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop existing objects if they exist (clean slate)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Cleaning up existing objects ===';
END $$;

-- Drop materialized view first (depends on table)
DROP MATERIALIZED VIEW IF EXISTS public.current_usage_summary CASCADE;

-- Drop functions (may reference the table)
DROP FUNCTION IF EXISTS public.check_usage_limit(UUID, TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.record_usage(UUID, TEXT, NUMERIC, TEXT, UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.get_usage_with_limits(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_current_usage_summary() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_period() CASCADE;

-- Drop the table last
DROP TABLE IF EXISTS public.usage_events CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup complete';
END $$;

-- ============================================================================
-- STEP 2: Create usage_events table (FRESH)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating usage_events table ===';
END $$;

CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 1,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '✅ Table created';
END $$;

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating indexes ===';
END $$;

CREATE INDEX idx_usage_events_user_period
  ON public.usage_events(user_id, period_year, period_month);

CREATE INDEX idx_usage_events_metric_type
  ON public.usage_events(metric_type, user_id);

CREATE INDEX idx_usage_events_created
  ON public.usage_events(created_at DESC);

CREATE INDEX idx_usage_events_resource
  ON public.usage_events(resource_type, resource_id)
  WHERE resource_id IS NOT NULL;

CREATE INDEX idx_usage_events_aggregation
  ON public.usage_events(user_id, metric_type, period_month, period_year);

DO $$
BEGIN
  RAISE NOTICE '✅ Indexes created';
END $$;

-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Enabling RLS ===';
END $$;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage events"
  ON public.usage_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  RAISE NOTICE '✅ RLS enabled';
END $$;

-- ============================================================================
-- STEP 5: Create materialized view
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating materialized view ===';
END $$;

CREATE MATERIALIZED VIEW public.current_usage_summary AS
SELECT
  user_id,
  metric_type,
  SUM(metric_value) as total_value,
  COUNT(*) as event_count,
  MAX(created_at) as last_updated
FROM public.usage_events
WHERE
  period_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  AND period_month = (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER)
GROUP BY user_id, metric_type;

DO $$
BEGIN
  RAISE NOTICE '✅ Materialized view created';
END $$;

-- ============================================================================
-- STEP 6: Create indexes on materialized view
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating indexes on view ===';
END $$;

CREATE UNIQUE INDEX idx_current_usage_summary_user_metric
  ON public.current_usage_summary(user_id, metric_type);

CREATE INDEX idx_current_usage_summary_metric
  ON public.current_usage_summary(metric_type);

DO $$
BEGIN
  RAISE NOTICE '✅ View indexes created';
END $$;

-- ============================================================================
-- STEP 7: Create refresh function
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating refresh function ===';
END $$;

CREATE FUNCTION public.refresh_current_usage_summary()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.current_usage_summary;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Refresh function created';
END $$;

-- ============================================================================
-- STEP 8: Create check_usage_limit function
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating check_usage_limit function ===';
END $$;

CREATE FUNCTION public.check_usage_limit(
  p_user_id UUID,
  p_metric_type TEXT,
  p_increment NUMERIC DEFAULT 1
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_value NUMERIC,
  limit_value NUMERIC,
  percentage NUMERIC,
  remaining NUMERIC,
  is_unlimited BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current NUMERIC;
  v_limit NUMERIC;
  v_plan_limits JSONB;
BEGIN
  -- Get current usage
  SELECT COALESCE(total_value, 0) INTO v_current
  FROM public.current_usage_summary
  WHERE current_usage_summary.user_id = p_user_id
    AND current_usage_summary.metric_type = p_metric_type;

  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  -- Get plan limits
  SELECT sp.limits INTO v_plan_limits
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
  LIMIT 1;

  -- If no subscription, allow unlimited
  IF v_plan_limits IS NULL THEN
    RETURN QUERY SELECT
      true::BOOLEAN,
      v_current,
      -1::NUMERIC,
      -1::NUMERIC,
      -1::NUMERIC,
      true::BOOLEAN;
    RETURN;
  END IF;

  -- Extract limit
  v_limit := CASE p_metric_type
    WHEN 'api_call' THEN (v_plan_limits->>'api_calls_per_month')::NUMERIC
    WHEN 'storage_mb' THEN (v_plan_limits->>'storage_mb')::NUMERIC
    WHEN 'model_created' THEN (v_plan_limits->>'models_limit')::NUMERIC
    WHEN 'training_job' THEN -1
    WHEN 'token_usage' THEN -1
    WHEN 'batch_test_run' THEN COALESCE((v_plan_limits->>'batch_test_runs_per_month')::NUMERIC, -1)
    WHEN 'scheduled_eval_run' THEN COALESCE((v_plan_limits->>'scheduled_eval_runs_per_month')::NUMERIC, -1)
    WHEN 'chat_message' THEN COALESCE((v_plan_limits->>'chat_messages_per_month')::NUMERIC, -1)
    WHEN 'inference_call' THEN COALESCE((v_plan_limits->>'inference_calls_per_month')::NUMERIC, -1)
    WHEN 'compute_minutes' THEN COALESCE((v_plan_limits->>'compute_minutes_per_month')::NUMERIC, -1)
    ELSE -1
  END;

  -- Check unlimited
  IF v_limit = -1 THEN
    RETURN QUERY SELECT
      true::BOOLEAN,
      v_current,
      -1::NUMERIC,
      -1::NUMERIC,
      -1::NUMERIC,
      true::BOOLEAN;
    RETURN;
  END IF;

  -- Check limit
  RETURN QUERY SELECT
    (v_current + p_increment <= v_limit)::BOOLEAN,
    v_current,
    v_limit,
    CASE WHEN v_limit > 0 THEN ROUND((v_current / v_limit) * 100, 2) ELSE 0 END,
    GREATEST(v_limit - v_current, 0),
    false::BOOLEAN;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ check_usage_limit function created';
END $$;

-- ============================================================================
-- STEP 9: Create record_usage function
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating record_usage function ===';
END $$;

CREATE FUNCTION public.record_usage(
  p_user_id UUID,
  p_metric_type TEXT,
  p_value NUMERIC DEFAULT 1,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_month INTEGER;
  v_period_year INTEGER;
BEGIN
  v_period_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_period_month := v_period_year * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;

  INSERT INTO public.usage_events (
    user_id,
    metric_type,
    metric_value,
    resource_type,
    resource_id,
    metadata,
    period_month,
    period_year
  ) VALUES (
    p_user_id,
    p_metric_type,
    p_value,
    p_resource_type,
    p_resource_id,
    p_metadata,
    v_period_month,
    v_period_year
  );
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ record_usage function created';
END $$;

-- ============================================================================
-- STEP 10: Create get_usage_with_limits function
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating get_usage_with_limits function ===';
END $$;

CREATE FUNCTION public.get_usage_with_limits(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_metric RECORD;
BEGIN
  FOR v_metric IN
    SELECT metric_type, total_value
    FROM public.current_usage_summary
    WHERE current_usage_summary.user_id = p_user_id
  LOOP
    SELECT v_result || jsonb_build_object(
      v_metric.metric_type,
      (SELECT row_to_json(r) FROM (
        SELECT * FROM public.check_usage_limit(p_user_id, v_metric.metric_type, 0)
      ) r)
    ) INTO v_result;
  END LOOP;

  RETURN v_result;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ get_usage_with_limits function created';
END $$;

-- ============================================================================
-- STEP 11: Create helper function
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Creating get_current_period function ===';
END $$;

CREATE FUNCTION public.get_current_period()
RETURNS TABLE (
  period_year INTEGER,
  period_month INTEGER
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as period_year,
    (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER) as period_month;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ get_current_period function created';
END $$;

-- ============================================================================
-- STEP 12: Add comments
-- ============================================================================

COMMENT ON TABLE public.usage_events IS 'Raw usage events for all metered actions';
COMMENT ON MATERIALIZED VIEW public.current_usage_summary IS 'Aggregated usage for current month';
COMMENT ON FUNCTION public.check_usage_limit(UUID, TEXT, NUMERIC) IS 'Check if user can perform action';
COMMENT ON FUNCTION public.record_usage(UUID, TEXT, NUMERIC, TEXT, UUID, JSONB) IS 'Record usage event';
COMMENT ON FUNCTION public.get_usage_with_limits(UUID) IS 'Get all usage metrics with limits';
COMMENT ON FUNCTION public.refresh_current_usage_summary() IS 'Refresh materialized view';
COMMENT ON FUNCTION public.get_current_period() IS 'Get current billing period';

-- ============================================================================
-- STEP 13: Grant permissions
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Granting permissions ===';
END $$;

GRANT EXECUTE ON FUNCTION public.check_usage_limit(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_with_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_period() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Permissions granted';
END $$;

-- ============================================================================
-- FINAL: Verify everything was created
-- ============================================================================

DO $$
DECLARE
  v_table_count INTEGER;
  v_view_count INTEGER;
  v_function_count INTEGER;
BEGIN
  RAISE NOTICE '=== Verifying migration ===';

  -- Check table
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'usage_events';

  -- Check view
  SELECT COUNT(*) INTO v_view_count
  FROM pg_matviews
  WHERE schemaname = 'public' AND matviewname = 'current_usage_summary';

  -- Check functions
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc
  WHERE proname LIKE '%usage%';

  RAISE NOTICE '✅ Tables created: %', v_table_count;
  RAISE NOTICE '✅ Views created: %', v_view_count;
  RAISE NOTICE '✅ Functions created: %', v_function_count;

  IF v_table_count = 0 THEN
    RAISE EXCEPTION 'Table usage_events was not created!';
  END IF;

  IF v_view_count = 0 THEN
    RAISE EXCEPTION 'Materialized view was not created!';
  END IF;

  IF v_function_count < 5 THEN
    RAISE EXCEPTION 'Not all functions were created!';
  END IF;

  RAISE NOTICE '=== ✅ Migration completed successfully! ===';
END $$;
