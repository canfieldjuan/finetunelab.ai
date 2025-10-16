-- Add metadata column to messages table
-- Date: October 13, 2025
-- Purpose: Store additional message metadata (tool calls, citations, etc.)

-- Add metadata column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for querying metadata
CREATE INDEX IF NOT EXISTS idx_messages_metadata
ON messages USING gin(metadata);

-- Add comment for documentation
COMMENT ON COLUMN messages.metadata IS 'JSON object containing message metadata (citations, tool_calls, context, etc.)';

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages'
      AND column_name = 'metadata'
  ) THEN
    RAISE EXCEPTION 'messages.metadata column not created';
  END IF;

  RAISE NOTICE 'messages.metadata column added successfully';
END $$;

-- Example metadata structure:
-- {
--   "citations": [
--     {"source": "document.pdf", "content": "...", "confidence": 0.95}
--   ],
--   "tool_calls": [
--     {"tool": "web_search", "query": "...", "result": "..."}
--   ],
--   "context": {
--     "graphrag_used": true,
--     "contexts_count": 3
--   }
-- }
