-- Migration: Create training_agents table
-- Purpose: Track training agent status based on polling activity
-- Date: 2026-01-07

-- Create training_agents table to track agent connections
CREATE TABLE IF NOT EXISTS training_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,

  -- Agent information (populated on first poll)
  hostname TEXT,
  platform TEXT CHECK (platform IN ('linux', 'darwin', 'windows')),
  version TEXT,

  -- Status tracking (computed from last_poll_at)
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_poll_at TIMESTAMPTZ,

  -- Timestamps
  registered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata for extensibility
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Unique constraint: one agent_id per user
  CONSTRAINT unique_user_agent UNIQUE (user_id, agent_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_training_agents_user
ON training_agents(user_id);

CREATE INDEX IF NOT EXISTS idx_training_agents_agent
ON training_agents(agent_id);

CREATE INDEX IF NOT EXISTS idx_training_agents_status
ON training_agents(user_id, status);

-- Enable RLS
ALTER TABLE training_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own agents
CREATE POLICY "Users can view own agents"
ON training_agents FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own agents
CREATE POLICY "Users can insert own agents"
ON training_agents FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own agents
CREATE POLICY "Users can update own agents"
ON training_agents FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own agents
CREATE POLICY "Users can delete own agents"
ON training_agents FOR DELETE
USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE training_agents IS 'Tracks training agent connections and status based on polling activity';
COMMENT ON COLUMN training_agents.agent_id IS 'Unique agent identifier (format: agent_xxxxxxxxxxxx)';
COMMENT ON COLUMN training_agents.last_poll_at IS 'Last time this agent polled for jobs - used to determine online status';
COMMENT ON COLUMN training_agents.status IS 'Computed status: online if last_poll_at within 60 seconds, offline otherwise';

-- Verify table was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'training_agents'
  ) THEN
    RAISE EXCEPTION 'training_agents table was not created';
  END IF;

  RAISE NOTICE 'Migration successful: training_agents table created';
END $$;
