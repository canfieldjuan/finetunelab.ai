-- Phase 5 Feature 1: Message Export & Archive System
-- Date: October 13, 2025
-- Purpose: Add export tracking and archive support to conversations

-- =====================================================
-- PART 1: Add Archive Support to Conversations Table
-- =====================================================

-- Add archive columns to existing conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- Create index for filtering archived conversations
CREATE INDEX IF NOT EXISTS idx_conversations_archived
ON conversations(user_id, archived)
WHERE archived = false; -- Partial index for active conversations

-- Add comment for documentation
COMMENT ON COLUMN conversations.archived IS 'Soft delete flag - true if conversation is archived';
COMMENT ON COLUMN conversations.archived_at IS 'Timestamp when conversation was archived';
COMMENT ON COLUMN conversations.archived_by IS 'User who archived the conversation';

-- =====================================================
-- PART 2: Create Conversation Exports Tracking Table
-- =====================================================

-- Table to track all export operations
CREATE TABLE IF NOT EXISTS conversation_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Export details
  conversation_ids UUID[] NOT NULL, -- Array of conversation IDs included
  format TEXT NOT NULL CHECK (format IN ('pdf', 'markdown', 'json', 'txt', 'html')),

  -- File details
  file_path TEXT NOT NULL, -- Path to generated file
  file_size INTEGER, -- Size in bytes

  -- Options used for export
  export_options JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- When file should be deleted (optional)

  -- Metadata
  download_count INTEGER DEFAULT 0, -- Track number of downloads
  last_downloaded_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_exports_user_id
ON conversation_exports(user_id);

CREATE INDEX IF NOT EXISTS idx_exports_created_at
ON conversation_exports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exports_expires_at
ON conversation_exports(expires_at)
WHERE expires_at IS NOT NULL; -- Partial index for cleanup queries

-- Add comments for documentation
COMMENT ON TABLE conversation_exports IS 'Tracks all conversation export operations and generated files';
COMMENT ON COLUMN conversation_exports.conversation_ids IS 'Array of UUID conversation IDs included in this export';
COMMENT ON COLUMN conversation_exports.format IS 'Export format: pdf, markdown, json, txt, or html';
COMMENT ON COLUMN conversation_exports.file_path IS 'File system path to the generated export file';
COMMENT ON COLUMN conversation_exports.export_options IS 'JSON object containing export options (includeMetadata, dateRange, etc.)';
COMMENT ON COLUMN conversation_exports.expires_at IS 'When this export file should be automatically deleted';

-- =====================================================
-- PART 3: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on exports table
ALTER TABLE conversation_exports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own exports
CREATE POLICY "Users can view their own exports"
ON conversation_exports
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create their own exports
CREATE POLICY "Users can create their own exports"
ON conversation_exports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own exports (for download tracking)
CREATE POLICY "Users can update their own exports"
ON conversation_exports
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own exports
CREATE POLICY "Users can delete their own exports"
ON conversation_exports
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- PART 4: Helper Functions
-- =====================================================

-- Function to get user's archived conversations
CREATE OR REPLACE FUNCTION get_archived_conversations(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  message_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.created_at,
    c.archived_at,
    COUNT(m.id) as message_count
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.user_id = p_user_id
    AND c.archived = true
  GROUP BY c.id, c.title, c.created_at, c.archived_at
  ORDER BY c.archived_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_archived_conversations IS 'Returns all archived conversations for a user with message counts';

-- Function to clean up expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS TABLE (
  deleted_count INTEGER,
  freed_space_bytes BIGINT
) AS $$
DECLARE
  v_deleted_count INTEGER;
  v_freed_space BIGINT;
BEGIN
  -- Get total size before deletion
  SELECT COUNT(*), COALESCE(SUM(file_size), 0)
  INTO v_deleted_count, v_freed_space
  FROM conversation_exports
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

  -- Delete expired exports
  DELETE FROM conversation_exports
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

  RETURN QUERY SELECT v_deleted_count, v_freed_space;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_exports IS 'Deletes export records that have passed their expiration date';

-- Function to archive multiple conversations at once (bulk operation)
CREATE OR REPLACE FUNCTION archive_conversations(
  p_user_id UUID,
  p_conversation_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Archive conversations and return count
  UPDATE conversations
  SET
    archived = true,
    archived_at = NOW(),
    archived_by = p_user_id,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND id = ANY(p_conversation_ids)
    AND archived = false; -- Only archive if not already archived

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION archive_conversations IS 'Archives multiple conversations for a user (bulk operation)';

-- Function to restore archived conversations
CREATE OR REPLACE FUNCTION restore_conversations(
  p_user_id UUID,
  p_conversation_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Restore conversations and return count
  UPDATE conversations
  SET
    archived = false,
    archived_at = NULL,
    archived_by = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND id = ANY(p_conversation_ids)
    AND archived = true; -- Only restore if archived

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_conversations IS 'Restores archived conversations (bulk operation)';

-- =====================================================
-- PART 5: Verification Queries
-- =====================================================

-- Verify conversations table has new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations'
      AND column_name = 'archived'
  ) THEN
    RAISE EXCEPTION 'conversations.archived column not created';
  END IF;

  RAISE NOTICE 'conversations table updated successfully';
END $$;

-- Verify exports table was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'conversation_exports'
  ) THEN
    RAISE EXCEPTION 'conversation_exports table not created';
  END IF;

  RAISE NOTICE 'conversation_exports table created successfully';
END $$;

-- Verify RLS policies are enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversation_exports'
      AND policyname = 'Users can view their own exports'
  ) THEN
    RAISE EXCEPTION 'RLS policies not created for conversation_exports';
  END IF;

  RAISE NOTICE 'RLS policies created successfully';
END $$;

-- =====================================================
-- PART 6: Sample Usage Examples (For Testing)
-- =====================================================

-- Example 1: Archive a single conversation
-- SELECT archive_conversations(
--   'user-uuid-here',
--   ARRAY['conversation-uuid-here']::UUID[]
-- );

-- Example 2: Get all archived conversations for a user
-- SELECT * FROM get_archived_conversations('user-uuid-here');

-- Example 3: Restore archived conversations
-- SELECT restore_conversations(
--   'user-uuid-here',
--   ARRAY['conversation-uuid-here']::UUID[]
-- );

-- Example 4: Clean up expired exports
-- SELECT * FROM cleanup_expired_exports();

-- Example 5: Track an export
-- INSERT INTO conversation_exports (
--   user_id,
--   conversation_ids,
--   format,
--   file_path,
--   file_size,
--   expires_at
-- ) VALUES (
--   'user-uuid-here',
--   ARRAY['conv-uuid-1', 'conv-uuid-2']::UUID[],
--   'pdf',
--   '/tmp/exports/export_123.pdf',
--   1024000,
--   NOW() + INTERVAL '24 hours'
-- );

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- If you need to rollback these changes:
--
-- DROP FUNCTION IF EXISTS restore_conversations(UUID, UUID[]);
-- DROP FUNCTION IF EXISTS archive_conversations(UUID, UUID[]);
-- DROP FUNCTION IF EXISTS cleanup_expired_exports();
-- DROP FUNCTION IF EXISTS get_archived_conversations(UUID);
-- DROP TABLE IF EXISTS conversation_exports;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS archived;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS archived_at;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS archived_by;
