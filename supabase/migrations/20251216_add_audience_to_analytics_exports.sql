-- Create analytics_exports table with audience column
-- This table stores export records for analytics data
-- Created: December 16, 2025

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS analytics_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'pdf', 'html', 'report')),
  export_type TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  included_metrics JSONB,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_name TEXT NOT NULL,
  audience TEXT CHECK (audience IS NULL OR audience IN ('executive', 'engineering', 'onboarding', 'custom')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analytics_exports_user_id ON analytics_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_exports_created_at ON analytics_exports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_exports_expires_at ON analytics_exports(expires_at);
CREATE INDEX IF NOT EXISTS idx_analytics_exports_audience ON analytics_exports(audience) WHERE audience IS NOT NULL;

-- Add RLS policies
ALTER TABLE analytics_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exports"
  ON analytics_exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON analytics_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exports"
  ON analytics_exports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exports"
  ON analytics_exports FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE analytics_exports IS 'Stores analytics export records with download URLs and metadata';
COMMENT ON COLUMN analytics_exports.audience IS 'Template type used for report generation: executive (KPI summary), engineering (technical details), onboarding (educational guide), or custom';
COMMENT ON COLUMN analytics_exports.included_metrics IS 'JSON array of metric names included in the export';
COMMENT ON COLUMN analytics_exports.expires_at IS 'Expiration timestamp for the export file (typically 7 days from creation)';
