-- Worker Agent System
-- Enables downloadable worker agents for Windows/macOS to send metrics/traces
-- Workers connect outbound-only (HTTPS + WebSocket) for security
-- Date: 2025-12-26

-- ============================================================================
-- PART 1: Extend API Key System with Worker Scope
-- ============================================================================

-- Add worker_id and worker_metadata columns to user_api_keys
ALTER TABLE user_api_keys
ADD COLUMN IF NOT EXISTS worker_id TEXT,
ADD COLUMN IF NOT EXISTS worker_metadata JSONB DEFAULT '{}'::jsonb;

-- Index for worker lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_worker_id
  ON user_api_keys(worker_id)
  WHERE worker_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN user_api_keys.worker_id IS
  'Unique worker identifier for worker-scoped API keys (format: wkr_xxxxxxxxxx)';
COMMENT ON COLUMN user_api_keys.worker_metadata IS
  'Worker metadata: hostname, platform, version, capabilities, etc.';

-- Update scopes constraint to include 'worker'
-- First drop the old constraint
ALTER TABLE user_api_keys
  DROP CONSTRAINT IF EXISTS check_scopes_not_empty;

-- Add new constraint that allows worker scope
ALTER TABLE user_api_keys
  ADD CONSTRAINT check_scopes_valid
  CHECK (
    scopes <@ ARRAY['all', 'training', 'production', 'testing', 'worker']::text[]
    AND array_length(scopes, 1) > 0
  );

-- Update the scopes comment
COMMENT ON COLUMN user_api_keys.scopes IS 'API key access scopes: training (metrics, predictions), production (ingest, traces), testing (batch tests), worker (worker agents), all (everything)';

-- ============================================================================
-- PART 2: Worker Registry Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.worker_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.user_api_keys(id) ON DELETE SET NULL,

  -- Worker information
  hostname TEXT NOT NULL,
  platform TEXT NOT NULL, -- windows, darwin, linux
  version TEXT NOT NULL,
  capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Status
  status TEXT NOT NULL DEFAULT 'offline', -- online, offline, error
  last_heartbeat TIMESTAMPTZ,
  last_command_at TIMESTAMPTZ,

  -- Metrics
  current_load INTEGER DEFAULT 0,
  max_concurrency INTEGER DEFAULT 1,
  total_commands_executed INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_status_valid CHECK (status IN ('online', 'offline', 'error')),
  CONSTRAINT check_platform_valid CHECK (platform IN ('windows', 'darwin', 'linux')),
  CONSTRAINT check_worker_id_format CHECK (worker_id ~ '^wkr_[a-z0-9]{16,32}$')
);

-- Indexes for worker_agents
CREATE INDEX idx_worker_agents_user_id ON public.worker_agents(user_id);
CREATE INDEX idx_worker_agents_status ON public.worker_agents(status);
CREATE INDEX idx_worker_agents_last_heartbeat ON public.worker_agents(last_heartbeat DESC);
CREATE INDEX idx_worker_agents_worker_id ON public.worker_agents(worker_id);

-- Comments
COMMENT ON TABLE public.worker_agents IS 'Registry of downloadable worker agents running on user machines';
COMMENT ON COLUMN public.worker_agents.worker_id IS 'Unique worker identifier (wkr_...)';
COMMENT ON COLUMN public.worker_agents.status IS 'Worker online status: online (connected), offline (disconnected), error (failed)';
COMMENT ON COLUMN public.worker_agents.capabilities IS 'Worker capabilities: trading, metrics, traces, analytics';

-- ============================================================================
-- PART 3: Worker Commands Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.worker_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT NOT NULL REFERENCES public.worker_agents(worker_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Command details
  command_type TEXT NOT NULL,
  params JSONB DEFAULT '{}'::jsonb,
  signature TEXT NOT NULL,
  timeout_seconds INTEGER DEFAULT 300,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, completed, failed, timeout
  result JSONB,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT check_command_status CHECK (
    status IN ('pending', 'executing', 'completed', 'failed', 'timeout')
  ),
  CONSTRAINT check_command_type CHECK (
    command_type IN ('start_trading', 'stop_trading', 'update_config', 'restart_agent', 'collect_diagnostics')
  ),
  CONSTRAINT check_timeout_range CHECK (timeout_seconds > 0 AND timeout_seconds <= 3600)
);

-- Indexes for worker_commands
CREATE INDEX idx_worker_commands_worker_id ON public.worker_commands(worker_id);
CREATE INDEX idx_worker_commands_user_id ON public.worker_commands(user_id);
CREATE INDEX idx_worker_commands_status ON public.worker_commands(status);
CREATE INDEX idx_worker_commands_created_at ON public.worker_commands(created_at DESC);
CREATE INDEX idx_worker_commands_status_worker_id ON public.worker_commands(status, worker_id)
  WHERE status IN ('pending', 'executing');

