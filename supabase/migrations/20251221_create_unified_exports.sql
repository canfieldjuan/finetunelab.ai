/**
 * Unified Exports Table
 * Consolidates conversation_exports and analytics_exports into single table
 * Phase 1: Foundation
 *
 * This table stores all export types: conversation, analytics, trace, custom
 */

-- ============================================================================
-- Create unified_exports table
-- ============================================================================

CREATE TABLE IF NOT EXISTS unified_exports (
  -- Primary key
  id TEXT PRIMARY KEY,

  -- User information
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Export metadata
  export_type TEXT NOT NULL CHECK (export_type IN ('conversation', 'analytics', 'trace', 'custom')),
  format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'jsonl', 'markdown', 'txt', 'html', 'pdf')),

  -- File information
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_name TEXT NOT NULL,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('filesystem', 'supabase_storage', 's3')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  error_message TEXT,

  -- Download tracking
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Flexible data selector (stores request parameters as JSONB)
  data_selector JSONB NOT NULL,

  -- Export options (stores ExportOptions as JSONB)
  options JSONB,

  -- Export metadata (stores ExportMetadata as JSONB)
  metadata JSONB
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- Primary queries: user + status + created_at
CREATE INDEX IF NOT EXISTS idx_unified_exports_user_status_created
  ON unified_exports(user_id, status, created_at DESC);

-- Query by user + export type
CREATE INDEX IF NOT EXISTS idx_unified_exports_user_type
  ON unified_exports(user_id, export_type);

-- Cleanup queries: status + expires_at
CREATE INDEX IF NOT EXISTS idx_unified_exports_status_expires
  ON unified_exports(status, expires_at);

-- Direct lookup by ID (covered by primary key, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_unified_exports_id
  ON unified_exports(id);

-- Query expired exports for cleanup job
CREATE INDEX IF NOT EXISTS idx_unified_exports_expired
  ON unified_exports(expires_at)
  WHERE status = 'completed';

-- JSONB index for data_selector queries (if needed for analytics)
CREATE INDEX IF NOT EXISTS idx_unified_exports_data_selector_gin
  ON unified_exports USING GIN(data_selector);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE unified_exports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own exports
CREATE POLICY "Users can view their own exports"
  ON unified_exports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own exports
CREATE POLICY "Users can create their own exports"
  ON unified_exports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own exports (for download tracking)
CREATE POLICY "Users can update their own exports"
  ON unified_exports
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own exports
CREATE POLICY "Users can delete their own exports"
  ON unified_exports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all exports (for cleanup jobs)
CREATE POLICY "Service role can manage all exports"
  ON unified_exports
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Update updated_at timestamp on any update
CREATE OR REPLACE FUNCTION update_unified_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unified_exports_updated_at
  BEFORE UPDATE ON unified_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_exports_updated_at();

-- Trigger: Auto-expire exports
CREATE OR REPLACE FUNCTION auto_expire_unified_exports()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at <= NOW() AND NEW.status = 'completed' THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_expire_unified_exports
  BEFORE UPDATE ON unified_exports
  FOR EACH ROW
  WHEN (NEW.expires_at <= NOW() AND OLD.status = 'completed')
  EXECUTE FUNCTION auto_expire_unified_exports();

-- ============================================================================
-- Cleanup function (called by cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_unified_exports()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Update status to expired for completed exports past expiration
  UPDATE unified_exports
  SET status = 'expired'
  WHERE status = 'completed'
    AND expires_at <= NOW();

  -- Delete exports that have been expired for more than 7 days
  WITH deleted AS (
    DELETE FROM unified_exports
    WHERE status = 'expired'
      AND expires_at <= NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_unified_exports() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_unified_exports() TO service_role;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE unified_exports IS 'Unified export system - stores all export types (conversation, analytics, trace, custom)';

COMMENT ON COLUMN unified_exports.id IS 'Unique export identifier (format: exp_{timestamp}_{random})';
COMMENT ON COLUMN unified_exports.user_id IS 'User who created the export';
COMMENT ON COLUMN unified_exports.export_type IS 'Type of export: conversation, analytics, trace, or custom';
COMMENT ON COLUMN unified_exports.format IS 'Export format: csv, json, jsonl, markdown, txt, html, or pdf';
COMMENT ON COLUMN unified_exports.file_path IS 'Relative path to export file in storage';
COMMENT ON COLUMN unified_exports.file_size IS 'Size of export file in bytes';
COMMENT ON COLUMN unified_exports.file_name IS 'User-friendly file name';
COMMENT ON COLUMN unified_exports.storage_type IS 'Storage backend: filesystem, supabase_storage, or s3';
COMMENT ON COLUMN unified_exports.status IS 'Export status: pending, processing, completed, failed, or expired';
COMMENT ON COLUMN unified_exports.download_count IS 'Number of times export has been downloaded';
COMMENT ON COLUMN unified_exports.expires_at IS 'When the export expires and becomes unavailable';
COMMENT ON COLUMN unified_exports.data_selector IS 'JSONB: Export request parameters (polymorphic based on export_type)';
COMMENT ON COLUMN unified_exports.options IS 'JSONB: Export options (compression, theme, etc.)';
COMMENT ON COLUMN unified_exports.metadata IS 'JSONB: Export metadata (counts, date ranges, etc.)';

-- ============================================================================
-- Migration notes
-- ============================================================================

/*
MIGRATION STRATEGY:

Phase 1 (Current):
- Create unified_exports table
- New exports use this table

Phase 2-6 (Weeks 6-8):
- Dual-write: Write to BOTH old and new tables
- New APIs use unified_exports
- Old APIs still work with old tables

Phase 7 (Week 9):
- Migrate historical data from conversation_exports and analytics_exports
- Script: /scripts/migrate-to-unified-exports.ts

Phase 8-9 (Weeks 10-11):
- Deprecation warnings on old tables
- After 60 days: Drop conversation_exports and analytics_exports

BACKWARD COMPATIBILITY:
- Download endpoint checks unified_exports first
- Falls back to conversation_exports and analytics_exports if not found
- Zero downtime migration
*/
