-- Migration: Add agent polling columns to local_training_jobs
-- Purpose: Enable poll-based job dispatch for remote training agents
-- Date: 2026-01-07

-- Add agent_id column to track which agent claimed/is executing a job
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS agent_id TEXT;

-- Add claimed_at timestamp to track when agent claimed the job
ALTER TABLE local_training_jobs
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Create index for efficient polling queries
-- Agents poll for jobs where status='pending' and agent_id is null
CREATE INDEX IF NOT EXISTS idx_local_training_jobs_pending_unclaimed
ON local_training_jobs(user_id, status)
WHERE status = 'pending' AND agent_id IS NULL;

-- Create index for agent-specific queries
CREATE INDEX IF NOT EXISTS idx_local_training_jobs_agent_status
ON local_training_jobs(agent_id, status)
WHERE agent_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN local_training_jobs.agent_id IS 'ID of the training agent that claimed this job (format: agent_xxxx)';
COMMENT ON COLUMN local_training_jobs.claimed_at IS 'Timestamp when the agent claimed this job for execution';

-- Verify columns were added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'local_training_jobs' AND column_name = 'agent_id'
  ) THEN
    RAISE EXCEPTION 'agent_id column was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'local_training_jobs' AND column_name = 'claimed_at'
  ) THEN
    RAISE EXCEPTION 'claimed_at column was not created';
  END IF;

  RAISE NOTICE 'Migration successful: agent_id and claimed_at columns added to local_training_jobs';
END $$;