-- Comments
COMMENT ON TABLE public.worker_commands IS 'Commands sent to worker agents';
COMMENT ON COLUMN public.worker_commands.signature IS 'HMAC signature for command verification';
COMMENT ON COLUMN public.worker_commands.status IS 'Command execution status';

-- ============================================================================
-- PART 4: Worker Metrics Table (Time-Series Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.worker_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT NOT NULL REFERENCES public.worker_agents(worker_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metrics timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- System metrics
  cpu_percent FLOAT,
  memory_used_mb BIGINT,
  memory_total_mb BIGINT,
  disk_used_gb BIGINT,
  network_sent_mb BIGINT,
  network_recv_mb BIGINT,

  -- Application metrics
  trading_status TEXT,
  active_trades INTEGER,
  custom_metrics JSONB DEFAULT '{}'::jsonb,

  -- Record timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for worker_metrics
CREATE INDEX idx_worker_metrics_worker_id_timestamp
  ON public.worker_metrics(worker_id, timestamp DESC);
CREATE INDEX idx_worker_metrics_timestamp
  ON public.worker_metrics(timestamp DESC);
CREATE INDEX idx_worker_metrics_user_id
  ON public.worker_metrics(user_id);

-- Comments
COMMENT ON TABLE public.worker_metrics IS 'Time-series metrics from worker agents';
COMMENT ON COLUMN public.worker_metrics.timestamp IS 'Metric collection timestamp (from worker)';

-- ============================================================================
-- PART 5: Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all worker tables
ALTER TABLE public.worker_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Worker Agents Policies
-- ============================================================================

-- Users can view their own workers
CREATE POLICY "Users can view their own workers"
  ON public.worker_agents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own workers (during registration)
CREATE POLICY "Users can register workers"
  ON public.worker_agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workers
CREATE POLICY "Users can update their own workers"
  ON public.worker_agents FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own workers
CREATE POLICY "Users can delete their own workers"
  ON public.worker_agents FOR DELETE
  USING (auth.uid() = user_id);

-- Workers can update their own status (using API key auth, via service role)
-- This is handled in application code with service role client

-- ============================================================================
-- Worker Commands Policies
-- ============================================================================

-- Users can view commands for their workers
CREATE POLICY "Users can view their worker commands"
  ON public.worker_commands FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create commands for their workers
CREATE POLICY "Users can create worker commands"
  ON public.worker_commands FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.worker_agents
      WHERE worker_agents.worker_id = worker_commands.worker_id
      AND worker_agents.user_id = auth.uid()
    )
  );

-- Users can update their worker commands (to cancel, etc.)
CREATE POLICY "Users can update their worker commands"
  ON public.worker_commands FOR UPDATE
  USING (auth.uid() = user_id);

-- Workers can update command status (via service role in application)

-- ============================================================================
-- Worker Metrics Policies
-- ============================================================================

-- Users can view metrics for their workers
CREATE POLICY "Users can view their worker metrics"
  ON public.worker_metrics FOR SELECT
  USING (auth.uid() = user_id);

-- Workers can insert metrics (via service role in application)
-- No INSERT policy for authenticated users - metrics only added via API

-- ============================================================================
-- PART 6: Helper Functions
-- ============================================================================

-- Function to update worker heartbeat
CREATE OR REPLACE FUNCTION update_worker_heartbeat(p_worker_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.worker_agents
  SET
    last_heartbeat = NOW(),
    updated_at = NOW(),
    status = 'online'
  WHERE worker_id = p_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark worker as offline if no heartbeat in 90 seconds
CREATE OR REPLACE FUNCTION mark_stale_workers_offline()
RETURNS void AS $$
BEGIN
  UPDATE public.worker_agents
  SET
    status = 'offline',
    updated_at = NOW()
  WHERE
    status = 'online'
    AND last_heartbeat < NOW() - INTERVAL '90 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to timeout pending commands after their timeout duration
CREATE OR REPLACE FUNCTION timeout_expired_commands()
RETURNS void AS $$
BEGIN
  UPDATE public.worker_commands
  SET
    status = 'timeout',
    error_message = 'Command execution timeout exceeded',
    completed_at = NOW()
  WHERE
    status IN ('pending', 'executing')
    AND created_at < NOW() - (timeout_seconds || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_worker_metrics()
RETURNS void AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.worker_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % old worker metrics rows', deleted_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments on functions
COMMENT ON FUNCTION update_worker_heartbeat IS 'Updates worker last_heartbeat and sets status to online';
COMMENT ON FUNCTION mark_stale_workers_offline IS 'Marks workers offline if no heartbeat in 90 seconds (run periodically)';
COMMENT ON FUNCTION timeout_expired_commands IS 'Marks commands as timeout if they exceed their timeout duration (run periodically)';
COMMENT ON FUNCTION cleanup_old_worker_metrics IS 'Deletes metrics older than 30 days (run daily)';
