-- ============================================================================
-- STEP 1: DIAGNOSE - Run this first to see your current table structure
-- ============================================================================

SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 2: Based on the results above, choose the appropriate fix below
-- ============================================================================

-- FIX A: If you have camelCase columns (userId, fileName, etc.)
-- Uncomment and run these lines:

/*
ALTER TABLE documents RENAME COLUMN "userId" TO user_id;
ALTER TABLE documents RENAME COLUMN "fileName" TO filename;
ALTER TABLE documents RENAME COLUMN "fileType" TO file_type;
ALTER TABLE documents RENAME COLUMN "uploadPath" TO upload_path;
ALTER TABLE documents RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE documents RENAME COLUMN "updatedAt" TO updated_at;
*/

-- FIX B: If columns are missing, add them
-- Uncomment and run these lines:

/*
-- Add user_id if missing
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'unknown';

-- Add other missing columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS upload_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS neo4j_episode_ids TEXT[] DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
*/

-- FIX C: Start fresh (WARNING: This deletes ALL data!)
-- Only use this if you have no important data
-- Uncomment and run:

/*
DROP TABLE IF EXISTS documents CASCADE;

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'txt', 'md', 'docx')),
  upload_path TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  neo4j_episode_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_processed ON documents(processed);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
*/

-- ============================================================================
-- STEP 3: Verify the fix worked
-- ============================================================================

-- Check columns are correct now
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- Expected columns:
-- id, user_id, filename, file_type, upload_path, processed, 
-- neo4j_episode_ids, created_at, updated_at, metadata
