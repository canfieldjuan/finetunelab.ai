-- Add scopes column to user_api_keys for granular access control
-- Scopes: training, production, testing, all
-- Date: 2025-12-12

-- Add scopes column with default 'all' for backwards compatibility
ALTER TABLE user_api_keys
ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT ARRAY['all']::text[];

-- Add comment explaining the scopes
COMMENT ON COLUMN user_api_keys.scopes IS 'API key access scopes: training (metrics, predictions), production (ingest, traces, inference), testing (batch tests, evaluation), all (everything)';

-- Create index for scope queries
CREATE INDEX IF NOT EXISTS idx_user_api_keys_scopes ON user_api_keys USING GIN (scopes);

-- Update existing keys to have 'all' scope if null
UPDATE user_api_keys
SET scopes = ARRAY['all']::text[]
WHERE scopes IS NULL;

-- Add constraint to ensure scopes is not empty
ALTER TABLE user_api_keys
ADD CONSTRAINT check_scopes_not_empty
CHECK (array_length(scopes, 1) > 0);

-- Function to check if a key has a specific scope
CREATE OR REPLACE FUNCTION has_api_key_scope(key_scopes text[], required_scope text)
RETURNS boolean AS $$
BEGIN
  RETURN 'all' = ANY(key_scopes) OR required_scope = ANY(key_scopes);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update API key usage stats (called on each validated request)
CREATE OR REPLACE FUNCTION update_api_key_usage(p_key_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_api_keys
  SET
    request_count = COALESCE(request_count, 0) + 1,
    last_used_at = NOW()
  WHERE id = p_key_id;
END;
$$ LANGUAGE plpgsql;
