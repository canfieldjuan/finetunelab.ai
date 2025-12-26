-- Function to clean up expired demo sessions
CREATE OR REPLACE FUNCTION cleanup_expired_demo_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired sessions
  DELETE FROM demo_model_configs
  WHERE expires_at < NOW();
  
  -- Delete orphaned batch test runs (cascade should handle this, but good to be safe)
  DELETE FROM demo_batch_test_runs
  WHERE demo_session_id NOT IN (SELECT session_id FROM demo_model_configs);
  
  -- Delete orphaned batch test results
  DELETE FROM demo_batch_test_results
  WHERE demo_session_id NOT IN (SELECT session_id FROM demo_model_configs);
END;
$$;
