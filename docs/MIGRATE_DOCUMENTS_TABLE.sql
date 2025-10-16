-- ============================================================================
-- MIGRATION: Add missing columns to existing documents table
-- ============================================================================
-- Your current columns: id, file_name, document_hash, content, created_at, updated_at
-- Needed columns: user_id, filename, file_type, upload_path, processed, neo4j_episode_ids, metadata
-- ============================================================================

-- Step 1: Add the missing columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'default-user';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS upload_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS neo4j_episode_ids TEXT[] DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Step 2: Rename file_name to filename to match code expectations
ALTER TABLE documents RENAME COLUMN file_name TO filename;

-- Step 3: Populate file_type from filename extension (for existing rows)
UPDATE documents 
SET file_type = CASE 
  WHEN filename ILIKE '%.pdf' THEN 'pdf'
  WHEN filename ILIKE '%.txt' THEN 'txt'
  WHEN filename ILIKE '%.md' THEN 'md'
  WHEN filename ILIKE '%.docx' THEN 'docx'
  ELSE 'txt'
END
WHERE file_type IS NULL;

-- Step 4: Set upload_path based on document_hash (for existing rows)
UPDATE documents 
SET upload_path = CONCAT('documents/', id, '/', filename)
WHERE upload_path IS NULL;

-- Step 5: Add constraints
ALTER TABLE documents 
  ALTER COLUMN file_type SET NOT NULL,
  ALTER COLUMN upload_path SET NOT NULL;

ALTER TABLE documents 
  ADD CONSTRAINT documents_file_type_check 
  CHECK (file_type IN ('pdf', 'txt', 'md', 'docx'));

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Step 7: Verify the migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- Expected columns now:
-- id, filename, document_hash, content, created_at, updated_at,
-- user_id, file_type, upload_path, processed, neo4j_episode_ids, metadata
