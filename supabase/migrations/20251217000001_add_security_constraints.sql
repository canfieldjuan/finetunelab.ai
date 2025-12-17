-- Migration: Add Security Constraints for Scheduled Evaluations
-- Date: 2025-12-17
-- Description: Rate limiting, validation, and performance improvements

-- 1. Add function to check schedule limit per user
CREATE OR REPLACE FUNCTION check_schedule_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM scheduled_evaluations WHERE user_id = NEW.user_id AND is_active = true) >= 50 THEN
    RAISE EXCEPTION 'Maximum 50 active schedules per user exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Add trigger to enforce limit on INSERT
CREATE TRIGGER enforce_schedule_limit_insert
  BEFORE INSERT ON scheduled_evaluations
  FOR EACH ROW EXECUTE FUNCTION check_schedule_limit();

-- 3. Add trigger to enforce limit on UPDATE (when activating)
CREATE TRIGGER enforce_schedule_limit_update
  BEFORE UPDATE ON scheduled_evaluations
  FOR EACH ROW
  WHEN (OLD.is_active = false AND NEW.is_active = true)
  EXECUTE FUNCTION check_schedule_limit();

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedules_active_next_run
  ON scheduled_evaluations(next_run_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_schedules_user_active
  ON scheduled_evaluations(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule_id
  ON scheduled_evaluation_runs(scheduled_evaluation_id, triggered_at DESC);

-- 5. Add audit table for tracking changes
CREATE TABLE IF NOT EXISTS scheduled_evaluation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_evaluation_id UUID,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'toggled', 'executed')),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add RLS policies for audit table
ALTER TABLE scheduled_evaluation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON scheduled_evaluation_audit
  FOR SELECT
  USING (auth.uid() = user_id);

-- 7. Add function to log audit entries
CREATE OR REPLACE FUNCTION log_schedule_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO scheduled_evaluation_audit (scheduled_evaluation_id, user_id, action, old_values)
    VALUES (OLD.id, OLD.user_id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO scheduled_evaluation_audit (scheduled_evaluation_id, user_id, action, old_values, new_values)
    VALUES (NEW.id, NEW.user_id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO scheduled_evaluation_audit (scheduled_evaluation_id, user_id, action, new_values)
    VALUES (NEW.id, NEW.user_id, 'created', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Add audit triggers
CREATE TRIGGER schedule_audit_insert
  AFTER INSERT ON scheduled_evaluations
  FOR EACH ROW EXECUTE FUNCTION log_schedule_audit();

CREATE TRIGGER schedule_audit_update
  AFTER UPDATE ON scheduled_evaluations
  FOR EACH ROW EXECUTE FUNCTION log_schedule_audit();

CREATE TRIGGER schedule_audit_delete
  AFTER DELETE ON scheduled_evaluations
  FOR EACH ROW EXECUTE FUNCTION log_schedule_audit();

-- 9. Add comment for documentation
COMMENT ON TABLE scheduled_evaluation_audit IS 'Audit log for all scheduled evaluation changes';
COMMENT ON FUNCTION check_schedule_limit() IS 'Enforces maximum of 50 active schedules per user';
