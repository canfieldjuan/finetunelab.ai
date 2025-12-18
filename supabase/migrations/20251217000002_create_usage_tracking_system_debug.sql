-- ============================================================================
-- DEBUG VERSION - Find which line causes the error
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Starting Usage Tracking Migration ===';
END $$;

-- ============================================================================
-- STEP 1: Create usage_events table
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'STEP 1: Creating usage_events table...';
END $$;

CREATE TABLE IF NOT EXISTS public.usage_events (
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
  RAISE NOTICE 'STEP 1: ✅ usage_events table created';
END $$;

-- ============================================================================
-- STEP 2: Verify table was created
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE 'STEP 2: Verifying usage_events table...';

  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'usage_events'
    AND column_name = 'user_id';

  IF v_count > 0 THEN
    RAISE NOTICE 'STEP 2: ✅ user_id column exists in usage_events';
  ELSE
    RAISE EXCEPTION 'STEP 2: ❌ user_id column NOT FOUND in usage_events';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'STEP 3: Creating indexes...';
END $$;

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

DO $$
BEGIN
  RAISE NOTICE 'STEP 3: ✅ Indexes created';
END $$;

-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'STEP 4: Enabling RLS...';
END $$;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage events" ON public.usage_events;
CREATE POLICY "Users can view own usage events"
  ON public.usage_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  RAISE NOTICE 'STEP 4: ✅ RLS enabled';
END $$;

-- ============================================================================
-- STEP 5: Test query before creating materialized view
-- ============================================================================

DO $$
DECLARE
  v_test_count INTEGER;
BEGIN
  RAISE NOTICE 'STEP 5: Testing query for materialized view...';

  -- Test the exact query that will be in the materialized view
  SELECT COUNT(*) INTO v_test_count
  FROM (
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
    GROUP BY user_id, metric_type
  ) test_query;

  RAISE NOTICE 'STEP 5: ✅ Test query worked (% rows)', v_test_count;
END $$;

-- ============================================================================
-- STEP 6: Create materialized view
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'STEP 6: Creating materialized view...';
END $$;

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

DO $$
BEGIN
  RAISE NOTICE 'STEP 6: ✅ Materialized view created';
END $$;

-- ============================================================================
-- STEP 7: Create indexes on materialized view
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'STEP 7: Creating indexes on materialized view...';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_current_usage_summary_user_metric
  ON public.current_usage_summary(user_id, metric_type);

CREATE INDEX IF NOT EXISTS idx_current_usage_summary_metric
  ON public.current_usage_summary(metric_type);

DO $$
BEGIN
  RAISE NOTICE 'STEP 7: ✅ Indexes on materialized view created';
END $$;

-- ============================================================================
-- Final message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration completed successfully! ===';
END $$;
