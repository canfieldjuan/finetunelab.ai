-- Add ip_address to demo_model_configs for rate limiting
-- Date: 2025-12-26

ALTER TABLE demo_model_configs
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Index for IP-based lookups
CREATE INDEX IF NOT EXISTS idx_demo_model_configs_ip
ON demo_model_configs(ip_address);

-- Comment
COMMENT ON COLUMN demo_model_configs.ip_address IS 'Client IP address for rate limiting (1 active session per IP)';
