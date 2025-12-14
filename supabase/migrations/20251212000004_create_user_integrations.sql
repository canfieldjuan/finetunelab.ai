-- User Integrations Table
-- Stores configuration for third-party integrations (Notion, etc.)
-- Date: 2025-12-12

CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Integration type: 'notion', 'linear', 'jira', 'teams', 'pagerduty', etc.
  integration_type TEXT NOT NULL,

  -- Human-readable name for this integration instance
  name TEXT NOT NULL DEFAULT '',

  -- Encrypted credentials stored as JSON
  -- For Notion: { "api_key": "...", "database_id": "..." }
  -- For Teams: { "webhook_url": "..." }
  -- etc.
  credentials JSONB NOT NULL DEFAULT '{}',

  -- Additional configuration options
  -- For Notion: { "log_job_started": true, "log_job_completed": true, ... }
  config JSONB NOT NULL DEFAULT '{}',

  -- Status
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One integration of each type per user (can be relaxed later)
  UNIQUE(user_id, integration_type)
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_type ON user_integrations(integration_type);

-- RLS Policies
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own integrations
CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON user_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all (for internal API)
CREATE POLICY "Service role full access"
  ON user_integrations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_integrations_updated_at();

-- Function to increment error count
CREATE OR REPLACE FUNCTION increment_integration_error(p_integration_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_integrations
  SET
    error_count = error_count + 1,
    updated_at = NOW()
  WHERE id = p_integration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_integrations TO authenticated;
GRANT EXECUTE ON FUNCTION increment_integration_error TO authenticated;
