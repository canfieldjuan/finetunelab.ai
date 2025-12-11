-- DAG Audit Logs Table
-- Stores security and operational audit trail for DAG executions

CREATE TABLE IF NOT EXISTS dag_audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
  execution_id TEXT,
  job_id TEXT,
  user_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes for common queries
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dag_audit_logs_timestamp ON dag_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dag_audit_logs_execution_id ON dag_audit_logs(execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dag_audit_logs_event_type ON dag_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_dag_audit_logs_level ON dag_audit_logs(level);
CREATE INDEX IF NOT EXISTS idx_dag_audit_logs_user_id ON dag_audit_logs(user_id) WHERE user_id IS NOT NULL;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_dag_audit_logs_execution_level ON dag_audit_logs(execution_id, level, timestamp DESC) WHERE execution_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE dag_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role can do everything" ON dag_audit_logs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can read their own audit logs
CREATE POLICY "Users can read their own audit logs" ON dag_audit_logs
  FOR SELECT
  USING (
    auth.uid()::text = user_id OR
    EXISTS (
      SELECT 1 FROM dag_executions
      WHERE dag_executions.id = dag_audit_logs.execution_id
      AND dag_executions.user_id = auth.uid()
    )
  );

-- Policy: Service can insert audit logs
CREATE POLICY "Service can insert audit logs" ON dag_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE dag_audit_logs IS 'Audit trail for all DAG execution operations and security events';
COMMENT ON COLUMN dag_audit_logs.id IS 'Unique identifier for the audit log entry';
COMMENT ON COLUMN dag_audit_logs.timestamp IS 'When the event occurred';
COMMENT ON COLUMN dag_audit_logs.event_type IS 'Type of event (execution.start, job.timeout, security.violation, etc.)';
COMMENT ON COLUMN dag_audit_logs.level IS 'Log level: info, warn, error, critical';
COMMENT ON COLUMN dag_audit_logs.execution_id IS 'ID of the DAG execution this event relates to';
COMMENT ON COLUMN dag_audit_logs.job_id IS 'ID of the job this event relates to (if applicable)';
COMMENT ON COLUMN dag_audit_logs.user_id IS 'ID of the user who initiated the action';
COMMENT ON COLUMN dag_audit_logs.details IS 'Event-specific details (error messages, resource usage, etc.)';
COMMENT ON COLUMN dag_audit_logs.metadata IS 'Additional metadata (system info, context, etc.)';

-- Grant permissions
GRANT SELECT, INSERT ON dag_audit_logs TO authenticated;
GRANT ALL ON dag_audit_logs TO service_role;
