-- Workflow Checkpoints Table
-- Stores execution state snapshots for pause/resume functionality

CREATE TABLE IF NOT EXISTS workflow_checkpoints (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'time-based', 'job-completed', 'level-completed', 'before-critical')),
  state JSONB NOT NULL,
  job_configs JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  
  -- Indexes for performance
  CONSTRAINT workflow_checkpoints_trigger_check CHECK (trigger IN ('manual', 'time-based', 'job-completed', 'level-completed', 'before-critical'))
);

-- Index for fast lookup by execution_id
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_execution_id 
  ON workflow_checkpoints(execution_id);

-- Index for fast lookup by created_at (for retention enforcement)
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_created_at 
  ON workflow_checkpoints(created_at DESC);

-- Index for trigger-based queries
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_trigger 
  ON workflow_checkpoints(trigger);

-- Composite index for execution + created_at (for retention per execution)
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_execution_created 
  ON workflow_checkpoints(execution_id, created_at DESC);

-- Add RLS policies (assuming authentication is handled elsewhere)
ALTER TABLE workflow_checkpoints ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to checkpoints"
  ON workflow_checkpoints
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Users can read their own checkpoints (if user auth is added later)
-- CREATE POLICY "Users can read own checkpoints"
--   ON workflow_checkpoints
--   FOR SELECT
--   USING (auth.uid()::text = created_by);

COMMENT ON TABLE workflow_checkpoints IS 'Stores execution state snapshots for DAG workflow pause/resume functionality';
COMMENT ON COLUMN workflow_checkpoints.id IS 'Unique checkpoint identifier';
COMMENT ON COLUMN workflow_checkpoints.execution_id IS 'ID of the DAG execution being checkpointed';
COMMENT ON COLUMN workflow_checkpoints.name IS 'Human-readable checkpoint name';
COMMENT ON COLUMN workflow_checkpoints.trigger IS 'What triggered this checkpoint (manual, time-based, job-completed, level-completed, before-critical)';
COMMENT ON COLUMN workflow_checkpoints.state IS 'Serialized DAGExecution state (jobs, status, timestamps, outputs)';
COMMENT ON COLUMN workflow_checkpoints.job_configs IS 'Original job configurations for execution restoration';
COMMENT ON COLUMN workflow_checkpoints.metadata IS 'Additional metadata (user notes, system info, etc.)';
COMMENT ON COLUMN workflow_checkpoints.created_at IS 'Timestamp when checkpoint was created';
COMMENT ON COLUMN workflow_checkpoints.created_by IS 'User/system that created the checkpoint';
