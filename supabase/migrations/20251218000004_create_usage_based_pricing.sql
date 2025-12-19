-- ============================================================================
-- Migration: Usage-Based Pricing System
-- Created: 2025-12-18
-- Purpose: Implement two-meter + retention pricing model
--
-- Meters:
--   1. Root traces monitored (per 1,000)
--   2. Payload storage (GB overage beyond included KB/trace)
--   3. Retention period (multiplier on base cost)
--
-- Tables:
--   - usage_meters: Real-time usage tracking
--   - usage_commitments: Monthly minimum commitments
--   - usage_invoices: Generated monthly invoices
-- ============================================================================

-- ============================================================================
-- STEP 1: Create usage_meters table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Billing period
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  
  -- Meter 1: Root traces monitored
  root_traces_count INTEGER NOT NULL DEFAULT 0,
  
  -- Meter 2: Payload storage (in bytes, will convert to GB for billing)
  total_payload_bytes BIGINT NOT NULL DEFAULT 0,
  compressed_payload_bytes BIGINT NOT NULL DEFAULT 0,
  
  -- Retention configuration
  retention_days INTEGER NOT NULL DEFAULT 14,
  
  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_usage_meters_user_period UNIQUE (user_id, period_year, period_month)
);

CREATE INDEX idx_usage_meters_user_period
  ON public.usage_meters(user_id, period_year, period_month);

CREATE INDEX idx_usage_meters_last_updated
  ON public.usage_meters(last_updated_at DESC);

COMMENT ON TABLE public.usage_meters IS 'Real-time usage tracking for two-meter pricing model';
COMMENT ON COLUMN public.usage_meters.root_traces_count IS 'Number of root traces (top-level spans) monitored this period';
COMMENT ON COLUMN public.usage_meters.total_payload_bytes IS 'Total payload size in bytes (uncompressed)';
COMMENT ON COLUMN public.usage_meters.compressed_payload_bytes IS 'Compressed payload size for billing calculations';

-- ============================================================================
-- STEP 2: Create usage_commitments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tier and minimum commitment
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'growth', 'business', 'enterprise')),
  minimum_monthly_usd NUMERIC(10, 2) NOT NULL,
  
  -- Pricing configuration (snapshot at commitment time)
  price_per_thousand_traces NUMERIC(10, 4) NOT NULL,
  included_traces INTEGER NOT NULL,
  included_kb_per_trace INTEGER NOT NULL,
  overage_price_per_gb NUMERIC(10, 4) NOT NULL,
  base_retention_days INTEGER NOT NULL,
  
  -- Volume discounts (Enterprise only)
  trace_commitment INTEGER,           -- Committed traces/month for discount
  discount_percent NUMERIC(5, 2),     -- % discount earned
  
  -- Stripe integration
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  
  -- Period
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_usage_commitments_user_active UNIQUE (user_id, status)
);

CREATE INDEX idx_usage_commitments_user_status
  ON public.usage_commitments(user_id, status);

CREATE INDEX idx_usage_commitments_stripe_sub
  ON public.usage_commitments(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON TABLE public.usage_commitments IS 'User subscription commitments with pricing snapshots';
COMMENT ON COLUMN public.usage_commitments.trace_commitment IS 'Enterprise volume commitment for discount eligibility';

-- ============================================================================
-- STEP 3: Create usage_invoices table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES public.usage_commitments(id) ON DELETE SET NULL,
  
  -- Billing period
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  
  -- Usage metrics (snapshot)
  root_traces_count INTEGER NOT NULL,
  included_traces INTEGER NOT NULL,
  overage_traces INTEGER NOT NULL DEFAULT 0,
  
  total_payload_gb NUMERIC(12, 4) NOT NULL,
  included_payload_gb NUMERIC(12, 4) NOT NULL,
  overage_payload_gb NUMERIC(12, 4) NOT NULL DEFAULT 0,
  
  retention_days INTEGER NOT NULL,
  retention_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
  
  -- Cost breakdown (USD)
  base_minimum_cost NUMERIC(10, 2) NOT NULL,
  trace_overage_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payload_overage_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  retention_adjustment NUMERIC(10, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10, 2) NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(10, 2) NOT NULL,
  
  -- Stripe integration
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'failed', 'void')),
  paid_at TIMESTAMPTZ,
  
  -- Audit
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT uq_usage_invoices_user_period UNIQUE (user_id, period_year, period_month)
);

CREATE INDEX idx_usage_invoices_user_period
  ON public.usage_invoices(user_id, period_year, period_month);

CREATE INDEX idx_usage_invoices_status
  ON public.usage_invoices(status);

