-- Create model_baselines table for storing baseline metrics
-- Date: 2025-11-29
-- Purpose: Store baseline metrics for model validation and regression detection
-- Related: Phase 4 - Regression Gates

CREATE TABLE IF NOT EXISTS model_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  version TEXT,
  metric_name TEXT NOT NULL,
  metric_category TEXT NOT NULL CHECK (metric_category IN ('accuracy', 'performance', 'quality', 'business')),
  baseline_value NUMERIC NOT NULL,
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('min', 'max', 'delta', 'ratio')),
  threshold_value NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  alert_enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_baselines_model_name ON model_baselines(model_name);
CREATE INDEX IF NOT EXISTS idx_model_baselines_version ON model_baselines(version);
CREATE INDEX IF NOT EXISTS idx_model_baselines_metric_name ON model_baselines(metric_name);
CREATE INDEX IF NOT EXISTS idx_model_baselines_created_at ON model_baselines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_baselines_severity ON model_baselines(severity);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_model_baselines_model_metric 
ON model_baselines(model_name, metric_name);

-- Composite index for version-specific queries
CREATE INDEX IF NOT EXISTS idx_model_baselines_model_version 
ON model_baselines(model_name, version) WHERE version IS NOT NULL;

-- Unique constraint to prevent duplicate baselines
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_baselines_unique_metric
ON model_baselines(model_name, COALESCE(version, ''), metric_name);

-- Enable RLS
ALTER TABLE model_baselines ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read baselines
CREATE POLICY "Authenticated users can view baselines"
ON model_baselines
FOR SELECT
TO authenticated
USING (true);

-- RLS Policy: Authenticated users can create baselines
CREATE POLICY "Authenticated users can create baselines"
ON model_baselines
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policy: Authenticated users can update baselines
CREATE POLICY "Authenticated users can update baselines"
ON model_baselines
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS Policy: Authenticated users can delete baselines
CREATE POLICY "Authenticated users can delete baselines"
ON model_baselines
FOR DELETE
TO authenticated
USING (true);

-- Add comments for documentation
COMMENT ON TABLE model_baselines IS 'Stores baseline metrics for model validation. Used in regression gates to prevent bad models from reaching production.';
COMMENT ON COLUMN model_baselines.model_name IS 'Name of the model this baseline applies to';
COMMENT ON COLUMN model_baselines.version IS 'Optional version identifier for version-specific baselines';
COMMENT ON COLUMN model_baselines.metric_name IS 'Name of the metric (e.g., accuracy, f1_score, latency_ms)';
COMMENT ON COLUMN model_baselines.metric_category IS 'Category: accuracy, performance, quality, or business';
COMMENT ON COLUMN model_baselines.baseline_value IS 'The baseline value to compare against';
COMMENT ON COLUMN model_baselines.threshold_type IS 'Type of threshold: min (>=), max (<=), delta (% change), ratio (multiplier)';
COMMENT ON COLUMN model_baselines.threshold_value IS 'Threshold value for validation (interpretation depends on threshold_type)';
COMMENT ON COLUMN model_baselines.severity IS 'Severity level: critical (blocks deployment), warning (alerts only), info (logged only)';
COMMENT ON COLUMN model_baselines.alert_enabled IS 'Whether to send alerts when this baseline is violated';
COMMENT ON COLUMN model_baselines.created_by IS 'User or system that created this baseline';
