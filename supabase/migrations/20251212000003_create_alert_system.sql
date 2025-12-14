-- Migration: Create Alert System Tables
-- Date: 2025-12-12
-- Description: User alert preferences, webhooks, and alert history

-- Table: user_alert_preferences
CREATE TABLE IF NOT EXISTS user_alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email settings
  email_enabled BOOLEAN DEFAULT true,
  email_address TEXT,

  -- Training job alerts
  alert_job_started BOOLEAN DEFAULT false,
  alert_job_completed BOOLEAN DEFAULT true,
  alert_job_failed BOOLEAN DEFAULT true,
  alert_job_cancelled BOOLEAN DEFAULT false,

  -- Resource alerts
  alert_gpu_oom BOOLEAN DEFAULT true,
  alert_disk_warning BOOLEAN DEFAULT true,
  alert_timeout_warning BOOLEAN DEFAULT true,

  -- Scheduled reports
  daily_summary_enabled BOOLEAN DEFAULT false,
  daily_summary_hour INTEGER DEFAULT 9 CHECK (daily_summary_hour >= 0 AND daily_summary_hour <= 23),
  weekly_digest_enabled BOOLEAN DEFAULT false,
  weekly_digest_day INTEGER DEFAULT 1 CHECK (weekly_digest_day >= 0 AND weekly_digest_day <= 6),

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start INTEGER DEFAULT 22 CHECK (quiet_hours_start >= 0 AND quiet_hours_start <= 23),
  quiet_hours_end INTEGER DEFAULT 8 CHECK (quiet_hours_end >= 0 AND quiet_hours_end <= 23),
  timezone TEXT DEFAULT 'UTC',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Table: user_webhooks
CREATE TABLE IF NOT EXISTS user_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  url TEXT NOT NULL,
  webhook_type TEXT DEFAULT 'generic' CHECK (webhook_type IN ('slack', 'discord', 'generic')),
  secret TEXT,

  -- Alert subscriptions
  alert_job_started BOOLEAN DEFAULT false,
  alert_job_completed BOOLEAN DEFAULT true,
  alert_job_failed BOOLEAN DEFAULT true,
  alert_job_cancelled BOOLEAN DEFAULT false,
  alert_gpu_oom BOOLEAN DEFAULT true,
  alert_disk_warning BOOLEAN DEFAULT true,
  alert_timeout_warning BOOLEAN DEFAULT true,

  -- Status tracking
  enabled BOOLEAN DEFAULT true,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: alert_history
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  job_id UUID,

  -- Email delivery
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_message_id TEXT,
  email_error TEXT,

  -- Webhook delivery
  webhook_sent BOOLEAN DEFAULT false,
  webhook_sent_at TIMESTAMPTZ,
  webhook_id UUID REFERENCES user_webhooks(id) ON DELETE SET NULL,
  webhook_status_code INTEGER,
  webhook_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_alert_prefs_user ON user_alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON user_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_enabled ON user_webhooks(user_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_history_user_created ON alert_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_job ON alert_history(job_id) WHERE job_id IS NOT NULL;

-- RLS Policies
ALTER TABLE user_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- user_alert_preferences policies
CREATE POLICY "Users can view own alert preferences"
  ON user_alert_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert preferences"
  ON user_alert_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alert preferences"
  ON user_alert_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- user_webhooks policies
CREATE POLICY "Users can view own webhooks"
  ON user_webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhooks"
  ON user_webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
  ON user_webhooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks"
  ON user_webhooks FOR DELETE
  USING (auth.uid() = user_id);

-- alert_history policies
CREATE POLICY "Users can view own alert history"
  ON alert_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert history"
  ON alert_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role policy for alert_history (allows backend to insert)
CREATE POLICY "Service role can insert alert history"
  ON alert_history FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_user_alert_preferences_updated_at ON user_alert_preferences;
CREATE TRIGGER update_user_alert_preferences_updated_at
  BEFORE UPDATE ON user_alert_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_webhooks_updated_at ON user_webhooks;
CREATE TRIGGER update_user_webhooks_updated_at
  BEFORE UPDATE ON user_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC function for atomic webhook failure increment
CREATE OR REPLACE FUNCTION increment_webhook_failure(webhook_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_webhooks
  SET
    failure_count = failure_count + 1,
    last_failure_at = NOW()
  WHERE id = webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE user_alert_preferences IS 'User preferences for email alerts and notifications';
COMMENT ON TABLE user_webhooks IS 'User-configured webhook endpoints for alerts';
COMMENT ON TABLE alert_history IS 'Log of all sent alerts with delivery status';
