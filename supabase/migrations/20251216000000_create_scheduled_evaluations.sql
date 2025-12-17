-- Migration: Create Scheduled Evaluations Tables
-- Created: 2025-12-16
-- Purpose: Enable recurring batch test evaluations with configurable schedules

-- ============================================================================
-- TABLE: scheduled_evaluations
-- Purpose: Store recurring evaluation schedule configurations
-- User Impact: Enables automated model monitoring
-- Breaking Changes: NONE (new table)
-- Dependencies: test_suites (FK), batch_test_runs (FK via last_run_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Schedule identification
  name TEXT NOT NULL,
  description TEXT,

  -- Schedule configuration
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('hourly', 'daily', 'weekly', 'custom')),
  cron_expression TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',

  -- Test configuration
  test_suite_id UUID NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  batch_test_config JSONB DEFAULT '{}'::jsonb,

  -- Status tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'cancelled') OR last_run_status IS NULL),
  last_run_id UUID,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  -- Alerting configuration
  alert_on_failure BOOLEAN NOT NULL DEFAULT true,
  alert_on_regression BOOLEAN NOT NULL DEFAULT false,
  regression_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 10.0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for scheduled_evaluations
CREATE INDEX IF NOT EXISTS idx_scheduled_evals_next_run
  ON public.scheduled_evaluations(next_run_at, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_evals_user
  ON public.scheduled_evaluations(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_scheduled_evals_suite
  ON public.scheduled_evaluations(test_suite_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_evals_created_at
  ON public.scheduled_evaluations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.scheduled_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own scheduled evaluations
CREATE POLICY "Users can view own scheduled evaluations"
  ON public.scheduled_evaluations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own scheduled evaluations
CREATE POLICY "Users can create own scheduled evaluations"
  ON public.scheduled_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own scheduled evaluations
CREATE POLICY "Users can update own scheduled evaluations"
  ON public.scheduled_evaluations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own scheduled evaluations
CREATE POLICY "Users can delete own scheduled evaluations"
  ON public.scheduled_evaluations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at (reuses existing function from test_suites)
CREATE TRIGGER scheduled_evaluations_updated_at
  BEFORE UPDATE ON public.scheduled_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_test_suites_updated_at();

-- ============================================================================
-- TABLE: scheduled_evaluation_runs
-- Purpose: Track history of scheduled evaluation executions
-- User Impact: Provides audit trail and trend analysis
-- Breaking Changes: NONE (new table)
-- Dependencies: scheduled_evaluations (FK), batch_test_runs (FK via batch_test_run_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_evaluation_id UUID NOT NULL REFERENCES public.scheduled_evaluations(id) ON DELETE CASCADE,
  batch_test_run_id UUID,

  -- Execution tracking
  status TEXT NOT NULL CHECK (status IN ('triggered', 'running', 'completed', 'failed', 'cancelled')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results summary (denormalized for quick queries)
  total_prompts INTEGER,
  successful_prompts INTEGER,
  failed_prompts INTEGER,
  avg_latency_ms NUMERIC(10,2),
  avg_quality_score NUMERIC(5,2),

  -- Regression detection (Phase 2 feature)
  regression_detected BOOLEAN NOT NULL DEFAULT false,
  regression_details JSONB,
  baseline_run_id UUID REFERENCES public.scheduled_evaluation_runs(id) ON DELETE SET NULL,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Audit timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for scheduled_evaluation_runs
CREATE INDEX IF NOT EXISTS idx_scheduled_eval_runs_schedule
  ON public.scheduled_evaluation_runs(scheduled_evaluation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_eval_runs_batch
  ON public.scheduled_evaluation_runs(batch_test_run_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_eval_runs_status
  ON public.scheduled_evaluation_runs(status, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_eval_runs_created_at
  ON public.scheduled_evaluation_runs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.scheduled_evaluation_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view runs for their own scheduled evaluations
CREATE POLICY "Users can view runs for own scheduled evaluations"
  ON public.scheduled_evaluation_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_evaluations
      WHERE scheduled_evaluations.id = scheduled_evaluation_runs.scheduled_evaluation_id
        AND scheduled_evaluations.user_id = auth.uid()
    )
  );

-- Note: No INSERT/UPDATE/DELETE policies - only system can create/modify runs
-- System operations use service role key which bypasses RLS
