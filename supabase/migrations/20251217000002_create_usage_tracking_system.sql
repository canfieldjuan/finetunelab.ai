-- ============================================================================
-- Migration: Create Usage Tracking System (Safe Version)
-- Created: 2025-12-17
-- Purpose: Implement comprehensive usage tracking for resource limits
--
-- SAFETY: This version checks if subscription tables exist before using them
-- If subscription tables don't exist, functions return safe defaults
-- ============================================================================

-- ============================================================================
-- TABLE: usage_events
-- Purpose: Store all raw usage events for all metric types
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metric information
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 1,

  -- Resource context (optional - links to specific resource)
  resource_type TEXT,  -- 'batch_test', 'message', 'training_job', 'scheduled_eval', 'inference'
  resource_id UUID,    -- ID of the specific resource

  -- Flexible metadata for additional context
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Period tracking (for monthly aggregation)
  -- period_month format: YYYYMM (e.g., 202512 for December 2025)
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for usage_events
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usage_events_user_period
  ON public.usage_events(user_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_usage_events_metric_type
  ON public.usage_events(metric_type, user_id);

CREATE INDEX IF NOT EXISTS idx_usage_events_created
  ON public.usage_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_resource
  ON public.usage_events(resource_type, resource_id)
  WHERE resource_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_aggregation
  ON public.usage_events(user_id, metric_type, period_month, period_year);

-- ============================================================================
-- RLS POLICIES for usage_events
-- ============================================================================

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage events" ON public.usage_events;
CREATE POLICY "Users can view own usage events"
  ON public.usage_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- MATERIALIZED VIEW: current_usage_summary
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.current_usage_summary CASCADE;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_current_usage_summary_user_metric
  ON public.current_usage_summary(user_id, metric_type);

CREATE INDEX IF NOT EXISTS idx_current_usage_summary_metric
  ON public.current_usage_summary(metric_type);

-- ============================================================================
-- FUNCTION: refresh_current_usage_summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_current_usage_summary()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.current_usage_summary;
END;
$$;

COMMENT ON FUNCTION public.refresh_current_usage_summary() IS 'Refreshes the current_usage_summary materialized view.';

-- ============================================================================
-- FUNCTION: check_usage_limit (SAFE VERSION)
-- This version checks if subscription tables exist before querying them
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_usage_limit(
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
  v_subscription_tables_exist BOOLEAN;
BEGIN
  -- Get current usage from materialized view
  SELECT COALESCE(total_value, 0) INTO v_current
  FROM public.current_usage_summary
  WHERE current_usage_summary.user_id = p_user_id
    AND current_usage_summary.metric_type = p_metric_type;

  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  -- Check if subscription tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_subscriptions'
  ) INTO v_subscription_tables_exist;

  -- If subscription tables don't exist, allow everything (unlimited)
  IF NOT v_subscription_tables_exist THEN
    RETURN QUERY SELECT
      true::BOOLEAN as allowed,
      v_current as current_value,
      -1::NUMERIC as limit_value,
      -1::NUMERIC as percentage,
      -1::NUMERIC as remaining,
      true::BOOLEAN as is_unlimited;
    RETURN;
  END IF;

  -- Get user's active subscription plan limits (dynamic query to avoid compile-time dependency)
  EXECUTE format(
    'SELECT sp.limits FROM public.user_subscriptions us
     JOIN public.subscription_plans sp ON sp.id = us.plan_id
     WHERE us.user_id = $1 AND us.status = ''active''
     LIMIT 1'
  ) INTO v_plan_limits USING p_user_id;

  -- If no subscription found, allow unlimited (will be restricted by other means)
  IF v_plan_limits IS NULL THEN
    RETURN QUERY SELECT
      true::BOOLEAN as allowed,
      v_current as current_value,
      -1::NUMERIC as limit_value,
      -1::NUMERIC as percentage,
      -1::NUMERIC as remaining,
      true::BOOLEAN as is_unlimited;
    RETURN;
  END IF;

  -- Extract limit for this specific metric type
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

  -- -1 means unlimited
  IF v_limit = -1 THEN
    RETURN QUERY SELECT
      true::BOOLEAN as allowed,
      v_current as current_value,
      -1::NUMERIC as limit_value,
      -1::NUMERIC as percentage,
      -1::NUMERIC as remaining,
      true::BOOLEAN as is_unlimited;
    RETURN;
  END IF;

  -- Check if adding increment would exceed limit
  RETURN QUERY SELECT
    (v_current + p_increment <= v_limit)::BOOLEAN as allowed,
    v_current as current_value,
    v_limit as limit_value,
    CASE
      WHEN v_limit > 0 THEN ROUND((v_current / v_limit) * 100, 2)
      ELSE 0
    END as percentage,
    GREATEST(v_limit - v_current, 0) as remaining,
    false::BOOLEAN as is_unlimited;
END;
$$;

COMMENT ON FUNCTION public.check_usage_limit(UUID, TEXT, NUMERIC) IS 'Check if user can perform an action. Safe version that works even without subscription tables.';

-- ============================================================================
-- FUNCTION: record_usage
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_usage(
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

COMMENT ON FUNCTION public.record_usage(UUID, TEXT, NUMERIC, TEXT, UUID, JSONB) IS 'Record a usage event.';

-- ============================================================================
-- FUNCTION: get_usage_with_limits
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_usage_with_limits(p_user_id UUID)
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

  IF v_result = '{}'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_usage_with_limits(UUID) IS 'Get all usage metrics with limits for a user.';

-- ============================================================================
-- HELPER FUNCTION: get_current_period
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_period()
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

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.usage_events IS 'Raw usage events for all metered actions.';
COMMENT ON MATERIALIZED VIEW public.current_usage_summary IS 'Aggregated usage for current month.';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.check_usage_limit(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_with_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_period() TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
