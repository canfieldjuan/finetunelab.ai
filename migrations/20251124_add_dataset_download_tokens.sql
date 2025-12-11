-- Dataset Download Tokens Table
-- Purpose: Temporary tokens for secure dataset downloads from RunPod pods
-- Date: 2025-11-24
-- Expires after 2 hours to prevent abuse

CREATE TABLE IF NOT EXISTS dataset_download_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_path TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dataset_download_tokens_token ON dataset_download_tokens(token);
CREATE INDEX idx_dataset_download_tokens_expires_at ON dataset_download_tokens(expires_at);
CREATE INDEX idx_dataset_download_tokens_user_id ON dataset_download_tokens(user_id);

-- RLS Policy
ALTER TABLE dataset_download_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tokens"
  ON dataset_download_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Auto-cleanup expired tokens (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_dataset_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM dataset_download_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE dataset_download_tokens IS 'Temporary time-limited tokens for secure dataset downloads from training pods';
COMMENT ON COLUMN dataset_download_tokens.token IS 'Cryptographically secure random token (base64url encoded)';
COMMENT ON COLUMN dataset_download_tokens.expires_at IS 'Token expiry timestamp (typically 2 hours from creation)';
COMMENT ON COLUMN dataset_download_tokens.used_at IS 'First usage timestamp (optional: can allow multiple uses)';
