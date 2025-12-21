-- Budget Tracking System (Category 4 Phase 3)
-- Allows users to set spending limits and receive alerts

-- Create budget_settings table
CREATE TABLE IF NOT EXISTS public.budget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_type TEXT NOT NULL CHECK (budget_type IN ('daily', 'weekly', 'monthly')),
  budget_limit_usd NUMERIC(10, 2) NOT NULL CHECK (budget_limit_usd > 0),
  alert_threshold_percent INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold_percent > 0 AND alert_threshold_percent <= 100),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, budget_type)
);

-- Create index on user_id for fast lookups
CREATE INDEX idx_budget_settings_user_id ON public.budget_settings(user_id);
CREATE INDEX idx_budget_settings_enabled ON public.budget_settings(user_id, enabled);

-- Enable RLS
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own budget settings
CREATE POLICY budget_settings_user_policy ON public.budget_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.budget_settings IS 'User budget limits and alert thresholds for cost tracking';
COMMENT ON COLUMN public.budget_settings.budget_type IS 'Budget period: daily, weekly, or monthly';
COMMENT ON COLUMN public.budget_settings.budget_limit_usd IS 'Maximum spend allowed in USD for the period';
COMMENT ON COLUMN public.budget_settings.alert_threshold_percent IS 'Percentage of budget at which to trigger alerts (default 80%)';
COMMENT ON COLUMN public.budget_settings.enabled IS 'Whether this budget limit is currently active';
