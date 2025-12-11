-- Phase 2.4: Human-in-the-Loop - Database Migration
-- Creates tables for approval requests and notifications

-- =============================================================================
-- Approval Requests Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Workflow context
  workflow_id UUID NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  execution_id UUID NOT NULL,
  
  -- Approval details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  context JSONB DEFAULT '{}',
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Valid statuses: 'pending', 'approved', 'rejected', 'timeout', 'escalated', 'cancelled'
  
  -- Requester information
  requested_by VARCHAR(255) NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Decision information
  decided_by VARCHAR(255),
  decided_at TIMESTAMPTZ,
  decision VARCHAR(50),
  comment TEXT,
  reason TEXT,
  
  -- Timeout configuration
  timeout_ms INTEGER NOT NULL DEFAULT 3600000, -- 1 hour default
  expires_at TIMESTAMPTZ NOT NULL,
  timeout_action VARCHAR(50) NOT NULL DEFAULT 'reject',
  -- Valid timeout actions: 'approve', 'reject', 'escalate'
  
  -- Notification configuration
  notify_users TEXT[], -- Array of user IDs to notify
  notify_channels TEXT[], -- Array of channels: 'slack', 'email', 'webhook', 'in-app'
  notify_roles TEXT[], -- Array of roles to notify
  notification_sent_at TIMESTAMPTZ,
  
  -- Policy configuration
  require_min_approvers INTEGER DEFAULT 1,
  allowed_approvers TEXT[], -- Restrict who can approve
  approvers TEXT[] DEFAULT '{}', -- Track actual approvers
  require_all_approvers BOOLEAN DEFAULT FALSE,
  
  -- Escalation configuration
  escalate_to_users TEXT[],
  escalation_level INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'approved', 'rejected', 'timeout', 'escalated', 'cancelled'
  )),
  CONSTRAINT valid_timeout_action CHECK (timeout_action IN (
    'approve', 'reject', 'escalate'
  )),
  CONSTRAINT valid_timeout CHECK (timeout_ms > 0),
  CONSTRAINT valid_min_approvers CHECK (require_min_approvers > 0)
);

