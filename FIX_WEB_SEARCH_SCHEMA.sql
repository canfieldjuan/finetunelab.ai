-- 1. Create search_telemetry table
CREATE TABLE IF NOT EXISTS search_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT false,
  error_code TEXT,
  query_length INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on search_telemetry
ALTER TABLE search_telemetry ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can do everything on search_telemetry"
  ON search_telemetry
  USING (true)
  WITH CHECK (true);

-- 2. Add missing column to research_jobs
ALTER TABLE research_jobs 
ADD COLUMN IF NOT EXISTS collected_content JSONB DEFAULT '[]'::jsonb;
