-- Training Configs Table
-- Stores user-created training configurations for Tiny Tool Use
-- Date: 2025-10-16

CREATE TABLE IF NOT EXISTS training_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL,

  -- Config JSON
  config_json JSONB NOT NULL,

  -- Validation
  is_validated BOOLEAN DEFAULT false,
  validation_errors JSONB,

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_config_name UNIQUE (user_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_configs_user_id
  ON training_configs(user_id);

CREATE INDEX IF NOT EXISTS idx_training_configs_template_type
  ON training_configs(template_type);

CREATE INDEX IF NOT EXISTS idx_training_configs_created_at
  ON training_configs(created_at DESC);

-- RLS
ALTER TABLE training_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own configs" ON training_configs;
CREATE POLICY "Users can view their own configs"
  ON training_configs FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own configs" ON training_configs;
CREATE POLICY "Users can insert their own configs"
  ON training_configs FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own configs" ON training_configs;
CREATE POLICY "Users can update their own configs"
  ON training_configs FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own configs" ON training_configs;
CREATE POLICY "Users can delete their own configs"
  ON training_configs FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION set_training_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_training_configs_updated_at ON training_configs;
CREATE TRIGGER trg_training_configs_updated_at
  BEFORE UPDATE ON training_configs
  FOR EACH ROW
  EXECUTE FUNCTION set_training_configs_updated_at();

-- Verification
SELECT tablename FROM pg_tables WHERE tablename = 'training_configs';