-- Indexes for approval_requests
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow_id 
  ON approval_requests(workflow_id);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status 
  ON approval_requests(status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_expires_at 
  ON approval_requests(expires_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by 
  ON approval_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_decided_by 
  ON approval_requests(decided_by) 
  WHERE decided_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_execution_id 
  ON approval_requests(execution_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_status_expires 
  ON approval_requests(status, expires_at);

-- =============================================================================
-- Approval Notifications Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key to approval request
  approval_request_id UUID NOT NULL,
  
  -- Notification channel and recipient
  channel VARCHAR(50) NOT NULL,
  -- Valid channels: 'slack', 'email', 'webhook', 'in-app'
  recipient VARCHAR(255) NOT NULL,
  
  -- Delivery status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Valid statuses: 'pending', 'sent', 'failed', 'read'
  
  -- Delivery tracking
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Notification content
  subject VARCHAR(500),
  body TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- External IDs for tracking
  external_id VARCHAR(255), -- Slack message ID, email message ID, etc.
  external_url TEXT, -- Link to external notification
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_channel CHECK (channel IN (
    'slack', 'email', 'webhook', 'in-app'
  )),
  CONSTRAINT valid_notification_status CHECK (status IN (
    'pending', 'sent', 'failed', 'read'
  )),
  CONSTRAINT valid_retry_count CHECK (retry_count >= 0),
  
  -- Foreign key constraint (note: not enforcing cascade for flexibility)
  CONSTRAINT fk_approval_request 
    FOREIGN KEY (approval_request_id) 
    REFERENCES approval_requests(id) 
    ON DELETE CASCADE
);

-- Indexes for approval_notifications
CREATE INDEX IF NOT EXISTS idx_approval_notifications_request_id 
  ON approval_notifications(approval_request_id);

CREATE INDEX IF NOT EXISTS idx_approval_notifications_recipient 
  ON approval_notifications(recipient);

CREATE INDEX IF NOT EXISTS idx_approval_notifications_status 
  ON approval_notifications(status);

CREATE INDEX IF NOT EXISTS idx_approval_notifications_channel 
  ON approval_notifications(channel);

-- Composite index for retry logic
CREATE INDEX IF NOT EXISTS idx_approval_notifications_retry 
  ON approval_notifications(status, retry_count, created_at) 
  WHERE status = 'failed' AND retry_count < max_retries;

-- =============================================================================
-- Approval Audit Log Table (Optional - for detailed audit trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS approval_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Approval request reference
  approval_request_id UUID NOT NULL,
  
  -- Action details
  action VARCHAR(100) NOT NULL,
  -- Examples: 'created', 'approved', 'rejected', 'timeout', 'escalated', 'cancelled', 'commented'
  
  -- Actor information
  user_id VARCHAR(255),
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  
  -- Action data
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_approval_request_audit 
    FOREIGN KEY (approval_request_id) 
    REFERENCES approval_requests(id) 
    ON DELETE CASCADE
);

-- Indexes for approval_audit_log
CREATE INDEX IF NOT EXISTS idx_approval_audit_log_request_id 
  ON approval_audit_log(approval_request_id);

CREATE INDEX IF NOT EXISTS idx_approval_audit_log_user_id 
  ON approval_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_approval_audit_log_action 
  ON approval_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_approval_audit_log_created_at 
  ON approval_audit_log(created_at DESC);

-- =============================================================================
-- Trigger: Update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to approval_requests
DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON approval_requests;
CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to approval_notifications
DROP TRIGGER IF EXISTS update_approval_notifications_updated_at ON approval_notifications;
CREATE TRIGGER update_approval_notifications_updated_at
  BEFORE UPDATE ON approval_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get pending approvals for a user
CREATE OR REPLACE FUNCTION get_user_pending_approvals(p_user_id VARCHAR)
RETURNS TABLE (
  id UUID,
  workflow_id UUID,
  job_id VARCHAR,
  title VARCHAR,
  description TEXT,
  requested_by VARCHAR,
  requested_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  timeout_ms INTEGER,
  can_approve BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.workflow_id,
    ar.job_id,
    ar.title,
    ar.description,
    ar.requested_by,
    ar.requested_at,
    ar.expires_at,
    ar.timeout_ms,
    -- Check if user can approve
    CASE 
      WHEN ar.allowed_approvers IS NULL OR array_length(ar.allowed_approvers, 1) IS NULL THEN TRUE
      WHEN p_user_id = ANY(ar.allowed_approvers) THEN TRUE
      ELSE FALSE
    END AS can_approve
  FROM approval_requests ar
  WHERE ar.status = 'pending'
    AND ar.expires_at > NOW()
    AND (
      p_user_id = ANY(ar.notify_users)
      OR ar.allowed_approvers IS NULL
      OR p_user_id = ANY(ar.allowed_approvers)
    )
  ORDER BY ar.expires_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if approval has timed out
CREATE OR REPLACE FUNCTION check_approval_timeout(p_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_status VARCHAR;
BEGIN
  SELECT expires_at, status 
  INTO v_expires_at, v_status
  FROM approval_requests
  WHERE id = p_request_id;
  
  IF v_status = 'pending' AND v_expires_at < NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get approval statistics
CREATE OR REPLACE FUNCTION get_approval_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_requests BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  timeout_count BIGINT,
  pending_count BIGINT,
  avg_decision_time INTERVAL,
  avg_timeout_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
    COUNT(*) FILTER (WHERE status = 'timeout') AS timeout_count,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    AVG(decided_at - requested_at) FILTER (WHERE decided_at IS NOT NULL) AS avg_decision_time,
    AVG(timeout_ms)::NUMERIC AS avg_timeout_ms
  FROM approval_requests
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Row Level Security (RLS) - Optional, enable if needed
-- =============================================================================

-- Enable RLS on tables (commented out by default)
-- ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE approval_audit_log ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (customize based on your auth system)
-- CREATE POLICY approval_requests_select_policy ON approval_requests
--   FOR SELECT
--   USING (
--     requested_by = current_user 
--     OR current_user = ANY(notify_users)
--     OR current_user = ANY(allowed_approvers)
--   );

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE approval_requests IS 'Stores approval requests for human-in-the-loop workflows';
COMMENT ON TABLE approval_notifications IS 'Tracks notifications sent for approval requests';
COMMENT ON TABLE approval_audit_log IS 'Audit trail for all approval-related actions';

COMMENT ON COLUMN approval_requests.status IS 'Current status: pending, approved, rejected, timeout, escalated, cancelled';
COMMENT ON COLUMN approval_requests.timeout_action IS 'Action to take on timeout: approve, reject, escalate';
COMMENT ON COLUMN approval_requests.require_min_approvers IS 'Minimum number of approvals required';
COMMENT ON COLUMN approval_requests.require_all_approvers IS 'Whether all listed approvers must approve';

COMMENT ON FUNCTION get_user_pending_approvals(VARCHAR) IS 'Returns pending approvals that a user can see and approve';
COMMENT ON FUNCTION check_approval_timeout(UUID) IS 'Checks if an approval request has timed out';
COMMENT ON FUNCTION get_approval_statistics(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns approval statistics for a date range';

-- =============================================================================
-- Migration Complete
-- =============================================================================

-- Verify tables were created
DO $$
DECLARE
  v_approval_requests_exists BOOLEAN;
  v_approval_notifications_exists BOOLEAN;
  v_approval_audit_log_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'approval_requests'
  ) INTO v_approval_requests_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'approval_notifications'
  ) INTO v_approval_notifications_exists;
  
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'approval_audit_log'
  ) INTO v_approval_audit_log_exists;
  
  IF v_approval_requests_exists AND v_approval_notifications_exists AND v_approval_audit_log_exists THEN
    RAISE NOTICE 'Phase 2.4 database migration completed successfully!';
    RAISE NOTICE 'Tables created: approval_requests, approval_notifications, approval_audit_log';
    RAISE NOTICE 'Helper functions created: get_user_pending_approvals, check_approval_timeout, get_approval_statistics';
  ELSE
    RAISE EXCEPTION 'Migration failed: some tables were not created';
  END IF;
END $$;