CREATE INDEX idx_usage_invoices_stripe_invoice
  ON public.usage_invoices(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON TABLE public.usage_invoices IS 'Monthly usage invoices with detailed cost breakdown';
COMMENT ON COLUMN public.usage_invoices.retention_multiplier IS 'Cost multiplier based on retention period (1.0 = base, higher = longer retention)';

-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

ALTER TABLE public.usage_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies: usage_meters
CREATE POLICY "Users can view their own usage meters"
  ON public.usage_meters
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all usage meters"
  ON public.usage_meters
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies: usage_commitments
CREATE POLICY "Users can view their own commitments"
  ON public.usage_commitments
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all commitments"
  ON public.usage_commitments
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies: usage_invoices
CREATE POLICY "Users can view their own invoices"
  ON public.usage_invoices
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all invoices"
  ON public.usage_invoices
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- STEP 5: Create functions for usage tracking
-- ============================================================================

-- Function: Increment root trace count
CREATE OR REPLACE FUNCTION public.increment_root_trace_count(
  p_user_id UUID,
  p_payload_bytes BIGINT DEFAULT 0,
  p_compressed_bytes BIGINT DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_period_month INTEGER;
  v_period_year INTEGER;
BEGIN
  -- Get current period
  v_period_month := EXTRACT(MONTH FROM NOW());
  v_period_year := EXTRACT(YEAR FROM NOW());
  
  -- Upsert usage meter
  INSERT INTO public.usage_meters (
    user_id,
    period_month,
    period_year,
    root_traces_count,
    total_payload_bytes,
    compressed_payload_bytes
  ) VALUES (
    p_user_id,
    v_period_month,
    v_period_year,
    1,
    p_payload_bytes,
    p_compressed_bytes
  )
  ON CONFLICT (user_id, period_year, period_month)
  DO UPDATE SET
    root_traces_count = usage_meters.root_traces_count + 1,
    total_payload_bytes = usage_meters.total_payload_bytes + p_payload_bytes,
    compressed_payload_bytes = usage_meters.compressed_payload_bytes + p_compressed_bytes,
    last_updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_root_trace_count IS 'Atomically increment root trace count and payload metrics for current billing period';

-- Function: Get current usage for user
CREATE OR REPLACE FUNCTION public.get_current_usage(p_user_id UUID)
RETURNS TABLE (
  period_month INTEGER,
  period_year INTEGER,
  root_traces INTEGER,
  payload_gb NUMERIC,
  compressed_payload_gb NUMERIC,
  retention_days INTEGER,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.period_month,
    um.period_year,
    um.root_traces_count,
    ROUND((um.total_payload_bytes::NUMERIC / 1073741824), 4) AS payload_gb,
    ROUND((um.compressed_payload_bytes::NUMERIC / 1073741824), 4) AS compressed_payload_gb,
    um.retention_days,
    um.last_updated_at
  FROM public.usage_meters um
  WHERE um.user_id = p_user_id
    AND um.period_month = EXTRACT(MONTH FROM NOW())
    AND um.period_year = EXTRACT(YEAR FROM NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate estimated monthly cost
CREATE OR REPLACE FUNCTION public.calculate_estimated_cost(p_user_id UUID)
RETURNS TABLE (
  base_minimum NUMERIC,
  trace_overage NUMERIC,
  payload_overage NUMERIC,
  retention_multiplier NUMERIC,
  estimated_total NUMERIC
) AS $$
DECLARE
  v_commitment RECORD;
  v_usage RECORD;
  v_traces_over INTEGER;
  v_payload_over NUMERIC;
  v_trace_cost NUMERIC;
  v_payload_cost NUMERIC;
  v_retention_mult NUMERIC;
  v_total NUMERIC;
BEGIN
  -- Get active commitment
  SELECT * INTO v_commitment
  FROM public.usage_commitments
  WHERE user_id = p_user_id
    AND status = 'active'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active commitment found for user %', p_user_id;
  END IF;
  
  -- Get current usage
  SELECT * INTO v_usage
  FROM public.get_current_usage(p_user_id);
  
  IF NOT FOUND THEN
    -- No usage this period
    RETURN QUERY SELECT 
      v_commitment.minimum_monthly_usd,
      0::NUMERIC,
      0::NUMERIC,
      1.0::NUMERIC,
      v_commitment.minimum_monthly_usd;
    RETURN;
  END IF;
  
  -- Calculate trace overage
  v_traces_over := GREATEST(0, v_usage.root_traces - v_commitment.included_traces);
  v_trace_cost := (v_traces_over::NUMERIC / 1000) * v_commitment.price_per_thousand_traces;
  
  -- Calculate payload overage
  v_payload_over := GREATEST(
    0,
    v_usage.compressed_payload_gb - ((v_usage.root_traces * v_commitment.included_kb_per_trace)::NUMERIC / 1048576)
  );
  v_payload_cost := v_payload_over * v_commitment.overage_price_per_gb;
  
  -- Retention multiplier (simplified - would need lookup table in production)
  v_retention_mult := CASE
    WHEN v_usage.retention_days <= v_commitment.base_retention_days THEN 1.0
    WHEN v_usage.retention_days <= 30 THEN 1.5
    WHEN v_usage.retention_days <= 60 THEN 2.0
    WHEN v_usage.retention_days <= 90 THEN 2.5
    ELSE 3.0
  END;
  
  -- Total cost
  v_total := v_commitment.minimum_monthly_usd + ((v_trace_cost + v_payload_cost) * v_retention_mult);
  
  RETURN QUERY SELECT
    v_commitment.minimum_monthly_usd,
    v_trace_cost,
    v_payload_cost,
    v_retention_mult,
    v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Create triggers
-- ============================================================================

-- Trigger: Auto-update updated_at on commitments
CREATE OR REPLACE FUNCTION update_usage_commitments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usage_commitments_updated_at_trigger
  BEFORE UPDATE ON public.usage_commitments
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_commitments_updated_at();

-- ============================================================================
-- STEP 7: Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Usage-Based Pricing Migration Complete ===';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ usage_meters (real-time tracking)';
  RAISE NOTICE '  ✓ usage_commitments (subscription tiers)';
  RAISE NOTICE '  ✓ usage_invoices (monthly billing)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  ✓ increment_root_trace_count() - Track usage';
  RAISE NOTICE '  ✓ get_current_usage() - Query current period';
  RAISE NOTICE '  ✓ calculate_estimated_cost() - Real-time estimates';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS enabled on all tables';
END $$;
