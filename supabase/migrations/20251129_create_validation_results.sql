-- Create validation_results table for storing model validation history
-- Date: 2025-11-29
-- Purpose: Store results from baseline validation checks during training
-- Related: Phase 4 - Regression Gates

CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning')),
  metrics JSONB NOT NULL DEFAULT '{}',
  baseline_comparisons JSONB NOT NULL DEFAULT '[]',
  failures TEXT[] DEFAULT '{}',
  warnings TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_results_model_name ON validation_results(model_name);
CREATE INDEX IF NOT EXISTS idx_validation_results_job_id ON validation_results(job_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_execution_id ON validation_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_created_at ON validation_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_results_status ON validation_results(status);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_validation_results_model_created 
ON validation_results(model_name, created_at DESC);

-- Enable RLS
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read validation results
CREATE POLICY "Authenticated users can view validation results"
ON validation_results
FOR SELECT
TO authenticated
USING (true);

-- RLS Policy: Service role can insert validation results
CREATE POLICY "Service role can insert validation results"
ON validation_results
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policy: Service role can update validation results
CREATE POLICY "Service role can update validation results"
ON validation_results
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE validation_results IS 'Stores validation results from model training regression gates. Used to track baseline comparisons and prevent bad models from reaching production.';
COMMENT ON COLUMN validation_results.execution_id IS 'DAG execution ID that triggered this validation';
COMMENT ON COLUMN validation_results.job_id IS 'Training job ID associated with this validation';
COMMENT ON COLUMN validation_results.model_name IS 'Name of the model being validated';
COMMENT ON COLUMN validation_results.model_version IS 'Version or checkpoint identifier';
COMMENT ON COLUMN validation_results.status IS 'Validation outcome: passed, failed, or warning';
COMMENT ON COLUMN validation_results.metrics IS 'JSON object containing all metrics that were validated';
COMMENT ON COLUMN validation_results.baseline_comparisons IS 'JSON array of baseline comparison results with pass/fail status';
COMMENT ON COLUMN validation_results.failures IS 'Array of failure messages for metrics that failed validation';
COMMENT ON COLUMN validation_results.warnings IS 'Array of warning messages for metrics that triggered warnings';
