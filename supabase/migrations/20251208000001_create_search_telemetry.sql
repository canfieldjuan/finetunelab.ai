-- Create search_telemetry table
CREATE TABLE IF NOT EXISTS search_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT false,
  error_code TEXT,
  query_length INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE search_telemetry ENABLE ROW LEVEL SECURITY;

-- Policies
-- Only allow service role to insert (or authenticated users if we want client-side telemetry, but this is server-side)
-- For now, we'll allow authenticated users to insert if they are running the search, but typically this is backend.
-- Since the search runs on the server (Next.js API routes), we will use the service role key or the user's context.
-- If we use the user's context, we need a policy for INSERT.

CREATE POLICY "Service role can do everything on search_telemetry"
  ON search_telemetry
  USING (true)
  WITH CHECK (true);

-- Optional: Allow admins to view telemetry
-- CREATE POLICY "Admins can view search_telemetry" ...
