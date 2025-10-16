-- Migration: Add metrics capture columns to messages table
-- Date: 2025-10-13
-- Phase: B.1 - Enhanced Metrics Capture
-- Description: Adds performance and tool tracking columns for ML training

-- Add metrics columns (all nullable for backward compatibility)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS tools_called JSONB,
ADD COLUMN IF NOT EXISTS tool_success BOOLEAN,
ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN,
ADD COLUMN IF NOT EXISTS error_type TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_tool_success
ON messages(tool_success) WHERE tool_success IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_error_type
ON messages(error_type) WHERE error_type IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN messages.latency_ms IS 'Response latency in milliseconds';
COMMENT ON COLUMN messages.input_tokens IS 'Number of input tokens sent to LLM';
COMMENT ON COLUMN messages.output_tokens IS 'Number of output tokens from LLM';
COMMENT ON COLUMN messages.tools_called IS 'JSON array of tools/functions called';
COMMENT ON COLUMN messages.tool_success IS 'Whether tool calls succeeded';
COMMENT ON COLUMN messages.fallback_used IS 'Whether model fell back instead of using tool';
COMMENT ON COLUMN messages.error_type IS 'Type of error if one occurred';

-- Verification queries (run after migration)
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'messages' AND column_name IN ('latency_ms', 'input_tokens', 'output_tokens', 'tools_called', 'tool_success', 'fallback_used', 'error_type');
-- SELECT COUNT(*) FROM messages;
